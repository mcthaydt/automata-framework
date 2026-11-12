# The paid app's plan, re-audited against `main` and the full launch scope

Audit session, 2026-11-12, branch `claude/paid-app-plan-reaudit` from `main` `d401ec4d`. It re-reads the paid app's
[spec](../../refactor/2026-11-08-apps-spec.md), [plan](../../refactor/2026-11-08-apps-plan.md) and
[plan audit](../../refactor/2026-11-08-apps-plan-audit.md) (all three merged on 2026-11-09 as #525 and #527) against
today's code. It also reads the ship-readiness audit's Part 2 (`docs/superpowers/audits/2026-11-12-ship-readiness.md` on
branch `claude/ship-readiness-audit`, `dd8612ca`), the closed PRs #544 and #531, and the Owner's rulings of today:
desktop means both readings, the painter (`@automata/figures`) will be published, `@pixi/3d` goes to the public 0.1.0,
and the launch includes 3D and every editor. No product code changed. No subagents. Every fact below says how it was
found.

## Verdict

**Execution cannot start as the plan is written.** Three of the things it stands on are not on `main`:

- **Its base.** All four PRs the plan starts from were closed unmerged at 21:01 today and their branches deleted (B1).
- **The one page with every editor.** No page on `main` holds every editor (B2).
- **Its package names.** The npm scope rename has to run first, alone (B3).

The phase that the brief linked to #544 was never #544's (B4). #544 was a different, web-based sign-in plan. The
paid app's own first build session was **#531**, which also closed unmerged today with about four tasks' worth of work
done.

What can start now:

- **The Rust half of task 2.1**, then the Rust parts of 2.2, 2.3, 3.4 and 5.1. They live in `apps/editor/src-tauri/`
  only, name no npm package, and collide with nothing in flight. They need WebKitGTK 4.1 on the machine that runs them
  (F12).
- **The Owner's accounts, listed at the end.** They take weeks of lead time, and none of them waits on code.

Everything in `packages/`, `extensions/` and the app's TypeScript waits for the rename to merge.

**Smallest shippable app:** the desktop app first, on Linux, macOS and Windows. It has every editor, Play, Publish, Home,
updates, a clean quit and nothing lost. That is 11 of the 30 tasks plus the every-editor page, about 13 to 16 sessions
(F18). The phones, GitHub sync in the app and the Review page follow in later releases.

**#531 and #544:** do not revive either branch whole. Re-implement on today's `main`, carrying #531's tested code
across task by task, and take #544's later sync pieces only if the Owner keeps sign-in on the web (D5) (F5, F6).

The plan and spec are corrected in place for every finding a document can fix. Both carry a dated "Re-audit
amendments (2026-11-12)" block, and the tracker has a new row.

## What was run

| What | Result |
|---|---|
| `pnpm install --frozen-lockfile` on `d401ec4d` | exit 0 |
| Existence and line check of every file the plan names (a loop over 25 paths) | 22 exist, 3 missing: `SuiteHeader.svelte`, `kit/nav/Sidebar.svelte`, `2026-11-08-editors-v2-spec.md` |
| `gh api` on PRs #508, #522, #559, #532, #531, #544, #536, #528 | all `closed`, `merged_at: null`, closed 2026-11-12 21:01:46 to 21:01:56 |
| `git ls-remote origin` | none of `claude/project-thread-q3zxgn`, `-fxu792`, `complete-game-journeys`, `-szjdbh`, `claude/desktop-games`, `claude/editor-journeys-green` is on `origin`; `refs/pull/544/head` = `f380d358`, `refs/pull/531/head` = `714796a2` |
| Trial merge of `pr544` into `main` (scratch worktree, aborted, nothing pushed) | 882 files conflict (it carries the whole closed stack) |
| Its own 146-file diff (`829039d5..f380d358`) applied with `git apply --3way` | 24 files conflict; 2 targets no longer exist (`site/src/features/editor/EditorPage.svelte` and its test) |
| Trial merge of `pr531` into `main` | 29 files conflict (listed in F5) |
| `cargo --version`, `pkg-config --modversion webkit2gtk-4.1`, `cargo tauri` | cargo 1.97.0; WebKitGTK 4.1 not found; no Tauri CLI |
| `node -e "new URL('tauri://localhost')"` | `host` `localhost`, `origin` `null` (the spec's section 5 rule holds) |
| GitHub's docs, "Refreshing user access tokens" | `client_secret` is "required unless the user access token was generated using the device flow" (the plan's 5.1 is right) |

Not run: any Tauri build (no WebKitGTK, no Tauri CLI here), `pnpm check` (no code changed), WebKit, Firefox, any Mac or
device step, anything against real GitHub or Cloudflare.

## Findings

Classes: **blocking** stops a task from being built as written; **should fix** would build the wrong thing or waste a
session; **tidy** is a stale reference or a wording fix. "Fixed" means the plan or spec text now says it.

### Blocking

**B1. The plan's base is gone.** The plan starts from "a merge of `claude/project-thread-q3zxgn` and
`claude/project-thread-fxu792`" (plan line 26, task 0.1 step 1). Those are editors v2 (#559) and the shared-editors fixes
(#522). Both closed unmerged today, along with #508 under them and #532 above them, and their branches are deleted.
`main` has the pre-v2 shell:

- `SuiteTopBar.svelte`, where Play is `<a class="play" href={playUrl} target="_blank">` at line 82;
- `SuiteRail.svelte`;
- `SuiteEnv` with `playUrl` and `publish` (`boot.ts:26-29`).

There is no `SuiteHeader.svelte`, no `kit/nav/Sidebar.svelte`, no `SaveState`, and no v2 spec in `docs/refactor/`.
Tasks 1.1, 2.4 and 6.2 point at files that do not exist. Task 6.2's "as drawn in the v2 mockup" and the v2 spec's
lines 51-53 are not on `main`.

*Fixed:* the plan's base is `main` after the rename (B3), the file references are `main`'s, and task 6.2 adds the Review
row to `SuiteRail.svelte`.

**B2. No page holds every editor.** On `main` there are two separate pages:

- `packages/editor-3d`'s `suite-full`: Tuner, Levels 2D, Levels 3D, Studio/Characters (`suite-main.ts:8-11`);
- `extensions/editors`' suite: Tuner, Levels 2D, Feel, Audio, Writer, Sequence, Schematic (`main.ts:19-21, 30-44`).

Task 2.1 says "imports the full suite from `extensions/editors`". That would ship an app with no Levels 3D and no
Characters, against the Owner's "the launch includes 3D and every editor". The page that joins them was #522 and #559
(closed). The shared-editors area that would rebuild it is at stage 1 of 6 (`progress.md:706-713`). Ship-list item 10
("the 3D editors and the content editors reach a stranger") needs the same page for `automata editor`.

*Fixed:* the plan gains a dependency. The app imports the every-editor page that item 10 (or the shared-editors build)
makes and does not build its own. If item 10 ships the editors as their own package (D4), the app still imports it from
the workspace and needs nothing published. Task 2.1's test now asserts that Levels 3D, Characters and Feel are on the
page. *Needs coordination:* the coordinator gives one session the every-editor page, either inside item 10 or as
shared-editors stage 2.

**B3. The rename runs first, alone.** The `@automata` scope on npmjs.org belongs to another account (ship audit Part 1).
The Owner's new org name is not yet chosen, so "`@automataframework`" in the plan and spec (spec section 4, Global
Constraints) is a guess. Every task in phases 0, 1, 3, 4.2 and 5.5 edits `packages/editor`, `packages/tools` or
`packages/content`. Started before the rename merges, each would conflict with it in every import.

*Fixed:* Global Constraints say nothing outside `apps/editor/src-tauri/` starts until the rename has merged. Package
names are written only in `framework-packages.ts`, as before, and the new name is "the org the Owner chooses".

**B4. #544 was not this plan's sync phase.** #544 (`f380d358`, base #532's branch) built a different area's plan: "Saving
on the device, the try-it apart, and sign in with GitHub" (spec, plan and audits in its `docs/refactor/2026-11-08-sign-in-sync-*.md`,
none on `main`). It has:

