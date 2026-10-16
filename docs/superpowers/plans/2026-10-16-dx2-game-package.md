# DX.2: `@mcthaydt/automata-game` TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.1 (`GameSpec`, `startGame`, `defineGame`, defaults), §3.3 (`InputMap`), §5 (boot flow), §6 (failure policy), §7 (default screens), §8 (tests), §12 (exit: `core-basic-window` ≤ 40 lines, boots under the fake host, golden in four engines). Acceptance tests written first by EX.3 ([EX plan](./2026-10-16-examples-one-file.md) step 6 and the EX.3 PR's "For the DX.2 and DX.2b PRs" notes).
- **Status:** drafted 2026-10-16 on branch `claude/clever-pasteur-ujmu6e-dx2`, stacked on EX.3 (`claude/clever-pasteur-ujmu6e-ex3`, which carries EX.1 and EX.2) with DX.1 (`-dx1-pending`) and DX.2b (`-dx2b`) merged in.
- **Progress:** 0 of 9 steps.
- **Owner:** `packages/game` (lane **game**, 04 How we build). It consumes `runtime`, `render-pixi`, `host`, `ui` and `sim` and changes none of them (DX §4; their lanes own them). It also finishes EX.3's step 6 in `examples/` and `tooling/examples-runner` (integration).

## Global constraints

