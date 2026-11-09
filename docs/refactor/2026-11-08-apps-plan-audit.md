# The paid desktop and mobile apps: plan audit

Stage 3 of the apps area. It audits the [spec](2026-11-08-apps-spec.md) and the [plan](2026-11-08-apps-plan.md) on PR
#525 (`4ac88c7f`, stacked on the audit, #511) for completeness, consistency and cohesion. Every claim was checked
against the code at the top of the editors stack: the editors v2 build (`claude/project-thread-q3zxgn`, `2c0c255e`),
with the shared-editors fixes (`claude/project-thread-fxu792`) and the complete-game base (#508, `89db7336`) beside it.

The Owner's decisions it checks against: every editor is free on the web and people pay to download the app; MCP only
in the apps, on a phone over local Wi-Fi with no relay; the app never names FigureBuilder or EnvironmentBuilder; launch
waits for Pixi 3D; progress must persist.

## 1. The answer

The spec and plan are sound in shape: the five ports, one page on five platforms, the in-app player, isomorphic-git and
the Review page fit the code and the Owner's decisions, and every Owner decision of 21:25 to 21:33 is carried. They are
not ready to build. Five things would stop the build or ship the wrong thing:

- the phone player as written refuses every game, because every game's `vite.config.ts` has the Svelte plugin (H1);
- the runtime the phone carries misses packages every template imports (H2);
- "progress must persist" is in neither document, and no test closes and reopens the app (H3);
- the npm release and the package rename (audit A5) fell out, so the desktop's first install cannot work (H4);
- the base the plan starts from does not exist as described, and its file references point at the pre-v2 code (H5).

None needs an Owner decision. All are fixes to the spec and plan, for the plan-and-spec author to make before the
build starts.

## 2. The real thing, end to end

The app does not exist yet, so the check ran on the free web editors at the stack top, the same suite the app will
load. A journey (copied to the project files, `refactor/2026-11-08-apps-plan-audit/persist-journey.test.ts`) made a new
2D game with `automata create-game`, opened `automata editor` on it and:

1. added J to Left in the Tuner and a 30-frame flash on "square bumped" in Feel (both written to the game's files);
2. reloaded the page: Feel still showed 30 frames and the Tuner still showed J;
3. stopped the command, closed the tab, ran `automata editor` again in a new tab: both still there;
4. pressed Play: J moved the square to the wall and the bump flashed the screen (brightness rose by more than 40).

Passed in Chromium at phone (390 × 844) and iPad sizes, 31 to 34 s each. Not run: WebKit and Firefox (not installed in
a cloud session), and anything in a Tauri window (no app yet). Screenshots:
`/mnt/project-files/refactor/2026-11-08-apps-plan-audit/`.

Two things seen on the phone screenshots, for the build: the header cuts the open editor's name to "Tu…" (A18 is still
live in the v2 header), and the Play button is an icon with no word beside a large "Publish".

## 3. Findings

### High

**H1. The phone player refuses every game.** Spec section 7 says a game with "a `vite.config.ts` plugin beyond the
content plugin" plays only on a computer. Every game the templates make has `plugins: [svelte(), automataContent(...)]`
(`packages/tools/src/shared/create-game/template-project.ts:118,132`), and so has Emberwick
(`games/emberwick/vite.config.ts:36`), because "the framework's screens are Svelte components, compiled with the game"
(the template's own comment). The template also picks the host adapter through a package condition,
`resolve.conditions: ['automata-web', …]` (`template-project.ts:127`; Emberwick uses `automata-ruken`), which the spec does
not mention.
*Fix:* the prebuilt runtime is built with the framework's Svelte screens already compiled and with the `automata-web`
condition; the player allows the Svelte plugin and the content plugin, and refuses only a game's own `.svelte` files
(the templates and Emberwick have none; `games/base-3d` has six) or any other plugin. Task 3.3's refusal test changes to
match, and gains a case: a template's unchanged `vite.config.ts` is not refused.

**H2. The phone runtime misses what the games import.** Spec section 7 lists `@automata/framework`, `-sim`, `-content`'s
browser entries, `pixi.js`, `@pixi/3d` and `zod`. The templates and Emberwick also import `@automata/feel` and
`@automata/feel/stage`, `@automata/audio-synth` and `@automata/audio-synth/stage` (a new 2D game plays Feel and Audio),
`@automata/3d`, `@automata/3d/sim` and `@automata/3d/level` (a 3D game reaches Pixi 3D through `@automata/3d`, never
directly), `@automata/content/level-2d`, `/palette`, `/controls`, `@automata/sim/hash` and the framework's `theme.css`.
Emberwick also depends on `@fontsource/pixelify-sans`, so by the spec's own rule ("a package the app does not carry") it
would be refused, while section 7 promises it plays.
*Fix:* the runtime manifest is made from the templates' `package.json` dependencies and every browser subpath export
they name, with a test that each template's imports resolve against it; decide Emberwick (carry the font, or drop it from
the promise).

**H3. "Progress must persist" is not in the spec or the plan.** The Owner's rule (2026-11-08 21:35): every audit reloads,
closes and reopens, and confirms the work is still there. The documents test a watch event and a merge, but nothing
quits the app and opens it again. On a phone this matters most: iOS and Android may end a webview that is in the
background without warning, so an edit held only in memory, or a push waiting in a 10 s batch, is lost.
*Fix:* a sixth Review Focus item, "The app is closed, or the phone ends it, right after an edit", with steps in:
task 4.1 (the app store writes through on every save and flushes on `visibilitychange` and `pagehide`); task 5.3 (a
commit made but not pushed is pushed on the next open, with no second commit); task 6.4 (the switch and the last 10
used changes survive a restart); task 5.1 (sign-in survives a restart); task 2.4 and 4.2 (the app reopens the last game);
and task 7.3's journey quits and reopens the app, on Linux and (Owner's Mac, device) on the phones, and checks each edit
in the editors and in play.

