# Publish to desktop

A game built for `tauri` runs as a desktop app: Tauri wraps the web build in the system's webview. Saves go to one
store file in the app's data folder (on Linux `~/.local/share/<identifier>/saves.json`), never to the webview's page
storage. A save reaches the disk half a second after the game's last change to it, and at once on Quit and when the
player closes the window (after the game's exit handlers), so an app that crashes or is killed loses at most that half
second. A link in the game (the credits panel's, for one) opens in the player's own browser, never
inside the game's window. The generated project allows `https:` addresses only.

What has been proved, and where: on Linux (Ubuntu 24.04), a new game made from the published packages builds, opens,
saves and reads its save back, end to end (`pnpm --filter @automata/consumer-smoke test:desktop`, the desktop
journey). On macOS and Windows nothing has been built yet: the steps below are Tauri's, and they are unverified for
this framework until the first build on a Mac and on a Windows PC.

## Make a desktop game

```sh
pnpm dlx @automata/tools create-game my-game --targets tauri
cd my-game && pnpm install
```

A 3D game (`--template 3d`) cannot be built for the desktop yet: the 3D package is not published, and a desktop build
is a public one. It waits on the 3D release.

`--targets tauri` gives the game the `build:tauri` and `prepare:tauri` scripts, Tauri's packages and its CLI
(`@tauri-apps/cli`, a dev dependency). Add `web` or `itch` to the list (`--targets web,itch,tauri`) to keep those too.

In `ship.config.ts`, replace the placeholder identifier with the app's own reverse-DNS name, unique to the game; the
app's data folder is named after it:

```ts
tauri: { identifier: 'dev.example.my-game' },
```

`tauri.icon` may name a square PNG of at least 512 px; without one, ship draws an icon.

## Install the toolchain once

### Linux (measured on Ubuntu 24.04)

```sh
sudo apt-get update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

The first line matters on a machine whose package lists are old. The packages are Tauri 2's list
([its prerequisites](https://v2.tauri.app/start/prerequisites/#linux); other Linux distributions are there); they took 31
seconds to install. Then open a new terminal so it finds `cargo`.

The AppImage step downloads Tauri's AppImage tools from `github.com` on the first build; a machine that cannot reach it
still gets the `.deb`, and `tauri build` names the download that failed.

### macOS (unverified)

Xcode's command line tools (`xcode-select --install`), then Rust with the same `curl … | sh` line.

### Windows (unverified)

The Visual Studio Build Tools with the "Desktop development with C++" workload, WebView2 (already on Windows 10 and
11), then Rust: `winget install --id Rustlang.Rustup -e`.

## Build and package

```sh
pnpm build:tauri && pnpm prepare:tauri
```

`prepare --target tauri` checks the build and the config, then the toolchain, and only then writes the Tauri project to
`.automata/tauri/` (rewritten on every run; never edit it), runs `tauri build` for this computer's OS with its output
shown, and copies the bundles to `dist-tauri/`:

| OS | Bundles in `dist-tauri/` |
|---|---|
| Linux | `my-game-0.1.0-linux-deb.deb`, `my-game-0.1.0-linux-appimage.AppImage` |
| macOS | `my-game-0.1.0-macos-dmg.dmg` |
| Windows | `my-game-0.1.0-windows-nsis.exe`, `my-game-0.1.0-windows-msi.msi` |

Measured on Linux, a new game on a 4-core machine: the first build took about 4 minutes (3 m 18 s of it compiling Rust);
later builds reuse `.automata/tauri/src-tauri/target/` and take seconds. The `.deb` was 4.1 MB and the AppImage 82.7 MB
(it carries the webview's libraries).

A missing tool is named before anything is built, with the one command that installs it, for example:

```text
Rust is not installed, and a desktop build needs it. Install it with:
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
then run this again in a new terminal, so it finds cargo.
```

## Try it

On Linux, install the `.deb` (`sudo apt install ./dist-tauri/my-game-0.1.0-linux-deb.deb`, then start "My Game" from
the menu) or run the AppImage (`chmod +x` it first). Close the window to quit; the game's screens have no Quit button
on the desktop yet.

## Publish to itch.io downloads

```sh
BUTLER_API_KEY=… pnpm exec automata ship publish --target itch --from tauri
```

Each bundle in `dist-tauri/` goes to its own butler channel (`linux`, `mac`, `windows`; `itch.downloads` renames
them). The game's `itch` section must be set, as in [Publish to itch.io](publish-to-itch.md).

## In CI, and signing

Tauri builds a bundle only for the computer it runs on, so build each one there: a Linux bundle on Linux, the macOS
bundle on a Mac, the Windows bundle on Windows. The release workflow `create-game` writes does not build them.

These bundles are unsigned. A player sees a warning before an unsigned app opens: Gatekeeper on macOS, SmartScreen on
Windows. Tauri signs and notarises the macOS bundle when the `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` environment variables are set
([Tauri's guide](https://v2.tauri.app/distribute/sign/macos/)); that needs an Apple Developer account. Signing the
Windows installers needs a code-signing certificate, and `ship` does not yet write the certificate's settings into the
generated project ([Tauri's guide](https://v2.tauri.app/distribute/sign/windows/)).

## What a desktop build does not carry yet

The bundles hold the game and the app, and no file of third-party licence notices (the framework's packages, PixiJS,
Svelte, and the Rust crates Tauri is built from are MIT or Apache-2.0 licensed, and those licences ask for their notice
to travel with copies). Until `ship` writes one, add a credits or licences screen to the game by hand.
