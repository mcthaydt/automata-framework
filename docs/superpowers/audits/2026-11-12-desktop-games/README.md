# Games as desktop apps: proved on Linux (ship list item 12, reading (a))

Session: `claude/desktop-games`, 2026-11-12, from `main` at the time of the branch. The Owner's words: "We ship with
3D, Editors, and Desktop Apps too", and on which desktop: "both". This is the first reading: a game made with the
framework, built as a desktop app. The ship audit (`claude/ship-readiness-audit`, section 3 and item 12) found the
`tauri` target written but never built: no Tauri CLI and no WebKitGTK in its container, no workflow that builds it.

**Progress: 7 of 7 items done as far as a Linux cloud box can go (100% of what can run here).** macOS and Windows
builds, signing and notarisation did not run: they need the Owner's machines and certificates.

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | Build it here | Done | The toolchain installs in 36 s; a bundle builds |
| 2 | The stranger's desktop path, from packed packages | Done (2D); 3D blocked by the 3D gate | Each step below; two product fixes, test first |
| 3 | Open it | Done | `stranger-desktop.test.ts` passes, 3 m 59 s |
| 4 | The host contract on desktop | Done; gaps listed | The shared contract suite, plus the real app |
| 5 | CI, as a proposal only | Done | [`proposed-desktop.yml`](proposed-desktop.yml), nothing under `.github/workflows/` |
| 6 | The guide and the messages | Done | [`publish-to-desktop.md`](../../../guides/publish-to-desktop.md); three messages rewritten, test first |
| 7 | Third-party licence notices | Finding, not fixed | Nothing writes notices, for web or desktop |

## 1. The Linux toolchain (Ubuntu 24.04.5, 4 cores; `cargo` and `rustc` 1.97.0 were already there)

The versions are the repository's own pins: `@tauri-apps/cli` 2.12.3 (`TAURI_CLI`), the crates `tauri` =2.12.4,
`tauri-build` =2.7.3 and the three plugins (`CRATE_PINS`), the npm packages `@tauri-apps/api` 2.12.4 and the plugins
`create-game` writes. Every command that was needed, in order:

```sh
apt-get update                                   # 4.6 s; the lists were stale
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf xdg-utils          # 31 s; WebKitGTK 2.52.6
# For the journey that opens the app (item 3) only:
apt-get install -y --no-install-recommends webkit2gtk-driver xvfb openbox wmctrl
cargo install tauri-driver@2.1.0 --locked        # 54 s
```

The first list is Tauri 2's Debian and Ubuntu prerequisites (<https://v2.tauri.app/start/prerequisites/#linux>) plus
`patchelf` and `xdg-utils`, installed up front for the AppImage step and not proved necessary on their own.
`xvfb` was already installed. No host was refused: the AppImage step downloads `AppRun` and `linuxdeploy` from
`github.com` on the first build, and crates come from `index.crates.io` and `static.crates.io`.

`tauri-driver` 2.1.0 was released 2026-09-26, the newest stable release at least 14 days old (`3.0.0-alpha.1` is a
pre-release).

## 2. The stranger's desktop path, from packed packages outside the workspace

Measured twice: by hand (folder `/tmp/af-stranger-…`, packs from `pnpm build`), then as the journey. The journey's
last run:

