# M1.7 2D Renderer: `render-pixi`, WebGL2-default init, `RenderDelta` consumer, pixel framebuffer, letterbox and filter helpers

- **Status:** Drafted 2026-10-13; reviewed by builder check; ready for Owner review. Next: M1.7 TDD plan (`docs/superpowers/plans/2026-10-13-m1-render-pixi.md`).
- **Task:** M1.7 in the [master delivery plan](../../02-master-delivery-plan.md). Detail level: [01 Decomposition](../../01-decomposition.md) §5.
- **Builds against:**
  - the [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md): §4.1 `render-pixi` row, §5, §6, §7;
  - [ADR 0002](../../adr/0002-pixi-for-2d-and-3d.md): PixiJS for 2D and 3D (WebGL2 default, WebGPU opt-in, no-eval bootstrap, S4 filter pairs);
  - the [extraction map](./2026-10-11-core-and-extensions-extraction-map.md): `render-pixi` section;
  - [Spike S4](../../spikes/s4-pixi.md): PixiJS 8.21 on WebGPU and WebGL, vertex-stage pixel position rule;
  - [M1.5 Runtime](./2026-10-12-m1-runtime-design.md): `GameRenderer`, `RendererFactory`, `RenderTarget`, `FrameInfo`, `RendererUnavailable`.
- **Consumes, does not rebuild (on `main`):**
  - `packages/sim`: `StepResult`, `RenderDelta`, `RenderRow`, `FieldRecord`;
  - `packages/runtime`: `GameRenderer`, `RendererFactory`, `RenderTarget`, `FrameInfo`, `RendererUnavailable`;
  - `packages/ui`: `GeometryOwner`, `Geometry`, `FormFactor`, `classifyFormFactor`;
  - `pixi.js` 8.21.0: `Application`, `Container`, `Graphics`, `Sprite`, `Texture`, `RenderTexture`, `TextureSource`, `Filter`, `GlProgram`, `GpuProgram`.
- **Source commits (re-read 2026-10-13):**
  - FloorFifty `45482fb`: `apps/client/src/no-eval.ts`, `apps/client/src/managers/canvas-resolution.ts`, `apps/client/src/managers/letterbox.ts`, `apps/client/src/managers/app.ts`, `tests/client/managers/{canvas-resolution,letterbox}.test.ts`;
  - The Last Light (`PixiJS3D_Experiment_001`) `8280918`: `src/render/stage.ts` lines 355–387, `src/render/filter-programs.ts`, `src/render/retro-filter.ts`.

---

## 1. Goal and boundaries

`packages/render-pixi` (`@mcthaydt/automata-render-pixi`) provides AF's core 2D renderer. It connects the simulation's `RenderDelta` stream to PixiJS 8, running strictly outside the sim and honoring Ruken's CSP (no `eval`).

**Deliverables:**
1. Package `packages/render-pixi` (`@mcthaydt/automata-render-pixi`), built with tsdown, published to GitHub Packages as part of core AF.
2. The `./no-eval` bootstrap entry point: imports `pixi.js/unsafe-eval` and sets Zod `config({ jitless: true })` before any code compiles schemas or initializes Pixi.
3. WebGL2-default renderer initialization with WebGPU opt-in, query param override (`?renderer=webgl` / `?renderer=webgpu`), single WebGL2 retry on WebGPU failure, canvas dataset stamping (`canvas.dataset.renderer = 'webgl' | 'webgpu'`), and typed error `RendererUnavailable` if initialization fails.
4. Effect `RendererFactory` layer yielding a scoped `PixiRenderer` (extending `GameRenderer`) matching `automata-runtime`'s contracts (`apply`, `draw`, `reset`).
5. `RenderDelta` consumer: manages entity views from `added`, `changed`, `removed`, and `resync`, caching previous and current states for sub-tick interpolation driven by `FrameInfo.alpha`.
6. Pixel framebuffer & resolution: handles high-DPI scaling via `canvasResolutionFor` (capped at 2x, 1x on `tablet-portrait`), integer nearest-neighbour upscaling for pixel art, and fixed logical framebuffers.
7. Letterbox frame (`LetterboxFrame`): letterbox, mask, backdrop, world, and HUD layering with portrait field lifting (`portraitFieldHeight`) adapted from FloorFifty, synchronizing reactively with `GeometryOwner`.
8. Filter helpers (`filterPrograms`): GLSL + WGSL pairs with shared vertex programs passing screen-space pixel position from the vertex stage per Spike S4.
9. Feature demo `examples/render-pixi/renderer-2d` proving WebGL2/WebGPU init, letterboxing, entity delta interpolation, and filter shader execution under the fake Ruken host.

