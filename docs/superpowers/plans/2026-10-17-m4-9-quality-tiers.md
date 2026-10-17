# M4.9 Graphics quality tiers and render targets: TDD plan

- **Task:** M4.9 in [02](../../02-master-delivery-plan.md), M4 spec [§4.11](../specs/2026-10-16-m4-input-display-design.md) (acceptance Q-a, Q-b), §6 (a filter that fails to compile), M4-D6 (`high`, no auto-detect).
- **Lanes:** render (`render-pixi`) and runtime (the settings field and the fact). **Depends on:** M4.0 (merged) and PRODUCT.1 (merged; the post-filter slot this extends).
- **Status:** In progress.
- **Progress:** 6 of 10 steps.

## Sources, read at these commits

- **FloorFifty `apps/client/src/systems/render/quality.ts` at `ac72660`** (81 lines) and `tests/client/systems/render/quality.test.ts` (90). AF takes the rules, not the race's two chains: a tier drops optional passes and never the art direction, and a part that cannot be built is absent instead of throwing out of the mount. The race's `resolveSkyFilters` and `resolveCityFilters` stay in FloorFifty. In AF, each owner of the post-filter slot declares the lowest tier it runs at.
- **FloorFifty `quality-rebuild.ts` at `ac72660`** (44) and its test (35): `rebuildOnQuality`, which destroys the old build before making the new one. `effectiveQuality` (an inspection-build override) is not taken.
- **FloorFifty `render-target.ts` at `ac72660`** (95) and its test (91): `CompositeTarget`. FloorFifty's fixed 960 × 540 becomes the game's logical size.

## Scope

**In:**

- **`QualityTier = 'high' | 'medium' | 'low'`.** Its one owner is runtime: `qualityTierSchema` (Zod, default `high`) and `displaySettingsSchema` (`{ quality }`), so a game's settings can carry `display.quality`. render-pixi imports the type.
- **Resolution caps.** `canvasResolutionFor(formFactor, dpr, tier = 'high')`: `low` caps at 1, `medium` at 1.5 and `high` at `MAX_RESOLUTION` (2). A portrait tablet stays at 1.
- **Slot tiers.** The post-filter slot's `set(id, filters, order, { minTier })` is additive. The slot's `setTier(tier)` recomposes the filter list without the owners whose `minTier` is above the tier.
- **Renderer quality.** `PixiRendererOptions.quality` sets the starting tier (default `high`). `PixiStage.quality` reads the tier and `PixiStage.setQuality(tier)` changes it: it re-caps the canvas resolution and re-tiers the slot.
- **`rebuildOnQuality(store, read, build, onBuilt?)`**, generic over runtime's `SettingsStore<S>` with `read: (settings: S) => QualityTier`.
- **`CompositeTarget`** (`packages/render-pixi/src/letterbox/composite-target.ts`):
  - the world and UI draw at resolution 1 and the logical size, then are nearest-upscaled into the letterbox;
  - it is on through `PixiRendererOptions.composite`, which defaults to on when `pixelArt` is on and the stage is letterboxed;
  - when it is on, the slot composes onto the composite stage, so the filter cost is bounded by the logical size;
  - the backdrop keeps device resolution, as in FloorFifty.
- **Dropped filters.** `stage.tryFilter(id, make)` returns the filter, or `undefined` when it cannot be built or compiled. When it drops one, it logs a warning and publishes `render.filter.dropped` with `{ id, reason }`. That fact joins `RuntimeFacts`, and `RenderTarget` gains an optional `bus` to publish it on.
- **Example:** `examples/render/render-quality.ts`, which switches tier with keys 1, 2 and 3 and shows a `minTier: 'medium'` pass leave at `low`.

**Out:**

- **The Display section of Settings, where the player picks the tier:** M4.4.
- **Auto-detecting a tier from the device:** M4-D6 waits on PRODUCT.7's phone measurements.
- **The frame-budget run at each tier:** the GPU runner, PRODUCT.7.

## Interfaces

