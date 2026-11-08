# The paid desktop and mobile apps: audit

The Owner, 2026-11-08 14:53: "should we get to using tauri to package to desktop, ios, and android? Also let's use
nomad sculpt economics $19.99 for mobile, $39.99 for desktop; lets keep essentials on web, everything open source except
deployment, but the full suite requires the app desktop or mobile; it needs to be synced to github so someone can claude
code can edit it freely and it syncs automatically back and forth".

Read as:

- One editor app, built with Tauri, for macOS, Windows, Linux, iOS and Android.
- A one-time price: $19.99 on a phone or tablet, $39.99 on a computer.
- The web (the site's try-it page, and the free `automata editor` command) keeps every editor, free. The price is for
  downloading the app (the Owner changed this at 21:25, section 4).
- All code is MIT and public, except deployment: signing, store listings, provisioning and the release pipelines.
- A game in the app is a GitHub repository that syncs both ways by itself, so Claude Code can edit it and the app shows
  the change.
- Later, the downloaded apps (computers and phones, never the browser) give a coding agent MCP access to the editors
  (the Owner, 21:26, section 7).

This keeps the earlier rule that every editor is free (the Owner, 2026-11-01 and 2026-11-08 04:00). It changes one
part of it: the desktop app is paid too, not only the iOS and Android packaging. Finding A8 lists where that rule is
written down.

This is stage 1 (audit) of the pipeline for a new area. It was made on PR #508 (branch `claude/complete-game-journeys`,
head `89db7336`), the top of the editors stack, and is filed against `main` as #509 was, because a docs-only branch
cannot be stacked on #508 without a force push.

## 1. The answer

**Are we basically done? Not for the apps.** The editors and the whole game loop work in a browser on a computer. The
apps need five things that do not exist yet:

1. **An app.** Nothing in the repository packages the editors. Tauri is only a target for *games* (`ship prepare
   --target tauri`, desktop only). The editors need Node for files, Play and Publish, and phones have no Node (A1).
2. **Play and Publish inside an app window.** Tried here in a real Tauri build: Play does nothing, and Publish's zip
   lands silently in whatever folder the app was started from (A2, A9).
3. **A way to play a game on a phone.** Play runs the game's own Vite. A phone cannot (A4).
4. **GitHub sync.** None exists. The editors do not even reload when a file changes under them (A6).
5. **The Owner's accounts and the open blockers.** The 3D editors carry Pixi 3D's closed beta, which may not be shipped
   publicly (A3). The npm release, the domain, the site host, the store accounts and the signing certificates are all
   still to do (section 9).

What *is* ready, measured here: the full editor suite runs inside a Tauri window on Linux (WebKitGTK 2.52) with no
change to the editors. A game was made in that window, played, and every change showed in play (section 2).

**Recommendation.** Build the desktop app first, as a Tauri shell around today's `automata editor` (a "sidecar"),
because that is proven here and needs little new code. Build the phone app on a second path that runs entirely inside
the app. Sell nothing until Pixi 3D is public, per the Owner's rule of 2026-10-23 ("we launch when pixi 3D goes
public"). Build, sign and test privately before then. The Owner settled the one open decision at 21:25: every editor
stays free on the web, and the apps sell the download (D1, section 4).

## 2. What was done by hand

In a cloud container: Node 24.21.0, Rust 1.97.0, Ubuntu 24.04 with WebKitGTK 2.52.6 (`libwebkit2gtk-4.1-dev`
installed for this), Xvfb, `tauri-driver` 2.1.0 and WebKitWebDriver to drive the window.

1. `pnpm install --frozen-lockfile`, then `turbo run build` for `@automata/tools`, `@automata/editor` and
   `@automata/editors`: exit 0 (11 tasks, 17.8 s).
2. **A new game the way a person makes one.** `automata create-game lantern-run --template 2d`, with its packages linked
   from Emberwick's install, as the journeys' `newGame` does (the packages are not on a public registry yet, A5).
3. **A Tauri desktop app around the editors.** A minimal Tauri 2 project (tauri `=2.12.4`, tauri-build `=2.7.3`, the
   versions AF already pins in `tauri-project.ts`). Its `main.rs` starts `node bin.js editor <game> --port 0` as a
   child, waits for the "This computer:" line, and opens a window on that address. `cargo build --release`: 2 min 8 s;
   the binary is 11.8 MB. The source is in
   `/mnt/project-files/refactor/2026-11-08-apps-audit-spike/` (not product code).