**Not in M1.7:**
- 3D rendering, mesh loading, perspective cameras, scene lighting: lives in `packages/render-pixi3d` extension (M3 / M9, unpublished per D-1).
- Complex gameplay post-filter chains (Bayer dither, LCD panel, palette LUT, CRT curvature): lives in `post-retro` extension (M3). Core `render-pixi` provides the shader pair helper (`filterPrograms`) only.
- Audio unlock or sound effects: lives in `audio-synth` / `audio-stream` (M5).
- Input event mapping: lives in `input` (M4).

---

## 2. Ownership

| State / Resource | Owner | Writers | Readers |
|---|---|---|---|
| Pixi Application & WebGL/WebGPU context | `PixiRenderer` / Scope | `createPixiRenderer` | Canvas host, render loop |
| Canvas DOM element | `PixiRenderer` | `createPixiRenderer` (appends), Scope (removes) | Host document, `RenderTarget.host` |
| Renderer type attribute (`data-renderer`) | `PixiRenderer` | `initRenderer` (`webgl` or `webgpu`) | E2E test assertions, debug overlay |
| Entity view graph (Pixi containers/sprites) | `RenderDeltaConsumer` | `apply(result.render)` | `draw(frame)` |
| Entity interpolation cache (`prev` / `curr` states) | `RenderDeltaConsumer` | `apply(result.render)` | `draw(frame)` |
| Letterbox geometry & mask | `LetterboxFrame` | `layout(width, height)` via `GeometryOwner.onChange` | Pixi stage, UI overlay |
| Post-processing filters | Game / Extension | Game / Extension setup | `PixiStage.filters` |

Rules:
- The sim never imports `render-pixi` or PixiJS.
- `render-pixi` never writes sim state; it reads `StepResult.render` (`RenderDelta`) and `StepResult.events`.
- Effect is used for setup lifecycle (`Scope`, `RendererFactory`, typed errors); the per-frame `draw` method runs as synchronous, allocation-free code within the frame budget.

---

## 3. Contracts

### 3.1 Package Exports and Entry Points

```json
{
  "name": "@mcthaydt/automata-render-pixi",
  "version": "0.0.1",
  "license": "UNLICENSED",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./no-eval": {
      "import": "./dist/no-eval.js",
      "types": "./dist/no-eval.d.ts"
    }
  }
}
```

### 3.2 `./no-eval` Entry Point
Must be imported before any code that compiles schemas or touches Pixi:
```ts
import 'pixi.js/unsafe-eval'
import { config } from 'zod'

config({ jitless: true })
```

### 3.3 PixiStage & PixiRenderer Interface

To enable games and extensions to attach post-processing filters, lighting passes, and custom scene layers, `PixiRenderer` exposes its `PixiStage`:

```ts
export interface PixiStage {
  readonly app: Application
  readonly frame?: LetterboxFrame | undefined
  /** The world container where entity views and gameplay objects are mounted. */
  readonly world: Container
  /** The logical screen-space UI layer (masked with the playfield). */
  readonly ui: Container
  /** The unclipped background scenery container. */
  readonly backdrop: Container
  /** The delta consumer tracking entity views. */
  readonly consumer: RenderDeltaConsumer
  /** Post-processing filters applied to the root rendered scene. */
  filters: Filter[] | null
}

export interface PixiRenderer extends GameRenderer {
  readonly stage: PixiStage
}
```