| Step | Command | Result | Time |
|---|---|---|---|
| Pack | `packPublished` (the consumer smoke's) | the published packages | 5.9 s |
| Make a game | `automata create-game my-game --targets tauri` | works | 3.7 s |
| Install | `pnpm install` with the packs as overrides | works | 3.5 s |
| Web build | `pnpm build:tauri` | works | 4.5 s |
| Desktop build | `pnpm prepare:tauri` (`automata ship prepare --target tauri`) | works, first time | 214.6 s cold (by hand: 3 m 58 s, 3 m 18 s of it `cargo build --release`) |
| Bundles | `dist-tauri/` | `my-game-0.1.0-linux-deb.deb` 4,135,294 bytes (4,126,952 to 4,135,330 over the builds measured: timestamps); `my-game-0.1.0-linux-appimage.AppImage` 82,688,504 bytes (82,680,312 by hand) | |

The `.deb` also installs (`apt install ./my-game-0.1.0-linux-deb.deb`: `/usr/bin/my-game`, the icon and
`My Game.desktop`; it depends on `libwebkit2gtk-4.1-0` and `libgtk-3-0`).

What broke, fixed in the product, each with a test that failed first (`prepare-tauri.test.ts`, 24 tests):

- **A missing `cargo` or `pkg-config` printed `could not run cargo: spawn cargo ENOENT`.** The checks treated only a
  non-zero exit as missing; a program not on the path fails to start instead, and the fake runner in the tests could
  not say that. The fake runner now can (`NOT_INSTALLED`), and the checks read "cannot start" as "missing"
  (`tauri-toolchain.ts`).
- **No web build printed `…/dist: ENOENT: no such file or directory, lstat …/dist`.** It now says
  `there is no web build in …/dist: run pnpm build:tauri first, then run this again`.

The 3D case: `create-game my-3d --template 3d --targets tauri` is accepted behind `AF_BETA_3D=1` (the gate the 3D
stranger's journey uses; not ungated here) and installs with `pack3d`'s packs. `pnpm build:tauri` then fails before
anything desktop runs: `vite.config.ts` imports `@automata/3d/figures`, and the packed `@automata/3d` is source only
(its `exports` name `src/entries/*.ts`, there is no `dist`), so Node refuses it
(`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). The same `vite.config.ts` serves the web build, so this is the 3D
package's publication (ship list item 10), not the desktop target. `prepare-tauri` would then refuse `@pixi/3d` in a
public build by design until Pixi 3D is public.

## 3. Open it

`tooling/consumer-smoke/tests/install/stranger-desktop.test.ts`, run with
`pnpm --filter @automata/consumer-smoke test:desktop` (its own Vitest config; never in `pnpm check`). After the build
above it unpacks the `.deb`, starts `Xvfb`, `openbox` and `tauri-driver` with the app's data, config and cache folders
inside the stranger's folder, and speaks W3C WebDriver with `fetch` (`src/desktop/webdriver.ts`, 5 unit tests). It
checks, in the real WebKitGTK webview:

1. the page reaches `data-state="ready"`, and `window.__TAURI_INTERNALS__` is there (the desktop app, not a browser);
2. the player picks Japanese on the first-run screen and the title shows;
3. the page's `localStorage` holds no locale key and no `ruken:` key (it holds the device's first-run flags,
   `my-game:automata.seen`, which are device storage by design: `seen-flags.ts`);
4. with no Quit and no close, `<XDG_DATA_HOME>/dev.example.my-game/saves.json` becomes exactly
   `{"automata.locale":"ja"}` on its own (the adapter writes a change to disk 500 ms after the last one), and the app is
   then killed (`SIGKILL`, so none of its exit handlers run);
5. a second start opens on the title in Japanese (`<html lang="ja">`) without asking;
6. the window is closed as a player closes it (the window manager's close, `wmctrl -c`), and the app quits.

Last run: `Test Files 1 passed (1)`, `Tests 1 passed (1)`, 3 m 59 s (`open the app: 0.2 s`, `the save reaches the disk
without a close: 0.5 s`, `open the app again: 0.2 s`, `close the window: 0.1 s`). Against the adapter before the
fix the same journey failed at step 4, `timed out waiting for the save on disk`. Before that step existed, five runs, no assertion failing in any: the 1st stopped in the test itself (`wmctrl` without `DISPLAY`, before the save checks ran); the
2nd and 4th failed removing the folder while the webview's helper still wrote Mesa's shader cache into it
(`ENOTEMPTY`); the 3rd passed after the background programs were stopped and waited for first; the 5th passed with
`rm` retrying as well. Each of those failures was the test's, fixed in the test.

Found on the way: **WebDriver's own "close window" bypasses Tauri's close request**: the app exits without the
adapter's handlers or flush, and nothing is saved. A player's close goes through the window manager, which is what the
journey sends.

## 4. The host contract on desktop

The tauri adapter already runs the shared `describeHostingContract` suite that the web and Ruken adapters and the
fake host pass (`hosting-tauri.test.ts`), plus its own cases (saves in the store, a store that will not load leaves
saves ungranted and refused `DENIED`, the close held until the handlers and the flush, the exit cap). Every capability:

| Capability | On desktop | Proved |
|---|---|---|
| lifecycle, input, display, audio | observed from the page, as on the web | contract suite; the real app reports `visibilityState: visible`, `AudioContext`, `getGamepads`, WebGL 2 |
| saves | the store file; refused `DENIED` if it will not load, never page storage | contract suite; the real app (item 3) |
| exit | granted: handlers, flush, quit | unit; the real app quits on a window close |
| links | the system browser (opener plugin, `https:` only) | unit; not clicked in the real app (no browser in the container) |
| fullscreen | the page's Element Fullscreen API | the real app: refused without a user gesture (`Cannot request fullscreen without transient activation`), on a click it fills the 1280 × 800 screen |
| leaderboards, entitlements | refused `UNSUPPORTED`, no local board | contract suite |
| menu request | no host menu on desktop; handlers are taken and given back | contract suite |

Fixed, test first (the coordinator's ruling on the first report):

- **Saves reached the disk only on exit.** The settings and the language were `saves.set` into the store, which was
  written only by `flush`: on Quit and on a window close. A crash or a kill lost them. The adapter now writes the
  store `SAVE_WRITE_DELAY_MS` (500 ms) after the last change, one write per burst; a flush in between takes its place,
  and dispose cancels it (`hosting-tauri.test.ts`, two new cases, red before the change). The journey kills the app
  after the change and finds the save (step 4 above).

Gaps, not fixed here:

- **No Quit on the desktop's screens.** `exit` is granted, but only the boot-failure panel offers it; the title and
  paused screens offer "Back to menu". A player quits by closing the window, which works. Asked for by the coordinator,
  and larger than it looks: every word on the default screens is translated into six languages
  (`packages/automata/src/app/screens/words/*.json`) with a hashed source record (`sources.json`) and context notes, so
  a new "Quit" needs five translations through that pipeline before the button (shown where `granted.has('exit')`,
  48 px, in the title's action bar) can land. The boot-failure panel's own "Quit" is not in that pipeline.
- **The `.deb`'s metadata**: `Maintainer: example` (taken from the identifier) and `Description: (none)`; the ship
  config has no description or publisher to give it.
- **macOS and Windows**: fullscreen, the close request and the store path are unproved there.

## 5. CI, as a proposal

[`proposed-desktop.yml`](proposed-desktop.yml): `workflow_dispatch` and nightly, three jobs, each the same journey.

| Job | Runner | Proves | Signing |
|---|---|---|---|
| `linux` | `vars.AF_LINUX_RUNNER` or `af-linux` | build, `.deb` and AppImage, and the app opens, saves, reads back and quits | none (Linux packages are not signed) |
| `macos` | `vars.AF_RELEASE_RUNNER` or `af-mac` | build, `.dmg` (the journey skips opening: WKWebView has no WebDriver) | when the six `APPLE_*` secrets exist |
| `windows` | `af-windows` (as `windows-trial.yml`, Git's bash) | build, NSIS `.exe` and `.msi` (opening needs Edge's WebDriver, not wired) | certificate imported when `WINDOWS_CERTIFICATE` exists |

How long: the Linux job's journey took 3 m 59 s to 4 m 19 s here on 4 cores, after `pnpm build` (34 s) and the packages above
(36 s, once per runner); `timeout-minutes: 30`.

What the Owner provides, to say yes:

- **macOS signing and notarisation** (an Apple Developer account, money): the six secrets Tauri reads,
  `APPLE_CERTIFICATE` (the Developer ID Application certificate as a base64 `.p12`), `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY` (for example `Developer ID Application: Name (TEAMID)`), `APPLE_ID`, `APPLE_PASSWORD` (an
  app-specific password) and `APPLE_TEAM_ID`. Tauri signs and notarises with them and needs no change in ship.
- **Windows signing** (a code-signing certificate, money; an OV or EV certificate from a certificate authority, or
  Azure Trusted Signing): `WINDOWS_CERTIFICATE` (the `.pfx` as base64) and `WINDOWS_CERTIFICATE_PASSWORD`. The job
  imports it; **ship must also write `bundle.windows.certificateThumbprint`, `digestAlgorithm` and `timestampUrl` into
  the generated `tauri.conf.json`** (or a `signCommand` for a cloud signer), which it does not today: a small product
  change once the Owner has chosen the certificate.
- The runners' prerequisites: on `af-linux`, `sudo` for the apt step or the packages installed once; on `af-mac`,
  Xcode's command line tools and Rust; on `af-windows`, the Visual Studio Build Tools' C++ workload and Rust
  (`winget install --id Rustlang.Rustup -e`).
- The yes itself: copy the file to `.github/workflows/desktop.yml`.

Risk on Windows, unproved: the consumer-smoke helpers start `pnpm` with `execFileSync` and no shell, which on Windows
needs `pnpm.cmd`; the web stranger's journey has the same shape and has not run on Windows either.

## 6. The guide and the messages

`docs/guides/publish-to-desktop.md` rewritten: making a desktop game, the Linux prerequisites as measured, macOS and
Windows marked unverified, the bundles per OS (the old text said macOS gives an `.app` and a `.dmg`; ship copies the
`.dmg` only), the measured build time and sizes, trying the `.deb`, the itch.io step, signing, and the missing notices.

The messages `ship prepare --target tauri` prints when a tool is missing, each tested to name the one command:

```text
Rust is not installed, and a desktop build needs it. Install it with:
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
then run this again in a new terminal, so it finds cargo.

The Linux desktop libraries (WebKitGTK 4.1 and the ones beside it) are not installed. On Debian or Ubuntu, install them with:
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
then run this again. Other Linux: https://v2.tauri.app/start/prerequisites/#linux

The Tauri command-line tool is not installed in this game. Install it with:
  pnpm add -D @tauri-apps/cli@2.12.3
then run this again.
```

On Windows the Rust line is `winget install --id Rustlang.Rustup -e`. The old WebKitGTK message named two packages (`libwebkit2gtk-4.1-dev libsoup-3.0-dev`); the build then fails to link
without the rest of Tauri's list. Not checked: Xcode's tools on macOS and the C++ build tools on Windows (unverified
there, so no message was written for them).

## 7. Third-party licence notices

Nothing in `ship` writes third-party notices, for the web build or the desktop one (kept as a finding on the
coordinator's ruling; not built). Measured on the stranger's game:
the 13 JavaScript chunks of `dist/assets/` hold no `@license` comment and no "MIT"; the `.deb` holds the binary, the
icon and the `.desktop` file only, and the binary embeds the web build. What a desktop game bundles, by the licences
their `package.json` files declare: `pixi.js` 8.22.0 MIT, `svelte` MIT, `zod` MIT, the framework's packages MIT,
`@tauri-apps/api` and the plugins `MIT OR Apache-2.0`, and for a 3D game `@pixi/3d` MIT; the binary also links some
hundreds of Rust crates (Tauri's, MIT or Apache-2.0 for the most part). MIT asks that its copyright and permission
notice travel with every copy. A notices step would need: the list of packages that reach the bundle (Vite's module
graph, not `package.json`, so dev-only packages stay out), each one's licence text from its package, the same for the
crates (`cargo about` or `cargo-license` over `.automata/tauri/src-tauri`), the font's OFL, one file written beside
the build (`dist/THIRD-PARTY-NOTICES.txt`) and, for the desktop, into the bundle as a resource, and a way to show it
(the credits screen). The font's OFL
text has the same problem (shared-polish implementation audit, S2). Reported, not invented: a notices step (for
example, collected at `vite build` and by `cargo about` for the crates) is a decision for the Owner.

## Gates

- `pnpm format`, before each commit.
- `TURBO_FORCE=true pnpm check`, uncached, after `git fetch origin main` and a rebase onto `main` `7b6ce6ace`: exit 0,
  19 m 51 s, on the first three commits (the toolchain messages, the journey, the docs).
- The adapter fix came after, on the coordinator's ruling, and ran its own gates: `pnpm lint`, the package's
  `typecheck` (0 errors), `pnpm boundaries`, `pnpm style`, `pnpm source-names`, `pnpm knip`, `pnpm check:changesets`
  (81, 0 problems), the framework's target unit tests (21 files, 217 tests), and the desktop journey (above). The whole
  uncached `pnpm check` did not run again after it.
- `pnpm build` (exit 0), `pnpm api-report` (0 breaks, 0 undeclared; `--update` changed nothing), `pnpm api-index`
  (`--write` changed nothing), `pnpm secrets` on the unshallowed history (no leaks).
- Changesets: `desktop-toolchain-messages.md` (`@automata/tools`, patch) and `desktop-saves-written-soon.md`
  (`@automata/framework`, patch).

## What did not run

- macOS and Windows builds, signing, notarisation, SmartScreen and Gatekeeper behaviour, real devices.
- The journey on the Owner's runners (it ran in this container only), and any workflow (none was added).
- The 3D desktop build (stopped by the 3D gate, above).
- Clicking a link in the real app (no browser in the container to receive it).

## For the tracker

The row this session added to `docs/superpowers/progress.md`, moved here verbatim on the coordinator's rule of 2026-11-12
(code branches carry no tracker edits; the coordinator gathers the rows). Two of its words are out of date: the journey
now kills the app before reading the save, and a Quit needed no new word (see the
[implementation audit](../2026-11-12-desktop-games-implementation-audit.md), S5 and N8).

| # | Workstream | Stage | Progress | Links |
|---|---|---|---|---|
| 7 | Games as desktop apps (the ship audit's item 12, reading (a); the Owner: "Desktop Apps too", "both") | Done 2026-11-12 on `claude/desktop-games`, as far as Linux goes, no subagents: the Tauri 2 toolchain installs in this container (36 s, every command recorded), and a game made from the packed packages with `create-game --targets tauri` builds with `ship prepare --target tauri` first time (230 s cold; `.deb` 4,135,330 bytes, AppImage 82,688,504 bytes). A new journey, `tooling/consumer-smoke/tests/install/stranger-desktop.test.ts` (`pnpm --filter @automata/consumer-smoke test:desktop`), opens the `.deb`'s app on a virtual screen through tauri-driver 2.1.0, picks a language, closes the window, finds the save in the app's store file and not in page storage, and reads it back on a second start: passed, 3 m 59 s. Fixed test first: a desktop save reached the disk only on Quit or a window close (now 500 ms after the last change, proved by killing the app); a missing `cargo` or `pkg-config` and a missing web build printed raw `ENOENT` errors; each message now names the one command that fixes it (changesets for `@automata/tools` and `@automata/framework`). The guide rewritten from the measurements. A desktop CI workflow proposed, not added (Linux, macOS, Windows; signing skipped until the secrets exist). Gaps reported: no Quit on the desktop's screens (a new word in six languages), no third-party licence notices in any build, Windows signing needs ship to write the certificate's settings, the 3D desktop build stops at the 3D package's publication. Not run: macOS and Windows builds, signing, notarisation, real devices | Linux: 100% (7 of 7 items); macOS and Windows: 0% (the Owner's machines and certificates) | [record](audits/2026-11-12-desktop-games/README.md), [proposed workflow](audits/2026-11-12-desktop-games/proposed-desktop.yml) |
