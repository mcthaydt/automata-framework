# DX.2b: `rect` and `sprite` entity views TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.4, §4, §8; usage in the [EX spec](../specs/2026-10-16-examples-one-file-design.md) §3 (`views: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`); `entityViews` and `RenderDeltaConsumer` from the [M1.7 render-pixi spec](../specs/2026-10-13-m1-render-pixi-design.md).
- **Status:** implemented and locally verified 2026-10-16 on branch `claude/clever-pasteur-ujmu6e-dx2b`. Owner review pending.
- **Progress:** 6 of 6 steps.
- **Owner:** `packages/render-pixi` (runtime lane). Consumer: `packages/game` (DX.2), Emberwick (DX.3).

## Global constraints

- **Strict TDD** in `packages/render-pixi`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Additive only.** The consumer's contract stays as M1.7 shipped it. The one change is additive: a record resolver passes the matched component id as a second argument to the factory (`EntityViewFactory = (row, componentId?) => …`). Existing factories ignore it.
- **Views read only `RenderDelta`** (DX §4); nothing here touches the sim.
- **Process:** `pnpm format` before committing; Conventional Commits. No changeset: `@mcthaydt/automata-render-pixi` is `private: true`, and `tooling/release/src/check-changesets.ts` rejects a changeset naming it ("not a published package"); `pnpm changeset status --since=origin/main` passes without one.
- **Bookkeeping:** tick each step here when its checks pass, in the same commit or the next one.

## Interfaces

- **Consumed:** `RenderRow`, `FieldRecord` (`@mcthaydt/automata-sim`); `EntityView`, `EntityViewFactory`, `RenderDeltaConsumer` (render-pixi, M1.7); Pixi `Graphics`, `Sprite`, `Texture`, `Rectangle`, `Assets`.
- **Produced** (exported from `@mcthaydt/automata-render-pixi`):
  - `rect(options: RectViewOptions): EntityViewFactory` with `RectViewOptions = { w, h, color, anchor? }`.
  - `sprite(source: Texture | string, options?: SpriteViewOptions): EntityViewFactory` with `SpriteViewOptions = { anchor?, frames? }`.
  - `ViewAnchor = number | { x: number; y: number }`; default `0.5` (centred, so `angle` turns the view about its position).
  - `SpriteFrames = { width, height, count? }`: the texture is a row-major grid of `width × height` frames; the frame shown is the pose component's `frame` field (floored, wrapped by `count`), frame 0 when absent. Frames are not interpolated.
  - `lerp(a, b, t)`, `lerpAngle(a, b, t)` (shortest arc, radians), `interpolatePose(curr, prev, alpha): Pose`, `poseComponent(components, componentId?)`.
- **Pose rules:** the view reads `x`, `y` and `angle` (radians, Pixi `rotation`) from the component it was registered under (`views: { [Body.id]: rect(…) }`). Used as a bare function resolver it reads the first component, in row order, with numeric `x` and `y`. With no `prev` (just added, after a resync) the view shows `curr` exactly. A missing `angle` means 0; a component without numeric `x`/`y` stays at 0,0.
- **Interpretation of the spec's `frames?`:** the spec names the option without a shape; this plan picks the sprite-sheet grid above as the smallest useful meaning. Recorded as a deviation for review.
- **`sprite(url)`:** uses the texture from `Assets.cache` when already loaded (the runtime preloads assets); otherwise shows `Texture.EMPTY` and swaps in the texture when `Assets.load(url)` resolves, unless the view was destroyed first.

## Files

- **Create:**
  - `packages/render-pixi/src/views/view-pose.ts`, `view-pose.test.ts`
  - `packages/render-pixi/src/views/rect-view.ts`, `rect-view.test.ts`
  - `packages/render-pixi/src/views/sprite-view.ts`, `sprite-view.test.ts`
  - `packages/render-pixi/src/views/views-resync.test.ts` (real sim restore → resync rebuild)
  - `packages/render-pixi/src/parity/entity-views.parity.test.ts`
- **Modify:**
  - `packages/render-pixi/src/delta/render-delta-consumer.ts` and its test (pass the matched component id)
  - `packages/render-pixi/src/index.ts`, `src/index.test.ts` (exports)

## Steps

