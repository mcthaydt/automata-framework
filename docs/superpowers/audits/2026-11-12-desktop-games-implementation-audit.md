# Games as desktop apps: implementation audit

**Date:** 2026-11-12. **Branch:** `claude/desktop-games`, audited at `bdc41959` (5 commits on `main` `7b6ce6ac`: the
toolchain messages, the journey, the docs, the adapter's save timing, the docs again). **Audited against:** the
session's brief as its [record](2026-11-12-desktop-games/README.md) states it (there was no spec or plan), `AGENTS.md`,
the `Hosting` contract (`packages/automata/src/shared/host/hosting.ts`) and the code on `main`. No subagents. Every
probe that changed code ran in this working tree and was reverted (`git status` clean after each).

## Verdict

**Ready to merge: yes, at the branch's last commit.** Not at `bdc41959`: one should-fix touched a published package's
behaviour (S1), and the record told the coordinator the Quit button needed new translations when it did not (S5). All
five should-fixes have landed since, each in its own commit (see "Fixes"), and the whole uncached `pnpm check` passed
after them.

1. **What the branch claims holds, measured here:** the Linux toolchain installs from the README's commands (58 s with
   `tauri-driver`); a game made from the packed packages outside the workspace builds first time (205 s cold) and the
   desktop journey passes (3 m 52 s; 3 m 44 s again after the fixes, now quitting by the title's Quit). Broken on purpose three ways (no disk write, saves in page storage, a save never
   read back), the journey goes red each time at the step that should catch it, with that step's own message.
2. **The save change is sound in order and in last-write-wins**, keeps every write off the sim and off the page's
   storage, and leaves `web`, `itch` and `ruken` untouched; **but a write that fails in the background is swallowed**
   (S1): `void saves.flush()` drops the refusal and `savesStatus` stays `saved`.
3. **No blocker.** 5 should-fix (all fixed), 9 notes. 14 findings in all. One more correction to the guide, found by
   measuring: a second build takes about a minute, not seconds.

## Findings

### S1, should fix: a desktop save that fails to reach the disk is reported to nobody

**Evidence.** `hosting-tauri.ts:89-92` (at `bdc41959`): the delayed write is `void saves.flush()`. `flush` relays a store
that rejects as `INTERNAL` (retryable), but the timer throws that answer away. `saves.set` has already answered `ok`
(the store's `set` is in memory), and `savesStatus` is the web adapter's `constant('saved')` (`hosting-web.ts:311`),
which the tauri adapter spreads unchanged. So with a full disk or a read-only data folder the game, the
`SaveStatus` indicator and the player all read "saved" while nothing is on disk, and nothing retries until the next
change or the exit (whose own flush result `quit` also discards, `hosting-tauri.ts:118`, a pre-existing gap). The
`Hosting` contract says "each call relays the host's answer or refusal" (`hosting.ts:68`); this is the one write no call
relays. No path sends a save to `localStorage` or to memory instead: the data stays in the store, unwritten.

**Fix.** The tauri adapter owns its `savesStatus`: `saved` while the store is on disk, `retry` when a write failed and
another is scheduled, `saved` again once one succeeds; a failed write (the delayed one or a flush) schedules the next
after `SAVE_WRITE_DELAY_MS`. Unit tests first, with the fake desktop's `failWrites`.

### S2, should fix: the desktop journey hides the app's and the driver's output, and a hung driver hangs it for 30 minutes

**Evidence.** `stranger-desktop.test.ts` starts `Xvfb`, `openbox` and `tauri-driver` with `stdio: 'ignore'`: on a failure
(the three mutation runs below) the log says only `timed out waiting for the save on disk` or the script that never
answered, with nothing from the app, WebKitWebDriver or tauri-driver. `webdriver.ts`'s `call` has no time limit per
request, so a driver that accepts a connection and never answers holds the test until Vitest's `testTimeout` (30
minutes, `vitest.install.config.ts`); a non-JSON error body fails as a bare `SyntaxError` naming no call. The brief asks
for "timeouts that fail fast with the app's output".