### 3.4 Renderer Options & Factory

```ts
export type RendererPreference = 'webgl' | 'webgpu'

export interface PixiRendererOptions {
  /**
   * Preferred backend. Default is 'webgl' (WebGL2).
   * Overridden by URL query param `?renderer=webgl` or `?renderer=webgpu` if present in browser.
   */
  readonly preference?: RendererPreference
  /** Logical playfield width in pixels (e.g. 960 or 320). If omitted, renders unletterboxed. */
  readonly logicalWidth?: number
  /** Logical playfield height in pixels (e.g. 540 or 192). If omitted, renders unletterboxed. */
  readonly logicalHeight?: number
  /** Background clear colour (hex number, e.g. 0x000000). Default is 0x000000. */
  readonly backgroundColor?: number
  /** If true, textures default to nearest-neighbour sampling for crisp pixel art. Default is true. */
  readonly pixelArt?: boolean
  /** Letterbox cropping fraction for top and bottom bars. Default is 0.05 (5%). */
  readonly barFraction?: number
  /** Bar color in hex. Default is 0x2e222f (FloorFifty plum black). */
  readonly barColor?: number
  /** Optional view factory resolver for entity components. */
  readonly entityViews?: EntityViewResolver
  /** Optional setup hook called before the first frame to add layers/filters. */
  readonly setup?: (stage: PixiStage) => void
}

export function createPixiRenderer(
  options?: PixiRendererOptions,
): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope>
```

### 3.5 `RenderDeltaConsumer` & View Registry

`RenderDelta` from `@mcthaydt/automata-sim` carries rows of type `RenderRow`:
```ts
export interface RenderRow {
  readonly sid: number
  readonly components: Readonly<Record<string, Readonly<FieldRecord>>>
}
```

An entity view handles the visual representation of one entity:
```ts
export interface EntityView {
  readonly container: Container
  update?(
    curr: Readonly<Record<string, Readonly<FieldRecord>>>,
    prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined,
    alpha?: number,
  ): void
  destroy?(): void
}

export type EntityViewFactory = (row: RenderRow) => EntityView | undefined

export type EntityViewResolver =
  | EntityViewFactory
  | Readonly<Record<string, EntityViewFactory>>

export class RenderDeltaConsumer {
  constructor(world: Container, resolver?: EntityViewResolver)
  apply(delta: RenderDelta): void
  interpolate(alpha: number): void
  reset(): void
  destroy(): void
}
```

**Entity view resolution rule:**
- If `resolver` is a function: calls `resolver(row)`; if an `EntityView` is returned, it is mounted.
- If `resolver` is a record `Record<string, EntityViewFactory>`: iterates the registered component keys; the first key present in `row.components` determines the factory. If none match, no view is mounted.
- Views are added to `world`. When an entity is removed or resynced, `view.destroy?.()` is called and `view.container` is removed from `world`.

**Interpolation cache lifecycle rule:**
- For entities present in `delta.added`: `prev = undefined`, `curr = row.components`.
- For entities present in `delta.changed`: `prev = oldCurr`, `curr = row.components`.
- For entities tracked but NOT present in `delta.changed` (stationary entities during tick $N+1$): `prev = curr`. This freezes their position so they do not interpolate stale delta movement from tick $N$.
- For entities in `delta.removed`: removed from cache and views destroyed.
- On `delta.resync === true` or `reset()`: all cached records and views are cleared.

### 3.6 Letterbox Frame (`LetterboxFrame`)

Adapted directly from FloorFifty's `LetterboxFrame` (`apps/client/src/managers/letterbox.ts`):