- [x] **1. Pose math.** Write `view-pose.test.ts`: `lerp` at 0, 0.5, 1; `lerpAngle` from `π - 0.1` to `-π + 0.1` at 0.5 lands on `±π` (not 0); from `0.1` to `2π - 0.1` goes backwards through 0; `interpolatePose` with no `prev` returns `curr`; with `prev` at alpha 0.25; missing `angle` → 0; `poseComponent` picks the named id, else the first component with numeric `x`/`y`, else `undefined`. Run `pnpm --filter @mcthaydt/automata-render-pixi test`; expect failure: cannot resolve `./view-pose.js`. Implement, confirm green.
- [x] **2. Consumer passes the component id.** In `render-delta-consumer.test.ts`, assert a record resolver's factory receives `(row, 'body')`. Expect failure: called with one argument. Pass `key` in `resolveView`. Confirm green and every existing consumer test unchanged.
- [x] **3. `rect`.** Write `rect-view.test.ts`: the factory returns a view whose container is at the interpolated position and `rotation` after `update(curr, prev, 0.5)`; anchor 0.5 centres the drawn rect (local bounds `-w/2…w/2`), anchor `{x:0,y:0}` puts it at `0…w`; a component other than the registered one moving doesn't move it; a consumer with `{ body: rect(…) }` draws nothing for an entity with only another component; `destroy` destroys the graphics. Expect failure: cannot resolve `./rect-view.js`. Implement, confirm green.
- [x] **4. `sprite`.** Write `sprite-view.test.ts`: a `Texture` source shows that texture, anchored, interpolated like `rect`; `frames` slices a 32×8 texture into four 8×8 frames and the `frame` field picks frame `floor(frame) mod count`; a url already in `Assets.cache` is used synchronously; an unloaded url shows `Texture.EMPTY`, then the loaded texture after `Assets.load` resolves (stubbed); destroy before load leaves the sprite untouched. Expect failure: cannot resolve `./sprite-view.js`. Implement, confirm green. Export both factories and the types from `index.ts` and assert them in `index.test.ts`.
- [x] **5. Resync after restore.** Write `views-resync.test.ts` with a real sim (`createSim`, one render component `body {x, y}`): step, snapshot at x=1, move to x=9 and step, `restore`, step; the resync delta through a consumer with `{ body: rect(…) }` leaves exactly one view, a new container, at x=1. This exercises existing behavior, so it is expected to pass first time; if it does, record that (a characterization test, not new code).
- [x] **6. Browser parity.** Write `parity/entity-views.parity.test.ts` (browsers project: Chromium, WebKit, Firefox): a real WebGL2 `Application` (64×64), a consumer with `{ body: rect({ w: 4, h: 4, color: 0xff0000, anchor: 0 }) }`, tick 1 at x=8, tick 2 at x=24, `interpolate(0.5)`, `render()`; the container's global position is (16, y) and the extracted pixels have red exactly in columns 16–19. It imports `rect` from the package entry (`../index.js`); written before step 4's export lands, expect failure: `rect` is not exported. Run `pnpm --filter @mcthaydt/automata-render-pixi test:parity`.

## Gates

- `pnpm format`, `pnpm check` (lint, typecheck, boundaries, style, unit).
- `pnpm test:parity` (rendering changed).
- `pnpm test:e2e` with `AF_E2E_SERVER_PORT=4660 AF_E2E_PREVIEW_PORT=4760` (rendering changed).
- `pnpm changeset status --since=origin/main`.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-16 | Plan | `98b22d1` | TDD plan. |
| 2026-10-16 | 1, 2 | `021096c` | Pose test failed first on the missing module, then on `lerp(0.7, 0.1, 1)` = 0.09999999999999998 (fixed: `t = 1` returns `b`); consumer test failed with the factory called with one argument. |
| 2026-10-16 | 3 | `6d511f9` | `rect-view.test.ts` failed on the missing module, then 8/8 green. |
| 2026-10-16 | 4, 6 | `27ce691` | `sprite-view.test.ts` failed on the missing module; the once-per-factory `reportError` test then failed (2 calls) until the catch moved inside the first load. `index.test.ts` failed on `rect` undefined. Parity test failed in Chromium, WebKit and Firefox with "`/src/index.ts` does not provide an export named `rect`", then 3/3 green. |
| 2026-10-16 | 5 | `4cc3150` | Characterization of existing consumer behavior: passed first run, as the plan expected. |
| 2026-10-16 | Gates | `961d03d` | First `pnpm check` failed on render-pixi typecheck (the `Assets.load` stub's generic type in the test); fixed. Then `pnpm check` 26/26 tasks, unit 1,689 passed in 22 packages (render-pixi 61 in 11 files; 4 skipped in `@mcthaydt/release`, pre-existing); `check-style` 180 files 0 findings. `pnpm test:parity` 9/9 tasks, 593 tests (render-pixi 6/6 incl. the new view test in 3 engines). `pnpm test:e2e` with 4660/4760: 28 passed, 18 failed, all base-2d with `net::ERR_UNSAFE_PORT` because base-2d's game port is preview + 300 = 5060, which browsers block (SIP); rerun with 4660/4762: 44 passed, 2 failed (base-2d golden route, 30 s test timeout in `clock.runFor` at load average ~25–30); those 2 rerun alone: 2/2 passed. No changeset (render-pixi is private). |