**Fix.** The driver's output (which carries WebKitWebDriver's and the app's) goes to `driver.log` in the stranger's
folder; a failed run prints its tail beside the kept folder's path. Each WebDriver request is limited
(`AbortSignal.timeout`, 60 s, longer than any one call took) and a failure names the method and path. Unit tests first
for the client.

### S3, should fix: the proposed workflow's secrets reach every step, one is echoed, and the macOS job runs on the release Mac

**Evidence.** `proposed-desktop.yml` (at `bdc41959`):

- The six `APPLE_*` and the two `WINDOWS_*` secrets are job-level `env`, so `pnpm install` (whose packages' install
  scripts run) sees them. The repository's other workflows give a secret to the one step that needs it
  (`release-packages.yml:109`, `:170`, `site.yml:37`).
- "Say whether this build is signed" prints `$APPLE_SIGNING_IDENTITY` (GitHub masks it, but the rule is "never echoed").
- The Windows job imports the certificate into `Cert:\CurrentUser\My` on the Owner's own PC and never removes it; the
  `.pfx` is left in `RUNNER_TEMP` if the import throws.
- The macOS job runs on `vars.AF_RELEASE_RUNNER`, the variable for the Mac that publishes (`release-packages.yml:43`), so
  a desktop test build would queue on the release machine.
- It lives under `docs/superpowers/`, which the scope codemod keeps as written (`origin/claude/scope-rename`,
  `rename-scope.ts` `KEPT`): copied to `.github/workflows/` after the rename, its `--filter @automata/consumer-smoke`
  would be stale (the scope-hygiene test would then catch it, but the copy step should say so).

Correct as it is, checked: the action pins (checkout v7.0.1, pnpm/action-setup v6.1.0, setup-node v7.0.0) are the
other workflows' exact SHAs; `permissions: contents: read`; no `upload-artifact` at all (so nothing stored on success,
as the Owner asked); no step publishes; signing steps are skipped when the secrets are absent; the Linux job's 30
minutes fit the measured 4 to 5 minutes; `af-linux` and `af-windows` are labels the repository's workflows use.

**Fix.** In the proposal (a document; nothing under `.github/workflows/`): a job-level boolean `SIGNED` only, the
secrets on the journey step (macOS) and the import step (Windows), no identity printed, `try`/`finally` around the
`.pfx` and an `always()` step that takes the certificate back out, `vars.AF_DESKTOP_MAC_RUNNER || 'af-mac'`, and a header
line on the codemod and on artifacts.

### S4, should fix: no Quit on the desktop's title screen

**Evidence.** `exit` is granted on `tauri` (`hosting-tauri.ts:133`), but only the boot-failure panel offers it
(`BootFailurePanel.svelte:51`); `TitleScreen.svelte` has Play alone, or nothing when the game has a save. A player quits
by closing the window. The guide says so ("the game's screens have no Quit button on the desktop yet").

**Fix.** A Quit on the title, shown only when the host is `tauri` and has granted `exit` (never `web`, `itch` or
`ruken`, where leaving is the browser's or Ruken's), in the title's action bar, at the primary height (48 px),
reachable by Tab, arrow keys and the pad's focus navigation as the other buttons are; its word through the screens'
catalog (see S5). DOM tests per host first; the desktop journey quits by it.

### S5, should fix: the record says Quit needs five new translations; the catalog already has them

