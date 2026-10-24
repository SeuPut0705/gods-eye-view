import fs from 'node:fs';
import path from 'node:path';

/**
 * The desktop app serves a production build of the page (`client/`, made by
 * stage.mjs) from the same Vite dev server the launchers run. The dev server
 * stays because Provider Settings, every `/api` provider and the voice
 * WebSocket proxy are dev-server middleware; only the page changes, so the
 * window no longer waits for Vite to transform hundreds of source modules.
 *
 * Client-exposed keys are `import.meta.env.*` defines, which a build would bake
 * in. The build reads them from globals instead, and ENV_SCRIPT sets those
 * globals from the running server's defines, which a Provider Settings save
 * refreshes through its server restart. The page keeps Vite's client, whose
 * reconnect after that restart is what reloads it.
 */

const ENV_PREFIX = 'import.meta.env.';
const ENV_SCRIPT = '/__mgev/env.js';

const envGlobal = (key) => `__MGEV_ENV_${key.slice(ENV_PREFIX.length)}__`;
const clientEnvKeys = (define) =>
  Object.keys(define ?? {}).filter((key) => key.startsWith(ENV_PREFIX));

/** The build's defines: each client-exposed value read from its global. */
export function runtimeEnvDefines(define) {
  return Object.fromEntries(
    clientEnvKeys(define).map((key) => [key, envGlobal(key)]),
  );
}

/** The script setting those globals to what the dev server would inline. */
function envScript(define) {
  return clientEnvKeys(define)
    .map(
      (key) =>
        `globalThis.${envGlobal(key)} = ${define[key] ?? 'undefined'};\n`,
    )
    .join('');
}

const pathnameOf = (url) => new URL(url ?? '/', 'http://localhost').pathname;

/** Vite plugin serving `clientDir` as the page on the dev server. */
export function prebuiltClientPlugin(clientDir) {
  const html = fs
    .readFileSync(path.join(clientDir, 'index.html'), 'utf8')
    .replace(
      /<head>/i,
      `<head>\n  <script src="${ENV_SCRIPT}"></script>\n  <script type="module" src="/@vite/client"></script>`,
    );
  return {
    name: 'mgev-prebuilt-client',
    enforce: 'post',
    config(config) {
      // Built files are served as they are, from Vite's public middleware.
      config.publicDir = clientDir;
      // Nothing is transformed, so nothing needs pre-bundling or watching.
      config.optimizeDeps = {
        ...config.optimizeDeps,
        include: [],
        noDiscovery: true,
      };
      config.server = { ...config.server, watch: null };
    },
    configureServer(server) {
      const send = (req, res, type, body, cacheControl) => {
        for (const [name, value] of Object.entries(
          server.config.server.headers ?? {},
        ))
          res.setHeader(name, value);
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', cacheControl);
        res.end(req.method === 'HEAD' ? undefined : body);
      };
      const sendDocument = (req, res) =>
        send(req, res, 'text/html; charset=utf-8', html, 'no-cache');
      const readable = (req) => req.method === 'GET' || req.method === 'HEAD';
      server.middlewares.use((req, res, next) => {
        if (!readable(req)) return next();
        const pathname = pathnameOf(req.url);
        if (pathname === ENV_SCRIPT)
          return send(
            req,
            res,
            'text/javascript; charset=utf-8',
            envScript(server.config.define),
            'no-store',
          );
        if (pathname === '/' || pathname === '/index.html')
          return sendDocument(req, res);
        next();
      });
      // Vite's history fallback rewrites other page navigations to /index.html.
      return () =>
        server.middlewares.use((req, res, next) => {
          if (readable(req) && pathnameOf(req.url) === '/index.html')
            return sendDocument(req, res);
          next();
        });
    },
  };
}
