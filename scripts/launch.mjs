#!/usr/bin/env node
// Double-click launch path shared by Start-Mac.command and Start-Windows.bat:
// install dependencies when the lockfile changed, check setup, start the dev
// server and open the default browser.
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from './project-root.mjs';
import {
  classifyNodeVersion,
  formatSetupReport,
  hasRequiredDependencies,
  inspectSetup,
  npmProcessSpec,
} from './setup-doctor.mjs';

const ROOT = projectRoot(import.meta.url);

function fail(message) {
  console.error(`\n[Launcher] ${message}`);
  process.exit(1);
}

function dependenciesStale() {
  // npm ci writes node_modules/.package-lock.json; a newer package-lock.json
  // means an update changed the dependency set since the last install.
  const installed = path.join(ROOT, 'node_modules', '.package-lock.json');
  if (!existsSync(installed) || !hasRequiredDependencies(ROOT)) return true;
  return statSync(path.join(ROOT, 'package-lock.json')).mtimeMs > statSync(installed).mtimeMs;
}

function installDependencies() {
  console.log('[Launcher] Installing dependencies (first run or after an update)...');
  const npm = npmProcessSpec(['ci']);
  const result = spawnSync(npm.command, npm.args, {
    cwd: ROOT,
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' },
    shell: npm.shell,
    stdio: 'inherit',
  });
  if (result.error) fail(`npm could not start: ${result.error.message}`);
  if (result.status !== 0) fail('Dependency install failed. See the npm output above.');
}

async function launch() {
  const node = classifyNodeVersion();
  if (node.level === 'error') {
    fail(`Node ${process.versions.node} is ${node.summary}. Get Node 24 LTS from https://nodejs.org/`);
  }

  if (dependenciesStale()) installDependencies();

  // The launcher does not import Keychain items (dev-fresh.sh does), so the
  // report describes only what this launch will actually see.
  const report = inspectSetup({ includeKeychain: false, rootDir: ROOT });
  console.log(`\n${formatSetupReport(report, { readyMessage: 'Ready. Opening your browser...' })}\n`);
  if (!report.ready) fail('Setup needs attention. See the report above.');

  process.chdir(ROOT);
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, server: { open: true } });
  await server.listen();
  server.printUrls();
  console.log('\n[Launcher] Keep this window open while you use the app. Close it or press Ctrl+C to stop.');

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await server.close();
      process.exit(0);
    });
  }
}

launch().catch((error) => fail(`Start failed: ${error.message}`));