```ts
export interface LetterboxGeometry {
  scale: number
  x: number
  y: number
  width: number
  height: number
  /** The visible playfield within the clip minus the letterbox bars. */
  gameplay: { x: number; y: number; width: number; height: number }
  /** The unclipped scenery extent in logical units covering the canvas. */
  scenery: { x: number; y: number; width: number; height: number }
  portrait: boolean
  fieldHeight: number
}

export interface LetterboxOptions {
  readonly logicalWidth: number
  readonly logicalHeight: number
  readonly barFraction?: number
  readonly barColor?: number
  readonly fieldColor?: number
}

export class LetterboxFrame {
  /** Container holding backdrop, root, and mask. */
  readonly scene: Container
  /** Unclipped background scenery spanning the canvas. */
  readonly backdrop: Container
  /** The play area, scaled and masked to the logical viewport. */
  readonly root: Container
  /** Camera/entity world layer inside root. */
  readonly world: Container
  /** Fixed screen-space UI inside root. */
  readonly ui: Container
  /** Viewport mask clipping root. */
  readonly mask: Graphics
  /** Sibling container holding top and bottom bars outside scene filters. */
  readonly bars: Container
  readonly topBar: Graphics
  readonly bottomBar: Graphics

  constructor(options: LetterboxOptions)
  layout(viewWidth: number, viewHeight: number): LetterboxGeometry
  setBarBlack(amount: number): void
  destroy(): void
}

export const PORTRAIT_FIELD_TOP = 60
export const MAX_RESOLUTION = 2

export function canvasResolutionFor(
  formFactor: FormFactor,
  devicePixelRatio: number,
): number

export function portraitFieldHeight(
  viewHeight: number,
  scale: number,
  band: number,
  baseHeight?: number,
): number
```

**Geometry formulas:**
- `portraitFieldHeight(viewHeight, scale, band, baseHeight = 540)`:
  Calculates field height in logical units on portrait screens:
  `Math.max(baseHeight, Math.floor((viewHeight - PORTRAIT_FIELD_TOP - band) / scale))`
  where `band` is the thumb control bottom safe band in CSS pixels (e.g. 140 px on phone, 180 px on tablet).
- `canvasResolutionFor(formFactor, dpr)`:
  Returns `1` for `tablet-portrait` (to preserve fragment fill budget on large tablets), otherwise `Math.min(dpr || 1, MAX_RESOLUTION)`.
- `gameplay` rectangle:
  `gameplayTop = barsVisible ? Math.max(clipTop, y + cropped) : clipTop`
  `gameplayBottom = barsVisible ? Math.min(clipBottom, y + height - cropped) : clipBottom`
  `gameplay = { x: 0, y: gameplayTop, width: viewWidth, height: Math.max(0, gameplayBottom - gameplayTop) }`
- `scenery` rectangle:
  `scenery = { x: -x / scale, y: -y / scale, width: viewWidth / scale, height: viewHeight / scale }`
- `setBarBlack(amount)`:
  `keep = Math.round(255 * (1 - Math.min(1, Math.max(0, amount))))`
  `tint = (keep << 16) | (keep << 8) | keep`
  Tints `topBar` and `bottomBar` toward true black.

### 3.7 Filter Programs Helper (`filterPrograms`)

```ts
export const FILTER_VERTEX: string
export const WGSL_FILTER_HEADER: string

export interface FilterProgramsResult {
  readonly glProgram: GlProgram
  readonly gpuProgram: GpuProgram
}

export function filterPrograms(
  name: string,
  fragmentGlsl: string,
  fragmentWgsl: string,
): FilterProgramsResult
```

In accordance with Spike S4:
- In `FILTER_VERTEX` (GLSL):
  ```glsl
  precision highp float;
  in vec2 aPosition;
  out vec2 vTextureCoord;
  out vec2 vPixelCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;
  void main() {
    vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    p.x = p.x * 2.0 / uOutputTexture.x - 1.0;
    p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(p, 0.0, 1.0);
    vTextureCoord = aPosition * uOutputFrame.zw * uInputSize.zw;
    vPixelCoord = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  }
  ```
- In `WGSL_FILTER_HEADER`:
  `VSOutput` carries `position: vec4<f32>`, `@location(0) uv: vec2<f32>`, and `@location(1) pixelCoord: vec2<f32>`.
  `mainVertex` computes `pixelCoord = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy`.