**H4. The npm release and the rename fell out (audit A5).** The desktop's first open of a game runs npm (spec 10.1), which
needs the framework on a registry a stranger can reach. `@automata` on npm belongs to someone else; the Owner chose
`@automataframework`, and the rename waits for the open stack. The spec and plan name `@automata/*` throughout: the
runtime manifest, the "newer framework" check on `@automata/framework` (task 3.3) and `@automata/editor-app`. Neither
document mentions A5.
*Fix:* name the release and the rename as a gate before task 2.3's first-install step and before any external tester; take
package names from one constant so the rename is one edit; carry A5 into the spec's section 14.

**H5. The base the plan starts from is two branches, and its references are pre-v2.** "The top of the editors stack once
the shared-editors fixes and the editors v2 build have landed" is two sibling branches off #508 (fixes: 19 commits;
v2: 39 commits), not one top. On v2, `SuiteTopBar.svelte` is gone: the header is `SuiteHeader.svelte`, and Play is an
`<a href={playUrl} target="_blank">` (`SuiteHeader.svelte:163`) with no `window.open` anywhere in the editors, so task
1.1's files and its test ("never `window.open`") point at code that has moved. The v2 spec leaves Review out on purpose:
"no 'Waiting for you' group, no Review row" (`2026-11-08-editors-v2-spec.md:51-53`), so task 6.2 "modifies" a group that
does not exist.
*Fix:* task 0.1 merges the two branches (or names the one that carries both) and records the head; task 1.1 points at
`SuiteHeader.svelte` and tests that Play calls the host instead of following a link; task 6.2 creates the "Waiting for
you" group from the v2 mockup, and the plan says so.

### Medium

**M1. Custom-scheme origins are "null" to `URL`, and the message handlers check the game's origin, not the page's.**
`new URL('tauri://localhost').origin` and `new URL('automata-game://localhost/index.html').origin` are both `"null"`
(measured in Node; the WHATWG rule for non-special schemes). The window-message handlers task 1.4 widens
(`extensions/editors/src/features/schematic/watch-bridge.ts:38`, the solver client) check messages from the framed
game, at the game's origin, so on a phone the allowed origin is the game's scheme, not the app's two. And on Android and
Windows Tauri serves a custom scheme as `http://<scheme>.localhost`, so the game is `http://automata-game.localhost`
there, not `automata-game://localhost` as spec section 7 and task 3.4 write.
*Fix:* `app-origins.ts` holds the page's and the game's origins per platform as literal strings, compared as strings,
never built through `URL.origin`; the sidecar's CORS reply echoes the literal; task 3.4's `gameUrl` is per platform; a
unit test pins all of it.

**M2. `/api/watch` cannot carry the token through an `EventSource`.** The server reads the token only from
`Authorization: Bearer` (`serve-editor.ts:211`), and a browser's `EventSource` sends no custom header. Task 1.2 injects
an "EventSource-like" dependency for tests, which hides this.
*Fix:* the store reads the stream with `fetch` and a streamed body (which carries the header), or the route accepts the
token as a query parameter; task 1.2 tests the real choice in Chromium.

**M3. The sidecar calls the wrong function.** Task 2.2's sidecar "calls `serveEditor` from `-tools`", but spec 10.1 runs it
with `--port 0 --token … --app-origin …` and reads its "This computer:" line, which only `editorCommand` prints
(`editor-command.ts:152`); the game runner and Publish are wired in `editorCommand` too, not in `serveEditor`.
*Fix:* the sidecar runs `editorCommand` with the `--app-origin` flag task 1.4 adds.

