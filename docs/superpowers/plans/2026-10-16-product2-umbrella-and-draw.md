# PRODUCT.2: the umbrella import and the `draw` layer, TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §7 (one import `@mcthaydt/automata` re-exporting `game` and the common verbs; a read-only `draw(ctx)` layer for HUD, debug and prototypes that reads state and never writes the sim, law 1; every verb a thin layer over a public lower-level API). Touches the [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.1 (`GameSpec`), §3.4 and its DX.3 amendment E-1 (`PixiStageHooks`), and the [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 (examples import `@mcthaydt/automata`).
- **Status:** drafted 2026-10-16 on branch `claude/clever-pasteur-ujmu6e-product2`, stacked on DX.3 (`claude/clever-pasteur-ujmu6e-dx3`, which carries DX.2, DX.2b and EX.1 to EX.3).
- **Progress:** 5 of 7 steps.
- **Owner:** lane **game** (`packages/game`, the new `packages/automata`). It consumes `render-pixi`'s stage hooks, `sim` and `runtime` and changes none of them. It adds one example in `examples/` (integration).

## Global constraints

- **Strict TDD** in `packages/` and `examples/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Law 1:** the draw layer reads the sim and never writes it. A game with `draw` steps exactly the commands it would step without it; the example's golden is recorded once in Node and must match in Chromium, WebKit and Firefox.
- **No Effect per frame** (ADR 0003): the draw layer is plain code called from the renderer's frame hook.
- **Process:** `pnpm format` before committing; Conventional Commits. No changeset: `@mcthaydt/automata` is private, as `@mcthaydt/automata-game` is (U-1).

## Decisions (mine, recorded for review)

- **U-1. `@mcthaydt/automata` lives in `packages/automata` and is `private: true` for now,** for DX.2's G-1 reason: it depends on `@mcthaydt/automata-game`, which depends on the unpublished `runtime` and `render-pixi`. It is published with them (the existing 02 follow-up for G-1 now covers three packages). EX.1's catalog already accepts the specifier `@mcthaydt/automata`; no catalog change.
- **U-2. The umbrella's surface is everything `@mcthaydt/automata-game` exports, plus the sim's six `define*` verbs and the types a game names** (`ComponentDef`, `CommandDef`, `EventDef`, `ResourceDef`, `SystemDef`, `PluginDef`, `Sim`, `SimContext`, `EntityRef`, `Command`, `StepResult`). A test pins the runtime export names, so a new verb is a deliberate change, and checks each is the same function as its owner's (thin layer, nothing wrapped). `createSim`, hashes, replay and the rest stay in `@mcthaydt/automata-sim` for a game that drops down. `./no-eval` re-exports the game package's.
- **U-3. Verbs in §7's list that core does not have yet are not stubbed:** `sound` and `music` (M5 audio), `camera2d` (M4), `t` (PRODUCT.L), `tween` (no owner yet) and a `text` entity view (no owner yet). `draw`'s context has `text` for HUD lines. Added to 02 as follow-ups; each lands in its owning package and then in the umbrella's pinned list.
- **U-4. No Plus extension in the umbrella:** a test fails if `packages/automata/package.json` depends on an extension package (`@mcthaydt/automata-physics` today; PD-1).
- **D-1. `GameSpec.draw?: (ctx: DrawContext) => void`,** called once per display frame while the default screens hold a sim (play; the last frame stays up while paused), after the entity views interpolate and before Pixi renders. It is built on DX.3's `PixiRendererOptions.setup` hooks, merged after any `renderer.setup` the game passes, so `render-pixi` is unchanged.
- **D-2. Coordinates are logical playfield pixels on the stage's `ui` layer** (above the world, clipped with the playfield). World-space drawing under a camera waits for `camera2d` (M4).
- **D-3. Read-only by construction:** `ctx.sim` has `tick`, `query`, `entity` and `resource` only (no `step`, `spawn`, `set`, `add`, `remove`, `restore`); component values and resources are frozen copies, so an assignment throws. These copies are made per call, which is fine for a HUD, a debug overlay or a prototype; hot drawing stays in entity views.
- **D-4. `draw` with custom `screens` is a `GameSpecError`** (`draw: needs the default screens`): custom screens do not hand their sim to the layer, and a layer that silently never draws is worse than a boot error. Follow-up in 02: a public way for custom screens to feed it.
- **D-5. A throw inside `draw` propagates** (it is a game bug, like a throwing view); the sim is not touched either way.
- **D-6. Immediate mode:** one `Graphics` cleared each frame; `Text` objects pooled by call order and hidden when unused, so a steady HUD allocates nothing after its first frame.
- **D-7. The example is `examples/shapes/shapes-draw-hud.ts`,** importing only `@mcthaydt/automata`, with `Golden: 120`. The existing examples keep their imports; EX.6 narrows them to the umbrella.
- **D-8. PRODUCT.1 is not merged into this branch:** the draw layer needs only DX.3's stage hooks, not PRODUCT.1's post-filter slot. When both land, PRODUCT.1's API report list gains `automata` (follow-up in 02).

## Interfaces

- **Consumed:** `PixiStage`, `PixiStageHooks`, `PixiRendererOptions` (`@mcthaydt/automata-render-pixi`); `FrameInfo` (`@mcthaydt/automata-runtime`); `Sim`, `ComponentDef`, `ResourceDef`, `EntityRef`, `FieldValues` (`@mcthaydt/automata-sim`); `Graphics`, `Container`, `Text` (`pixi.js`).
- **Produced** (`@mcthaydt/automata-game`, re-exported by `@mcthaydt/automata`):
  - `DrawContext { sim: DrawSim; frame: FrameInfo; width; height; rect(x, y, w, h, color); circle(x, y, radius, color); line(x1, y1, x2, y2, color, width?); text(value, x, y, { color?, size? }?) }`.
  - `DrawSim { tick; query(...components): DrawEntity[]; entity(sid): DrawEntity | undefined; resource(def) }`, `DrawEntity { sid; has(component); get(component) }`.
  - `GameSpec.draw?: (ctx: DrawContext) => void`.
- **Produced** (`@mcthaydt/automata`): U-2's surface; `./no-eval`.

## Files

- **Create** `packages/game/src/draw/`: `read-sim.ts` (+ `read-sim.test.ts`), `draw-layer.ts` (+ `draw-layer.test.ts`, `draw-layer.parity.test.ts`).
- **Modify** `packages/game/`: `src/define-game.ts` (+ test), `src/screens/default-screens.ts` (+ test), `src/index.ts` (+ test), `vitest.config.ts` and `package.json` (a `browsers` project for `*.parity.test.ts`, run by `test:parity`).
- **Create** `packages/automata/`: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `src/index.ts`, `src/no-eval.ts`, `src/index.test.ts`.
- **Create** `examples/shapes/shapes-draw-hud.ts`, `examples/__goldens__/shapes-draw-hud.replay`; **modify** `examples/package.json` (`@mcthaydt/automata`), `examples/e2e/default-screens.e2e.ts` (the draw example into play).
- **Modify** `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`, this plan.

## Steps

- [x] **1. Read-only sim view.** `read-sim.test.ts` against a real sim: `tick`, `query`, `entity` and `resource` read what the sim holds; assigning to a value from `get` or `resource` throws `TypeError`; the view has no `step`, `spawn`, `restore`, and its entities no `set`, `add`, `remove`; `sim.hash()` is unchanged after a reader tried every write. Red: the module does not exist. Implement `readSim(sim)`; green. *Red: `Failed to resolve import "./read-sim.ts"`. Green: 4/4.*
- [x] **2. Draw layer.** `draw-layer.test.ts` (jsdom, real Pixi display objects): `setup(stage)` adds one container on `stage.ui`; with no sim watched, a frame calls nothing; with a sim, each frame clears and calls `draw` once with the frame, the logical size and a `readSim` view; `rect`, `circle` and `line` land in the graphics' bounds at logical coordinates; `text` reuses one `Text` per call index and hides the unused ones; `watch(undefined)` clears; `mergeStageHooks(a, b)` calls `apply`, `draw` and `reset` of both in order. Red: missing module. Implement; green. *Red: `Failed to resolve import "./draw-layer.ts"`. First green run failed one case on the test's own line bounds (Pixi pads a stroke's bounds by half its width on every side: `[-1, 9, 31, 11]`, not `[0, 9, 30, 11]`); expectation corrected. Green: 9/9.*
- [x] **3. `GameSpec.draw`.** `define-game.test.ts`: `draw` with custom `screens` lists `draw: needs the default screens`; `draw` that is not a function is listed. `default-screens.test.ts`: play hands its sim to `watchSim`, quit to title hands `undefined`. Red: no field, no callback. Implement (the renderer's `setup` merges the game's own hooks with the layer's); green. *Red: 6 failed (`defineGame accepted an invalid spec` ×2, `pixiOptions is not a function` ×3, `expected [] to deeply equal [ undefined ]`). Green: 34/34 across both files. The renderer options moved into an exported-for-test `pixiOptions(spec, layer)` in `define-game.ts` (not in the package index), so the setup composition is tested without WebGL; the draw types are exported from the index.*
- [x] **4. Browser parity.** `draw-layer.parity.test.ts` in Chromium, WebKit and Firefox on WebGL2: a `rect` drawn at (8, 8, 4, 4) lands on exactly those pixels and a `text` draws non-background pixels at its position. Red first by drawing the rect at the wrong place in the test's expectation (record the observed failure); green. *Red, all three engines: `expected [ 8, 9, 10, 11 ] to deeply equal [ 9, 10, 11, 12 ]`, so the rect sat on the pixels the layer was given. Green: 3/3 (Chromium, WebKit, Firefox); the text drew green pixels only in its quadrant. The package's `test:parity` now runs `layout` and `browsers`.*
- [x] **5. The umbrella.** `packages/automata/src/index.test.ts`: the export names equal U-2's pinned list; each is the same value as its owner's export; `./no-eval` loads; the manifest depends on no extension (U-4). Red: the package does not exist. Create it, `pnpm install`; green. *Red: `Failed to resolve import "./index.ts"`. First green run failed the manifest case on the test's own path (`The URL must be of scheme file` under jsdom); read via `import.meta.dirname` instead. Green: 18/18; `svelte-check` 0 errors; `pnpm style`, `tooling/versions` and `tooling/release` unit tests pass with the new package. No `biome.json` override: the package has no `.svelte` files.*
- [ ] **6. The example.** `examples/shapes/shapes-draw-hud.ts` (≤ 100 code lines, only `@mcthaydt/automata`): red first in the catalog/typecheck (missing dependency), then the parity runner (`.replay is missing`); record the golden once in Node (`AUTOMATA_UPDATE_GOLDENS=1`), then Node, Chromium, WebKit and Firefox match. `default-screens.e2e.ts` walks `shapes-draw-hud` into play and back with no console errors.
- [ ] **7. Gates and bookkeeping.** `pnpm format`, `pnpm check`, `pnpm test:parity`, `CI=1 pnpm test:e2e` (each under the shared lock), `pnpm build:examples`. 02 row, follow-ups (U-3, D-4, D-8), execution record, 03 row, execution log.

## Execution log

| Date | Step | Commits | Result |
|---|---|---|---|
| 2026-10-16 | Plan | (this commit) | The TDD plan with decisions U-1 to U-4 and D-1 to D-8. |
