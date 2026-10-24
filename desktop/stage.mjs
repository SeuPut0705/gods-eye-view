import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(desktopDir, '..');
const stageDir = path.join(desktopDir, '.stage');

/** `public/` only feeds the client build and is removed after it. */
const SOURCE_DIRS = ['src', 'server', 'build', 'config', 'public'];
const SOURCE_FILES = [
  'index.html',
  'style.css',
  'vite.config.js',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'scripts/pinokio-environment.mjs',
  'scripts/google-server-key.mjs',
];
/** Files from this directory, copied to `desktop/` in the stage. */
const DESKTOP_FILES = [
  'main.mjs',
  'prebuilt-client.mjs',
  'splash.html',
  'client.config.mjs',
];
/** devDependencies the dev server needs at runtime: the config file imports
 * vite and vite-plugin-cesium, and the AIS feed loads ws lazily. */
const RUNTIME_DEV_DEPENDENCIES = ['vite', 'vite-plugin-cesium', 'ws'];
/** Packages the server loads without an import esbuild can follow. */
const UNTRACED_RUNTIME_PACKAGES = ['ws'];
/** Peers the server never imports: vite-plugin-cesium only names files under
 * cesium, and the page's Cesium is in the build. */
const PAGE_PEERS = new Set(['cesium']);
const PRODUCT_NAME = 'MGEV';
const CLIENT_DIR = 'client';

const PLATFORMS = { mac: 'darwin', win: 'win32' };
const HOST_PLATFORM = { darwin: 'mac', win32: 'win' }[process.platform];

/** `--mac|--win` and `--arm64|--x64`, defaulting to the host. */
export function parseTarget(argv) {
  const platform = argv.includes('--mac')
    ? 'mac'
    : argv.includes('--win')
      ? 'win'
      : HOST_PLATFORM;
  const arch = argv.includes('--arm64')
    ? 'arm64'
    : argv.includes('--x64')
      ? 'x64'
      : process.arch;
  if (!platform)
    throw new Error(`Unsupported host platform ${process.platform}`);
  if (!['arm64', 'x64'].includes(arch))
    throw new Error(`Unsupported architecture ${arch}`);
  return { platform, arch };
}

const isTestFile = (name) => /\.test\.[cm]?js$/.test(name);

function copySources() {
  const filter = (source) => {
    const name = path.basename(source);
    return (
      !isTestFile(name) && name !== '.DS_Store' && !name.startsWith('.gev-')
    );
  };
  for (const dir of SOURCE_DIRS)
    cpSync(path.join(repoRoot, dir), path.join(stageDir, dir), {
      recursive: true,
      filter,
    });
  for (const file of SOURCE_FILES) {
    const target = path.join(stageDir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repoRoot, file), target);
  }
  mkdirSync(path.join(stageDir, 'desktop'));
  for (const file of DESKTOP_FILES)
    copyFileSync(
      path.join(desktopDir, file),
      path.join(stageDir, 'desktop', file),
    );
}

function stagedPackage(root) {
  const version = process.env.GEV_RELEASE_VERSION || root.version;
  const dependencies = { ...root.dependencies };
  for (const name of RUNTIME_DEV_DEPENDENCIES)
    dependencies[name] = root.devDependencies[name];
  return {
    name: root.name,
    productName: PRODUCT_NAME,
    version,
    description: root.description,
    author: root.author,
    license: root.license,
    homepage: root.homepage,
    type: root.type,
    main: 'desktop/main.mjs',
    dependencies: Object.fromEntries(Object.entries(dependencies).sort()),
  };
}

function run(command, args, options = {}) {
  const npmCli = process.env.npm_execpath;
  const viaNode = command === 'npm' && npmCli?.endsWith('.js');
  const result = spawnSync(
    viaNode || command === 'node' ? process.execPath : command,
    viaNode ? [npmCli, ...args] : args,
    {
      cwd: stageDir,
      stdio: 'inherit',
      shell: command === 'npm' && !viaNode && process.platform === 'win32',
      ...options,
    },
  );
  if (result.status !== 0)
    throw new Error(`${command} ${args[0]} failed in the stage`);
}

/** `npm ci` for a platform and architecture; the host's when omitted. */
function installDependencies({ platform, arch } = {}) {
  run('npm', [
    'ci',
    '--omit=dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...(platform ? [`--os=${PLATFORMS[platform]}`, `--cpu=${arch}`] : []),
  ]);
}

/** Build the page into CLIENT_DIR without any key in it (see prebuilt-client.mjs). */
function buildClient() {
  // An empty data directory: the build must never read a stray .env.
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'mgev-build-'));
  try {
    run(
      'node',
      [
        path.join('node_modules', 'vite', 'bin', 'vite.js'),
        'build',
        '--config',
        path.join('desktop', 'client.config.mjs'),
        '--configLoader',
        'native',
        '--outDir',
        CLIENT_DIR,
        '--emptyOutDir',
        '--logLevel',
        'warn',
      ],
      { env: { ...process.env, GEV_DATA_DIR: dataDir } },
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

/** Packages the desktop main process and the dev server config import. */
async function tracedServerPackages() {
  const esbuildPath = createRequire(
    path.join(stageDir, 'package.json'),
  ).resolve('esbuild');
  const { build } = await import(pathToFileURL(esbuildPath).href);
  const { metafile } = await build({
    absWorkingDir: stageDir,
    entryPoints: ['vite.config.js', 'desktop/main.mjs'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    write: false,
    metafile: true,
    outdir: 'trace',
    logLevel: 'error',
    loader: { '.wasm': 'file', '.html': 'text' },
  });
  const packages = new Set();
  for (const { imports } of Object.values(metafile.inputs))
    for (const { path: specifier, external } of imports)
      if (external && !isBuiltin(specifier))
        packages.add(packageName(specifier));
  packages.delete('electron');
  return packages;
}

/**
 * Delete every installed package the server cannot reach from `roots`. The
 * page's own packages (Cesium, Mapillary, hls.js, ...) are in the build.
 */
function pruneDependencies(roots) {
  const modulesDir = path.join(stageDir, 'node_modules');
  const installed = JSON.parse(
    readFileSync(path.join(modulesDir, '.package-lock.json'), 'utf8'),
  ).packages;
  // Node's lookup: the nearest node_modules/<name> up from the importer.
  const resolve = (from, name) => {
    for (let dir = from; ;) {
      const candidate = `${dir ? `${dir}/` : ''}node_modules/${name}`;
      if (installed[candidate]) return candidate;
      if (!dir) return null;
      const parent = dir.lastIndexOf('/node_modules/');
      dir = parent < 0 ? '' : dir.slice(0, parent);
    }
  };
  const keep = new Set();
  const pending = [...roots].map((name) => {
    const found = resolve('', name);
    if (!found) throw new Error(`Runtime package ${name} is not installed`);
    return found;
  });
  while (pending.length) {
    const location = pending.pop();
    if (keep.has(location)) continue;
    keep.add(location);
    const { dependencies, optionalDependencies, peerDependencies } =
      installed[location];
    for (const name of [
      ...Object.keys({ ...dependencies, ...optionalDependencies }),
      ...Object.keys(peerDependencies ?? {}).filter(
        (name) => !PAGE_PEERS.has(name),
      ),
    ]) {
      // Optional and peer dependencies may be absent on purpose.
      const found = resolve(location, name);
      if (found) pending.push(found);
    }
  }
  let removed = 0;
  for (const location of Object.keys(installed)) {
    if (!location.startsWith('node_modules/') || keep.has(location)) continue;
    rmSync(path.join(stageDir, location), { recursive: true, force: true });
    removed++;
  }
  rmSync(path.join(modulesDir, '.bin'), { recursive: true, force: true });
  rmSync(path.join(modulesDir, '.package-lock.json'));
  const versions = Object.fromEntries(
    [...roots]
      .sort()
      .map((name) => [name, installed[`node_modules/${name}`].version]),
  );
  return { kept: keep.size, removed, versions };
}

/** Assemble desktop/.stage for one platform and architecture. */
export async function stage(target) {
  const root = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  );
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  copySources();
  const pkg = stagedPackage(root);
  writeFileSync(
    path.join(stageDir, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );
  copyFileSync(
    path.join(repoRoot, 'package-lock.json'),
    path.join(stageDir, 'package-lock.json'),
  );
  // The build and the trace run here, so they need the host's binaries.
  const crossBuild =
    target.platform !== HOST_PLATFORM || target.arch !== process.arch;
  installDependencies(crossBuild ? undefined : target);
  buildClient();
  const roots = await tracedServerPackages();
  for (const name of UNTRACED_RUNTIME_PACKAGES) roots.add(name);
  if (crossBuild) installDependencies(target);
  const { kept, removed, versions } = pruneDependencies(roots);
  // What the app depends on now, which electron-builder checks against.
  pkg.dependencies = versions;
  writeFileSync(
    path.join(stageDir, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );
  for (const leftover of [
    'package-lock.json',
    'public',
    path.join('desktop', 'client.config.mjs'),
  ])
    rmSync(path.join(stageDir, leftover), { recursive: true, force: true });
  console.log(
    `[stage] ${pkg.name}@${pkg.version} for ${target.platform}-${target.arch}: ` +
      `server packages ${Object.keys(versions).join(', ')}; ` +
      `${kept} packages kept, ${removed} removed`,
  );
  return pkg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await stage(parseTarget(process.argv.slice(2)));