**M4. `templateFiles` is not pure today, and most of it already exists.** The template's content files are read from disk
with `node:fs` (`template-content.ts:1,24-27`, `template-3d-content.ts:1`); `create-game.ts` imports Effect and
`node:fs`; and the 3D template is offered only when `three-d-gate.ts` finds the package on disk. `templateFilesOf(options)`
already returns the file list (`template.ts:22`).
*Fix:* task 4.2 embeds the template folders at build time (a generated module, kept equal to the folders by a test),
builds on `templateFilesOf`, and gives the phone its own 3D gate (the runtime carries `@automata/3d` or it does not).

**M5. The content compile split is larger than "move `compileTree`".** `compileTree` (`compile-content.ts:156`) sits in a
module that imports Effect and `compile-messages.ts` (`node:fs`, Effect); a game with `paraglide` writes its messages to
disk; the text of `virtual:automata/content` is built in the Vite plugin (`automata-content.ts:72`), which imports
`node:path` and Effect; the plugin defines `__AUTOMATA_DEBUG__` (`automata-content.ts:179`); and both templates use
`import.meta.hot` (`template-game.ts:235`, `template-3d-game.ts:149`).
*Fix:* task 3.1 also moves the module text and the option checks that need no disk; section 7's Vite list gains
`__AUTOMATA_DEBUG__` (false in the player) and `import.meta.hot` (undefined); a game with `paraglide` plays only on a
computer, said before Play, until a later task compiles messages in the page.

**M6. Four audit findings have no task and no "not in this spec".** A12 (Google Play's 12 testers for 14 days, which
must start well before launch), A14 (whether a game's own release workflow gets its desktop job back), A16 (the stores
need Privacy and Terms; the site's `check:site` refuses a store link until both have an `#app` section, which the site
plan says this area writes) and A20 (WebKit journeys type as a person does: select all, then type).
*Fix:* add A16's two sections to task 7.4, A20 to task 7.3, A12 to the Owner's steps with its lead time, and say A14 in
section 16 or give it a task.

**M7. MCP should reuse what AF already pins.** AF pins `@modelcontextprotocol/sdk` 1.32.1 for the MCP server in
`@automata/pipelines` (`docs/versions.md:33`). Phase 8 names no SDK and does not say how the app's server relates to that
one.
*Fix:* task 8.2 uses the same pin and says whether the pipelines' gate tools join the app's list or stay separate.

### Low

**L1. References that are off.** The A8 sentences are at `2026-11-08-content-editors-spec.md:12-13` (lines 10 and 11 are
the Owner's quote, which stays); the store kinds are at `project-store.ts:70` and `watch` at line 87; the 14-day rule is
`renovate.json`'s `minimumReleaseAge`, not `docs/versions.md`; the sidecar's refusal is `serve-editor.ts:240-251`.

**L2. The Plus edit may be moot.** Task 0.1 edits automata-plus `AGENTS.md:22`, but Plus is being ported into AF's
`extensions/` and the repository archived afterwards (Owner, 2026-11-07). Do it only if Plus is still live then.

**L3. Words (the drunk grandma test).** "Let it in" does not say what happens; "Let Automata see this game" does. "Show
the files" on a Review card reads as a file manager; "See what changed" says it. "Use changes without asking" passes.
"Updates need the key from your receipt email." passes. The v2 header's icon-only Play beside a worded Publish fails it
(section 2); the app should say "Play".

## 4. What holds

Checked and right: the cross-origin refusal the sidecar gains an `appOrigins` option for (`serve-editor.ts:240-251`); the
optional-port rule (`suite-ports.ts:6`); `ProjectStore.watch` declared and unimplemented (`project-store.ts:87`); the
`import.meta.glob(…, { eager: true, query: '?url' })` uses (`template-game.ts:182`, `template-level.ts:118`); the site
playground's sucrase compile (`site/src/features/playground/compile.ts:2`); the Tauri pins `tauri =2.12.4` and
`tauri-build =2.7.3` (`tauri-project.ts:13-14`); the existing conflict dialog (`kit/dialogs/ConflictDialog.svelte`);
the editor-list policy needing no Node (`editor-policy.ts` imports only `@automata/editor/editor-list`). Every Owner
decision named in the thread is in section 2 of the spec with a place it lands, including no relay ever and no 2D-only
app; the names rule has a build test (task 2.1).

## 5. Gates

Documents only. `pnpm check` was not run for this change. The persistence journey ran in Chromium (section 2); WebKit,
Firefox and a Tauri window did not.