| Produced | Where | Consumers |
|---|---|---|
| `QualityTier`, `qualityTierSchema`, `displaySettingsSchema`, `DEFAULT_QUALITY` | `@mcthaydt/automata-runtime` | render-pixi, M4.4 Display section, games' settings |
| `'render.filter.dropped': { id, reason }` in `RuntimeFacts`; `RenderTarget.bus?` | runtime | render-pixi, M4.10 |
| `canvasResolutionFor(..., tier)`, `RESOLUTION_CAPS`, `meetsTier` | `@mcthaydt/automata-render-pixi` | renderer |
| `PostFilterSlot.set(..., { minTier })`, `setTier`, `tier` | render-pixi (PRODUCT.1's slot, additive) | Plus `post-retro`, games |
| `PixiRendererOptions.quality`, `composite`; `PixiStage.quality`, `setQuality`, `tryFilter`, `composite` | render-pixi | games, examples |
| `rebuildOnQuality`, `CompositeTarget` | render-pixi | games |

## Steps

Each step starts with a failing test whose failure reason is confirmed and recorded here, then the minimal change.

1. [x] **Plan.** This file, committed first.
2. [x] **The tier contract (runtime).** Test file: `packages/runtime/src/settings/display-settings.test.ts`. Red: `Failed to resolve import "./display-settings.schema.js"`; green 3 of 3. Deviation: an unknown tier reads as `high` instead of being rejected, because every settings field falls back to its default (`readSettings`, Zod `.catch`), so a bad saved value never fails boot.
   - Red: `displaySettingsSchema.parse({})` is `{ quality: 'high' }`.
   - Red: `'ultra'` reads as `high`.
   - Red: the three tiers round-trip.
3. [x] **Resolution caps.** Test file: `packages/render-pixi/src/letterbox/canvas-resolution.test.ts`. Red: `expected undefined to deeply equal { low: 1, medium: 1.5, high: 2 }`; green 4 of 4 (the two existing cases unchanged).
   - Red: at device pixel ratio 3, `low` gives 1, `medium` 1.5 and `high` 2.
   - Red: a portrait tablet gives 1 at every tier.
   - Existing calls without a tier are unchanged.
4. [x] **Slot tiers (Q-a, slot half).** Test file: `post-filter-slot.test.ts`. Red: `expected undefined to be 'high'` and `slot.setTier is not a function`; green 5 of 5 (the three PRODUCT.1 cases unchanged). `ids` lists only the owners that run at the tier. `meetsTier` lives in `packages/render-pixi/src/quality/meets-tier.ts`.
   - Red: an owner set with `{ minTier: 'medium' }` is in the filter list at `high` and `medium`, and leaves at `setTier('low')`.
   - Red: it comes back at `setTier('high')`, in its old place by order.
   - Red: an owner with no `minTier` stays at every tier, as the FloorFifty palette lock does.
5. [x] **Renderer quality (Q-a).** Test file: `renderer.test.ts`, with the mocked `Application`. Red: `expected "init" to be called with arguments: [ ObjectContaining {"resolution": 1} ]` (both cases); green 12 of 12.
   - Red: `quality: 'low'` at device pixel ratio 2 inits at resolution 1, and a `minTier: 'medium'` owner is absent from `stage.filters`.
   - Red: `setQuality('high')` sets the resolution to 2 and brings the owner back.
   - Red: a geometry change keeps the tier's cap.
6. [x] **`rebuildOnQuality`.** Test file: `packages/render-pixi/src/quality/rebuild-on-quality.test.ts`, the FloorFifty cases over a runtime `SettingsStore` stub. Red: `Failed to resolve import "./rebuild-on-quality.js"`; green 3 of 3 (an `onBuilt` case added; the build asserts nothing else is alive when it runs).
   - Red: the old build is destroyed before the new one exists, and `dispose` leaves nothing alive.
   - Red: a change to another setting does not rebuild.
7. [ ] **`CompositeTarget`.** Test file: `composite-target.test.ts`, the FloorFifty cases at the game's logical size:
   - the texture is exactly the logical size, at resolution 1 and nearest scale mode;
   - `resize(height)` grows the texture and marks the sprite's quad to rebuild;
   - `filterArea` is pinned to the target;
   - `adopt` moves the world and UI into the target and puts its sprite in the letterbox root;
   - a filtered UI child keeps its own filters.
8. [ ] **The composite in the renderer.** Test file: `renderer.test.ts`.
   - Red: with `pixelArt` on and a logical size, `stage.composite` is defined, and `draw` renders the composite stage into its texture before `app.render`.
   - Red: a geometry change resizes the composite to the frame's field height.
   - Red: the slot's filters land on the composite stage, not the scene.
   - Red: `composite: false`, or `pixelArt: false`, keeps today's tree.
   - Red: the finalizer destroys the composite.
9. [ ] **Dropped filters (Q-b).**
   - Red (`renderer.test.ts`): `tryFilter('bad', () => { throw … })` returns `undefined`, logs one warning and publishes `render.filter.dropped` with `{ id: 'bad' }` on the target's bus. The frame still draws.
   - Red (`render-quality.parity.test.ts`, the browsers project, WebGL2 in Chromium, WebKit and Firefox): a filter whose GLSL does not compile is dropped by `tryFilter`, and a frame then renders without throwing.
   - The parity test also establishes how Pixi reports a compile failure: as a throw, or as a log with an unusable program. `tryFilter` compiles eagerly by rendering a 1 × 1 probe through the filter inside the try.
10. [ ] **Example and verification.**
    - The example `examples/render/render-quality.ts`, with its header, inside the catalog's budget.
    - Its catalog check and its smoke in the `examples` projects.
    - A changeset: patch, for render-pixi and runtime only if published; `check-changesets` decides.
    - `pnpm format`; `pnpm check` (`TURBO_FORCE=true`); the CI checks-job extras (`api-report --update`, `pnpm cheatsheet`, `pnpm api-index`, `pnpm agent-skills --write`, `build`, `test:dist`).
    - `pnpm test:parity`; `CI=1 pnpm test:e2e`; `prepare-ruken` for both games.
    - Tick the M4.9 row in 02, and record the evidence in 02's execution record and in 03.

## Acceptance mapping

| Case | Test |
|---|---|
| Q-a | `post-filter-slot.test.ts` (an owner leaves at `low`) and `renderer.test.ts` (resolution 1, and the owner absent from `stage.filters`) |
| Q-b | `renderer.test.ts` (dropped, fact, frame draws) and `render-quality.parity.test.ts` (a real compile failure in three engines) |

## Risks

- **The composite is on by default for pixel-art games, so it changes how Emberwick and the examples draw.** Shapes are drawn at the logical size and upscaled, instead of at device resolution. Any E2E screenshot that changes is shown to the Owner with its expected, actual and diff images, and is never rebaselined silently. Sim goldens cannot change: the composite is presentation only.
- **How Pixi 8 reports a compile failure is not yet known.** Step 9's parity test settles it before `tryFilter` is written.
- **The draw layer and the camera move the world container.** The composite adopts that same container, so `camera2d` keeps working. Step 8 checks that the world container `stage.world` returns is the one the composite renders.