**Evidence.** The README (section 4, "No Quit on the desktop's screens") and the tracker row say a Quit needs "five
translations through that pipeline" and that "the boot-failure panel's own 'Quit' is not in that pipeline". It is:
`runtime_quit` is in `packages/automata/src/app/screens/words/` in all six languages (`Quit`, `Salir`, `終了`, `종료`,
`Sair`, `退出`) with its source hash in `sources.json` (`b3eb37ac…`, the sha256 of `Quit`, for each of the five). The
pipeline itself is `automata words`, which calls a paid translator, but the catalog's own history shows the other way
it is fed: words written by hand in the style of their neighbours and recorded with `automata words --mark` (no
translator call; `5a3980b3`). A title Quit with the same English word needs no new translation and no new glyph (each
character is already in every language's catalog, so the committed font subsets do not move).

**Fix.** Correct the record; a `title_quit` key carrying the catalog's existing words for "Quit", its context note, and
its source hashes from `automata words --mark` (S4).

### N1, note: dispose drops a write still waiting

`dispose()` cancels the delayed write without flushing (`hosting-tauri.ts:159`). Before the branch, dispose wrote
nothing either (only Quit and the close did), so nothing is lost that was kept before; the exit paths flush. Left as
is: a write after `dispose` would be refused `CANCELLED` by the adapter's own rule.

### N2, note: ordering, bursts and last-write-wins, checked

`set` and `remove` change the store in memory in call order and re-arm one timer; the write saves the whole store, so
the last value of each key is what reaches the disk. Two keys in one burst are one write (the branch's unit test). A
change during a write re-arms the timer, so it is written by the next one. A flush (Quit, the close, the save manager's
background flush) cancels the timer and writes at once. The timer is the adapter's injected `Clock` (`systemClock` in
the app, `fakeClock` in the tests); the sim never touches it (saves are `Hosting`, outside `-sim`). The shared
`describeHostingContract` suite passes unchanged for `web`, `itch`, `ruken`, the fake and `tauri`; the new timing is
adapter-specific and tested beside it. `hosting-web.ts`, `hosting-ruken.ts` and their tests are not in the diff.

### N3, note: the journey's process handling on failure

After each failed mutation run (each 223 s to 266 s, the cargo build cold every time), the processes left were `<defunct>` (WebKitWebDriver, the app, WebKit's network and web
processes): dead, waiting for a parent this container's PID 1 does not reap. One WebKit web process was still exiting at the moment of the check and was gone seconds later (the Mesa
shader-cache writer the README describes). None held the display; a desktop or a runner whose init reaps leaves none. `stopBackground` waits for each child it started after
`SIGTERM` with no cap (a child that ignored it would hang the `finally`); `appPids` matches every process named
`my-game` on the machine; display `:97` is fixed and its readiness is the socket file, which another X server on `:97`
would also satisfy. None bit here.

### N4, note: the tools' messages, checked for real

