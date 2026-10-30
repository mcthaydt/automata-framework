# WEB.PLAY.2: the playground protocol, frame and harness (plan)

> **Spec:** website `docs/superpowers/specs/2026-10-30-live-playground-design.md` (WEB.PLAY.0), §5.1, §5.3, §5.4,
> §7.2, §7.3, §15, §17 (WEB.PLAY.2); PLAY-D11 (the harness calls `runGame` with `seams.sdkEnv`, no public API change).
> **Lane:** website (the playground's framework side, private tooling). **Stacked on** WEB.PLAY.1 (#199): it uses
> `framePolicy` and `playgroundHeaders`. **Branch:** `claude/website-WEB.PLAY.2-playground-harness`.

## Goal

A frame page that, given compiled example code by its parent, runs it against Ruken's in-memory fake host and says
what happened in the protocol's messages: `booted`, then `running`, `failed` (with the reader's line) or
`determinism`. Every message is a Zod schema in one module the site copies verbatim.

## Interfaces produced (all in `tooling/examples-runner/src/playground/`)

| Name | File | Consumers |
| --- | --- | --- |
| Message schemas `bootedMessage`, `runMessage`, `runningMessage`, `failedMessage`, `determinismMessage`, the unions `frameMessage` (frame → parent) and `parentMessage`; constants `PROTOCOL_VERSION` (1), `LOOP_GUARD_NAME` (`__afLoop`), `MAX_CODE_CHARS` (262,144), `MAX_FAILURE_CHARS` (2,000), `RUNNING_FRAME_WAIT_MS` (250), `LOOP_GUARD_MS` (1,000); `exampleModulePath(module, name)` | `playground-protocol.ts` | `frame.ts`; the site's parent (a verbatim copy, WEB.PLAY.4) |
| `createLoopGuard({ now, onStretch, limitMs })` → `(line) => void`, throwing `LoopGuardError` (`line`) | `loop-guard.ts` | `frame.ts` |
| `exampleLocation(stack, file)` → `{ line, column }` or undefined, for V8 (`at f (url:l:c)`) and JavaScriptCore/Gecko (`f@url:l:c`) stacks | `stack-location.ts` | `frame.ts` |
| `fakeHostOptions(settings)` → the `grant` and `saves` for `createFakeHost`, and `offline` | `fake-host-options.ts` | `harness.ts` |
| `runExample(game, { root, host })`, `hashRun(game, ticks)`, `checkGolden(game, bytes)` | `harness.ts` | `frame.ts` |
| `playgroundFramePage(entry, runtime, siteOrigin)`; the body carries `data-example` (the file, for stack lines) and `data-host` (the `Host:` settings) | `frame-page.ts` | the test server here; `build:playground` (WEB.PLAY.3) |
| `startAtPlay(content)`: the default flow entered at `play`, hash recomputed | `start-at-play.ts` | `harness.ts` |
| `createRunGate(parentWindow, siteOrigin)`: one `run`, ever, from the parent window with the site origin | `run-gate.ts` | `frame.ts` |
| `runtimeFromViteManifest(manifest, base)`, `PLAYGROUND_ENTRIES` | `vite-runtime.ts` | the test server; WEB.PLAY.3 |
| `seams.onFailure(cause)` on `RuntimeSeams` (tests and the playground only) | `packages/runtime/src/boot/game-definition.ts`, called in `run-game.ts` and `boot-program.ts` | `harness.ts` |
| `isDefinedGame` from `@mcthaydt/automata-game/tooling` (the umbrella's pinned list is unchanged) | `packages/game/src/tooling.ts` | `frame.ts` |
| The frame's browser entry | `frame.ts` | the frame page |

Consumed: `runGame` (`@mcthaydt/automata-runtime`), `isDefinedGame` (`@mcthaydt/automata`), `createFakeHost`
(`@ruken/sdk-host/testing`, in-memory mode, as `HostingTest` uses it), `createSim`, `unpackReplay` and
`createReplayStepper` (`@mcthaydt/automata-sim`), `streamCompression` (`@mcthaydt/automata-testing/sim`), the catalog's
`HostSettings` (`header.ts`), `framePolicy` (WEB.PLAY.1).

## Files

- Create, each with its `.test.ts` (Node): `playground-protocol.ts`, `loop-guard.ts`, `stack-location.ts`,
  `fake-host-options.ts`, `frame-page.ts`.
- Create `harness.ts` and `frame.ts` (browser code; covered by the browser tests).
- Create `playground/runtime/{automata,zod,frame}.ts` entries, `playground/vite.config.ts` (one build: one Pixi, one
  Zod, one sim; content-hashed names; Vite manifest), `playground/server.ts` (serves the build, the frame pages from the
  catalog, `examples/resources`, `examples/public`, the goldens, all with `playgroundHeaders`, and a test parent page
  at `/` whose script drives the protocol), `playground/static/harness-parent.js`, `playground/e2e/frame.e2e.ts`.
- Modify `package.json` (dependencies `@mcthaydt/automata`, `@mcthaydt/automata-runtime`, `zod`; script
  `e2e:playground-frame`), `host/ports.ts` (`playgroundFramePort`, slot 9), `playwright.config.ts` (projects
  `playground-frame-{chromium,webkit,firefox}` and the server).

## Steps (TDD)

1. [x] Protocol: failing tests (each message parses its own shape and rejects a missing `v`, a wrong `v`, an unknown
   `type`, `code` over `MAX_CODE_CHARS`, a `runId` below 1, a hash that is not 16 hex digits); then the module.
2. [x] Loop guard: failing tests with a fake clock and a manual `onStretch` (no throw before `limitMs`; throws naming the
   line after it in one stretch; the stretch's end resets it; reads the clock once per 1,024 calls); then the module.
3. [x] Stack location: failing tests on recorded V8, JavaScriptCore and Gecko stacks, a stack with no example frame,
   and a `blob:` frame; then the module.
4. [x] Fake host options and the frame page: failing tests (grant, saves, offline; the page's policy is
   `framePolicy(<its import map>, origin)`; the import map names the runtime's automata and zod files; the frame script
   and stylesheets are the runtime's; a pending entry gets a page that runs nothing); then the modules.
5. [x] First browser test, "shapes-rects posts running in its frame": fails because no frame server exists. Then the
   build, server, harness and `frame.ts` until it passes in Chromium.
6. [x] One browser test per frame-side failure in §7.2, each seen failing first: an import that fails (`failed`
   `import` with the line), a default export that is not `defineGame(...)`, a throw in `setup` (`boot` with the line),
   a throw on a later tick (`run` with the line), `while (true) {}` in a system (`hung: true` with the line, within
   2 s), and the frame accepting one `run` only and ignoring a message from another source.
7. [x] Determinism: the unedited `shapes-rects` with its golden reports `golden: 'pass'` and a 16-hex hash; an edited
   one reports `golden: 'none'` with its own hash for the same ticks; the guard leaves the golden hash unchanged.
8. [x] All three engines; gates: `pnpm format`, `TURBO_FORCE=true pnpm check`; no published package changes
   (no changeset, api-report or agent-skills); the examples' goldens are read, not changed (no parity re-run needed
   beyond the browser cases here).

## Execution log

2026-10-30, this container: Node 24.21.0, Playwright 1.63.0, Chromium 153.0.8010.12, WebKit 26.6, Firefox 155.0.

- **Steps 1 to 4.** Each unit file failed first with "Cannot find module" for its module, then passed: protocol 4,
  loop guard 4, stack location 5, fake-host options 3, frame page 4 (5 with the data attributes, which failed first on
  the missing `data-example`). `vite-runtime.test.ts` was written with its module and passed at once; the planted
  defects below cover the build it reads.
- **Found while building, not in the plan:**
  - *A running sim's fault never reaches the frame.* The runtime shows a boot failure and a step's throw as panels
    and keeps the cause. `RuntimeSeams.onFailure` (tests-only, like the other seams) now hears it: two `runGame`
    tests failed first ("expected [] to have a length of 1"), then passed. `runtime` is private: no changeset; the
    API report is updated.
  - *`isDefinedGame` is not exported*, and the umbrella's export list is pinned (`packages/automata/src/index.test.ts`),
    so the game package gained a `./tooling` entry; its test failed first on the missing module.
  - *The default flow opens on the title screen*, so every edit would need a press on Play. `startAtPlay` enters the
    play screen when the flow is the default shape; its tests failed first on the missing module. The sim is not
    touched, and the golden still passes. This is a decision for the Owner's veto (the spec's journey assumes the
    game is showing).
  - *Setup throws only as a panel inside the runtime*, so the frame sets the sim up once headless before `runGame`
    (`exampleSim`), which reports `setup` and plugin throws with their stack.
  - *Firefox logs a CSP eval violation* from the runtime's Zod chunk (`schemas-*.js`) while the example still runs;
    Chromium and WebKit log none. This is the spec's R-6; WEB.PLAY.3's A-17 (every example, no violation, all three
    engines) owns finding and fixing the path. Headless Firefox here also has no WebGL ("Failed to create WebGL
    context"), so its runs prove the protocol, not drawing.
- **Step 5.** "shapes-rects posts running in its frame" passed on its first run in Chromium, WebKit and Firefox: the
  server was written with the test, so its failure first was not observed. A screenshot of the first runs showed the
  title screen (hence `startAtPlay`); after it, WebKit's screenshot shows the blocks, bar and spinner moving.
- **Steps 6 and 7.** 8 more cases (import, default export, setup line 41, tick-30 line 18 after `running`, the hang
  at line 18, golden pass, edited hash, guard leaves the golden) passed in all three engines. The run gate's
  one-run-only rule is unit-tested (`run-gate.test.ts`, 3 cases; failed first on the missing module) because a browser
  cannot show a message was ignored without waiting. **Planted defects, Chromium:** no stack lines: the two line
  cases fail; a guard that never throws: the hang case fails (25 s timeout); the golden check inverted: both golden
  cases fail; the title screen kept: the tick-30 and hang cases fail (the sim never steps). Each restored after.
- **Step 8.** `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 (33 tasks) after knip found `parentMessage` a
  duplicate of `runMessage` (removed) and the API report test found the two changed reports (`pnpm build`,
  `pnpm api-report --update`); `pnpm api-index` and `pnpm agent-skills` are current; `check-changesets` 0 problems.
  Through the root config, `--project 'playground-*'`: 51 passed (24 feasibility, 27 frame).
- **Independent review (a separate agent reading the diff against the spec), all addressed test-first:**
  1. A screen that failed to load or enter showed its panel but never reached `seams.onFailure`, and the frame then
     posted `running`. The flow now hears it (`MakeFlowOptions.onFailure`); a `runGame` test with an `enter` that
     throws failed first ("expected [] to have a length of 1"), then passed.
  2. A determinism check that could not run (a missing or unreadable golden) either said nothing or surfaced as the
     example failing through `unhandledrejection`. The protocol gains `determinism-unavailable`, posted from a
     try/catch around the check; the protocol test failed first on the new shape, and a browser case (a golden that
     does not exist) passes in all three engines.
  3. `startAtPlay` skipped core-saves' title, where its slots are; a game with `saves` keeps its title now (unit test,
     failed first on the new signature).
  4. A throwing `onFailure` would have stopped the runtime's own failure handling: every call now goes through
     `notifyFailure`, which swallows the listener's throw and runs after the panel is up; a test with a throwing
     listener timed out on `data-state` first, then passed. The doc says the seam can fire once per failed attempt.
     The frame also omits a guard line below 1 instead of posting a message the protocol refuses.
  5. The content-hash formula was retyped: the runtime now exports `contentHashOf` (its pinned export list is updated
     on purpose) and `startAtPlay` uses it. The content package's root was tried first and pulled Node-only modules
     into the browser build, so it was not used.
  Minor: `hashRun` and `checkGolden` set the sim up with the plugins, seed and setup only, as the parity suite records
  the goldens, so a hash here is comparable with it.
  After the fixes: 37 unit tests in `src/playground`, 85 in the runtime's boot and flow folders, 30 frame cases in
  Chromium, WebKit and Firefox through the root config, `TURBO_FORCE=true pnpm check` exit 0, API reports updated.
