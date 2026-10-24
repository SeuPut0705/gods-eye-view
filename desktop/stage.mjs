import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(desktopDir, '..');
const stageDir = path.join(desktopDir, '.stage');

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
/** devDependencies the dev server needs at runtime: the config file imports
 * vite and vite-plugin-cesium, and the AIS feed loads ws lazily. */
const RUNTIME_DEV_DEPENDENCIES = ['vite', 'vite-plugin-cesium', 'ws'];
const PRODUCT_NAME = "God's Eye View";

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
  copyFileSync(
    path.join(desktopDir, 'main.mjs'),
    path.join(stageDir, 'desktop-main.mjs'),
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
    main: 'desktop-main.mjs',
    dependencies: Object.fromEntries(Object.entries(dependencies).sort()),
  };
}

function installDependencies({ platform, arch }) {
  const args = [
    'ci',
    '--omit=dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    `--os=${PLATFORMS[platform]}`,
    `--cpu=${arch}`,
  ];
  const npmCli = process.env.npm_execpath;
  const viaNode = npmCli?.endsWith('.js');
  const result = spawnSync(
    viaNode ? process.execPath : 'npm',
    viaNode ? [npmCli, ...args] : args,
    {
      cwd: stageDir,
      stdio: 'inherit',
      shell: !viaNode && process.platform === 'win32',
    },
  );
  if (result.status !== 0) throw new Error('npm ci failed in the stage');
}

/** Assemble desktop/.stage for one platform and architecture. */
export function stage(target) {
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
  installDependencies(target);
  rmSync(path.join(stageDir, 'package-lock.json'));
  console.log(
    `[stage] ${pkg.name}@${pkg.version} for ${target.platform}-${target.arch}: ${Object.keys(pkg.dependencies).join(', ')}`,
  );
  return pkg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  stage(parseTarget(process.argv.slice(2)));
