# S7: `@pixi/3d` 0.1.0-beta.2 under AF's rules (part 1)

- **Question:** does the `@pixi/3d` beta fit AF: Ruken's CSP after `render-pixi/no-eval`, AF's renderer seams, the angled 24 mm camera, its bytes and CPU costs, and its terms? ([M3 spec, revised](../superpowers/specs/2026-10-18-m3-3d-characters-design.md) §3; [2026-10-16 spec](../superpowers/specs/2026-10-16-m3-25d-pipelines-design.md) §3 for S7-Q6, S7-Q7 and the `extras` rule.)
- **Part 1 (M3.1a)** answers what runs without a GPU: S7-Q1, Q5, Q7, Q11, S7-g and the first Node numbers for Q8 and Q9. **Part 2 (M3.1b, GPU runner)** answers S7-Q2, Q3, Q4, Q10 and the phone numbers, adds the verdict row to `README.md` and removes the spike folder. No verdict is written here.
- **Method:** `spikes/s7-pixi3d` (a standalone package outside the workspace, `pnpm install --ignore-workspace`): `pixi.js` 8.22.0, `@pixi/3d` from `vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz` (`file:`), `effect` 3.22.2, `zod` 4.6.6, Vite 8.3.3, Playwright 1.63.0. The page mounts through render-pixi's real `createPixiRenderer` `setup(stage)` and places the figures with render-pixi's real `RenderDeltaConsumer` over the `View3D`'s root (imported from `packages/render-pixi/src` by Vite aliases, with `resolve.dedupe` so there is one `pixi.js`, 8.22.0). `render-pixi/no-eval` is that package's own file, imported first, not a replica. `node measure.ts` builds the pages and serves them with `compileHeaders` from the vendored `@ruken/manifest` on the spike's `ruken.toml`; `node bench/rig-bench.ts` times the rig; `node --test src/bundle/extras-guard.test.ts` runs the bundle guard; `tsc -p .` checks the seam types.
- **The scene:** a 12 × 10 × 3 m box room (floor, far and side walls; the near wall and ceiling cut, as §4.2's occluder rule would), the angled camera (24 mm, 25° down, 5 m back, focus 1.0 m above the followed figure), six procedural figures on FigureBuilder's skeleton (27 joints, 17 box/capsule meshes each; two play keyed clips, one walking a circle; one turns its head and reaches its right arm at the followed figure with `twoBoneIK`), one static GLB prop, a directional light, a hemisphere environment and linear fog (9 to 22 m).
- **Sources:** FigureBuilder `a1f7246` (`src/render/figure/{math,rig,genes}.ts`, copied, formatting only); The Last Light `92e6704` (`src/render/glb.ts` `parseGlb`, copied, formatting only; `src/render/models/desk.glb`, 201,368 bytes, SHA-256 `7468a3b5…0c4dbe`, made by GPT prop sheet → Meshy image-to-3D per its `docs/art/props-3d/README.md`; static, no skin).
- **Run:** 2026-10-30, AF `6aee63b` (`main`) plus this branch; Linux container, Intel Xeon 2.30 GHz, 4 shared vCPUs, no GPU; Node 24.21.0; Chromium 153.0.8010.12 (headless shell), WebKit 26.6, Firefox 155.0.

## Results

### S7-Q1: the scene under Ruken's CSP after `render-pixi/no-eval` — **fails as asked**

The CSP served (compileHeaders): `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors <origin>`.

| Browser | Page | Ready | Renderer (GPU string) | CSP events | Console errors | Image (distinct colours, share not background) |
|---|---|---|---|---|---|---|
| Chromium 153 | `index.html` (as asked) | no | WebGL2 (ANGLE, SwiftShader) | 0 | **1**: `TypeError: n[r] is not a function` on the first draw | 1, 0.000 (nothing drawn) |
| Chromium 153 | `index-shim.html` (with the remedy below) | yes | WebGL2 (ANGLE, SwiftShader) | 0 | 0 | 4,125, 0.951 |
| WebKit 26.6 | `index.html` | no | WebGL2 ("Apple GPU", WebKit's masked string; software here) | 0 | **1**: same error | 1 (nothing drawn) |
| WebKit 26.6 | `index-shim.html` | yes | WebGL2 | 0 | 0 | 3,993, 0.952 |
| Firefox 155 | both | yes | **canvas**: headless Firefox here has no WebGL at all (`getContext('webgl2')` and `'webgl'` are both null), so pixi's auto-detect fell back to its Canvas renderer and the View3D drew nothing, silently | 0 | 0 | 1, 0.000 |

- **The cause** (unminified build, stack `GlUniformGroupSystem.updateUniformGroup` ← `GlShaderSystem.bind` ← `Mesh3DBatcherGl.draw` ← `View3DPipeGl.renderForward`): importing `@pixi/3d` runs `addUniformParsers()` (`dist/utils/addUniformParsers.mjs`), which pushes four uniform parsers (`mat4x4<f32>` and `mat3x3<f32>` from `elements`, two `vec3<f32>` from `{x,y,z}` and `{r,g,b}`) into pixi's `uniformParsers` as **source strings** for pixi's code generator. `pixi.js/unsafe-eval`, which `render-pixi/no-eval` imports, replaces that generator with polyfills that take a parser's function from parallel arrays by the same index (`uniformParserFunctions` in `lib/unsafe-eval/uniforms/uniformSyncFunctions.mjs`, `uboParserFunctions` in `lib/unsafe-eval/ubo/uboSyncFunctions.mjs`). Those arrays have pixi's five entries and none for the 3D parsers, so the first 3D draw calls `undefined`.
- **Not the CSP itself:** the same build served with **no** CSP fails the same way in Chromium, because the polyfill is installed whenever `no-eval` is imported. Without `pixi.js/unsafe-eval`, pixi cannot start under the CSP at all. The Last Light never meets this: it runs without a CSP and never imports `pixi.js/unsafe-eval`.
- **A remedy, measured:** `src/mount/pixi3d-no-eval.ts` (about 60 lines) pushes the four functions those strings describe into both arrays at the matching indices, after `@pixi/3d` loads and before the first draw. With it the scene boots, renders and holds zero CSP events and zero console errors in Chromium and WebKit (rows above; captures `out/index-shim-*.png` from `node measure.ts`). It reaches into two files that are not in `pixi.js`'s package exports (aliased by path), and it depends on parser order, so it is a workaround to take to the Owner, not a fix: the clean fix is upstream (a beta bug report: ship `unsafe-eval` counterparts with the parsers) or an AF-owned `render-pixi3d/no-eval` entry that carries this shim with a test pinning the indices. The WebGPU path (UBO polyfill) is covered by the shim's `uboParserFunctions` half but was not run here (no WebGPU in these headless browsers; S7-Q2 is M3.1b's).
- **Firefox:** S7-Q1 cannot be answered for Firefox in this container (no WebGL). It needs the GPU runner (M3.1b). A related AF finding: with no WebGL, `createPixiRenderer` returns a Canvas-renderer stage instead of failing with `RendererUnavailable`, and a View3D on it draws nothing without an error; `render-pixi3d` should refuse a renderer that is not WebGL2 or WebGPU (M3.4a).

### S7-Q5: the symbol list and AF's seams

- **Symbols the spike imports from `@pixi/3d` (the main entry only):** `View3D`, `Container3D`, `Mesh3D`, `Geometry3D`, `CubeGeometry`, `CapsuleGeometry`, `PlaneGeometry`, `PhongMaterial`, `DirectionalLight`, `Matrix4` (the fov check only), and the type `Camera3D` (the view's `camera`); View3D options `autoResize`, `toneMapping: 'none'`, `environment: { skyColor, groundColor }` (a Hemisphere) and `fog: { type: 'linear', color, near, far }` (the `Fog` shape, not imported by name). No `./extras`, no glTF loader (`Assets.load`/`Model3D`), no `Skeleton`, `Animation` or skin path: the prop goes through The Last Light's `parseGlb` into a `Geometry3D`. (`./extras` is imported only by the S7-g page.) The Last Light's list (§3.2 of the 2026-10-16 spec) adds `FlatMaterial`, `Sprite3D`, `ContainerTexture`, `ParticleContainer3D`.
- **`Container3D` in `RenderDeltaConsumer`: not by type, yes at run time.** `Container3D` extends `EventEmitter`, not pixi's `Container` (`dist/scene/Container3D.mjs`: `class extends EventEmitter`). `tsc -p .` passes with `@ts-expect-error` on `new RenderDeltaConsumer(container3d)` and on `EntityView.container = mesh3d` (`src/probe/seam-types.ts`), so both are type errors. At run time the consumer uses only `addChild`, `parent` and `removeFromParent`, which `Container3D` has with pixi's meaning: in all three browsers a consumer over `view.root` (cast) added a figure view (`parent === view.root`), moved it on a changed row and detached it on removal (`consumer: { added, moved, removed }` all true). M3.4a needs the consumer generic over its container (or a 3D twin); that is a render-pixi change for its owner.
- **`View3D` mounts in `setup(stage)`: yes.** `View3D` extends pixi's `ViewContainer`; `stage.world.addChild(view3d)` type-checks and, in every browser, `view3d.parent === stage.world` and the frame drew through the hooks `setup` returned (`apply`, `draw`).
- **The camera's field of view:** `Camera3D.fov` is "Vertical field of view in degrees, for a perspective camera" (`dist/scene/cameras/Camera3D.d.ts`), and `computeProjection` does `makePerspective(fov / zoom * (Math.PI / 180), aspect, near, far)` with `f = 1 / Math.tan(fovy / 2)` (`Camera3D.mjs`, `Matrix4.mjs`). Measured in every browser: `camera.fov` = `fovOf(24)` = 53.13010235415598°, and the projection's `[5]` = 2 exactly (1 / tan(atan(0.5))), so at 24 mm the visible height at distance *d* is *d*, as §4.2 says.

### S7-Q6: `pixi.js` 8.22 in core — **pass** (answered on M3.2's branch, PR #205)

Answered by M3.2 (`claude/3d-m3-2-pixi-822`, [plan](../superpowers/plans/2026-10-30-m3-2-pixi-822.md)) rather than on a scratch branch here, since the bump is that task. With every pin at 8.22.0: `TURBO_FORCE=true pnpm check` 33/33; `pnpm test:parity` in Chromium, WebKit and Firefox, 13/13 packages, no golden changed (render-pixi's WebGL2 filter-compile cases skip in this container's Firefox, which has no WebGL2); `automata check games/emberwick --csp` 9/9 steps; e2e `placeholder`, `base-2d` and `base-2d-compact` 21 passed; consumer smoke from packs passed; API reports unchanged. A diff of the 8.21.0 and 8.22.0 `lib` code shows `FilterSystem`'s stack rewritten: 8.21 leaked one stack entry per `generateFilteredTexture` call, 8.22 pops on every path. AF uses one filter level, where both versions compute the same resolution and offset. AF carries no equivalent of FloorFifty's `filter-stack-guard.ts`, so it is not extracted (FloorFifty was not readable from the session; the Owner can confirm the guard targets this code). The five pixi files on the no-eval allowlist are byte-identical in 8.22.0.

### S7-Q7: bytes (gzip level 9, from the Vite manifest; production build)

| Build | Up front | Lazy chunks | Total |
|---|---|---|---|
| Without `@pixi/3d` (`no3d.html`: no-eval, `createPixiRenderer`, the delta consumer, Effect, one Graphics) | 173.8 kB | 16.0 kB | 189.7 kB |
| The S7 scene with `@pixi/3d` (`index.html`) | 275.9 kB | 60.6 kB | 336.5 kB |
| The scene, `./webgl` only (`@pixi/3d`'s WebGPU backend chunk stubbed, as a game importing `@pixi/3d/webgl` alone would ship) | 274.4 kB | 43.3 kB | 317.7 kB |
| The scene with the S7-Q1 remedy | 276.3 kB | 60.6 kB | 336.9 kB |

- `@pixi/3d` plus the scene's code add **102.1 kB up front and 146.8 kB in all**; the WebGPU backend is 18.8 kB of that, lazy. Loaded over the network on a WebGL2 page (Chromium, WebKit): 313.9 kB for the scene against 189.7 kB without 3D (+124.2 kB): `@pixi/3d` downloads only the backend it uses.
- Against S8's budgets: E1 (Effect ≤ 35 kB) is unchanged, Effect being in both builds; E3 (≤ 60 kB) is the placeholder's, not a 3D game's, and no S8 budget covers one. M3.4 or the frame-budget work sets the 3D boot budget.

### S7-Q8 and S7-Q9: first CPU numbers — **Node 24 on the container's Xeon, not the phone profile**

`node bench/rig-bench.ts`: 200 batches after 50 warm-up batches, ms per call, one 1.68 m figure (27 joints, 17 meshes).

| Measure, per figure | Mean | p50 | p95 |
|---|---|---|---|
| S7-Q8 one two-bone solve (an arm, the source's allocating `twoBoneIK`, with its `fk`) | 0.0052 ms | 0.0045 ms | 0.0067 ms |
| S7-Q8 pose step: four limb solves (feet on floor targets, hands on targets) + head aim | 0.0121 ms | 0.0131 ms | 0.0145 ms |
| S7-Q8 per frame: head aim + one arm reach | 0.0102 ms | 0.0092 ms | 0.0128 ms |
| S7-Q9 joint update (27 local rotations and translations) + mesh transforms (17 world matrices), clip sampled | 0.0200 ms | 0.0156 ms | 0.0517 ms |
| S7-Q9 one-off build (skeleton, joints, geometries, materials, meshes) | 0.78 ms | 0.56 ms | 1.95 ms |

Desktop-class numbers sit 10 to 20 times under the targets (≤ 0.1 ms a solve, ≤ 0.3 ms a frame, ≤ 20 ms a build). The phone profile, the spine IK and the pins of §4.4.2 are M3.1b's; these do not answer S7-e or S7-f.

### S7-Q11: the beta's version and terms, as written

- **Version pinned:** `@pixi/3d` 0.1.0-beta.2 (`package.json` in the tarball), peer `pixi.js` ^8.22.0, dependency `meshoptimizer` ^1.2.0 (1.3.0 installed). Tarball SHA-256 `f515c1b603da64e2d546ffc74a71d14a0218f9819b09d250310b55b9ff04013a`, vendored in `b7ef19d` (#188, `1a73ee7` on the branch).
- **Licence:** MIT, "Copyright (c) 2026 PixiJS". `vendor/pixi-3d/LICENSE` is byte-identical to the tarball's `LICENSE` and to The Last Light's `vendor/LICENSE-pixi-3d.txt`.
- **The tarball's README:** "This is a read-only mirror of the private `@pixi/3d` repo, for closed-beta testers. The package isn't on npm yet, so install it from the tarball attached to the latest release" and "Please keep the code and the builds themselves inside the beta."
- **The Last Light's README** (`92e6704`), "Closed beta": "Keep the source, beta tarball and generated builds inside the beta. This project is private, with no public deployment. … The release package is not available on the public npm registry. A clone of this private repository includes the pinned tarball and its MIT licence."
- Facts only: the Owner decided to build on the beta and launch when Pixi 3D is public (M3R-D18). The MIT licence and the README's "keep … the builds … inside the beta" request differ in force; this report records both as written.

### S7-g: `@pixi/3d/extras` under the CSP and the bundle guard

- **A page importing `@pixi/3d/extras`** (`extras.html`: no-eval first, then `ParticleSystem3D`) records **one `securitypolicyviolation`** (`script-src`, blocked `eval`) in Chromium, WebKit and Firefox; Firefox also logs it as a console error. The scene's pages record none. So the §3.2 rule stands: `render-pixi3d` never imports `./extras`.
- **The guard** (`src/bundle/extras-guard.ts`, `assertNoExtras(dir)`, written to move into `packages/render-pixi3d` in M3.4a): its test passes the scene's build and fails the extras page's build. **A finding:** the name `generateSpawnBurst` is **not** in the minified production bundle although the extras code is, because the minifier renames it; a check on that name alone would pass a bundle that violates the CSP. The guard also matches string literals the spawn code generator emits (`ctx.packedFrames`, which the minified extras chunk holds), and the name for unminified builds.

## Pending M3.1b (GPU runner)

S7-Q1 in Firefox (and again in Chromium and WebKit on a real GPU), S7-Q2 (WebGL2 and WebGPU parity, including the UBO half of the remedy), S7-Q3 (p95 on both phone profiles), S7-Q4 (non-black capture), S7-Q10 (legibility at 844×390 and 780×270, the horizon, depth precision, the 21:9 stretch), the phone numbers for S7-Q8 and S7-Q9; the verdict row and the spike folder's removal.

## For the Owner

- **S7-Q1 fails as asked**: `@pixi/3d` 0.1.0-beta.2 does not draw under `pixi.js/unsafe-eval`, which Ruken's CSP requires. The spec says a failed S7-Q1 stops M3.4 onward and goes to you with the evidence (above). A measured workaround exists (the four-function shim); the decision is whether M3.4 may carry it in an AF-owned `render-pixi3d/no-eval` entry while the bug goes to the Pixi 3D beta.