- **Strict TDD** in `packages/game`, `examples/` and `tooling/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **No sim behavior change** (DX §3.1): a `startGame` game steps exactly the commands its input map produced, one per tick, `{ tick, source: 0, seq: tick, type, payload }` (Emberwick's `moveCommand` shape). Golden replays are recorded once in Node and must match in Chromium, WebKit and Firefox; a mismatch is investigated, never re-recorded.
- **Effect outside the sim only.** Screens are runtime `ScreenDef`s; no Effect allocation per frame (the input map's `commands(tick)` is plain code).
- **Process:** `pnpm format` before committing; Conventional Commits. No changeset: the game package is private (decision G-1), and the runner and examples are private.
- **Bookkeeping:** tick each step here when its checks pass, in the same commit or the next one.

## Decisions (mine, recorded for review)

- **G-1. `@mcthaydt/automata-game` is `private: true` for now.** It depends on `@mcthaydt/automata-runtime` and `@mcthaydt/automata-render-pixi`, which are both private (M2.4's published list has neither). Published, it could not be installed (the consumer smoke installs every publishable package from its pack, and `runtime@0.0.0` is on no registry). Publishing `runtime`, `render-pixi` and `game` together is a release-list change for the ship lane, added to 02 as a follow-up before DX.5 and DX.11. Because EX.1's catalog accepts only published packages' entries, the catalog gets one explicit, tested exception: `@mcthaydt/automata-game`'s declared entries are public while it awaits that publish; `render-pixi` and `runtime` stay rejected.
- **G-2. `defineGame` returns a `DefinedGame`:** the runtime's `GameDefinition` plus the spec's `id`, `title`, `size`, `input` and `sim` with `seed` filled (default `1`, Emberwick's). The examples `export default defineGame(...)`, the runner calls `startGame(example)`, and the parity test reads `example.sim`, so `startGame` takes a `GameSpec` or a `DefinedGame`. `root` is a getter, so a definition can be imported in Node (parity) without a document.
- **G-3. An invalid `GameSpec` throws a `BootDefect` from `defineGame`,** whose message lists every field path. DX §6 says the boot failure screen shows it; that screen belongs to the runtime boot of a definition, and there is no definition to boot. The throw happens at definition time, before anything renders (DX §5 step 1). Recorded as a deviation.
- **G-4. `title?: string` (default `id`)** is added to `GameSpec` for the title screen (DX §7 shows "game title"; §3.1 has no field for it).
- **G-5. Resuming play re-syncs the renderer** by restoring the sim's own snapshot (`sim.restore(sim.snapshot())`) before `AppLoop.run`, which resets the renderer. State, tick and hash are unchanged; the next step's delta is a full resync, so the views come back after a pause.
- **G-6. Examples boot under their own Ruken id.** Ruken's fake host refuses a hello whose `gameId` is not its own, so the smoke opens each example with `entry.id` (which `defineGame`'s `id` must equal). The runner's shared manifest (`af-examples`) only supplies Ruken's headers.
- **G-7. Later-pressed key wins per field** when held bindings overlap (DX §3.3 "later keys win per field").
- **G-9. `keys(..., { idle })`.** Every payload is merged over the idle payload: the schema's own defaults (`schema.parse({})`), or `options.idle` for a schema without defaults (Emberwick's `move` has none, so DX.3 can pass `idle: { x: 0, jump: false }` instead of changing the schema and its hash). A binding is checked merged over it at construction; with no idle payload a binding that leaves required fields unset throws, and nothing held sends no command.
- **G-8. Gamepad on menus:** a small poller on the title and paused screens maps the standard mapping's A (button 0) to the focused button and B (button 1) to Escape. In play, `keys(..., { pad })` maps standard buttons to payloads, polled once per tick.

## Interfaces

- **Consumed:**
  - `runGame`, `GameDefinition`, `ScreenDef`, `Flow`, `AppLoop`, `BootDefect`, `CompiledContentData`, `RuntimeHandle`, `RuntimeSeams`, `SettingsDef`, `ExtensionDef` (`@mcthaydt/automata-runtime`, `./extension`); `RuntimeTest`, `nullRenderer`, `manualFrames` (`./testing`) in tests.
  - `createPixiRenderer`, `PixiRendererOptions`, `EntityViewFactory`, `rect`, `sprite` (`@mcthaydt/automata-render-pixi`, DX.2b); `@mcthaydt/automata-render-pixi/no-eval`.
  - `HostingOptions` (`@mcthaydt/automata-host`).
  - `ScreenFrame`, `ActionBar`, `InputMethodTracker`, theme (`@mcthaydt/automata-ui`); `checkLayout`, `publishConditions`, `settleLayout`, `byTestId` (`@mcthaydt/automata-ui/testing`); `REFERENCE_SIZES`, `VARIANTS`, `mountFixture` (`@mcthaydt/automata-testing`).
  - `createSim`, `PluginDef`, `CommandDef`, `Command`, `Sim` (`@mcthaydt/automata-sim`); `canonicalJson`, `utf8`, `xxhash64`, `hex64` (`./hash`).
  - `SLUG_RE` (`@ruken/manifest`): Ruken's game id rule, not copied.
- **Produced** (`@mcthaydt/automata-game`):
  - `GameSpec<S>` as DX §3.1, plus `title?` (G-4); `DefinedGame<S>` (G-2).
  - `defineGame<S>(spec): DefinedGame<S>`; `startGame<S>(game: GameSpec<S> | DefinedGame<S>): RuntimeHandle`.
  - `defaultContent(): { data, hash }`: flow `title → play ⇄ paused → title`, hashed as the content compiler hashes.
  - `keys(command, bindings, options?): InputMap`; `KeyBindings`, `KeysOptions` (`touch?: boolean`, `pad?: Record<number, payload>`, `idle?: payload`); `InputMap.attach(window): InputSource` with `commands(tick)`, `hold(id)`, `release(id)`, `dispose()`; `InputMap.touchButtons` (one per distinct payload).
  - `defaultScreens(game): ScreenDef[]` (title, play, paused).
  - Re-exports `rect`, `sprite` and their option types from render-pixi; `./no-eval` re-exports render-pixi's.

## Files

- **Create** `packages/game/`: `package.json`, `tsconfig.json`, `vitest.config.ts` (`unit` in jsdom, `layout` in Chromium, WebKit and Firefox), `src/env.d.ts`, `src/index.ts` (+ `index.test.ts`), `src/no-eval.ts`; `src/define-game.ts` (+ test); `src/default-content.ts` (+ test); `src/input/keys.ts` (+ test); `src/screens/` `TitleScreen.svelte`, `PlayScreen.svelte`, `PausedScreen.svelte`, `default-screens.ts`, `menu-pad.ts`, `screens.css`, tests `default-screens.test.ts`, `menu-pad.test.ts`, `screens.layout.test.ts`; `src/start-game.ts` (+ test).
- **Modify:**
  - `tooling/examples-runner/src/catalog.ts` (+ test, G-1), `src/page-template.ts` and `src/vite-plugin.test.ts` (`<main id="game">`), `src/smoke.ts` (G-6).
  - `examples/package.json` (`@mcthaydt/automata-game`, `@mcthaydt/automata-sim`, `zod`, `svelte`, `@sveltejs/vite-plugin-svelte`), `examples/vite.config.ts` (`start` and `noEval` from the game package, Svelte plugin), the four examples' `Pending:` lines, `examples/__goldens__/{core-input-keys,shapes-rects,textures-sprite}.replay`.
  - `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`, the EX plan (step 6), this plan.

## Steps

- [x] **1. Package skeleton and exports.** `index.test.ts` expects `defineGame`, `startGame`, `keys`, `rect`, `sprite`, `defaultContent`, `defaultScreens` to be functions. Red: the package does not exist (import fails). Create the package and the exports (stubs throw), `pnpm install`; green.
- [x] **2. Default content.** `default-content.test.ts`: the flow is `title → play ⇄ paused → title` with entry `title`; the hash equals `hex64(xxhash64(utf8(canonicalJson(data))))` and is pinned as a literal; `defineGame` uses it unless `content` is given. Red: stub throws. Implement; green.
- [x] **3. `defineGame` defaults and validation.** `define-game.test.ts`: defaults (`hosting = { gameId: id, wants: [], pauseBehavior: 'pause' }` merged with `spec.hosting`; `seed` 1; `title` = id; three screens; renderer factory is a function); `root` resolves `spec.root`, else `#game`, else throws `BootDefect`; validation lists every path: `id` against `SLUG_RE`, `size.width`/`size.height` positive integers, a `views` key that is no render component of the plugins (`views.ghost`), and a `content.hash` that is not 16 hex digits. Red: stub throws `not implemented`. Implement; green.
- [x] **4. `keys()` input map.** `keys.test.ts`: a binding payload the schema refuses throws at construction naming the key; nothing held gives the schema's idle payload (`schema.parse({})`), or no command when the schema needs fields; held keys merge with later-pressed winning per field; release and window blur clear; one command per tick `{ tick, source: 0, seq: tick, type, payload }`; `touchButtons` groups keys by payload; `hold`/`release` from a touch button; `pad` buttons polled from `navigator.getGamepads()`; `dispose` removes listeners. Red: stub throws. Implement (extracted from Emberwick's `input/keys.ts` and `devices.ts`); green.
- [x] **5. Default screens (DOM).** `default-screens.test.ts` in jsdom through `RuntimeTest` (null renderer, manual frames, default content): title shows the game title and a primary Play that has focus; Play, Enter or Space goes to play; play creates the sim with seed and plugins, calls `setup`, runs `AppLoop` with the input map's commands (the renderer sees the spawned entity's resync); Escape or P and the corner Pause button go to paused, which pauses the sim; Resume and Escape return to play with the same sim tick and a resync (G-5); Quit to title disposes the sim and a new Play starts at tick 0; touch buttons show only when the input method is touch and `touch !== false`; the host menu request opens paused. `menu-pad.test.ts`: A clicks the focused button once per press, B sends Escape. Red: stubs. Implement the Svelte screens on `ScreenFrame` and `ActionBar`; green. *Done with `runGame` and a renderer that records each `StepResult` rather than `RuntimeTest`'s null renderer, which logs ticks only, so the test can read the resync and the entity's `x`. Red: all 13 cases timed out waiting for the title screen (the stubs die). The menu pad drives the ui `FocusNavigator` (`confirm`, `back`); the package takes ui's `biome.json` override for `.svelte` files.*
- [ ] **6. Default screens (layout).** `screens.layout.test.ts`: each screen (title, play with touch buttons, paused) passes `checkLayout` at every `REFERENCE_SIZES` entry and `VARIANTS` variant in Chromium, WebKit and Firefox, with Play, Pause, Resume, Quit and the touch buttons as essentials. Red first: run it against a deliberately small (32 px) touch button to see the contract fail for that reason, then the real CSS; green.
- [ ] **7. `startGame`.** `start-game.test.ts` in jsdom: `startGame(spec)` with no `root` and no `#game` throws `BootDefect`; `startGame(spec)` and `startGame(defineGame(spec))` both run the runtime boot on that root under Ruken's fake host (`seams.sdkEnv`), through hosting and the content hash to the Pixi renderer, which jsdom cannot start: the boot fails with `RendererUnavailable` on the boot failure panel. That proves the composition and its order without WebGL; the real renderer, title, play and pause are proven in a browser by the examples' smoke (step 8). Red: stub throws. Implement; green.
- [ ] **8. The examples run.** In order, each red first:
  - remove `DX.2b` and then `DX.2` from the examples' `Pending:` lines; the catalog test fails with `import "@mcthaydt/automata-game" is not a public entry` (G-1 not yet in), then the typecheck fails on the missing dependency; add G-1's exception (catalog test: game accepted, render-pixi still refused) and the examples' dependencies; green;
  - the vite-plugin test expects `<main id="game">` in the example page; add it;
  - point `examples/vite.config.ts` at `@mcthaydt/automata-game` and its `no-eval`, add the Svelte plugin; the smoke boots each example under its own id (G-6): red under `af-examples` (the fake host refuses the hello), green after;
  - parity: the three `Golden:` examples fail with no replay; record them once in Node (`AUTOMATA_UPDATE_GOLDENS=1`), then confirm Node, Chromium, WebKit and Firefox match;
  - `core-basic-window.ts` is 40 lines or fewer (count recorded).
- [ ] **9. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `CI=1 pnpm test:e2e` (under the shared lock), `pnpm build:examples`. Tick 02's DX.2 row only if every deliverable is verified; tick EX plan step 6 and record EX.3's completion; 02 follow-ups (G-1 publish, anything found); 03 row; execution log.

## Execution log

| Date | Step | Commits | Result |
|---|---|---|---|
