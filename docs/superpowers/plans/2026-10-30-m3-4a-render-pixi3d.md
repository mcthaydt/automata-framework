# M3.4a: `render-pixi3d` part 1 (package, renderer, meshes, assets, packaging guards), TDD plan

- **Spec:** [revised M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.1, §4.8, §5, §6, §9, §13 (D3-c, D3-d, D3-f, S7-g, X-b); [2026-10-16 M3 spec](../specs/2026-10-16-m3-25d-pipelines-design.md) §4.1 (mounting, interpolation, assets, init order, manifest), §4.7 (packaging), §5 (context lost), §6. Spike S7 part 1: `docs/spikes/s7-pixi3d.md` on `claude/3d-m3-1a-s7-spike` (S7-Q1 shim, S7-Q5 seams, S7-g guard), and the Owner's S7-Q1 decision of 2026-10-30 ("AF-owned shim").
- **Task:** `M3.4a — render-pixi3d part 1` (02). Lane render3d. Stacked on M3.2 (`claude/3d-m3-2-pixi-822`, PR #205, `pixi.js` 8.22).
- **Status:** drafted 2026-10-30; implementation below.
- **Progress:** 0 of 11 steps.

## Why

M3.4 is the 3D runtime every later 3D task stands on (the camera M3.4b, occluders M3.4c, lighting M3.4d, the figure view M3.5d, `games/base-3d` M3.7). Part 1 is the package, the mount through core's renderer, static meshes and boxes, model files, the no-eval shim the Owner chose for S7-Q1, and the guards that keep the closed beta out of public builds.

## Sources (recorded)

- The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`: `src/render/glb.ts` (`parseGlb`, `parsePack`, 62 lines) and the parse cases of `tests/props.test.ts` (`parseGlb` matches the GLB's own accessors; `parsePack` vertex counts and bounds), ported onto `desk.glb` and `desk.pack` (copied byte for byte into `packages/render-pixi3d/src/model/testing/fixtures/`, with provenance).
- AF spike S7 (`claude/3d-m3-1a-s7-spike`, `86a5298`): `spikes/s7-pixi3d/src/mount/pixi3d-no-eval.ts` (the four functions), `src/bundle/extras-guard.ts` and its test (the markers, including the code-generator strings that survive minification).
- `@pixi/3d` 0.1.0-beta.2 from `vendor/pixi-3d/` (SHA-256 `f515c1b6…013a`), through `file:`.

## Decisions (agent defaults, for the Owner's veto)

1. **The shim plugs in at the polyfill generators, not the arrays.** `pixi.js` has an `exports` map, so `pixi.js/lib/unsafe-eval/.../uniformSyncFunctions.mjs` cannot be imported by a package; the spike reached it with Vite aliases, which every game's bundler would have to copy. `render-pixi3d/no-eval` instead imports `pixi.js/unsafe-eval` and `@pixi/3d`, then wraps the polyfills `pixi.js/unsafe-eval` installs on the **exported** `GlUniformGroupSystem`, `GlUboSystem` and `GpuUboSystem` (`_generateUniformsSync`, `_generateUboSync`, the same methods `unsafe-eval` itself replaces): a uniform whose first matching parser is one of `@pixi/3d`'s four is uploaded by AF's function for it (the spike's four functions), the rest by pixi's polyfill. No path alias, no consumer config. **The pin test** fails loudly when pixi or the beta moves: pixi's own parser count (5), the total (9), the four 3D parsers' order and types (`mat4x4`, `mat3x3`, `vec3` from `{x,y,z}`, `vec3` from `{r,g,b}`), the two method names, and each AF function's output equal to what the parser's own source string computes (evaluated with `new Function` in Node, where there is no CSP), for uniforms and for both buffer layouts. `allow_eval` is never used.
2. **`ModelInvalid` is a boot error.** `ModelInvalid { file, reason }` joins runtime's `BootError` (its owner) and ui's `BootFailure` (published: a patch changeset). The panel draws a new state, `model-invalid`, "A 3D model in this copy of the game is damaged: {file}." with Try again, which re-runs boot in a fresh scope and so fetches the file again (D3-f). `RendererFactory` may fail with `RendererUnavailable | ModelInvalid`. Reasons: `skinned`, `malformed: <what>`, `unsupported type`, `not loaded`.
3. **Models load before the Pixi app, through runtime `Assets`.** A `mesh(file)` view names its file; `createPixi3dRenderer` parses every named file from `target.assets` (already fetched with byte progress and the 30 s stall, M1.5) before it builds the app, so a bad model fails boot and nothing renders partly. A game without `content/` lists its model files in a new `defineGame({ preload })` (the default content's entry screen gets them as `assets`); a game with content lists them in `content/assets.toml`.
4. **`defineGame({ createRenderer })`.** Core never imports an extension, so a game picks the 3D renderer with `createRenderer: (options) => createPixi3dRenderer({ ...options, views })`: core passes the Pixi options it built (size, pixel art, the draw layer's and Settings' `setup`) and the extension wraps them.
5. **D3-c, read as written for a lossless prop.** The `.bin` pack (The Last Light's `LLP1` layout, served as `.bin`, M3-D8) quantises positions, normals and UVs, so a real Meshy prop's pack differs from its GLB by design. D3-c is proven on a fixture prop whose values lie on the pack's grid: its `.glb` and `.bin` give byte-identical `Geometry3D` vertex buffers. The ported source test checks the real `desk.pack` against `desk.glb` (bounds and counts).
6. **Pose fields.** A 3D view reads `x`, `y`, `z` (metres) and `yaw` (radians about +y) from the component it is registered under, each interpolated by `alpha` (`yaw` by the shorter arc); missing fields are 0.
7. **Renderers.** `createPixi3dRenderer` refuses a stage whose renderer is not WebGL2 or WebGPU (Pixi's Canvas fallback, S7-Q1 Firefox) with `RendererUnavailable`.
8. **Context loss (renderer level).** On `webglcontextlost` the renderer publishes `render.context.lost` and stops drawing; on `webglcontextrestored` it publishes `render.context.restored`, rebuilds the 3D views from the consumer's current rows and draws again. The panel-with-Try-again path for a context that never comes back, and X-c's sim-hash check, stay with M3.10 (runtime-wide, not 3D-only).
9. **Packaging (X-b, S7-g) in `ship`.** `prepareBuild` and `prepareItch` read the build for `@pixi/3d` markers: `./extras` markers always fail (`Pixi3dExtrasInBuild`, a CSP violation under Ruken); core markers fail when the target is public (`Pixi3dInPublicBuild`, the D-1 reason). `publish` (Ruken, itch.io) and `prepare` are public; `deploy-dev` (the private dev host) and `prepare --private` (Ruken's local stack) are private. `ship` is published: a patch changeset.
10. **Examples.** `render3d` joins the core modules (M3R-D20, `Tier: core`); the catalog accepts `render-pixi3d`'s entries as an **unpublished extension** (D-1); the playground's public catalog leaves out any example that imports one, so the website never ships the beta.
11. **`render-pixi` change is additive.** `RenderDeltaConsumer`, `EntityView`, `EntityViewFactory` and `EntityViewResolver` take a container type parameter defaulting to Pixi's `Container` (S7-Q5: `Container3D` is not a `Container`). `render-pixi` is private: no changeset; its API report is updated.

## Files

- **Create:** `packages/render-pixi3d/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/no-eval.ts`, `src/no-eval/pixi3d-uniform-sync.ts` + test, `src/model/{parse-glb,model-geometry,load-models}.ts` + tests and `testing/` fixtures, `src/views/{pose-3d,mesh-view,box-view}.ts` + tests, `src/renderer/create-pixi3d-renderer.ts` + test, `src/renderer/context-loss.ts`, `src/render3d.extension.ts` + test, `src/parity/*.parity.test.ts`, `src/bundle/pixi3d-bundle.test.ts`); `packages/ship/src/prepare/pixi3d-markers.ts` + test; `examples/render3d/render3d-meshes.ts`, its model files and `examples/e2e/render3d-meshes.e2e.ts`; `.changeset/*.md` (ui, ship); `tooling/api-report/reports/render-pixi3d.api.md`.
- **Modify:** `packages/render-pixi/src/delta/render-delta-consumer.ts` (+ test); `packages/runtime/src/boot/{boot-error,run-game}.ts`, `src/render/renderer.ts`, `src/presentation/presentation-bus.manager.ts`, `src/index.ts` (+ tests); `packages/ui/src/status/{boot-failure.ts,BootFailurePanel.svelte}` (+ tests); `packages/game/src/{define-game,default-content}.ts` (+ tests); `packages/ship/src/{errors,prepare/prepare-build,targets/prepare-itch,cli,cli-args,deploy}.ts` (+ tests); `tooling/examples-runner/src/{catalog,playground/playground-catalog}.ts` (+ tests); `examples/package.json`; `playwright.config.ts` (a WebKit examples project for `render3d-*`); API reports.

## Interfaces

Consumed: `createPixiRenderer`, `PixiRendererOptions`, `PixiStage`, `PixiStageHooks`, `lerp`, `lerpAngle` (render-pixi); `RendererFactory`, `RenderTarget`, `RendererUnavailable`, `defineExtension` (runtime); `View3D`, `Container3D`, `Mesh3D`, `Geometry3D`, `CubeGeometry`, `PhongMaterial` (`@pixi/3d` main entry only).

Produced (`@mcthaydt/automata-render-pixi3d`, private):

```ts
export interface Pixi3dOptions extends PixiRendererOptions {
  readonly views: EntityViewResolver3d
  /** After the View3D is mounted: the camera, lights and static scenery (M3.4b replaces the camera with `CameraRig`). */
  readonly scene?: ((view: View3D, stage: PixiStage) => PixiStageHooks | undefined) | undefined
}
export type EntityView3d = EntityView<Container3D>
export interface View3dFactory {
  (row: RenderRow, componentId: string | undefined, models: ModelLibrary): EntityView3d | undefined
  readonly models?: readonly string[]
}
export type EntityViewResolver3d = Readonly<Record<string, View3dFactory>>
export interface Pixi3dRenderer extends PixiRenderer { readonly view: View3D }
export function createPixi3dRenderer(options: Pixi3dOptions): (target: RenderTarget) => Effect<Pixi3dRenderer, RendererUnavailable | ModelInvalid, Scope>
export function mesh(file: string, options?: MeshViewOptions): View3dFactory
export function box(size: { width; height; depth }, material: { color: number }): View3dFactory
export function parseGlb(buffer: ArrayBuffer, file: string): ModelMesh   // throws ModelInvalid
export function parsePack(buffer: ArrayBuffer, file: string): ModelMesh  // throws ModelInvalid
export function modelGeometry(mesh: ModelMesh): Geometry3D
export function interpolatePose3d(curr, prev, alpha): Pose3d
export const render3dExtension: ExtensionDef<'render-pixi3d'>
// './no-eval': side effects only
```

## Steps

Each step starts with its failing test, run alone, with the failure reason recorded in the log.

- [ ] **1. Plan.** This file (first commit).
- [ ] **2. Generic consumer (render-pixi).** Red: a type test (`RenderDeltaConsumer<Node>` over a non-Pixi node class with `addChild`, `parent`, `removeFromParent`) fails to compile; a run-time case adds, moves and removes. Green: the type parameter. `pnpm --filter @mcthaydt/automata-render-pixi test`, typecheck.
- [ ] **3. Package and no-eval shim.** Red: `pixi3d-uniform-sync.test.ts` (pin and equivalence) fails with no module. Green: package skeleton, `@pixi/3d` `file:`, `src/no-eval.ts`.
- [ ] **4. Models.** Red: `parse-glb.test.ts` (ported source cases on `desk.glb`/`desk.pack`; skinned → `ModelInvalid` `skinned`; truncated, bad magic, missing accessor → `malformed`), `model-geometry.test.ts` (D3-c). Needs `ModelInvalid` in runtime (red there first: `boot-error` and `describeBootError` cases).
- [ ] **5. Panel (ui, runtime).** Red: `bootFailureView` for `ModelInvalid` → `model-invalid` with Try again; the panel's message names the file; `BootErrorIsDrawable` compiles. Green; changeset for ui.
- [ ] **6. Views.** Red: `pose-3d.test.ts` (D3-d: at alpha 0.5 the position is halfway; yaw by the short arc), `mesh-view.test.ts`, `box-view.test.ts` (placement, destroy). Green.
- [ ] **7. Renderer.** Red (Node, fake target and stubbed app where needed): models parsed before the app; `ModelInvalid` from a bad blob; `not loaded` for a file not in `target.assets`; a Canvas stage refused with `RendererUnavailable`; the user's `setup` and `scene` hooks run. Browser parity (`*.parity.test.ts`, Chromium and WebKit; Firefox has no WebGL here and skips): mounts `View3D` in `stage.world`, a box and a mesh draw non-background pixels, the consumer adds/moves/removes over `view.root`, context lost → restored draws again. `render3dExtension` test. Game: `createRenderer` and `preload` (red in `define-game.test.ts`).
- [ ] **8. Packaging guards (ship).** Red: `pixi3d-markers.test.ts` (core and extras markers in text; none in a 2D build); `prepare-build.test.ts` and `prepare-itch.test.ts` (public refuses `@pixi/3d`, private passes, extras always refused); `cli-args` (`prepare --private`). Then `render-pixi3d/src/bundle/pixi3d-bundle.test.ts` builds two minified fixture bundles with Vite from the real tarball (main entry only; `./extras`) and checks ship's markers find `@pixi/3d` in both and extras only in the second (S7-g), even though `generateSpawnBurst` is renamed. Changeset for ship.
- [ ] **9. Example.** Red: catalog test (a `render3d` example importing the unpublished extension passes; the playground catalog leaves it out). Green: `examples/render3d/render3d-meshes.ts` (`Tier: core`), models, `examples/package.json`. E2E `render3d-meshes.e2e.ts` under `compileHeaders` in Chromium (`examples` project) and WebKit (new `examples-webkit` project): boots, zero CSP violations and console errors, non-background pixels; D3-f: the model route serves a malformed `.glb` first, the panel names the file, Try again loads the good one and the scene draws.
- [ ] **10. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update` then `pnpm api-report`; `pnpm api-index`; `pnpm agent-skills`; `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`; `pnpm --filter @mcthaydt/automata-render-pixi test:parity` and `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity`; consumer smoke from packs if a build config changed; gitleaks over `origin/main..HEAD`.
- [ ] **11. Hand off.** Push; report (branch, SHAs, API, decisions, gates, what M3.1b's GPU run must confirm).

## Gates

- Selected: as step 10, plus the focused e2e (`render3d-meshes` in `examples` and `examples-webkit`).
- Not here: Firefox WebGL (headless Firefox in this container has no WebGL: the render-pixi3d parity cases skip there and the GPU runner runs them); WebGPU (no WebGPU in these headless browsers; the shim's buffer half is proven in Node by the equivalence test only); frame budgets (GPU runner, M3.1b and M3.10).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | | |
