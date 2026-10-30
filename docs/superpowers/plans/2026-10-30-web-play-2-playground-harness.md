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
| `playgroundFramePage(entry, runtime, siteOrigin)` | `frame-page.ts` | the test server here; `build:playground` (WEB.PLAY.3) |
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

1. [ ] Protocol: failing tests (each message parses its own shape and rejects a missing `v`, a wrong `v`, an unknown
   `type`, `code` over `MAX_CODE_CHARS`, a `runId` below 1, a hash that is not 16 hex digits); then the module.
2. [ ] Loop guard: failing tests with a fake clock and a manual `onStretch` (no throw before `limitMs`; throws naming the
   line after it in one stretch; the stretch's end resets it; reads the clock once per 1,024 calls); then the module.
3. [ ] Stack location: failing tests on recorded V8, JavaScriptCore and Gecko stacks, a stack with no example frame,
   and a `blob:` frame; then the module.
4. [ ] Fake host options and the frame page: failing tests (grant, saves, offline; the page's policy is
   `framePolicy(<its import map>, origin)`; the import map names the runtime's automata and zod files; the frame script
   and stylesheets are the runtime's; a pending entry gets a page that runs nothing); then the modules.
5. [ ] First browser test, "shapes-rects posts running in its frame": fails because no frame server exists. Then the
   build, server, harness and `frame.ts` until it passes in Chromium.
6. [ ] One browser test per frame-side failure in §7.2, each seen failing first: an import that fails (`failed`
   `import` with the line), a default export that is not `defineGame(...)`, a throw in `setup` (`boot` with the line),
   a throw on a later tick (`run` with the line), `while (true) {}` in a system (`hung: true` with the line, within
   2 s), and the frame accepting one `run` only and ignoring a message from another source.
7. [ ] Determinism: the unedited `shapes-rects` with its golden reports `golden: 'pass'` and a 16-hex hash; an edited
   one reports `golden: 'none'` with its own hash for the same ticks; the guard leaves the golden hash unchanged.
8. [ ] All three engines; gates: `pnpm format`, `TURBO_FORCE=true pnpm check`; no published package changes
   (no changeset, api-report or agent-skills); the examples' goldens are read, not changed (no parity re-run needed
   beyond the browser cases here).

## Execution log

(filled in as steps pass)