- web sign-in through a Cloudflare Pages Function (`site/functions/api/github/[[route]].ts`);
- a REST engine over GitHub's API (`kit/sync/rest-engine.ts`) instead of git;
- the access token in page memory.

Its spec records an Owner decision that this plan lacks: "2026-11-08 22:30 | D2: GitHub sync is free on the web;
`/app` drops 'Sync with GitHub'". `main` already follows D2: `site/src/features/app/app-offer.ts:45-49` lists "sign in
with GitHub and they stay in sync" under the web, not the app. The apps spec section 3 still says "only the download
has GitHub sync and the Review page".

*Fixed:* spec sections 2 and 3 carry D2. Sync code lives in the editor kit (`packages/editor/src/shared/kit/sync/`,
#531's ruling) so the web and the app share it. The app adds the git engine, the keychain and the device flow; Review
stays app-only.

*Needs the Owner:* D5 (revive web sign-in or take the line off Home) decides whether the web half is built at all. The
app's phase 5 can be built either way.

### Should fix

**F5. #531 holds the plan's first build session, recoverable.** #531 ("the build's first session", base `main`
`40b249f6`, 127 files) did the following, by its body and diff:

- 3.1 whole: `@…/content/compile` with no Node or Effect behind it, and a boundaries rule;
- 3.2 for the 2D template and Emberwick;
- 3.3's `compileGame` with refusals;
- 4.1 whole: the contract suite on the app store;
- the tools half of 4.2 (`templateFiles`) and the template half of 5.5 (`AGENTS.md`, `.gitignore`);
- the server halves of 1.2 (`GET /api/watch`) and 1.4 (`--app-origin`);
- 5.1's device sign-in, 5.3's loop and 5.4's merge drivers, as `kit/sync`;
- a start on `kit/review` and `kit/player`.