Run by hand with the CLI from source in a game folder: no `dist/` prints `there is no web build in …/dist: run pnpm
build:tauri first, then run this again`; a `PATH` without `cargo` prints the three-line Rust message; a `PATH` with
`cargo` but no `pkg-config` prints the Linux libraries' message (its `apt` list pulls `pkgconf` in through
`libglib2.0-dev`, checked with `apt-cache depends`). The tests were written first (the record and the commit say so;
the fake runner's `NOT_INSTALLED` is what lets them fail before the fix). `exitCodeOf` reads any `ProcessError`
(`EACCES` too) as "not installed", which is the right advice in practice. Nothing else in `ship` changed: the move of
`checkToolchain`, `locateTauri` and `TAURI_CLI` into `tauri-toolchain.ts` is verbatim but for the messages and the
caught `ProcessError`.

### N5, note: the guide against this box

Followed as a stranger with the packs standing in for the registry (the journey's own steps, and by hand for the
messages): every command and path is true here. `pnpm dlx @automata/tools …` cannot run until the packages are on
npmjs.org (the same line is in `packages/tools/README.md`). The guide's package list leaves out `patchelf` and
`xdg-utils`, which the measurement installed; whether the AppImage step needs them is unproved (the README says so).
"Later builds take seconds" was not true here: a second `pnpm prepare:tauri` in a kept folder took 61 s (the game's
crate compiled again in 26.6 s, since ship rewrites `.automata/tauri/` each run, then both bundles); the guide now says
so. macOS and Windows are marked
unverified.

### N6, note: against the branches in flight

- **Scope rename** (`origin/claude/scope-rename`): nothing on this branch builds the scope or a pack file name from
  pieces; the journey takes pack paths from `packAll` and names `@automata/tools` and `@automata/consumer-smoke`
  literally, which the codemod's first rule rewrites. The proposal is the one file the codemod would skip (S3).
- **The 3D lane** (`origin/claude/ship-3d-plan-audit`, task A5): A5 changes `create-game`'s 3D gate and help; this
  branch changes no `create-game` file. When A5 makes `@automata/3d` public, the guide's "A 3D game cannot be built
  for the desktop yet" and `prepare-tauri`'s `@pixi/3d` refusal for a public build need a fresh look.
- **`claude/artifacts-on-failure`**'s new hygiene test (a package script naming a test file not on disk): `test:desktop`
  is `vitest run --config vitest.install.config.ts`; it names no test file and no `../` path, so it passes.
- **`claude/editor-journeys-green`** touches `turbo.json` and the root `package.json`; this branch touches neither.

### N7, note: a comment line of 153 characters

`hosting-tauri.ts:15` was extended and not re-wrapped (Biome does not wrap comments; the rest of the file keeps to 120).

### N8, note: the tracker row is out of date

Row 7 of `docs/superpowers/progress.md` still says the journey "closes the window, finds the save" (it now kills the app
first) and that Quit needs "a new word in six languages" (S5). On the coordinator's rule of 2026-11-12, the row moves to
the record's "For the tracker" (a fix below), and this audit's own row is under "For the tracker" here.

### N9, note: what the brief asked that the branch does not cover

- WebDriver's own "close window" bypasses Tauri's close request (found by the branch, recorded). The journey closes
  through the window manager, as a player does.
- The `.deb`'s `Maintainer: example` and `Description: (none)`, third-party notices, Windows signing in `ship`, and the 3D
  desktop build are reported, not fixed, as the brief allowed; each needs a decision or another lane.

## What was verified, and how

| What | How | Result |
|---|---|---|
| Toolchain | `apt-get update` (3 s); the README's `apt-get install` list (25 s, WebKitGTK 2.52.6); `webkit2gtk-driver xvfb openbox wmctrl` (5 s); `cargo install tauri-driver@2.1.0 --locked` (23 s). `cargo` 1.97.0 was already there | installs, 58 s |
| Packages | `pnpm install --frozen-lockfile`, `pnpm build` (34 s, 16 tasks, uncached) | exit 0 |
| The journey | `pnpm --filter @automata/consumer-smoke test:desktop` | passed, 232 s: pack 5.7 s, make 6.8 s, install 3.3 s, web 4.6 s, desktop 205.4 s, open 0.3 s, save on disk 0.5 s, open again 0.2 s, close 0.1 s; `.deb` 4,135,296 bytes, AppImage 82,688,504 bytes; no process left |
| Mutation: no disk write | `SAVE_WRITE_DELAY_MS = 600_000`, framework rebuilt, journey | red at step 4, `timed out waiting for the save on disk` |
| Mutation: page storage | the adapter returns `web.saves` | red at step 3: `expected [ 'ruken:my-game:automata.locale' ] to deeply equal []` |
| Mutation: never read back | `saves.get` answers `null` | red at step 5: `expected 'en' to be 'ja'` (the device's first-run flag skips the language screen, so the title opens in English: the `lang` check is the one that catches it) |
| Save change | read against `hosting.ts`; the target unit tests | N2 |
| Messages | the CLI from source in a game folder, three `PATH`s | N4 |
| Warm rebuild | `pnpm prepare:tauri` again in a kept stranger folder | exit 0, 61 s |
| Gates | see "Gates" | |

## What could not run

macOS and Windows builds, signing and notarisation, Gatekeeper and SmartScreen, real devices, the proposed workflow on
the Owner's runners, a link opened in the system browser (no browser in the container), the 3D desktop build (stopped
by the 3D package's publication). All expected for a Linux cloud box.

## Gates

Before the fixes, at `bdc41959` with the toolchain above: `pnpm install --frozen-lockfile`, `pnpm build` (exit 0), the
desktop journey (passed), the framework's target unit tests (21 files). The whole gate set ran after the fixes, on the
branch's last commit (see "Fixes").

## Fixes

Each its own commit on `claude/desktop-games`, after this document; code changes with a test watched failing first.

| Finding | Commit | What changed | Test, failing first |
|---|---|---|---|
| Tracker (coordinator's rule, N8) | `2c4466b7` | Row 7 moved verbatim to the record's "For the tracker"; `docs/superpowers/progress.md` and `docs/refactor/progress.md` back to `main`'s; `git diff origin/main...HEAD --stat` shows neither | n/a |
| S1, N7 | `dac75153` | The tauri adapter owns `savesStatus`: `retry` from a failed write until one lands, each failure scheduling the next try after `SAVE_WRITE_DELAY_MS`; a failed `flush` still refused `INTERNAL`; the header comment re-wrapped. Changeset `desktop-save-failure-status.md` (`@automata/framework`, patch) | two cases in `hosting-tauri.test.ts` (`expected 'saved' to be 'retry'`); the target suite 21 files, 219 tests after |
| S2 (client) | `a80fdd1a` | Each WebDriver request limited to 60 s; a timeout or a non-JSON answer names the method and path | two cases in `webdriver.test.ts` (one hung for its 5 s, one threw a `SyntaxError`) |
| S3 | `b1d477db` | The proposal: secrets on the one step each, `SIGNED` booleans only, no identity printed, the `.pfx` removed in a `finally` and the certificate taken back out, `AF_DESKTOP_MAC_RUNNER`, the codemod and artifacts notes. Nothing under `.github/workflows/` | n/a (a document) |
| S4, S5, S2 (journey) | `deb13602` | Quit on the desktop title (tauri with `exit` granted only), after Play or the slots, in the action bar (Tab, arrows, the pad's focus steps), 48 px, through `Hosting.exit`; `title_quit` in six languages beside `runtime_quit`, a context note, hashes by `automata words --mark` (no translator call; no new character, so no font subset moves); the guide and the record corrected; the journey quits by the button on its second start and closes the window on a third, and keeps tauri-driver's log. Changeset `desktop-title-quit.md` (`@automata/framework`, patch) | `title-quit.test.ts` (7 cases: none on web, itch, Ruken, nor on tauri without `exit`; on tauri beside Play, with a save, focusable, quitting through the host); 3 failed before the change |

Left as notes, with reasons: N1 (dispose wrote nothing before either), N3 (`<defunct>` processes are this container's
init, not the journey), N5 (`patchelf` and `xdg-utils` unproved either way; `pnpm dlx` waits on publication), N6 (other
lanes' work), N9 (decisions for the Owner or other lanes). Not done: the `.deb`'s metadata, notices, Windows signing in
`ship`, the 3D desktop build.

### Gates after the fixes

- `pnpm format` (Biome) on each commit's files; the pre-commit hook's affected unit tests on each.
- `TURBO_FORCE=true pnpm check`, uncached, on `b05563d8` (every code fix in): **exit 0, 16 m 40 s**. A first run
  (on `deb13602`) failed only at `pnpm style`'s docs check: the moved tracker rows' links (fixed in `cb9e07f4` and
  `b05563d8`).
- `pnpm build` (exit 0, 31 s); `pnpm api-report`: 1 break against the base, `ScreensCopy['title']` gains `quit`,
  now declared by this branch's own changeset (`BREAKING:` line) rather than passing on another's; `--update` and
  `pnpm api-index --write` committed (`1323b4ef`).
- `pnpm secrets`: no leaks in the full history (3,785 commits).
- The desktop journey on `deb13602` (the Quit and the driver log in): passed, 224 s; no live process afterwards.
- Changesets, all `patch`, published packages only: `desktop-save-failure-status.md` and `desktop-title-quit.md`
  (`@automata/framework`), beside the branch's two.
- Not run: the 2D browser suites and journeys (no change reaches a rendered pixel but the title's one button; its
  height was checked in the real WebKitGTK webview by the journey instead), parity, the 3D lane, macOS, Windows.

## For the tracker

| # | Item | State | Progress | Links |
|---|---|---|---|---|
| 7 | Games as desktop apps: implementation audit | Done 2026-11-12 on `claude/desktop-games`, no subagents: 14 findings (0 blockers, 5 should fix, 9 notes); the journey passes here and goes red at the right step under three deliberate breaks of the adapter | audit: 100% | [audit](2026-11-12-desktop-games-implementation-audit.md) (from `docs/superpowers/`: `audits/2026-11-12-desktop-games-implementation-audit.md`) |
