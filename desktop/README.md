# Desktop app

Unsigned Electron packaging for God's Eye View. Nothing here is part of the web
app, and the root `package.json` does not depend on it.

The packaged app runs the same Vite dev server as `Start-Mac.command` and
`Start-Windows.bat`, bound to `127.0.0.1`, inside an Electron window. It runs the
dev server because Provider Settings and the client-exposed keys only exist
there. Everything the app writes (`.env`, caches, logs, the Vite cache) goes to
Electron's user data folder through `GEV_DATA_DIR`, never into the install.

## Build

```sh
cd desktop
npm ci
npm run dist                     # host platform and architecture
npm run dist -- --mac --x64      # or --mac --arm64, --win --x64
```

`npm run stage` alone assembles `desktop/.stage/`: the runtime source, the root
`package-lock.json`, and `npm ci --omit=dev` for the chosen platform and
architecture. `GEV_RELEASE_VERSION` overrides the version, which defaults to the
root `package.json` version. Output lands in `desktop/release/`.

Windows installers can only be built on Windows.

## Release

`.github/workflows/release.yml` builds macOS (arm64, x64) and Windows (x64) and
publishes a GitHub release on every push to `main`. The version is
`<root version>-seuput.<run number>`.