- Screen-space filter passes read `vPixelCoord` / `pixelCoord`, guaranteeing bit-identical pattern alignment across WebGL2 and WebGPU.

---

## 4. Data and lifecycle flow

### 4.1 Initialization (within Effect `Scope`)
1. Extract `target.host`, `target.geometry`, and `target.assets`.
2. Inspect environment / query parameter:
   - Check `location.search` for `?renderer=webgl` or `?renderer=webgpu`.
   - Priority: URL override > `options.preference` > default `'webgl'`.
3. Configure `TextureSource.defaultOptions.scaleMode = 'nearest'` if `pixelArt` is enabled.
4. Calculate resolution via `canvasResolutionFor(target.geometry.geometry.current.formFactor, window.devicePixelRatio)`.
5. Call `app.init({ preference, width: target.geometry.geometry.current.usable.width, height: target.geometry.geometry.current.usable.height, resolution, ... })`:
   - If `preference === 'webgpu'` and initialization fails, destroy partial app and retry once with `preference: 'webgl'`.
   - If WebGL2 also fails, fail with `RendererUnavailable({ tried: ['webgpu', 'webgl2'] })`.
   - If WebGL2 was initial choice and fails, fail with `RendererUnavailable({ tried: ['webgl2'] })`.
6. Stamped canvas attributes:
   - `app.canvas.dataset.renderer = app.renderer.name` (`'webgl'` or `'webgpu'`).
   - `app.canvas.classList.add('af-stage')`.
7. Mount canvas to `target.host`.
8. Create stage hierarchy:
   - If `logicalWidth` & `logicalHeight` provided: construct `LetterboxFrame`, add `frame.scene` and `frame.bars` to `app.stage`.
   - If unletterboxed: create `world`, `ui`, `backdrop` directly under `app.stage`.
9. Construct `RenderDeltaConsumer` over `world`.
10. Wire reactive geometry changes:
    - Listen via `target.geometry.onChange((g) => { ... })`:
      - Resize renderer: `app.renderer.resize(g.usable.width, g.usable.height)`.
      - Recompute letterbox: `frame?.layout(g.usable.width, g.usable.height)`.
      - Update resolution if `canvasResolutionFor` changed.
    - Run initial layout immediately.
11. Call `options.setup?.(stage)`.
12. Register finalizer on `Scope`:
    - Unsubscribe from `target.geometry`.
    - Call `consumer.destroy()`.
    - Call `frame?.destroy()`.
    - Call `app.destroy(true, { children: true, texture: true })`.
    - Remove `app.canvas` from `target.host`.
13. Return `PixiRenderer` instance.

### 4.2 Per-Step Update (`apply(result: StepResult)`)
1. Pass `result.render` to `consumer.apply(result.render)`.
2. Advance delta interpolation cache:
   - Resync: purge all cached entities and views.
   - Removed: prune from cache and destroy views.
   - Added/Changed: advance `prev = curr`, update `curr`.
   - Unchanged: advance `prev = curr`.

### 4.3 Per-Frame Draw (`draw(frame: FrameInfo)`)
1. Interpolate entities via `consumer.interpolate(frame.alpha)`.
2. Call `app.render()`.
3. Zero Effect allocations: pure synchronous JS execution.

### 4.4 Reset (`reset()`)
1. Clear all entity views and interpolation states (`consumer.reset()`).
2. Reset camera and letterbox frame effects.

---

## 5. Failure policy

1. **Unsupported WebGPU / WebGL2:**
   - Fallback hierarchy: WebGPU -> WebGL2 -> Fail.
   - Failure raises typed error `RendererUnavailable` which the boot program catches and maps to the "unsupported" screen with an exit button.
2. **Context Loss:**
   - Pixi 8 handles transient WebGL context restore automatically where supported.
   - Unrecoverable loss emits defect or fatal error handled by the runtime supervisor.
