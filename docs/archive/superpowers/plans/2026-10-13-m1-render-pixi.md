# M1.7 2D Renderer (`render-pixi`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@mcthaydt/automata-render-pixi`, the framework's core 2D renderer connecting sim `RenderDelta` streams to PixiJS 8 under Ruken's strict no-eval CSP, with WebGL2 default init, WebGPU opt-in, letterbox framing, and Spike S4 filter helpers.

**Architecture:** A lightweight Effect-managed `RendererFactory` initializes PixiJS on WebGL2 (or WebGPU when opted in), managing canvas lifecycle and reactive geometry resizing via `GeometryOwner`. A pure synchronous `RenderDeltaConsumer` caches and interpolates entity views across sub-tick `FrameInfo.alpha` steps without allocating per frame. FloorFifty's proven `LetterboxFrame` isolates gameplay masking from post-processing bars, while `filterPrograms` compiles GLSL + WGSL shader pairs passing screen-space pixel position from the vertex stage.

**Tech Stack:** TypeScript 5.8, PixiJS 8.21.0 (`pixi.js`, `pixi.js/unsafe-eval`), Zod 4 (jitless), Effect 3.19 (`Context`, `Scope`, `Data`, `Effect`), Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-13-m1-render-pixi-design.md`](../specs/2026-10-13-m1-render-pixi-design.md)

---

## Global Constraints

- **Ruken CSP:** Zero `eval` or `new Function` at runtime; `./no-eval` must be imported first by any game entry point.
- **Renderer Preference:** WebGL2 is the default backend. WebGPU is opt-in (`preference: 'webgpu'`). Single WebGL2 retry on WebGPU failure. Fatal failure yields typed `RendererUnavailable`.
- **Canvas Dataset:** `app.canvas.dataset.renderer` must be set to `'webgl'` or `'webgpu'`.
- **Effect Frame Loop Rule:** No Effect allocations inside `draw(frame: FrameInfo)`. Setup and teardown use Effect `Scope`.
- **Naming & Linting:** Strict kebab-case filenames with role suffixes (`*.manager.ts`, `*.test.ts`, etc.). Clean `pnpm check` (biome, typecheck, boundaries, style).
- **Parity:** Filter programs and geometry math must produce bit-for-bit identical results in Node, Chromium, WebKit, and Firefox.

---

## Review Focus

1. **CSP violation on dynamic shader compilation or schema probing:**
   `./no-eval` must patch both Pixi (`pixi.js/unsafe-eval`) and Zod (`config({ jitless: true })`) before any module evaluations occur.
2. **Stationary entity sub-tick drift:**
   Entities absent from `delta.changed` on tick $N+1$ must advance `prev = curr` in `RenderDeltaConsumer` so they do not interpolate stale delta movement.
3. **WebGPU failure on unsupported hardware:**
   When `preference: 'webgpu'` is requested but WebGPU context creation rejects, `createPixiRenderer` must cleanly destroy the partial app and fall back to WebGL2 without leaving orphan canvas nodes.
4. **Letterbox masking overflow on wide displays (> 1.98:1):**
   Canvas wider than 16:9 causes logical field overflow; `LetterboxFrame` must clamp masks so bars do not render inside-out or inverted.
5. **Cross-engine shader coordinate mismatch:**
   Screen-space filter shaders must receive `vPixelCoord` / `pixelCoord` from the vertex stage rather than relying on `gl_FragCoord` or `@builtin(position)`, preventing vertical flip divergence between WebGL2 and WebGPU.

---

## Tasks

### Task 1: Package Scaffolding & Build Setup (`packages/render-pixi`)

**Files:**
- Create: `packages/render-pixi/package.json`
- Create: `packages/render-pixi/tsconfig.json`
- Create: `packages/render-pixi/tsdown.config.ts`
- Create: `packages/render-pixi/src/index.ts`
- Test: `packages/render-pixi/src/index.test.ts`
- Modify: `pnpm-lock.yaml`, `package.json`

**Interfaces:**
- Consumes: `@mcthaydt/automata-sim`, `@mcthaydt/automata-runtime`, `@mcthaydt/automata-ui`, `pixi.js` 8.21.0
- Produces: Package `@mcthaydt/automata-render-pixi` exported under ESM and types

- [ ] **Step 1: Write failing test verifying package export exports**

```ts
// packages/render-pixi/src/index.test.ts
import { describe, expect, it } from 'vitest'
import * as RenderPixi from './index.js'