The tracker says "Not started (0 of 30)". That is true of `main`, but it hides about four sessions of tested work.

A trial merge conflicts in 29 files: `docs/refactor/progress.md`, `docs/versions.md`, `docs/cheatsheet.md`, the agent's
`api.md`, `games/emberwick/vite.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, content's
`package.json`, `tsdown.config.ts`, `automata-content.ts`, `compile-content.ts`, `read-sources.ts` and a test,
`packages/editor/package.json`, tools' `cli.ts`, `help.ts`, `editor-args.ts`, `editor-command.ts`, `serve-editor.ts`,
`create-game.ts`, `template-project.ts`, `template.ts`, `tsdown.config.ts` and three tests, and two tooling tests. Every
file of it uses the old `@mcthaydt/automata-*` names (`git show pr531:packages/content/package.json`), which `main` has
since renamed, and a second rename is coming.

*Fixed:* each task the plan lists names "#531 has this; carry its tests and code across, renamed" as its Step 0, with
the head `714796a2` to read it from. Fetch it with `git fetch origin refs/pull/531/head`.

**F6. #544: what it built, and the honest cost.** Its own diff is 146 files, 13,143 lines:

- Phase 1, saving: typed words saved 500 ms after typing, drafts in `localStorage`, one Undo step per field visit. This
  fixes the customer-value audit's V2.
- Phase 2, games kept in the browser (OPFS), on top of #532.
- The Pages Function (PKCE S256, `state`, sealed `HttpOnly; Secure; SameSite` cookies at `Path=/api/github/`, the
  token route requiring the site's `Origin` and an `X-Automata: 1` header, `safeBack` refusing `//`).
- `kit/sync` from #531 plus `rest-engine.ts`, `web-sync.ts`, `SyncStopped`, `line-merge.ts`, `blob-id.ts`, and the
  "Keep mine / Keep GitHub's / Keep both" dialog.
- Three Chromium journeys.

Its body says what never ran: anything against real GitHub or Cloudflare, `pnpm check` whole, `check:site`, WebKit and
Firefox. It also says commits skipped the pre-commit hook.

Against `main`: merging its head brings the closed stack (882 conflicting files). A 3-way apply of its own diff
conflicts in 24 files and finds 2 targets gone. Its web-games half needs #532's every-editor page, which is not on
`main`.

**Recommendation: do not revive #544.** Reviving means rebuilding #532's base, resolving 24 or more files and renaming
twice (L, two to three sessions) before anything is trusted, and it still would not be the app's design. Instead:

1. Re-implement the app's sync phase on today's `main` (5.1 to 5.5, about 6 sessions; fewer if #531's `kit/sync` is
   carried across).
2. Take #544's later pieces (`SyncStopped`, `line-merge.ts`, the choice dialog and its tests) as references to copy
   from.
3. Hand #544's phase 1 (typed words saved) to the editors' owner as its own small PR. It is a data-loss bug fix the
   launch needs whatever happens to the app.
4. Build the Pages Function again only if D5 keeps web sign-in.

**F7. The sidecar cannot run `editorCommand` as written.** Task 2.2 has the sidecar run `editorCommand` with
`--port 0 --token --app-origin`. Two problems:

- `editorCommand` refuses the full page outside the repository unless `--app-dir` is given ("The 3D editors are not in
  this release yet.", `editor-command.ts:92-96`).
- It serves a page the app does not use, because the app loads its own build.

*Fixed:* the sidecar passes `--app-dir` pointing at the app's bundled page. Task 2.2's test covers a 3D game outside the
workspace.

**F8. Task 1.4 has no CORS to extend.** `serve-editor.ts` sends no `Access-Control-*` header (`grep -c` gives 0). It
refuses a cross-origin write by comparing `new URL(origin).host` with the `Host` header (lines 238-245, not the plan's
240-251). The task builds the CORS reply and the `OPTIONS` preflight from nothing.

*Fixed:* line references, and the step says "add".

**F9. Task 4.1 re-creates what exists.**

- `flushOnHide` is on `main` (`kit/storage/page-lifecycle.ts:19`, exported from `kit/core/index.ts:84`).
- `ProjectStore.watch?` is declared (`project-store.ts:87`).
- The `kind` union is at line 70.
- Writes are already mtime-guarded (`WriteExpectation`, `suite-ports.ts:76`).

*Fixed:* 4.1 reuses these.

**F10. Template references moved, and template work collides.** `template-project.ts` now imports `automataContent` at
line 138, the conditions are at 150 and the plugins at 153 (the plan says 118, 127, 132). There is no
`content.config.ts`, no game `AGENTS.md`, and `.automata/` is in a game's `.gitignore` only for the `tauri` target
(`create-game-targets.ts:77`).

Tasks 3.2, 4.2 and 5.5 all edit `packages/tools/src/shared/create-game/`, as does the rename. Ship items 8 and 12 may
too (the 3D template's `PIXI_3D_SPEC`, the `tauri` target).

*Fixed:* references updated. The three tasks run in one lane, one after another.

**F11. The tracker and the plan's counts.** The progress row says "Not started (0 of 30 tasks)" with no word of #531,
#544 or this re-audit.

*Fixed:* a new row (stage 3b) links this document. The build row says #531 is recoverable.

**F12. Tauri tooling is not what the plan says.**

- The plan says "a cloud session has … WebKitGTK through `tauri-driver`". This container has neither WebKitGTK 4.1
  nor the Tauri CLI.
- The repository pins the CLI as an npm package (`@tauri-apps/cli` 2.12.3, `docs/versions.md:69`), not `cargo tauri`.

*Fixed:* steps run `pnpm exec tauri …` from `apps/editor`. Task 2.1 records the system packages it needs
(`libwebkit2gtk-4.1-dev` and Tauri's Linux list) and runs on `af-linux` or a session whose environment installs them.

**F13. Windows has a runner the plan does not use.** `.github/workflows/windows-trial.yml` runs on `af-windows`. The
spec sells Windows, and task 7.2 builds only Linux and macOS.

*Fixed:* 7.2 adds an unsigned Windows bundle on `af-windows`.

**F14. One set of Tauri pins for games and the app.** Games as desktop apps (reading (a)) pin crates in
`packages/tools/src/shared/ship/targets/tauri/tauri-project.ts:12-18` (`tauri` 2.12.4, `tauri-build` 2.7.3, store,
process, opener). The app needs the same crates plus fs, http, shell and updater.

`claude/desktop-games` is not on `origin`, so its changes could not be read. The two lanes share:

- the Owner's Apple Developer membership;
- notarisation through `APPLE_*` secrets;
- the Windows certificate;
- the af-mac and af-windows runners.

They do not share code. The app is built by the private deploy repository; a stranger signs their own game.

*Fixed:* task 2.1 adds a test that the app's `Cargo.toml` pins equal `CRATE_PINS` wherever both name a crate, so a bump
in one fails until the other follows.

**F15. The app needs no published package; a game opened in it does.** The app bundles the editors and the phone
runtime from the workspace, so ship items 8 to 10's publishing is not a dependency of the app's build. A game the
desktop app installs from npm ("Getting your game ready…") is a dependency:

- a 2D game needs the renamed framework, content, sim and tools published (items 1, 16, 17);
- a 3D game also needs `@automata/3d` built and published (item 8) and `@pixi/3d` public (items 7, 11).

The spec already limits the desktop app to games with packages installed until the release.

*Fixed:* the Global Constraints name items 1, 8 and 17 instead of "A5".

**F16. The editor journeys must be green before task 1.1.** Task 1.1 turns Play from a link into a button, and its
check is "the 2D journeys' Play step still passes". Those journeys are red on `main` (ship audit Part 1, M5: 23 passed,
15 failed), and their fix branch `claude/editor-journeys-green` is not on `origin`.

*Fixed:* task 1.1 waits for that fix to merge, or records which journeys were red before it started.

**F17. The painter's name and the app bundle.** The Owner rules the painter is published, so the app may carry
`character-kit` with painted figures. The plan's test "no source or built file contains FigureBuilder" would still trip
on comments: `extensions/character-kit/src/features/hair/*.ts` (8 files) and `extensions/figures/docs/contract.md` name
FigureBuilder.

*Fixed:* the test reads the app's own `src/` and its built bundle's strings, not the workspace packages' comments.

**F18. The smallest shippable app.** The spec's "done" has five platforms, sync, Review and the phone player. A first
paid release needs far less to be true and worth $39.99. `main`'s `/app` page promises the download only this (the
`app` list, `app-offer.ts:51-55`):

- "installs in one step and keeps itself up to date";
- "the editors on your phone, tablet or computer, made for touch";
- MCP "coming later".

The phone and the computer are priced separately, and each store link is `null` ("Coming soon") until it sells.

**Release 1: the desktop app on Linux, macOS and Windows.**

| | Tasks |
|---|---|
| MUST | 0.1, 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 7.1 (updates), 7.2 (CI), 7.3 (desktop half: make, edit with three editors, Play, Publish, quit, reopen), 7.4 (deploy handover, Privacy and Terms) |
| From the ship list | the every-editor page (item 10 or shared-editors stage 2, B2) |
| SHOULD | 1.2 (watch). Not a MUST: writes are mtime-guarded and the conflict dialog exists, so an agent's edit is never silently overwritten (Review Focus 1 holds without it). It is the first task after release 1, because people will run Claude Code beside the app |

Platform order:

1. **Linux** builds first, in CI on `af-linux` once WebKitGTK is installed, and can ship unsigned (AppImage and `.deb`).
2. **macOS** needs the Owner's Apple Developer ID and notarisation, or Gatekeeper refuses it.
3. **Windows** works unsigned behind a SmartScreen warning and needs a certificate to be clean.

All three are one build, so they ship together once the signing exists.

Why sync, Review and the phones wait, from the spec:

- Sync is free on the web (D2), so the app does not sell it.
- Review needs sync.
- The phones need the in-app compile (phase 3) and Apple review under 2.5.2 (spec section 17, one round budgeted).
- Google Play's closed test needs 12 testers for 14 days on a personal account (spec section 12).

**Release 2: the phones (iOS, Android)** with phases 3 and 4, then sync (phase 5) and Review (phase 6). Phase 8 (MCP)
stays last.

A 2D-only app stays ruled out (the Owner, 21:33). Release 1 sells nothing before `@pixi/3d` is public.

*Fixed:* spec section 12 and the plan's opening carry the release split. The corrected task table marks each task's
release.

### Laws and security

**F19. Laws, task by task: no breach in the plan's design; three gaps.**

Each law and where the plan meets it:

- **Host is a port.** Met: the `SuiteHost` port, and `packages/editor` never sees Tauri.
- **Only a target's adapter imports platform packages.** Met by `src/shared/tauri/`, but `apps/editor` must join
  `--platform-imports` in `pnpm boundaries` (package.json line 25 lists `packages extensions games examples tooling`,
  no `apps`).
- **No silent fallback to device storage.** Met: the keychain refusal says so (5.1), and the phone's missing sidecar
  fails (4.3).
- **Window-message handlers check source and origin.** `watch-bridge.ts:38` checks both today. `solver-client.ts:32`
  listens on a worker it made, so a check is not needed there. `site/.../Playground.svelte:293` is the site's own. The
  plan's list is complete.
- **Responsive UI.** Met: 44 and 48 px targets, phone first, rotation not named. *Gap:* task 2.4 adds a rotation and
  compact-height check.
- **Zod only.** Met: 8.1 uses Zod.
- **Effect only in Node tooling.** Met: the sidecar is Node tooling, and the page compiles through 3.1's pure modules.

Gaps: (a) `apps` is not in the boundaries or style scripts; (b) rotation; (c) `docs/refactor/copy.md` has no "Apps"
section yet (its headings end at "Site slice").

*Fixed:* 2.1 adds `apps/editor` to `boundaries` (`--features`, `--platform-imports`) and `style`; 2.4 adds rotation;
0.1 creates the copy section.

**F20. Sign-in security.**

The app's design:

- Device flow with no client secret is right: GitHub's docs say the refresh needs no secret for device-flow tokens.
- Tokens live in the keychain through Rust commands, never a file.
- Scopes are the GitHub App's fine-grained permissions on chosen repositories only.

Two points to carry:

- (a) The Linux keychain is the Secret Service, which minimal desktops lack. The plan's refusal path covers it. 5.1
  should test it explicitly on Linux.
- (b) One GitHub App can serve both flows. If D5 keeps web sign-in, the same "Automata" app has "Enable Device Flow" on
  and the web callback URL, and its permissions are asked once: GitHub asks the person to approve again when an app
  adds a permission, so the list stays as spec section 8 has it.

For #544's Pages Function, if revived:

- (c) `SITE_ORIGIN` falls back to the request's own origin. A Cloudflare preview deployment (`*.pages.dev`) would then
  run the sign-in with production secrets. The Owner sets `SITE_ORIGIN` and scopes the secrets to production only.
- (d) Its `Privacy.svelte:13` says "Pages make no requests to other services". A web sign-in makes that false, so the
  words change with it. #544 drafted them, unapproved.

*Fixed:* (a) and (b) in task 5.1. (c) and (d) are recorded for D5.

### Tidy

**T21.** `automata-content.ts:72`, where the plan says the module text is built, is now `moduleCode` at line 74.
**T22.** The content-editors spec's lines 12-13 still say only the iOS and Android packaging is paid. Task 0.1 still
applies. **T23.** `TRADEMARK.md` does not exist yet. 0.1 still applies. **T24.** `docs/versions.md` already lists
`@modelcontextprotocol/sdk` 1.32.1 (line 34), so 8.2's pin is right. **T25.** Isomorphic-git's "1.44.11 is too new
today" (spec section 8) is stale. Pick the version at task 5.2 by the 14-day rule, as the plan says.

## Dependencies on work in flight

| Work | Relation to this plan |
|---|---|
| The scope rename (ship item 1) | Runs first, alone. Nothing here outside `apps/editor/src-tauri/` starts before it merges (B3) |
| `@automata/3d`, the kits, the editors as packages (items 8 to 10) | The app needs none of them published. It needs item 10's every-editor page (B2). A 3D game in the desktop app needs item 8 published (F15). No duplication, provided the every-editor page is built once, by item 10 |
| `@pixi/3d` public (items 7, 11) | Nothing is sold before it. The app bundles whatever `packages/3d` uses at the time |
| `claude/desktop-games` (reading (a)) | Not on `origin`, not read. They share the Owner's Apple and Windows signing and the runners, not code. The crate pins are kept equal by a test (F14) |
| `claude/editor-journeys-green` | Not on `origin`. Task 1.1 waits for it (F16) |
| The painter published (D2 of the ship audit, ruled) | The app may carry painted figures. The name test reads only the app's bundle (F17) |

## Corrected task table

Size: S is under one session, M is one, L is two or more (90-minute sessions). Release: 1 is the desktop app, 2 the
phones, sync and Review, L is the later MCP stage. Lane: tasks in the same lane edit the same folders and run one after
another; different lanes can run as separate sessions on separate branches.

| Task | Size | Release | Lane (folders it owns) | Waits for | #531 has |
|---|---|---|---|---|---|
| 0.1 Documents, `TRADEMARK.md`, copy section | S | 1 | docs: `docs/refactor/2026-11-08-content-editors-spec.md`, `README.md`, `TRADEMARK.md`, `docs/refactor/copy.md`; the template README line in `create-game/template-project.ts` | rename | — |
| 1.1 `SuiteHost` | M | 1 | E: `packages/editor/src/shared/kit/ports/`, `.../features/suite/shell/` | rename, editor journeys green | — |
| 1.2 `watch` | M | 1 (SHOULD) | T then E: `packages/tools/src/features/editor/`, `.../kit/storage/` | rename | server half |
| 1.3 `SuiteCommands` | M | L (MCP) | E | 1.1 | — |
| 1.4 Origins, CORS | S | 1 | T: `packages/tools/src/features/editor/`; `extensions/editors/src/features/schematic/watch-bridge.ts` | rename | `--app-origin` |
| 2.1 `apps/editor` (Rust half) | M | 1 | R: `apps/editor/src-tauri/` | WebKitGTK on the machine | — |
| 2.1 `apps/editor` (TS half) | M | 1 | A: `apps/editor/` but `src-tauri`; `pnpm-workspace.yaml`, `package.json` scripts, `knip.jsonc` | rename, the every-editor page | package shell |
| 2.2 Sidecar | L | 1 | A + R | 2.1 | — |
| 2.3 Play, Publish, install, quit | M | 1 | A + R | 2.2 | — |
| 2.4 Home, header at phone size | M | 1 | A; E for `SuiteTopBar.svelte` | 2.2, 1.1 | — |
| 3.1 Content compile without Effect | M | 2 | C: `packages/content/src/shared/compile/`, `entries/` | rename | whole |
| 3.2 `content.config.ts` | S | 2 | G: `packages/tools/src/shared/create-game/`, `games/emberwick/` | 3.1 | 2D and Emberwick |
| 3.3 The game compile | L | 2 | A: `apps/editor/src/features/player/` | 3.1, 3.2 | `compileGame`, refusals |
| 3.4 Play scheme, play view | M | 2 | R + A | 2.1, 3.3 | — |
| 4.1 App store | S | 2 | A: `apps/editor/src/features/app-store/` | 2.1 TS | whole |
| 4.2 A new game on a phone | M | 2 | G, then A | 3.2, 4.1 | tools half |
| 4.3 iOS and Android projects | L | 2 | R: `src-tauri/gen/`; Owner's Mac, devices | 4.1, 4.2, 3.4 | — |
| 4.4 Code view | S | 2 | A | 3.4 | — |
| 5.1 Secrets and sign-in | M | 2 | R (`secrets.rs`, can start early) + K: `packages/editor/src/shared/kit/sync/` | rename (TS half) | device flow |
| 5.2 Git engine | L | 2 | A: `apps/editor/src/features/sync/` | 4.1 | — |
| 5.3 Pull, push, status line | M | 2 | K + E (`suite-ports.ts`) | 5.2 | loop, words |
| 5.4 Merges by file kind | M | 2 | K | 5.3 | drivers |
| 5.5 Game `AGENTS.md`, get a game | M | 2 | G + A | 5.2, 4.2 | template half |
| 6.1 Review port | M | 2 | A + E (`suite-ports.ts`) | 5.3 | partial (`kit/review`) |
| 6.2 Review page | M | 2 | E: `packages/editor/src/features/review/`, `SuiteRail.svelte` | 6.1 | — |
| 6.3 The three buttons | L | 2 | A | 6.2, 3.4 | — |
| 6.4 Use without asking | M | 2 | A | 6.3 | — |
| 7.1 Updates, purchase key | M | 1 | A + R | 2.3 | — |
| 7.2 Public CI (Linux, macOS, Windows, iOS sim) | M | 1 | `.github/workflows/apps.yml` | 2.1 | — |
| 7.3 Real-thing journey | L | 1 (desktop half), 2 (rest) | A: `apps/editor/tests/e2e/` | 2.4, 7.1 | — |
| 7.4 Deploy handover, Privacy, Terms | S | 1 | docs; `site/src/features/legal/` | Owner's words | — |

**Critical path to release 1:**

1. The rename (item 1).
2. The every-editor page (item 10, which waits on items 7, 8 and 9).
3. 2.1 TS, then 2.2, then 2.3, then 2.4 and 7.1, then 7.3.
4. `@pixi/3d` public and the Owner's signing and selling accounts.

The app's own tasks are not the long pole; the 3D lane of the ship list is.

**Lanes that can run at once after the rename:**

| Lane | Folders | Tasks |
|---|---|---|
| R | `apps/editor/src-tauri/` | 2.1R, 2.2R, 2.3R, then 3.4R and `secrets.rs`; R can start before the rename |
| E | `packages/editor/` kit ports and the suite shell | 1.1, then 1.3, then 2.4's header, 5.3's and 6.1's port lines, 6.2 |
| T | `packages/tools/src/features/editor/` | 1.4, 1.2's server |
| C | `packages/content/src/shared/compile/` | 3.1 |
| G | `packages/tools/src/shared/create-game/` and `games/emberwick/` | 3.2, 4.2's tools half, 5.5's template half |
| K | `packages/editor/src/shared/kit/sync/` | 5.1, 5.3, 5.4 |
| A | the app's TypeScript | everything else |

E and K both touch `suite-ports.ts`, so their port lines go in one at a time.

**Honest total.** Release 1 is about 13 to 16 sessions: 11 tasks of about 12 sessions, plus a build audit and its
fixes. The every-editor page is item 10's and is not counted. Everything is about 40 sessions: 30 tasks of about 34
sessions, plus about 6 for audits and fixes per phase pair. Carrying #531 across saves about 3 to 4. MCP, 4 tasks, is
about 5 more.

## What needs the Owner

Each item says what it blocks.

| # | Action | Blocks |
|---|---|---|
| O1 | Create the npm organisation and say its name (ship item 1) | **The first task** outside `src-tauri` |
| O2 | Answer D5: web sign-in (revive #544's idea; F6) or take "Sign in with GitHub" off Home and `/app` | Phase 5's web half; Home's copy |
| O3 | Approve the release split (F18): desktop first, phones later | The order of work; not code |
| O4 | Apple Developer Program membership (one membership covers the Mac app, iOS, and games-as-desktop proofs). Then a "Developer ID Application" certificate exported as a `.p12`, and an app-specific password. Six secrets in the private deploy repository: `APPLE_CERTIFICATE` (the `.p12`, base64), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | The macOS release, TestFlight; not any task's tests |
| O5 | A Windows code-signing certificate (OV or EV from a CA, or Azure Trusted Signing), its secret in the deploy repository | A clean Windows release (unsigned works behind SmartScreen) |
| O6 | App Store Connect (same Apple membership): accept the Paid Apps agreement, tax and bank forms, create the app record. Google Play Console (one-time fee): the closed test with 12 testers for 14 days, started at least three weeks before the phone launch | Release 2 only |
| O7 | Payment for the desktop: open the merchant-of-record account (the spec recommends Polar; the MoR handles sales tax and VAT), create the $39.99 product with licence keys. The phones' $19.99 is set in each store (Apple and Google are the merchant there). Confirm both prices; they are already on `/app` via `shared/content/pricing.ts` | Selling; not code |
| O8 | Licence checks: decide that the update endpoint (private) checks the purchase key against the MoR's licence API. The open code checks nothing (spec section 3) | 7.1's live half only |
| O9 | Updater: generate the Tauri updater key pair (`tauri signer generate`), keep the private key and its password as deploy-repository secrets, and give the public key and endpoint URL to the build's environment. Choose where the update manifests are hosted (behind the licence check) | Release 1's updates (7.1 builds and tests with a fake) |
| O10 | Privacy and Terms: approve the `#app` sections' words, and a support address on a registered domain (ship item 2). Both stores need a privacy-policy URL | 7.4, store submission |
| O11 | Register the GitHub App "Automata" (device flow on; Contents RW, Metadata R, Pull requests RW, Checks R, Commit statuses R; if D5 keeps web sign-in, its callback URL too) | Phase 5's live run; tests use a fake |
| O12 | Create `mcthaydt/automata-apps-deploy` (private) with access to the runners | Any signed build |
| O13 | The DUEL palette: Arilyn's written permission, or legal advice (spec section 12) | Selling |
| O14 | Real-device runs: the Mac, an iPhone, an Android phone (tasks 4.3, 7.3, 8.3) | Release 2 |
| O15 | Say whether `claude/desktop-games` and `claude/editor-journeys-green` exist anywhere: neither is on `origin` | F14, F16 |

None of O4 to O14 blocks the first task. Only O1 does, for everything but the Rust lane.

## Amendment, 2026-11-12 (the coordinator's ruling 4): the trial merge was shallow

The sizing above is wrong in one place. The trial merge of `pr544` into `main` (in "What was run") that showed 882
conflicting files ran on a shallow clone. Findings B1 and F6 and the recommendation "do not revive #544" rest on that
figure. The original findings are left as written; this section corrects them, in the words the v2 landing plan's
audit supplied ([the plan's "For the coordinator"](../../superpowers/plans/2026-11-12-editors-v2-landing.md)):

- **B1.** The closed stack's base branches are restored (2026-11-12). The v2 look reaches `main` through the v2
  landing plan's Tasks 2 to 4. Tasks 1.1, 2.4 and 6.2 of the paid app's plan go back to v2's files
  (`SuiteHeader.svelte`, `kit/nav/Sidebar.svelte`) once that plan's Task 4 has merged, and 2.1 waits for its Task 6.
- **F6.** On full history the sync tip (#564) conflicts with `main` in 85 files, not 882, and in 12 against the v2 tip.
  Sync lands by merging #564's tip after launch (the v2 landing plan's Tasks 8 to 11), not by rebuilding it, so
  "do not revive #544" no longer stands as written.
- **Recommendation 3** (typed words saved, #544's phase 1) is the v2 landing plan's Task 1.