4. **The editors in the app window.** The rail read Tuner, Levels, Feel, Audio, Schematic (`tauri-01-open.png`). The
   user agent was WebKit 605.1.15.
   - **Tuner:** Add key on Left, then J pressed. `content/controls.toml` gained `"KeyJ"` (`tauri-02-tuner.png`). The
     Tuner's game pane drew the game beside the controls.
   - **Feel:** for "square bumped", the flash raised to 30 frames and the limit to 30. `feel.toml` now reads
     `visual = [{flash = "white", frames = 30}]` and `[limits] flash_frames = 30`, with no Save (`tauri-03-feel.png`).
   - **Levels:** a Collision wall painted at column 10, row 4. `start.toml`'s rows changed from `".*32"` to
     `".*10 1 .*21"` (collision) and `".*10 0 .*21"` (the ground tile it places) (`tauri-04-levels.png`).
5. **Play in the app window: nothing happened.** The Play link (`href="http://localhost:<port>/"`, `target="_blank"`)
   was clicked. No window opened (the X server listed one app window), and the page stayed where it was
   (`tauri-05-after-play.png`). See A2.
6. **Play with a fix.** The window was given an `on_new_window` handler that opens the address in a second app window.
   Play then opened the game. Pressing its Play button showed the painted wall at column 10, row 4
   (`tauri-08-game-start.png`). Holding **J** moved the square left into the wall; the screen went white with "Bump!"
   and the mean brightness went from **44.5 at rest to 188.3** (`tauri-09-game-bump-flash.png`). **Made in the app,
   played in the app, seen: the wall, the new key and the longer flash.**
7. **Publish.** "Build my game" made `lantern-run-0.1.0-itch.zip` (328,836 bytes). Its script holds `KeyJ` and
   `visual:[{flash:`white`,frames:30}]`. Without a download handler, "Download the zip" wrote the file into the app's
   working folder with no message (A9). With an `on_download` handler it went to the downloads folder.
8. **Quitting.** After the app closed, `automata editor` and the game's Vite were still running (A10).
9. **Phone size.** The window at 390 × 844 showed the phone layout: the top bar's Game menu and the bottom tab bar
   (`tauri-12-phone-levels.png`). This is WebKitGTK, not iOS.

Screens: `/mnt/project-files/refactor/2026-11-08-apps-audit-screens/`.

## 3. What exists today

