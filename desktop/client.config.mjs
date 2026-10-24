// Build config for the desktop app's page, used by stage.mjs from inside the
// stage (`desktop/client.config.mjs` there). It is the app's own config with
// the client-exposed keys read at runtime instead of baked in.
import appConfig from '../vite.config.js';
import { runtimeEnvDefines } from './prebuilt-client.mjs';

export default async (env) => {
  const config =
    typeof appConfig === 'function' ? await appConfig(env) : appConfig;
  return {
    ...config,
    define: { ...config.define, ...runtimeEnvDefines(config.define) },
  };
};