describe('@mcthaydt/automata-render-pixi', () => {
  it('exports expected symbols', () => {
    expect(RenderPixi).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test`
Expected: FAIL with missing package or module not found.

- [ ] **Step 3: Implement package configuration, tsdown config, and initial index.ts**

Create `package.json` with `"name": "@mcthaydt/automata-render-pixi"`, dependencies on `effect`, `zod`, workspace packages, and peer dependency on `pixi.js: ^8.21.0`. Configure `tsdown.config.ts` targeting `src/index.ts` and `src/no-eval.ts`.

- [ ] **Step 4: Run test and build to verify they pass**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test && pnpm --filter @mcthaydt/automata-render-pixi build`
Expected: PASS with `.dist` output generated.

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi pnpm-lock.yaml
git commit -m "feat(render-pixi): scaffold package and tsdown build"
```

---

### Task 2: `./no-eval` Bootstrap Entry Point

**Files:**
- Create: `packages/render-pixi/src/no-eval.ts`
- Test: `packages/render-pixi/src/no-eval.test.ts`

**Interfaces:**
- Consumes: `pixi.js/unsafe-eval`, `zod`
- Produces: Side-effecting module `@mcthaydt/automata-render-pixi/no-eval`

- [ ] **Step 1: Write failing test verifying no-eval runtime state**

```ts
// packages/render-pixi/src/no-eval.test.ts
import { describe, expect, it } from 'vitest'
import { globalConfig } from 'zod'

describe('render-pixi/no-eval', () => {
  it('enforces jitless mode in zod', async () => {
    await import('./no-eval.js')
    expect(globalConfig.jitless).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/no-eval.test.ts`
Expected: FAIL with `Cannot find module './no-eval.js'`

- [ ] **Step 3: Implement `src/no-eval.ts`**

Import `'pixi.js/unsafe-eval'` and call `config({ jitless: true })` from `'zod'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/no-eval.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/no-eval.ts packages/render-pixi/src/no-eval.test.ts
git commit -m "feat(render-pixi): add no-eval bootstrap entry"
```

---

### Task 3: Resolution & Letterbox Frame (`canvasResolutionFor`, `portraitFieldHeight`, `LetterboxFrame`)

**Files:**
- Create: `packages/render-pixi/src/letterbox/canvas-resolution.ts`
- Test: `packages/render-pixi/src/letterbox/canvas-resolution.test.ts`
- Create: `packages/render-pixi/src/letterbox/letterbox.ts`
- Test: `packages/render-pixi/src/letterbox/letterbox.test.ts`

**Interfaces:**
- Consumes: `@mcthaydt/automata-ui` (`FormFactor`, `classifyFormFactor`), `pixi.js` (`Container`, `Graphics`)
- Produces: `canvasResolutionFor`, `portraitFieldHeight`, `LetterboxFrame`, `LetterboxGeometry`, `LetterboxOptions`

- [ ] **Step 1: Write failing tests for canvas-resolution and letterbox geometry**

Port tests from FloorFifty's `tests/client/managers/canvas-resolution.test.ts` and `letterbox.test.ts`:
- `canvasResolutionFor`: 2x cap on phones/desktop, 1x on `tablet-portrait`.
- `LetterboxFrame`:
  - 16:9 canvas fits exactly with 0 bar height.
  - Wide aspect ratios (> 16:9) overflow vertically without pillarboxing.
  - Portrait canvas lifts field below `PORTRAIT_FIELD_TOP = 60` and above bottom control band.
  - Mask clips scene root, bars stay outside scene filter hierarchy.
  - `setBarBlack` tints bars towards true black.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/letterbox/`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement `canvas-resolution.ts` and `letterbox.ts`**

Port FloorFifty's `canvasResolutionFor`, `portraitFieldHeight`, and `LetterboxFrame` class with:
- Container hierarchy: `scene` (holds `backdrop`, `root`, `mask`), `root` (holds `world`, `ui`), `bars` (holds `topBar`, `bottomBar`).
- Calculations for `gameplay`, `scenery`, `fieldHeight`, `scale`, and bar clamping.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/letterbox/`
Expected: PASS (all geometry assertions green).

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/letterbox/
git commit -m "feat(render-pixi): implement canvasResolutionFor and LetterboxFrame"
```

---

### Task 4: Filter Programs Helper (`filterPrograms`, `FILTER_VERTEX`, `WGSL_FILTER_HEADER`)

**Files:**
- Create: `packages/render-pixi/src/filter/filter-programs.ts`
- Test: `packages/render-pixi/src/filter/filter-programs.test.ts`

**Interfaces:**
- Consumes: `pixi.js` (`GlProgram`, `GpuProgram`)
- Produces: `FILTER_VERTEX`, `WGSL_FILTER_HEADER`, `filterPrograms(name, fragmentGlsl, fragmentWgsl): FilterProgramsResult`

- [ ] **Step 1: Write failing test for filterPrograms helper**

Verify `filterPrograms` compiles GLSL and WGSL program pairs:
- `FILTER_VERTEX` contains `out vec2 vPixelCoord;` and computes `aPosition * uOutputFrame.zw + uOutputFrame.xy`.
- `WGSL_FILTER_HEADER` defines `pixelCoord: vec2<f32>` in `VSOutput` and sets it in `mainVertex`.
- Returned object has valid `glProgram` and `gpuProgram` instances.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/filter/`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `filter-programs.ts`**

Export `FILTER_VERTEX`, `WGSL_FILTER_HEADER`, and `filterPrograms` function adhering to Spike S4's vertex-stage pixel coordinate specification.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/filter/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/filter/
git commit -m "feat(render-pixi): add filterPrograms helper with S4 vertex pixel coordinates"
```

---

### Task 5: `RenderDeltaConsumer` & Sub-Tick Interpolation

**Files:**
- Create: `packages/render-pixi/src/delta/render-delta-consumer.ts`
- Test: `packages/render-pixi/src/delta/render-delta-consumer.test.ts`

**Interfaces:**
- Consumes: `@mcthaydt/automata-sim` (`RenderDelta`, `RenderRow`, `FieldRecord`), `pixi.js` (`Container`)
- Produces: `RenderDeltaConsumer`, `EntityView`, `EntityViewFactory`, `EntityViewResolver`

- [ ] **Step 1: Write failing tests for RenderDeltaConsumer**

Test cases:
- Adding entity creates view via resolver and mounts container to `world`.
- Changing entity advances `prev = oldCurr`, sets `curr = newCurr`, and triggers `view.update(curr, prev, alpha)`.
- Stationary entity (in tick $N+1$, present in cache but absent in `delta.changed`) advances `prev = curr`.
- Sub-tick interpolation calls `view.update(curr, prev, alpha)` with correct `alpha`.
- Removing entity calls `view.destroy()` and removes container from `world`.
- `resync: true` or `reset()` clears all views and cached records.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/delta/`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `RenderDeltaConsumer`**

Implement `RenderDeltaConsumer` managing entity views and the interpolation cache according to the rules defined in §3.5 of the spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/delta/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/delta/
git commit -m "feat(render-pixi): implement RenderDeltaConsumer and sub-tick interpolation"
```

---

### Task 6: `createPixiRenderer` Factory & Lifecycle Integration

**Files:**
- Create: `packages/render-pixi/src/renderer.ts`
- Modify: `packages/render-pixi/src/index.ts`
- Test: `packages/render-pixi/src/renderer.test.ts`

**Interfaces:**
- Consumes: `@mcthaydt/automata-runtime` (`RenderTarget`, `GameRenderer`, `RendererUnavailable`, `FrameInfo`), `@mcthaydt/automata-sim` (`StepResult`), `pixi.js` (`Application`, `TextureSource`)
- Produces: `createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Effect.Effect<PixiRenderer, RendererUnavailable, Scope.Scope>`

- [ ] **Step 1: Write failing tests for createPixiRenderer**

Test cases:
- Initializes with WebGL2 default, stamps `app.canvas.dataset.renderer = 'webgl'`.
- Respects `preference: 'webgpu'` or URL override `?renderer=webgpu`.
- Fallback: when WebGPU init throws, cleans up partial app and retries once on WebGL2.
- When both backends fail, yields `RendererUnavailable({ tried: ['webgpu', 'webgl2'] })`.
- Stamped canvas is appended to `target.host`.
- When `target.geometry.onChange` fires, calls `app.renderer.resize` and `frame.layout`.
- Effect scope finalizer destroys app, views, letterbox frame, and removes canvas from DOM.
- `apply(result)` forwards render delta to consumer.
- `draw(frame)` executes synchronous render without allocating Effects.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/renderer.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `createPixiRenderer`**

Implement `createPixiRenderer` and export `PixiStage` and `PixiRenderer` from `src/renderer.ts`. Wire into `src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test src/renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/renderer.ts packages/render-pixi/src/index.ts packages/render-pixi/src/renderer.test.ts
git commit -m "feat(render-pixi): implement createPixiRenderer factory with WebGL2/WebGPU fallback"
```

---

### Task 7: Feature Demo `examples/render-pixi/renderer-2d` & E2E Tests

**Files:**
- Create: `examples/render-pixi/renderer-2d/package.json`
- Create: `examples/render-pixi/renderer-2d/tsconfig.json`
- Create: `examples/render-pixi/renderer-2d/vite.config.ts`
- Create: `examples/render-pixi/renderer-2d/index.html`
- Create: `examples/render-pixi/renderer-2d/src/main.ts`
- Create: `examples/render-pixi/renderer-2d/tests/renderer-2d.e2e.ts`

**Interfaces:**
- Consumes: `@mcthaydt/automata-render-pixi`, `@mcthaydt/automata-runtime`, `@mcthaydt/automata-sim`, `@ruken/sdk-host`
- Produces: Standalone runnable demo with automated Playwright browser test verifying zero-eval CSP, canvas mount, delta rendering, and letterbox geometry.

- [ ] **Step 1: Write Playwright E2E test verifying demo canvas and CSP**

Test in `renderer-2d.e2e.ts`:
- Loads page inside iframe with strict Ruken CSP (`script-src 'self' 'wasm-unsafe-eval'`).
- Verifies zero CSP violations (`securitypolicyviolation` event listener).
- Verifies canvas has `data-renderer="webgl"` (or webgpu).
- Verifies entity positions change over multiple frames.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @af-examples/renderer-2d test:e2e`
Expected: FAIL with missing project.

- [ ] **Step 3: Implement demo `renderer-2d`**

Build the minimal demo:
- `index.html` with CSS-only loader shell.
- `main.ts` importing `@mcthaydt/automata-render-pixi/no-eval` first.
- Bouncing square sim with `Transform2D` component and `RenderDelta` output.
- `createPixiRenderer` with `logicalWidth: 320, logicalHeight: 192`, custom entity view for the square, and a vignette post filter using `filterPrograms`.
- Connects to fake host or runs via `runGame`.

- [ ] **Step 4: Run E2E test to verify it passes**

Run: `pnpm --filter @af-examples/renderer-2d test:e2e`
Expected: PASS (all Playwright browser assertions green).

- [ ] **Step 5: Commit**

```bash
git add examples/render-pixi/renderer-2d/
git commit -m "feat(render-pixi): add renderer-2d example and e2e test under fake host"
```

---

### Task 8: Verification, Cross-Engine Parity, Records & Master Plan Update

**Files:**
- Create: `packages/render-pixi/src/parity/filter.parity.test.ts`
- Modify: `docs/02-master-delivery-plan.md`
- Modify: `docs/03-continuation-prompt.md`
- Modify: `tooling/release/src/release-list.test.ts` (if published list test checks packages)

**Interfaces:**
- Consumes: Full test runner
- Produces: M1.7 completion evidence and cross-engine parity verification in Chromium, WebKit, and Firefox

- [ ] **Step 1: Write filter program parity test**

Run `filterPrograms` shader validation in browser runners (Chromium, WebKit, Firefox) via vitest browser project.

- [ ] **Step 2: Run parity test across 3 browsers**

Run: `pnpm --filter @mcthaydt/automata-render-pixi test:parity`
Expected: PASS in Chromium, WebKit, and Firefox.

- [ ] **Step 3: Run full verification gate**

Run: `pnpm check`
Expected: PASS (lint, typecheck, boundaries, style, and all unit tests clean).

- [ ] **Step 4: Update execution records in delivery plan and continuation prompt**

Mark M1.7 complete in `docs/02-master-delivery-plan.md` and record verified evidence in `docs/03-continuation-prompt.md`.

- [ ] **Step 5: Commit**

```bash
git add packages/render-pixi/src/parity/ docs/02-master-delivery-plan.md docs/03-continuation-prompt.md
git commit -m "docs: record M1.7 render-pixi completion and parity evidence"
```
