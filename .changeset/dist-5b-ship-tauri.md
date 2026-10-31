---
"@mcthaydt/automata-ship": patch
---

`automata-ship prepare --target tauri` builds a game's desktop bundles for the OS it runs on (DIST.5b, DIST spec §6.2).
It runs these checks first, and each one that fails names what to change:
- the release tag;
- the new `tauri` section of `ship.config.ts` (`identifier`, an optional `icon`);
- a semver `game.version`;
- an `index.html` entry;
- a webview CSP without `'unsafe-eval'`;
- the public-build scans (secrets, `@pixi/3d`);
- the toolchain: `cargo`, WebKitGTK 4.1 on Linux, and the game's `@tauri-apps/cli`.

It then writes a Tauri project into `.automata/tauri/`. The crates are pinned exactly, the plugins are the store and
process ones the desktop adapter calls, and only those permissions are granted. It runs `tauri build` there and copies
each bundle to `dist-tauri/<id>-<version>-<os>-<kind>.<ext>`: Linux `deb` and `appimage`, macOS `dmg`, Windows `nsis`
and `msi`. The builds are unsigned; signing comes with the release job. New exports: `prepareTauri`, `TAURI_CLI`,
`TauriConfig`, `tauriConfigSchema`, and the errors `TauriBuildInvalid`, `TauriToolchainMissing` and `TauriBuildFailed`.
