import { Arch, build, Platform } from 'electron-builder';
import { parseTarget, stage } from './stage.mjs';

const target = parseTarget(process.argv.slice(2));
await stage(target);

const platform = Platform[target.platform === 'mac' ? 'MAC' : 'WINDOWS'];
await build({
  targets: platform.createTarget(undefined, Arch[target.arch]),
  publish: 'never',
});
