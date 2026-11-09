# Publish to desktop

A game built for `tauri` runs as a desktop app: Tauri wraps the web build in the system's webview. Saves go to one
store file in the app's data folder, and Quit closes the app after the game's exit handlers and a save flush.

## Set up once

1. In `ship.config.ts`, set the app's reverse-DNS identifier, unique to the game. `create-game` writes a placeholder
   that you replace:

   ```ts
   tauri: { identifier: 'dev.example.my-game' },
   ```

   `tauri.icon` may name a square PNG of at least 512 px; without one, ship draws an icon.

2. Install Rust (`cargo`). On Linux, also install WebKitGTK 4.1 and libsoup 3 development packages (on Debian or
   Ubuntu: `libwebkit2gtk-4.1-dev` and `libsoup-3.0-dev`).
3. The game's dev dependency `@tauri-apps/cli`, written by `create-game`, is the Tauri CLI ship runs.

## Build and package

```sh
pnpm build:tauri && pnpm prepare:tauri
```

`prepare --target tauri` checks the build and the config, writes the Tauri project to `.automata/tauri/` (rewritten
on every run; never edit it), runs `tauri build` for this computer's OS and copies the bundles to `dist-tauri/`: a
`.deb` and an AppImage on Linux, an `.app` and a `.dmg` on macOS, NSIS and MSI installers on Windows. A missing tool is
named before anything is built.

## Publish to itch.io downloads

```sh
BUTLER_API_KEY=… pnpm exec automata ship publish --target itch --from tauri
```

Each bundle in `dist-tauri/` goes to its own butler channel (`linux`, `mac`, `windows`; `itch.downloads` renames
them). The game's `itch` section must be set, as in [Publish to itch.io](publish-to-itch.md).

## In CI, and signing

Tauri builds a bundle only for the computer it runs on, so build each one there: a Linux bundle on Linux, the macOS
bundle on a Mac, the Windows bundle on Windows. The release workflow `create-game` writes does not build them. These
bundles are unsigned; Tauri signs and notarizes the macOS bundle when the `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` environment
variables are set ([Tauri's guide](https://v2.tauri.app/distribute/sign/macos/)).
