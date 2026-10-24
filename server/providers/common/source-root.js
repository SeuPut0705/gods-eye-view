import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve defaultSourceRoot for ESM context. */
const defaultSourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

/**
 * Where the app writes its own state (`.env`, `.gev-logs`, the MCP panel key).
 * `GEV_DATA_DIR` moves it out of a read-only install such as a packaged
 * desktop app; unset, state stays beside the source it belongs to.
 */
function dataRoot(sourceRoot = defaultSourceRoot) {
  const dir = process.env.GEV_DATA_DIR;
  return dir ? path.resolve(dir) : sourceRoot;
}

export { defaultSourceRoot, dataRoot };