3. **Missing Entity Component View:**
   - If an entity row in `delta.added` does not match any registered factory, fallback to an invisible/noop view without crashing the frame loop.
4. **Scope Cancellation:**
   - Scope interruption cleanly tears down Pixi WebGL/WebGPU contexts and DOM attachments without leaking listeners or WebGL handles.

---

## 6. Responsive behavior and geometry

1. **Resolution Cap:**
   - Maximum resolution is `2.0`.
   - `tablet-portrait` uses resolution `1.0` to preserve the fragment shader budget on large screens.
2. **Letterboxing:**
   - Fills the host element.
   - Landscape: Maintains exact logical aspect ratio (e.g. 16:9), masking edges and framing with bars.
   - Portrait: Lifts playfield under the HUD top margin (`PORTRAIT_FIELD_TOP = 60`) and above bottom thumb safe area.
3. **Whole-Pixel Upscaling:**
   - Optional integer scaling mode (`Math.floor(scale)`) prevents pixel distortion on pixel-art games.

---

## 7. Test allocation

| Layer | Files | Verifies |
|---|---|---|
| Unit (No DOM / Mocked) | `packages/render-pixi/src/no-eval.test.ts` | Pixi unsafe-eval loaded and Zod `jitless: true` active |
| Unit (Pure math) | `packages/render-pixi/src/letterbox/canvas-resolution.test.ts` | `canvasResolutionFor` across form factors and pixel ratios |
| Unit (Pure geometry) | `packages/render-pixi/src/letterbox/letterbox.test.ts` | `LetterboxFrame` bounds, masking, portrait field calculation |
| Unit (Shader strings) | `packages/render-pixi/src/filter/filter-programs.test.ts` | GLSL + WGSL vertex output variables, `vPixelCoord` syntax |
| Unit (Sim integration) | `packages/render-pixi/src/delta/render-delta-consumer.test.ts` | `RenderDelta` processing: add, update, remove, resync, interpolation |
| Unit / Fake DOM | `packages/render-pixi/src/renderer.test.ts` | `createPixiRenderer` factory, preference fallback, error handling |
| Parity (Headless browsers) | `packages/render-pixi/src/parity/*.test.ts` | Shader compilation and parity across Chromium, WebKit, Firefox |
| E2E / Browser Journey | `examples/render-pixi/renderer-2d/tests/renderer-2d.e2e.ts` | Playwright test under fake host: WebGL canvas mount, zero eval CSP, delta rendering |

---

## 8. Feedback workflow

- Fast feedback: `pnpm --filter @mcthaydt/automata-render-pixi test` runs unit tests in < 2 seconds.
- Quality gates: `pnpm check` (lint, typecheck, boundaries, style, unit tests).
- Browser checks: `pnpm --filter @mcthaydt/automata-render-pixi test:parity` in Chromium, WebKit, and Firefox.

---

## 9. Ruken alignment

- **CSP:** Strict CSP compatibility (zero `eval`, zero `new Function`) verified with Ruken's `compileHeaders` test.
- **Manifest:** Ruken manifest defines `webgl2` as reference renderer; WebGL2 default aligns directly with Ruken games.
- **`display.metrics`:** Respects safe area, `hostReserved`, and `scale` via `GeometryOwner`.
- **Packaging:** tsdown bundles ESM with TypeScript type definitions.

---

## 10. Exit criteria

1. `@mcthaydt/automata-render-pixi` builds, tests, and passes `pnpm check`.
2. `./no-eval` boots cleanly under Ruken CSP with 0 `securitypolicyviolation` events.
3. WebGL2 initialized by default; WebGPU opt-in falls back cleanly to WebGL2 on failure; fatal init returns `RendererUnavailable`.
4. `RenderDelta` consumer correctly interpolates entity positions and handles `resync`.
5. `LetterboxFrame` matches FloorFifty's geometry specifications and tests.
6. `filterPrograms` compiles and matches S4 vertex-stage pixel coordinate rules.
7. `examples/render-pixi/renderer-2d` passes end-to-end browser tests under fake Ruken host.