| Piece | State | Where |
| --- | --- | --- |
| Tauri for games | A game can be built as a desktop app: generated `src-tauri`, bundles for each OS, the desktop host adapter (saves, Quit) | `packages/tools/src/shared/ship/targets/tauri/`, `packages/automata/src/features/targets/tauri/` |
| Desktop release jobs for games | `desktop` (unsigned bundles) and `desktop-macos-signed` (APPLE_* secrets) are in `main`'s `game-release.yml`. The stack replaces that file with a new game's own `release.yml`, which builds only web and itch.io (2D plan task 15.1) | `.github/workflows/game-release.yml` on `main`; `packages/tools/src/shared/create-game/template-ci/release.yml` |
| An editor app | None | |
| Mobile | None. Tauri is pinned for desktop only | `tauri-project.ts` `CRATE_PINS` |
| Editor storage | One port, `ProjectStore`, with five adapters: memory, OPFS, a picked folder, download, and HTTP to `automata editor`. Writes are guarded by mtime, and a conflict opens "Keep mine / Take theirs / Save as copy". `watch` is declared and implemented by none | `packages/editor/src/shared/kit/storage/project-store.ts:87` |
| Pages | The 2D page (Levels 2D with Characters and Add tiles, and the Tuner) is in the published tools and on the site's try-it. The full page (every editor) is built in the repository only | `editor-command.ts:57`, `:59`; `site/scripts/build-demos.ts:67` |
| Play and Publish | Need the game's Vite and `vite build`, run by `automata editor` | `game-runner.ts`, `publish-game.ts` |
| A browser-only compile | The site playground strips TypeScript with sucrase in a worker and runs it against a prebuilt runtime, single files only | `site/src/features/playground/compile.ts` |
| Git or GitHub | None. `create-game` makes no repository and no `AGENTS.md` | `packages/tools/src/shared/create-game/` |
| Pricing or download pages | None. The site cannot deploy (no host) | `site/`, site audit (#477) |
| Licence | Every package is MIT (27 manifests), `LICENSE-SCOPE.md` | |

## 4. Which editors are free on the web (decision D1, settled)

The audit first offered three answers: the 2D basics on the web (recommended), Levels only, or every editor. **The
Owner, 2026-11-08 21:25: "And I change my mind, all editors are free on Web, you only have to pay to download".**

So the web gets every editor, in 2D and 3D games (the Owner's 14:26 rule). The site's try-it page and the free
`automata editor` command serve the full page. What a buyer pays for is the download:
- the app installed in one step on a computer, with Node carried inside it (A1), and kept up to date;
- the app on a phone or tablet (A4);
- GitHub sync and the Review page (section 7);
- later, MCP access to the editors, on computers and phones (section 7). The Owner, 21:26: "you get mcp access to the
  editors when they're downloaded, but not for the browser".

Sync is in the apps for a technical reason, not as a gate. A web page cannot reach GitHub's git endpoints or its
device sign-in, because neither sends CORS headers (checked). A web version would need a server in between that holds
people's GitHub tokens. That would be a hosted service to run and pay for, not a download.

What changes on the web:
- The published tools and the try-it page serve the full page (`editor-command.ts:57`, `:59`;
  `site/scripts/build-demos.ts:67`). The shared-editors audit already plans this (#509, S4 and S10).
- The command stops printing "Feel and Audio are not in this release yet, so the editors show Levels and the Tuner."
  (`editor-command.ts:108`).
- The 3D editors carry Pixi 3D's beta (A3), so a public page gets them only when Pixi 3D is public, the same day as
  the apps. Until then the public page has every editor except the 3D ones, as S4 already plans.

## 5. How to sell the download while staying open source

- **No editor is gated.** The web and the apps run the same full page, built from the same public repository. What a
  buyer pays for is the signed app: installed in one step, kept up to date, synced, and on a phone. Anyone may build
  the app from source; MIT allows it, and that is the deal open-source paid apps make (Ardour and Krita sell builds of
  code anyone can compile).
- **No licence keys or copy protection in the open code.** A fork deletes them in minutes. The Mac App Store forbids
  them (guideline 2.4.5 vi). And AF's own rule is that a missing capability fails and says so; it never hides behind
  the player's back.
- **Downloads and updates are for buyers.** The phone stores do this themselves. On a computer, the merchant (section 7)
  emails the download link, and the update server asks for the buyer's purchase key before it hands over an update. The
  key only fetches downloads; the app never stops working without one.
- **The name is the protection.** Add a `TRADEMARK.md`: a fork may ship the code under another name and icon, never as
  "Automata" in a store. Store reviewers act on copycat reports (Apple 4.1, 5.2).
- **Where the code lives.** The app's code is product code and is public: the Tauri project, the app's `ProjectStore`
  adapter, Play inside the app, and sync, for example in `apps/editor/` in the framework repository. A new private
  repository (for example `mcthaydt/automata-apps-deploy`) holds only signing, provisioning, store metadata and the
  release workflows. It builds a pinned framework commit, the way Plus pinned core with `core.ref`.

## 6. Findings

### High

**A1. There is no app, and the editors need Node, which phones do not have.** Every file the editor reads or writes
goes through `automata editor`'s HTTP API (`http-store.ts`), Play is the game's own Vite (`game-runner.ts`), and Publish
is `vite build` and a zip (`publish-game.ts`). A computer can carry Node beside the app: the binary is 120.7 MB
(30.4 MB as `.tar.xz`), next to an 11.8 MB Tauri shell. iOS and Android cannot run it: Tauri's shell plugin only opens
URLs there, its localhost plugin has no mobile support, and its file system plugin reaches only the app's own folder
(Tauri's plugin pages, checked 2026-11-08). *Direction:* two paths behind the one `ProjectStore` port. On a computer,
the app starts `automata editor` as a sidecar (proven in section 2). On a phone, a sixth adapter keeps the game in the
app's folder through Tauri's file system plugin, and Play and Publish run inside the app (A4).

**A2. Play does nothing inside an app window.** Play is `<a href={playUrl} target="_blank">` or
`window.open(playUrl, '_blank', 'noopener')` (`SuiteTopBar.svelte:83`, `:108`). Tauri's webview drops both unless the
window has an `on_new_window` handler (section 2, step 5). That handler exists on desktop only: "Android / iOS: Not
supported" (`tauri-2.12.4/src/webview/webview_window.rs`, the doc above `on_new_window`). To a person, Play is a button
that does nothing, which fails the drunk grandma test. *Direction:* in the app, Play opens an in-app game view (a second
window on a computer, a full-screen view on a phone), chosen by the host and not by the editor page.

**A3. The full suite ships Pixi 3D's closed beta.** The full page's build has `@pixi/3d` markers in four chunks
(`View3DGCRegistry-*.js`, `fullscreenTriangleGeometry-*.js`, `init-*.js`, `stage-renderer-*.js` in
`extensions/editors/dist/suite/assets/`); the 2D page's build has none. `vendor/pixi-3d/README.md`: "its terms allow no
public deployment". A paid app is a public deployment, and so is the Google Play closed test with 12 outside testers
(A12). With every editor free on the web (D1), so is a public page with the 3D editors. The same beta keeps the
framework repository private (the go-public audit, 2026-11-07: the tarball is in the
history), so "everything open source" waits for it too. *Direction:* per the Owner's 2026-10-23 rule, sell nothing until
Pixi 3D is public. Until then, build, sign and test privately (TestFlight internal testers, Play's internal track), or
ask PixiJS in writing. A 2D-only app (no Levels 3D, no 3D Characters) could go on sale sooner if the Owner wants that.

**A4. A phone cannot play a game.** A game's behaviour is TypeScript, its content is compiled by a Vite plugin, and the
content compiler is Node tooling (`packages/content/src/shared/files/content-files.ts` uses `node:fs` inside Effect).
*Direction:* the site playground already compiles TypeScript in a worker with sucrase and runs it against a prebuilt
runtime (`site/src/features/playground/compile.ts`). Grow that into a whole-game compile inside the app: the game's
`src/` file by file, an import map onto a prebuilt copy of the framework the app carries, and the content compile
running on `ProjectStore` instead of `node:fs`. Two consequences the plan must settle: running the content compile in a
page puts Effect in the browser, and law 5 keeps Effect for Node tooling (ADR 0003 as amended), so either the compile
drops Effect or the ADR changes; and a game that imports packages the app does not carry plays only on a computer, which
the app must say in words. Content-only edits, the common case on a phone, need only the content half.

**A5. A stranger cannot install a game's packages yet.** A new game depends on `@automata/framework` and friends
(`create-game`'s `package.json`). `@automata` belongs to someone else on npm, the Owner chose `@automataframework`
(site audit D1), the rename waits for the Plus port to merge, and the first release is the Owner's. The desktop app's
first run of a cloned game needs `npm install` to work. *Direction:* the desktop app waits for the first public
release; its sidecar carries Node and npm, and runs the install with a progress line ("Getting your game ready…").

**A6. Nothing syncs, and the editors do not notice outside changes.** No git or GitHub code exists. `ProjectStore.watch`
is declared and no adapter implements it (`project-store.ts:87`), so a file Claude Code changes while the editor is
open is caught only when the editor next saves it (the mtime guard). `create-game` makes no repository and writes no
`AGENTS.md`, so Claude Code has no guide to which files it may edit. One trap is already measured: a level's TOML is
generated from its `.af2d.json` project, and a hand edit of the TOML fails `automata check` (journey
`drift-is-caught`). Claude Code would naturally edit the TOML. *Direction:* section 7's design, and the templates write
an `AGENTS.md` that names the source files and tells the agent to work on a branch and open a pull request.

**A7. Apple's rules on running code the app did not ship with.** The app runs the person's own game, which is JavaScript
from their repository. Guideline 2.5.2 bans downloading code that changes the app, except for "Educational apps designed
to teach, develop, or allow students to test executable code", which "must make the source code provided by the app
completely viewable and editable by the user". Guideline 4.7 allows "HTML5 and JavaScript mini apps and mini games", but
4.7.2 forbids exposing native APIs to them without permission. *Direction:* the game runs in its own origin with no
Tauri bridge in reach; the app shows the game's code (a read-only Code view at least); the review notes explain that it
is a game maker that plays only the person's own project. Budget for one rejection round. Google Play's Device and
Network Abuse policy allows "code that runs in a virtual machine or an interpreter … (such as JavaScript in a webview or
browser)". Neither store has been asked.

**A8. Two documents say only the phone apps are paid.** Every editor stays free (D1), so the rule "never gate editors
as paid" holds. One part changes: the desktop app is paid too, and only deployment is private. Two documents need the
Owner's new words:
- `docs/refactor/2026-11-08-content-editors-spec.md` lines 10 to 12: "So every editor is free. Only the iOS and Android
  packaging of the editor apps is paid, and that code lives in" a private repository.
- automata-plus `AGENTS.md` line 22: "The only paid product is the editor apps on iOS and Android. Their native wrapper
  code, signing setup and store listings live in a separate private repository."

The shared-editors audit (#509, S4 and S10) and project memory (`af-content-editors`) agree with D1 and need no change.

### Medium

**A9. Publish's download lands silently in the wrong folder.** The page hands the zip over as a link with `download`
(`publish-client.ts:64` to `:72`). In the app window that wrote `lantern-run-0.1.0-itch.zip` into the process's working
folder, with no message (section 2, step 7). A double-clicked app's working folder is `/` on macOS. *Direction:* the
zip is already in the game folder (`publish-game.ts` writes it there), so in the app the dialog's last step is "Show the
zip" (open its folder), not a download.

**A10. Quitting leaves the editor and the game running.** After the app closed, `automata editor` and the game's Vite
were both still running. Tauri's `run` "never returns. When the application finishes, the process is exited directly
using std::process::exit" (`tauri-2.12.4/src/app.rs:1364`), so cleanup after `run` never happens, and Rust's
`Child::kill` is SIGKILL, so Node cannot stop its Vite. Mac App Store guideline 2.4.5 (iii) forbids processes that keep
running after the app quits. *Direction:* stop the sidecar in `RunEvent::Exit` with SIGTERM, so `automata editor`
stops the game as it does on Ctrl+C.

**A11. The Mac App Store cannot take the desktop design.** 2.4.5 (iv) forbids downloading code (npm installs native
binaries such as esbuild's), (vi) forbids licence keys, (vii) forbids other update mechanisms. *Direction:* sell the
desktop app directly (section 7), with Tauri's updater. The Microsoft Store and Steam both take developer tools and can
come later.

**A12. Google Play needs 12 testers for 14 days first.** "Developers with personal accounts created after November 13,
2023, must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least
14 days" before production (Play Console Help 14151465). An organisation account avoids it but needs a D-U-N-S number.
With A3, the closed test build cannot carry Pixi 3D unless PixiJS agrees.

**A13. Windows signing.** Azure Artifact Signing costs about $9.99 a month, and "Individual developers are currently
limited to the USA and Canada" (Microsoft Learn, code signing options). New files still show SmartScreen until
reputation builds; EV certificates no longer skip it. The Microsoft Store has free registration for individuals since
2025-09-10 and signs MSIX packages itself.

**A14. The stack drops the desktop release jobs for games.** `main`'s `game-release.yml` builds desktop bundles and
signs and notarizes the macOS one; the stack's new-game `release.yml` builds web and itch.io only. That is about games,
not the editor app, but the Owner kept Tauri as a game target (2026-11-05) and this is where its signing lived.
*Direction:* the plan says whether a game's own release workflow gets a desktop job back.

**A15. Runners are per repository.** The Owner's runners are registered per repository on a personal account. A private
deployment repository needs its own, and iOS needs the Mac (Tauri builds iOS only on macOS with Xcode).

**A16. The stores need a website that does not exist yet.** Both stores ask for a privacy policy and support address.
`automataframework.com` is not registered and the site has no host (site audit, #477).

**A17. Licences the paid app would ship that nobody has settled.** The DUEL palette's author and licence; the
FigureBuilder and EnvironmentBuilder work behind the 3D base figures and rooms; FigureBuilder's history holding SNEKPRTY
assets. These are open Owner questions in project memory.

### Low

**A18. The phone top bar cuts the game's name to "L…"** and the Levels toolbar's last button runs off the right edge at
390 px (`tauri-12-phone-levels.png`, WebKitGTK). A person cannot see which game is open.

**A19. Words for the new model.** The site's Editor page ("Nothing to install") and the game README ("`pnpm editor`
opens the editors on your game") are right for the web but say nothing about the app. Each gains one plain line on
what the download adds: an app on your computer with nothing else to install, the phone, and GitHub sync.

**A20. Tests for WebKit must type the way a person does.** Under WebKitWebDriver, clearing a number field did not empty
it, so "30" became "330" and was refused; select-all and type worked. Not a bug a person meets, but the app's WebKit
journeys (iOS is WebKit) need the same care.

## 7. Designs for the plan

### Two-way GitHub sync

**Who edits what.** The app writes only the files the game's editor list allows (`content/editors.toml`), never code.
Claude Code writes anything. So a change to code never conflicts with the app; only a content file changed on both
sides can.

**Three ways Claude Code edits a game:**

1. **On the same computer, in the game's folder.** No GitHub needed. The app's store implements `watch` (a change
   stream from `automata editor`, file events on a phone), and an open document reloads when it has no unsaved change,
   or shows the existing conflict dialog when it does.
2. **Anywhere else: on a branch, waiting for the person's yes.** This is the way this project's own agents work. The
   Owner, 2026-11-08 19:11: "I'd like our coding agents to use the same workflow we have here". Claude Code works on a
   `claude/…` branch, pushes it and opens a pull request, and nothing reaches the game's `main` until the person says
   yes. The editors' **Review** page shows each waiting change. It sits in the sidebar under "Waiting for you", as in
   the editors v2 mockup, with the count at the row's end. Each change gets one card:
   - **What it changes.** The pull request's title, the editors it touches ("Feel, Levels (Start)") and who made it.
   - **Play it.** Plays that version in a play window, as Play does. The person's own copy is not changed.
   - **Use this change.** Merges the pull request on GitHub and pulls, so the open editors show it. If `main` has moved
     since the branch was made, the merge uses the conflict rules below. An overlap the person must settle opens the
     same dialog.
   - **Not this one.** Closes the pull request. The branch stays on GitHub, so the change can be brought back.

   A change whose checks failed says so ("This change broke a check: Feel") and still offers all three buttons. The
   diff is behind "Show the files", not on the card.

   **Use changes without asking.** The Owner, 2026-11-08 19:16: "We should have an auto option too where it doesn't
   ask it just works". This is a switch at the top of the Review page, one per game, and it is off at first. When it
   is on, each change is used as soon as its checks pass, with no card. The app does the merge itself when it pulls
   (on open, on coming to the front, and every 60 s), because GitHub's own auto-merge is not available on private
   repositories on the Free plan. A change made while the app is closed is used the next time it opens. The switch
   still stops and asks in two cases:
   - A check failed. The change waits on the page with "This change broke a check: Feel".
   - The merge rules below cannot settle an overlap with the person's own edits. The conflict dialog opens.

   Each change it uses shows a notice for a few seconds: "Claude's change is in: Feel, Levels (Start). Undo". Undo is a
   new commit that reverts it, never a force-push. The Review page lists the last changes used this way, each with
   Undo, so one can be taken back after the notice has gone.

   **Build it new.** There is no Review page to start from. Main still has a Review desk (`ReviewDesk.svelte`,
   `review-model.ts`) that showed the local change-set journal with no buttons. The stack deletes it with the
   change-set desk (`a15c7b36`, "a real game never had a change set"); `DiffView.svelte` goes with it. The editors v2
   spec (PR #519) leaves Review out on purpose: "Building it again is a feature, so it is not in this plan". So the
   plan builds all of it:
   - the "Waiting for you" group, the Review row with its count, the page and its cards;
   - the switch and the Undo;
   - a diff view;
   - the empty page from the editors v2 mockup: "Nothing waiting for you".

   The `review` icon is still in the kit. The page reads the game's open pull requests through the sync engine.

   **Play it** needs something that does not exist yet: the game runner must play a second checkout of the branch
   (`.automata/review/<branch>`), not the open game's folder. On a phone it needs the in-app player (A4).

   The page needs GitHub, so it is in the apps (section 4).
3. **Told to push to `main`.** The app pulls it like any change. The game's `AGENTS.md` (A6) tells a coding agent to
   use a branch and a pull request, so this happens only when the person asks for it.

**When.** Pull when the game opens, when the app comes to the front, and every 60 s while open (a conditional request on
the branch: a 304 "does not count against your primary rate limit", GitHub's REST best practices). Push after saves,
batched after 10 s of quiet, one commit per batch ("Edited in Automata: Feel, Levels (Start)").

**Conflicts, file by file:**

1. Text files: git's three-way merge first.
2. TOML and JSON: a merge driver that merges by key, and arrays of tables by their id (`on` for Feel), so "you changed
   the flash, Claude changed the shake" merges cleanly.
3. Still overlapping: the person chooses, per file, in the dialog the editors already have, in sync words: "Keep mine",
   "Keep GitHub's", "Keep both". Conflict markers are never written: a TOML file with them does not parse, and the game
   would break.
4. Generated files are never merged. A level's TOML is made again from the merged `.af2d.json`. If Claude changed a
   generated file, the app says so in words and offers to take that change into the level, which needs an import step
   that does not exist yet (A6).
5. Pictures and sounds: no merge; choose one or keep both.
6. Changed on one side, deleted on the other: ask.
7. Never force-push. "Keep mine" is a new commit, so GitHub's version stays in the history and can be brought back.
8. Offline: commits wait and the status line says so ("Saved on this device. Not on GitHub yet: no internet.").

**The engine.** isomorphic-git (1.44.11, MIT, released 2026-11-05) in the app's page, on all five platforms, writing a
real `.git` that the git command and Claude Code read too. Its `mergeDriver` hook takes the TOML and JSON merge. Its
requests go through Tauri's HTTP plugin, because github.com's git endpoints and its device-code endpoint send no CORS
headers (checked). One engine means one test suite.

**Signing in.** A GitHub App ("Automata"), using the device flow: the app shows a code, opens github.com/login/device,
and the person types the code. No client secret ships in the open code: GitHub's refresh request needs `client_secret`
"Required unless the user access token was generated using the device flow". Tokens last 8 hours, refresh tokens 6
months, kept in the system keychain. Permissions: Contents (read and write), Metadata (read), Pull requests (read and
write, for Claude's changes). Making a new repository from the app needs Administration or Repository creation (write);
the first version can open github.com/new instead. GitHub is only for sync, not the app's account, and the app works
without it, so Apple's 4.8 (Sign in with Apple) does not apply.

**Words.**
- "Saved and on GitHub".
- "Getting changes from GitHub…".
- "Waiting for you": "Play it", "Use this change", "Not this one".
- "Use changes without asking". "Claude's change is in: Feel, Levels (Start). Undo".
- "A file changed here and on GitHub. Choose which to keep."

### The desktop app

A Tauri shell that starts `automata editor` as a sidecar with a token, waits for its address, and opens the full page.
Play opens a second app window (`on_new_window`); Publish ends with "Show the zip"; quitting stops the sidecar with
SIGTERM (A10). Sold directly; updates through Tauri's updater, signed with the Owner's updater key.

### The phone app

A Tauri app with the full page built in, a `ProjectStore` over the app's folder, sync, and Play inside the app (A4). The
game's folder is visible in the Files app on iOS (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`). The page
is served from `tauri://localhost` on iOS, macOS and Linux and `http://tauri.localhost` on Windows and Android, so every
window-message handler's origin check must allow the app's origin.

### MCP access to the editors (a later stage)

The Owner, 2026-11-08 21:26: "Let's create an MCP server also when we finish to sweeten the deal, you get mcp access to
the editors when they're downloaded, but not for the browser", and a minute later: "Can you do mcp for mobile apps as
well?". So this is a stage after the apps are built, on every platform the apps run on. The app plan leaves room for it
now.

**What it is.** An MCP server inside the app. A coding agent such as Claude Code connects to it and works on the open
game through the editors, as a person does:
- list the game's content;
- read a content file, and change it through the editors' own write path, with the same checks and Undo;
- open an editor on a file, so the person sees it;
- run the checks and read the problems;
- Play and Publish.

The tools are shaped like the editors, not like raw file access, because an agent can already read files.

**Where it lives.** In the app's own code (`apps/editor/`), never in the web page or in the free `automata editor`
command. "Not for the browser" is read here as: the try-it page and the free command, which opens the editors in a
browser, have none. Anyone may still build the app from source, which is the deal in section 5.

**Room the app plan must leave now:**
1. One command layer. Every action an agent needs is a plain function behind the page: open a file, write content, run
   the checks, Play, Publish. The page's buttons and the MCP tools call the same code, and no tool reaches into the
   page's state.
2. The app owns the server. The page never listens on a port.
3. The person sees what the agent does. A change shows in the open editor, the status line says "Claude changed Feel",
   and Undo takes it back, as with sync.

**On a computer** it is close to free. The sidecar already serves a token-guarded HTTP API on 127.0.0.1
(`serve-editor.ts`: `/api/ping`, `/api/list`, `/api/file`). The app adds a Streamable HTTP MCP endpoint beside it, and
a small stdio command for clients that start a server themselves. That command forwards to the running app; it is not
a second server.

**On a phone** (the Owner's second message) there are two limits. Neither was checked against the stores' current rules
in this audit; the plan must check them:
- iOS suspends an app soon after it leaves the screen, and does not let it keep a server listening in the background.
- Android can keep one running only as a foreground service with a notification the person can see, a kind of service
  Google Play reviews.

There are three ways to reach a phone:

| Way | How | For | Against |
| --- | --- | --- | --- |
| A. Same Wi-Fi, app open | The app runs the Streamable HTTP server on the local network while it is on screen. The person pairs a computer once with a code shown on the phone, and the code is the token | Private, no server to pay for, the agent sees the phone's editors live | Only on the same network, and only while the app is open. iOS asks for local network access. A server inside a Tauri phone app is Rust code AF must write: Tauri's localhost plugin has no mobile support (A1) |
| B. A relay | The app connects out to a relay the Owner runs, and the agent connects to the relay with a token | Works from anywhere | A hosted service to run and pay for, which is more than "pay to download". The person's game goes through the Owner's server, which needs a privacy policy line and Apple's privacy label. It still stops when iOS suspends the app |
| C. Through GitHub | With the app closed, the agent works on the game's repository, and its changes wait on the Review page | Always works, and needs nothing new | Not live: the agent cannot open, play or see the phone's editors |

**Recommendation.** MCP on computers first, through the sidecar. On phones, A while the app is open and C when it is
not, with no relay at first. A relay costs money every month and carries people's games through the Owner's server, so
it is worth building only if people ask for it. The phone app says it in words: "Claude can work in your game while this
app is open on the same Wi-Fi. When it is closed, Claude's changes wait in Review."

Apple reviews a local server under guideline 2.5.2, like the rest of the app (A7). The tools change the person's
content, not the app's code.

### Tauri's mobile maturity

Tauri 2.0 (2024-10) added iOS and Android. The latest `tauri` crate is 2.12.5 (crates.io, 2026-11-06); AF pins 2.12.4,
and the CLI 2.12.3. Tauri's own changelog still fixes iOS builds (2.12.3, 2026-10-10: release builds made with Xcode 27
failed to link). The plugins the apps need:

| Plugin | Desktop | iOS and Android |
| --- | --- | --- |
| File system | Full | The app's own folder |
| HTTP | Full | Full |
| Shell (run Node) | Full | Open URLs only |
| Localhost | Full | None |
| Updater | Full | None (the stores update) |
| Deep links | Full (macOS: in config) | In config only |
| `on_new_window` | Yes | Not supported |

Nothing was built for a phone here: there is no Mac or Android SDK in a cloud container. The first mobile spike runs on
the Owner's Mac.

## 8. Pricing

| | Price | Who takes what | The Owner gets |
| --- | --- | --- | --- |
| iPhone and iPad | $19.99 once | Apple, 15% (Small Business Program, under $1M a year) | $16.99 |
| Android | $19.99 once | Google, 15% (not checked here) | $16.99 |
| Mac, Windows, Linux, direct | $39.99 once, all three | Polar (merchant of record, handles sales tax): 5% + 50¢, plus 1.5% on cards from outside the US | $37.49 |
| Steam, later | $39.99 | Steam, 30%, and $100 per app | $27.99 |

Nomad Sculpt, checked 2026-11-08: $19.99 on the US App Store; desktop "~$35 USD" for "1 key → 2 computers", sold
through polar.sh, free to download and try. "A store purchase does not unlock the desktop version, and a desktop key
does not unlock the mobile app." The proposal follows it: two prices, two purchases, and the web, with every editor, as
the free way in.

## 9. The Owner's checklist

Credentials, money and store accounts are the Owner's. In order of what blocks what:

**Before anything is sold**
- [ ] Pixi 3D public, or PixiJS's written permission to ship the beta (A3).
- [ ] The npm organisation `automataframework`, `NPM_TOKEN`, and the first release (A5).
- [ ] Register `automataframework.com`, choose the site host, and give the site a privacy policy and a support page
      that name the apps (A16).
- [ ] Settle the licences in A17.
- [ ] Choose who sells: the Owner as a person, or a company. The stores show the seller's legal name; a company needs a
      D-U-N-S number for Apple and Google organisation accounts.

**Apple (iOS, and notarizing the Mac app)**
- [ ] Apple Developer Program, $99 a year.
- [ ] App Store Connect: the Paid Apps agreement, tax forms, bank account; join the Small Business Program.
- [ ] Reserve the app's name (store names are unique; "AutomataStudio" is already taken).
- [ ] Certificates: Apple Distribution (iOS), Developer ID Application (the Mac app sold directly).
- [ ] An App Store Connect API key (key id, issuer id, `.p8`) for uploads and notarization from CI.
- [ ] Bundle ids and provisioning profiles; the privacy answers, the age rating, the export answer (HTTPS only).

**Google (Android)**
- [ ] Play Console account, $25 once, identity checked; personal or organisation (A12).
- [ ] A payments profile for a paid app; tax details.
- [ ] An upload key (keystore), and Play App Signing turned on.
- [ ] Data safety form and content rating.
- [ ] A closed test with 12 testers for 14 days, if the account is personal.

**Windows**
- [ ] Azure Artifact Signing (about $9.99 a month; individuals in the USA or Canada only), or an OV certificate, or the
      Microsoft Store (free for individuals; it signs the package).

**Linux**
- [ ] Nothing to buy. AppImage and `.deb`; publish checksums.

**Selling the desktop app**
- [ ] A Polar account (or Lemon Squeezy or Paddle) as merchant of record; the $39.99 product with the three downloads.
- [ ] The updater signing key (`TAURI_SIGNING_PRIVATE_KEY`) and somewhere to host updates.

**GitHub**
- [ ] Register the "Automata" GitHub App: device flow on, expiring tokens on, no webhook, the permissions in section 7.
      Its client id goes in the app; there is no secret to keep.
- [ ] Create the private deployment repository and register runners for it, the Mac included (A15). Its secrets are
      the Apple, Google, Windows, Polar and updater ones above.

## 10. Not run

- iOS, Android, macOS and Windows builds; only Linux (WebKitGTK) was built and driven.
- Safari and iOS WebKit, Firefox; the GPU runner's suites.
- Any store review, a real GitHub App, sync of any kind, and a phone-side Play compile: none exists yet.
- `pnpm check`: this stage adds only documents.

## Sources

Checked 2026-11-08: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (2.4.5,
2.5.2, 4.7, 4.8); [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/);
[Play Console testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en);
[GitHub: refreshing user access
tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens);
[GitHub: generating a user access
token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app);
[GitHub REST: repositories](https://docs.github.com/en/rest/repos/repos); [GitHub REST best
practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api); [Play Device and
Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379?hl=en); [Tauri
plugins](https://v2.tauri.app/plugin/) and [Tauri releases](https://tauri.app/release/tauri/all-versions/);
[crates.io](https://crates.io/crates/tauri); [Microsoft code signing
options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options); [Microsoft Store free
registration](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/);
[Polar fees](https://polar.sh/docs/merchant-of-record/fees); [Nomad Sculpt](https://nomadsculpt.com/); [isomorphic-git
merge](https://isomorphic-git.org/docs/en/merge).
