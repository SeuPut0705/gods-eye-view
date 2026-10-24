# Desktop app

Unsigned Electron packaging for MGEV (My God's Eye View). Nothing here is part
of the web app, and the root `package.json` does not depend on it.

The packaged app runs the same Vite dev server as `Start-Mac.command` and
`Start-Windows.bat`, bound to `127.0.0.1`, inside an Electron window, because
Provider Settings and every `/api` provider are dev-server middleware. The page
itself is a production build (`client/`, see `prebuilt-client.mjs`): the
server sends it as built instead of transforming the source on every launch.
Client-exposed keys are not baked into that build; the page reads them from
`/__mgev/env.js`, which the server writes from its current configuration, so a
key saved in Provider Settings applies after the usual restart and reload.
Everything the app writes (`.env`, caches, logs, window position) goes to
Electron's user data folder (`~/Library/Application Support/MGEV`,
`%APPDATA%\MGEV`) through `GEV_DATA_DIR`, never into the install.

## Build

```sh
cd desktop
npm ci
npm run dist                     # host platform and architecture
npm run dist -- --mac --x64      # or --mac --arm64, --win --x64
```

`npm run stage` alone assembles `desktop/.stage/`: the runtime source, the root
`package-lock.json` installed with `npm ci --omit=dev`, the page built into
`client/`, and only the packages the server imports (traced from
`vite.config.js` and `main.mjs`); the page's own packages live in the build.
A cross-architecture stage installs the host's packages for the build first,
then the target's. `GEV_RELEASE_VERSION` overrides the version, which defaults
to the root `package.json` version. Output lands in `desktop/release/` as
`MGEV-mac-arm64.dmg`, `MGEV-mac-x64.dmg` or `MGEV-win-x64.exe`.

Windows installers can only be built on Windows.

`icons/` is generated from `public/logo.svg` by `npm run icons` (needs the root
dependencies installed) and committed. Set `MGEV_DEVTOOLS=1` to get DevTools in
the View menu of a packaged build.

## Release

`.github/workflows/release.yml` builds macOS (Apple Silicon) and Windows (x64)
and publishes a GitHub release on every push to `main`.

Versions are `MAJOR.MINOR.PATCH`. `version` in `desktop/package.json` sets
`MAJOR.MINOR`; each release takes the next free `PATCH` for that pair
(`v1.0.0`, `v1.0.1`, ...). Bump `MINOR` for new features and `MAJOR` for
breaking changes by editing that field; the next release then starts at
`.0`. Asset names carry no version, so
`https://github.com/SeuPut0705/mgev/releases/latest/download/<asset>` always
points at the newest build.
