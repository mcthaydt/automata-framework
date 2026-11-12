# `@pixi/3d` 0.1.0-beta.3 and `pixi.js` 8.23: the upgrade

Branch `claude/pixi-3d-beta-3`, one session (Sonnet 5.5, no subagents), started 2026-11-12 from `main` `382ef1bd` with the
beta.3 tarball merged in (`98b5dc6a1`). The tarball is `vendor/pixi-3d/pixi-3d-0.1.0-beta.3.tgz`, SHA-256
`5eb4c18eaf3fdb0f9b66603e34a9d232b96e039d508ce721647adb32015720ad` (checked on arrival). It stays private with every build that
contains it (`vendor/pixi-3d/README.md`).

## Tracking

| Step | What | State | Evidence |
|---|---|---|---|
| 1 | Baseline on `main` before any change | done 2026-11-12 | [§1](#1-baseline) |
| 2 | What changed in the beta | done 2026-11-12 | [§2](#2-what-changed-in-the-beta) |
| 3 | `pixi.js` 8.22.0 → 8.23.0, on its own, with beta.2 | done 2026-11-12 | [§3](#3-pixijs-8220--8230-on-its-own-with-beta2) |
| 3b | `main` (#654, #655, #656) merged; the baseline taken again on the merged tree with beta.2; the retro-crisp case that 8.23.0 moved found | done 2026-11-12 | [§3b](#3b-the-merged-tree-with-beta2-the-baseline-taken-again) |
| 4 | `@pixi/3d` beta.3 | in progress | [handoff](#handoff-at-90-minutes) |
| 5 | Workarounds the beta makes unnecessary | not started | |
| 6 | Close: build, API report and index, changesets, the whole check, this record | not started | |

Progress: 3 of 6 steps (50%).

## 1. Baseline

`main` at `382ef1bd` plus the vendored tarball, nothing else changed; `pnpm install --frozen-lockfile` first. Chromium only: WebKit
and Firefox are not installed here. The browser projects ran with `--project '<name>*chromium*'` (the engine-less names would
start WebKit and Firefox), WebGL through the container's software GL, WebGPU with `AF_WEBGPU=software`
(`--use-angle=swiftshader --enable-unsafe-swiftshader --enable-features=Vulkan --use-vulkan=swiftshader`). Four CPUs, so timings
are slow and only comparable with each other.

**`pnpm check`: exit 0, 12 m 43 s.** Lint, typecheck and the rest of the static gates 2 m 17 s (54 tasks); the unit tests 9 m 44 s
(63 tasks, none cached); `check:changesets` clean (67 changesets). Unit counts the upgrade is measured against:
`@automata/3d` 1,433 (137 files), `@automata/framework` 2,093 (212), `@automata/tools` 902 + 1 skipped, `@automata/editor-3d` 2,279
(160), `@automata/character-kit` 228, `@automata/world-kit` 231, `@af-games/base-3d` 110, `@af-games/emberwick` 135,
`@af-examples/wardrobe-3d` 95, `@automata/sim` 316, `@automata/versions` 35.

| Chromium browser suite | Result | Time |
|---|---|---|
| `@automata/3d` (`browser` + `webgpu`) | 13 files, 48 passed, 2 skipped | 62 s |
| `@automata/world-kit` | 8 passed | 17 s |
| `@automata/character-kit` (`browser` + `webgpu`) | 58 passed, 3 skipped | 41 s |
| `@automata/editor-3d` (layout) | 285 passed, 3 skipped | 114 s |
| `@af-games/base-3d` (layout + sim) | 36 passed | 20 s |
| `@af-examples/wardrobe-3d` | 14 passed | 8 s |
| sectors, nav, cutscenes, narrative, systems | 2, 2, 2, 4, 1 passed | 2 to 7 s each |
| `@automata/framework` (2D layout contract) | 2,225 passed | 245 s |
| `@automata/editor` (2D) | 796 passed, 5 skipped | 94 s |
| content, sim, debug, editors, hud, level-2d, physics, puzzle | 3, 62, 6, 64, 9, 1, 2, 1 passed | 3 to 24 s each |
| `@automata/net-ui`, `@automata/ui-screens` | 100 passed; 550 passed, 1 skipped | 102 s; 57 s |
| `@af-games/emberwick` (browser), `examples-runner` | 1 passed; 12 passed, 1 skipped | 7 s; 6 s |

| Journeys, Chromium | Result | Time |
|---|---|---|
| Emberwick (phone, compact, iPad-sized Chromium, the six language projects; the dev-server journey is the `emberwick-dev-chromium` project, in the 38) | 38 passed | 2 m 03 s |
| `@af-games/base-3d` (`base-3d`, `base-3d-dev`) | 14 passed | 2 m 49 s |
| `@af-examples/examples-3d` | 20 passed | 3 m 06 s |
| `@af-examples/examples-2d` (phone, compact, runner, runner-compact, demos, ui-primitives) | 106 passed, 2 skipped | 2 m 22 s |
| `@af-examples/story-2d` (phone, iPad) | 10 passed | 1 m 16 s |
| `@automata/editor-3d` journeys | 16 passed (3 files) | 45 s |
| **`@af-examples/story-3d`** | **0 run: its web server does not start on `main`** | 10 s |

`examples/3d-story` fails on `main`, before any of this work: its second web server runs `automata editor . --app suite
--app-dir …`, and the CLI answers `This option is gone: automata editor picks the editors your game needs.` The journeys never
start. It is not caused by this upgrade and is not fixed here; it is the Owner's to schedule.

Not run in the baseline, and not run for the upgrade: WebKit and Firefox projects (parity, journeys, `examples-ipad`,
`emberwick-*-webkit`, `base-3d-dev-webkit`, `examples-3d-webkit`), a real GPU, WebGPU on hardware.

## 2. What changed in the beta

Sources: the two tarballs, unpacked into separate empty folders outside the repository and never run; `pixi.js` 8.22.0 and
8.23.0 from the npm registry the same way. The beta's repository is invite-only and `github.com` is refused here. The beta's
own release notes reached this branch from `main` after step 1 (`vendor/pixi-3d/release-notes-0.1.0-beta.3.txt`, saved by the
Owner) and are the authority for behaviour; `pixi.js` 8.23's notes could not be read. The first two subsections below are read
from the declarations (`dist/**/*.d.ts` compared export by export with the TypeScript API for `.`, `./extras`, `./webgl` and
`./webgpu`), the bundled JavaScript and the new `skills/pixijs-3d` folder, and agree with the notes.

### Package

- `package.json`: version, peer `pixi.js` `^8.23.0` (was `^8.22.0`), dependency `meshoptimizer` `^1.2.0` (same), MIT (same),
  `LICENSE` byte for byte. It builds against `pixi.js` exactly `8.23.0`. `files` now includes `skills`; `sideEffects` no longer
  lists `./src/index.bundle.ts`. Exports are the same five: `.`, `./extras`, `./webgl`, `./webgpu`, `./package.json`.
- New `skills/pixijs-3d/` (a `SKILL.md` and 19 reference notes: cameras, custom shaders, environment and sky, instancing,
  materials, particles, picking, post-processing, render-to-texture, scene and lighting, from Three.js). They describe the
  beta's behaviour and are the best written account of it; the notes below cite them. The README is rewritten (quick start,
  `npm create pixi.js`).
- `.`: 711 → 651 exports: 151 gone from the root, 91 new, 119 with a changed declaration. `./extras`: 129 → 142: 1 gone, 14 new,
  17 changed. `./webgl`: 0 → 36 and `./webgpu`: 0 → 37 exports (see the first item below).

### Removed, renamed or changed, and who uses it

The framework imports 29 names from `@pixi/3d` (60 import sites) and `@pixi/3d/extras` only as a namespace
(`packages/3d/src/testing/bundle/extras-entry.ts`). Of the 29, these changed (`Mesh` is only a string in boundary-test fixtures):

| Export | Change | Used by |
|---|---|---|
| `Mesh3D.updateShadow()`, `Mesh3D.renderPassBits` | removed. A mesh's pass mask is now computed on demand: `enablePass`/`disablePass` and `castShadow` set bits, and `renderPassMask` strips `SHADOW` for a blended or transmissive material by itself | `packages/3d/src/features/camera/occluders/occluders.ts` (`showAt` calls `updateShadow()` after an alpha-mode change), and its unit test, which spies on it |
| `Mesh3D.morph` | now `_morph` (internal) | not used |
| `Mesh3DOptions.geometry`, `.material` | now optional (`Geometry3D.EMPTY`, `BaseMaterial3D.EMPTY`) | none; widening only |
| `BaseMaterial3D.toneMapped`, `FlatMaterial.toneMapped` | removed; `colorSpace: ColorSpace` and `label` added; `clone(options)` added; `BaseMaterial3D` gets a third type parameter (`TOptions`) | no source names `toneMapped`; `shared-material.ts` and `occluders.ts` subclass or use `BaseMaterial3D` |
| `BaseMaterial3D.textureCacheKey`, `_extraBits` | removed (`extraBits` public, `_textureSetId`, bind groups added) | not used |
| `Material3DOptions` | no longer omits `textures` | widening only |
| `PostEffect.stage` | was the literal `'post'`; now `EffectStage`, set by the new `stage` option (`'beforeToneMapping'` default, `'afterToneMapping'`) | every effect: `look/duel-snap-filter.ts`, `haze.ts`, `outline-filter.ts`, `present-pass.ts`, and world-kit's `glow-effect.ts`, `rain-effect.ts`, `stars-effect.ts` |
| `OutputPass` | was a `RenderPass` with a bind group; now a `FullscreenPass` in the post-processing folder, the tone curve and encode run by it | not imported by the framework |
| `FullscreenPass` | private slots renamed (`_colorBinding`, `_depthBinding`, `_extraBits`) | `look/present-pass.ts` extends it |
| `RenderGraph._texture(handle, session)` | now public `getTexture`; `sceneOutputs`, `getSceneOutput`, `hasSceneOutput`, `resolution`, `sceneIsLinear`, `globalTextureBindings` added | `look/duel-snap-filter.ts`, `look/present-pass.ts` (they read the graph) |
| `Pass3D.requiredOutputs?` | added | `look-pass.ts`, world-kit `sky-passes.ts` |
| `ShaderBit` | `bindings` now `Partial<Record<group, BindingGroup>>`; new `outputs`, `requires`; `gpu`/`gl` stage maps spelled out | `look/ramp-light-material.ts` |
| `ShaderDescriptor` | `outputLocations` added | same |
| `View3D.background` | accepts any `ColorSource` as well as a cube or hemisphere (read back as a number); `resolution` option added; `cull` is now an accessor; `_ensureInitialized` takes two more arguments (internal) | `create-renderer.ts`, `scene.ts`, the editors' views |
| `Camera3D` | `jitter`, `resetHistory()`, `_tanHalfFovY()` added; nothing removed | `extensions/character-kit/.../pose.ts` reads `position`, `quaternion`, `mode`, `fov`, `orthographicSize`, `zoom`: all still there |
| `Sprite3D` | constructor takes one `Sprite3DOptions | Texture` | `spikes/3d-look/spike.ts` only |
| `Geometry3D`, `PhongMaterial` | `EMPTY`, `_toOptions` and bookkeeping added | no effect |

The other 26 used names (`Container3D`, `View3D`, `CubeGeometry`, `PlaneGeometry`, `SphereGeometry`, `Box`, `Vector3`, `Matrix4`,
`DirectionalLight`, `Fog`, `EffectFragment`, `EffectIO`, `DEPTH_VIEW_PLACEHOLDER`, `createLightingBit`, `PhongMaterialOptions`,
…) are unchanged or only gain members (`Container3D.traverse` is new).

Removed from the root export and not used by the framework: the glTF schema types (`Accessor`, `Mesh`, `Node`, `Scene`, …), the
maths helpers (`lerp`, `damp`, `smoothstep`, `euclideanModulo`, `random*`, …; the skill's own note says to write them inline),
`createOutputState`, `outputBit`, `depthReadBit`, `resetBitRegistry`, `formatStructLayout`, `layoutMaterialTexels`, and
from `./extras` `setSpawnCodegen` (particles now pick codegen or the polyfill once, at import, from `unsafeEvalSupported()`).

**The renderer backends moved.** In beta.2 `./webgl` and `./webgpu` exported nothing and the backend classes (`View3DPipeGl`,
`MaterialSystemGpu`, `shadowBitsGl`, the shader plugins, `renderForwardBatchesGl`, …) were on the root. In beta.3 those 36 and 37
names are exported by `./webgl` and `./webgpu`, and the root has the shared parts. The loader hook that pulls a backend in when
`Application.init` picks it is unchanged. The framework imports none of those names, but its bundle guard
(`packages/3d/src/testing/bundle/`) and the closed-beta markers look at what lands in a build, so the lazy chunk's shape is checked in step 4.

**New in the beta** (additive; none of it is required by the framework): instanced batch data
(`BatchInstanceData`, `InstanceDataStoreBuffer`, `DirtySlots`, `DrawCommandCapture`), scene outputs (`SceneOutput`, `normalOutput`,
`velocityOutput`, `ExtractPass`, `VelocityViewer`), `FxaaEffect`, `MotionBlurEffect`, `PortalFeedPass`, `dissolveBit`, HDR environments
(`loadHdr`, `parseRadianceHdr`, `equirectToCube`: an `.hdr` loads through `Assets.load`), `PointLight.radius`,
`Camera3D.jitter`, `View3D.resolution`, float render target helpers.

### The release notes: behaviour changes and where the framework stands

The notes list 30 breaking or behaviour-changing items. The framework's footprint is narrow: its own views set `toneMapping:
'none'` themselves, it builds no skinned glTF rigs (its figures are generated geometry), uses no particles, batched meshes, glTF
cameras or `Sprite3D`, and sets no `cull` option. The items that can touch it, with what to expect (all of it is checked in step 4,
not assumed):

| Note | Where it meets the framework | Expected |
|---|---|---|
| `View3D` defaults to `toneMapping: 'none'` (was `'aces'`) | `create-renderer.ts` already passes `'none'` | nothing |
| Unlit materials (`FlatMaterial`, sprites, particles, portals) encode their colour for display: beta.2 drew a 128 grey as 55; at `'none'` and exposure 1 they now draw as authored | `FlatMaterial` in `world-view.ts`, `figure-meshes.ts`, `figure-shadow-view.ts`, `box-view.ts`, `ember-view.ts` | **unlit colours get brighter**: image goldens and parity values that read a `FlatMaterial` move |
| `srgbToLinear`/`linearToSrgb` are a pure 2.2 gamma, and every `ColorSource` the engine decodes (material colours, lights, fog, backgrounds) shifts: mid-tones carry about 2% more linear light | every lit surface, `fogSkyColor` (which decodes with the piecewise sRGB curve) | small shifts in every 3D golden; `fogSkyColor` and the fog parity test need a second look |
| `PostEffect` runs at `'beforeToneMapping'` by default, on linear `rgba16float` light; display-picture effects must pass `stage: 'afterToneMapping'`; a view with a before-stage effect draws its scene into float linear light and the curve runs once after | the look's effects (`duel-snap-filter`, `haze`, `outline-filter`, `present-pass`) and world-kit's `glow`, `rain` and `stars` effects | each effect that works on the picture as shown needs `afterToneMapping`; decided effect by effect, test first; a wrong stage shows as a changed picture |
| An effect's depth read binds in its own group; `RenderGraph.compile()` throws when a pass samples a transient through the view's global bind group | `PresentEffect` was written to keep the global depth slot clean (WebGPU `sceneDepth` hazard); `scene-depth.test.ts` | the hazard the WP0 record describes is the one this fix names: step 5 tries the bare effect |
| `PassBuilder.sample(handle, binding)` takes a `TextureBinding`; `pipe.globalSlots` is gone; `globalTextureBindings` is a required graph option | `look/present-pass.ts`, `look/duel-snap-filter.ts` (custom `RenderPass`/graph code) | type errors to fix |
| `ShaderBitTemplate` must list `{ name: 'global', ubo: true }`; slot names `{{materialAccess}}` became `{{storeAccess}}`; WGSL material templates return a `FragmentOutput` and bits set `finalColor` and `alpha` in `end`; `decodeColor`, `inputTint`, `decodeFrame`, `inputExposure`, `decodeToLinear`, `viewTexel`, `depthTexel`, `PI` became reserved or defined; bits that need screen-space functions list `requires` | `look/ramp-light-material.ts` (the one custom `ShaderBit`), the effects' fragments | compile errors or silent differences at run time; test first |
| `Mesh3D.updateShadow()` removed: a mesh starts or stops casting when its material goes to or from `'blend'`, "delete the calls" | `occluders.ts` and its test | delete the call; the test proves the mask |
| Opaque materials ignore `alpha` | `occluders.ts` fades a wall by setting `alpha` and `alphaMode: 'blend'` below 1 | no change: it already blends |
| `CullMode` loses `'auto'`; `'gpu'` is the default, culling a skinned mesh at its bind pose | no `cull` option is set, so every view culls on the GPU now where beta.2 drew small views unculled; the figures are not skinned meshes | checked by the parity and figure suites; `cull: 'off'` if a figure ever vanishes |
| A camera's `zoom` divides `orthographicSize` and `tan(fov/2)` | `character-kit`'s `pose.ts` folds `zoom` the old way (`fov / zoom`, `size * zoom`) and says it matches `Camera3D.computeProjection` | **must change** with its test: at zoom 1 it is the same, at any other zoom the pose was wrong |
| `Camera3D` glTF cameras load | `View3D.from` is not used | nothing |
| Point and spot lights fall off as `1 / sqrt(d⁴ + radius⁴)`, up to 29% less at 0.1 m | `lamp-kit.ts`, `scene-lighting`, `world-view.ts` lamps | lit-room brightness parity values and goldens move a little near lamps |
| Every WebGPU material texture samples with its own style: pixi's default clamps, so a tiled texture must set `addressMode: 'repeat'` | `world-view.ts` already sets `addressMode: 'repeat'` and `scaleMode: 'nearest'` | WebGPU gets `nearest` and `repeat` it did not honour before |
| `View3D.background` takes a colour; `View3D.resolution`; MSAA follows the canvas `antialias` through post effects (more memory, resolve each frame) | `create-renderer.ts` and the look's chain | a look view with effects now multisamples; may change edge pixels |
| `Mesh3D.morph` removed (use `weights`); `Mesh3DOptions` geometry and material optional; `BaseMaterial3D.clone`, `extraBits` public, third type parameter | `shared-material.ts` | type check only |
| `Sprite3D`, particles, `BatchedMesh3D`, `Model3D.skeletons`, normal maps, `getMaterial`, `uMaterialStorage`, `Geometry3D` integer positions, HDR, `.hdr`, KTX2 | not used | nothing |
| Removed math helpers | not imported | nothing |
| `View3D.unload()` destroys the render graph and its passes; a pass kept across an unload is dead | the look builds passes inside its graph | check |

### Anything that makes a framework workaround unnecessary

| Workaround | What the beta does now | Decision (step 5) |
|---|---|---|
| `Mesh3D.updateShadow()` call in `occluders.ts` | mask computed on demand; the API is gone | forced by the type error; a test must show a blended pillar leaves the shadow pass and an opaque one rejoins |
| No-eval uniform sync (`pixi3d-uniform-sync.ts`) | `addUniformParsers()` is the same code with shorter comments: the same four parsers pushed as source strings. Nothing of its own for `pixi.js/unsafe-eval`. `pixi.js` 8.23's polyfill is unchanged but for `generateShaderSyncPolyfill` (reads `group.layout`, binds `BufferResource` blocks by name); its integer write into a WGSL uniform buffer is the same code as 8.22's | stays; its pin test says if the parsers move |
| Integer uniform write for WebGPU (`integerWrite`) | `pixi.js` 8.23 did not touch `unsafe-eval/ubo` | stays unless a test shows otherwise |
| `fogSkyColor` (`view-fog.ts`) | fog is mixed in the same linear space (`writeLinearRgb(uFogColor)`); the notes now say fog and `view.background` both go through exposure and the curve and "match on screen under any curve", and that `backgroundColor` matches fog "only at `'none'` and exposure 1" | decided by `lighting.test.ts` and the parity test, not by reading |
| `PresentEffect` keeps the empty depth in the global slot (`present-pass.ts`, `scene-depth.test.ts`) | `RenderGraph` now has `globalTextureBindings` and the resource model changed; the hazard is not mentioned in the notes | decided by running the bare-effect case in `scene-depth.test.ts` |
| `snapshot.ts` reads the canvas with `gl.readPixels` | the macOS Firefox `RenderTexture` read cannot be tried here | stays, cannot be judged |
| `pose.ts` comment naming beta.2 | `Camera3D` is unchanged where it reads | comment only |

### The beta's own no-eval story

`@pixi/3d` still writes its WebGL and WebGPU shaders as strings pixi's code generator pastes, and still appends four uniform
parsers to `uniformParsers` for the generated upload functions. `pixi.js/unsafe-eval`'s arrays do not include them, as in beta.2,
so the AF shim is still needed. What is new is that particle spawning has its own eval-free path (`generateSpawnPolyfill`, bytes
identical to the `new Function` path by the beta's own parity test), chosen once by `unsafeEvalSupported()` at the time
`@pixi/3d/extras` is imported. Nothing in the beta's `dist` outside particle spawning calls `new Function`. `pixi.js` 8.23.0
adds no new `new Function` call site to the five the no-eval allowlist names; `GenerateShaderSyncCode` (one of the five) changed
its text, so the allowlist's byte check needs a look in step 3.

### `pixi.js` 8.22.0 → 8.23.0 (the registry's only 8.23 release)

Only additive exports: `extractFragmentOutputMaskFromGlProgram`/`...GpuProgram` (fragment outputs for several render targets),
`GpuDepthCopy`, `GpuMsaaTexture`, `stripShaderComments`, `isWebKit`, abstract graphics adaptors, a `SmoothGraphicsMixins`
reference. About 70 modules changed in behaviour, none on a public signature the framework calls: `Color`, `RoundedRectangle`,
`Batcher`, `FilterSystem`, `EventBoundary`, `HTMLSource`, `CanvasObserver`, the GL and GPU limits, render-target, buffer and
texture systems, `generateProgram`/`getUboData`, `GpuUniformBatchPipe`, the unsafe-eval shader-sync polyfill. A 2D golden or a
parity value that moves in step 3 is reported before anything is re-recorded.

## 3. `pixi.js` 8.22.0 → 8.23.0, on its own, with beta.2

What moved: every exact pin (18 manifests, `vendor/figure-builder/package.json`, `create-game`'s template), the lockfile, `docs/versions.md`
and `docs/stack.md` (`pnpm docs:stack`), the pin test's fixtures, and the no-eval allowlist's vendor strings and comment. Beta.2's
peer `^8.22.0` accepts 8.23.0, so beta.2 stayed vendored. **One thing the versions test forced:** it floors a published package's
peer range at that package's own dev pin, so `@automata/framework` and `@automata/feel` now ask for `pixi.js` `^8.23.0`
(a game on 8.22.0 no longer satisfies them). Changeset `.changeset/pixi-js-8-23.md` (`patch`: framework, feel, tools).

No-eval allowlist: of the five `pixi.js` files it names, `unsafeEvalSupported`, `compileBufferSync` and `generateUniformsSync` are byte
for byte the same in 8.23.0; `GenerateShaderSyncCode` and `generateParticleUpdateFunction` changed what they generate but keep the
`Function(...)` parameter names the allowlist matches on, and no other file of 8.23.0 builds a function from a string. The entry names
now say 8.23.0.

**Results (Chromium; same commands as the baseline).** Every count equals the baseline's. No 2D golden image, no parity value and no
sim hash moved.
- `pnpm check`: the whole gate (lint, typecheck, boundaries, style, knip, 63 unit tasks) passed in 10 m 16 s. Its last step,
  `changeset status`, failed once only because the new changeset was not yet committed; committed, `check:changesets` reports 68
  changesets, 0 problems. The first run before the peer change failed `@automata/versions` (the two rules above); fixed as described.
- Browser suites: all 2D packages and all 3D packages (still beta.2): identical to the baseline table (`@automata/framework` 2,225;
  `@automata/3d` 48 passed, 2 skipped; editor-3d 285; and the rest).
- Journeys: Emberwick 38; `examples/2d` 106, 2 skipped; base-3d 14; examples/3d 20; editor-3d 16. `examples/2d-story`: **9 of 10 in the first
  run**: the "pointing the sees-the-player switch at Follow" journey on the phone project saw the guard go `patrol → hunt` where the test
  expects `patrol → follow` (the Schematic edit had not reached the game's content when it started), and the next test was skipped by
  Playwright's serial rule. It passed on the iPad project in the same run, 20 of 20 on the phone project run again four times over, and 10 of 10 in a full rerun.
  The journey edits a content file through a server and plays at once, nothing in it draws with `pixi.js`, and it is not the baseline's failure
  (`examples/3d-story` fails to start on `main`, see §1). Recorded as a flake of that edit-then-play race, not explained further; a
  real fix belongs to the journey's owner.

## 3b. The merged tree with beta.2: the baseline taken again

`origin/main` merged into the branch with no conflict (`c23bc6b3`: #656, the builders-into-the-framework spec; `progress.md` kept both sides). Two things the merge
left for this session, both committed in `639ac722` after a whole `pnpm check` on exactly that tree:
`extensions/lcd-panel` and `extensions/retro-crisp` came in from main still pinning `pixi.js` 8.22.0 (step 3's 18 manifests were the ones that existed), so the
lockfile on the merged tree had no 8.23.0 entry for them and `pnpm install --frozen-lockfile` failed. Both pins are 8.23.0 now. And `vendor/FigureBuilder` (a submodule
at `23f889c8`, not checked out in this container) was cloned read-only into place so `character-kit`'s typecheck could resolve its types; nothing of it is changed or committed.

**`pnpm check` on the merged tree (beta.2, pixi.js 8.23.0): exit 0, 11 m 17 s, 56 of 56 tasks, 78 changesets, 0 problems.** Unit counts for the move:
`@automata/3d` 1,529 (143 files), `@automata/framework` 2,143 (218), `@automata/tools` 926 + 1 skipped, `@automata/editor-3d` 2,279 (160), `@automata/character-kit` 228,
`@automata/world-kit` 262, `@automata/lcd-panel` 18, `@automata/retro-crisp` 37, `@af-games/base-3d` 110, `@af-games/emberwick` 136, `@af-examples/wardrobe-3d` 95,
`@automata/sim` 316, `@automata/versions` 35.

| Chromium browser suite (beta.2, merged tree) | Result | Time |
|---|---|---|
| `@automata/3d` (`browser` + `webgpu`, `AF_WEBGPU=software`) | 16 files, 55 passed, 2 skipped | 62 s |
| `@automata/world-kit` | 19 cases: 18 passed on the sequence run, the 19th (`ward.test.ts`) **timed out at 15 s (21 s)**; alone, 1 of 1 passes | 30 s |
| `@automata/character-kit` (`browser` + `webgpu`) | 58 passed, 3 skipped | 39 s |
| `@automata/lcd-panel` | 9 passed | 18 s |
| `@automata/retro-crisp` | **9 passed, 1 failed, every time** (see below) | 18 s |
| `@automata/editor-3d` (layout) | 285 passed, 3 skipped | 91 s |
| `@af-games/base-3d` (layout + sim) | 36 passed | 18 s |

| Journeys, Chromium (beta.2, merged tree) | Result | Time |
|---|---|---|
| `@af-games/base-3d` (`base-3d`, `base-3d-dev`) | 14 passed | 2 m 37 s |
| `@af-examples/examples-3d` | 22 passed | 3 m 08 s |
| `@automata/editor-3d` journeys | 16 passed (3 files) | 41 s |

The 2D suites once (Chromium, `--project '*chromium*'`): `@automata/framework` (`packages/automata`) 2,252 passed (27 files); `@automata/editor` 796 passed, 5 skipped; content 3, sim 62, level-2d 1, physics 2,
puzzle 1, sectors 2, nav 2, cutscenes 2, narrative 4, systems 1, `games/emberwick` browser 1, extensions `debug` 6, `editors` 64, `hud` 9, `net-ui` 103, `ui-screens` 550 + 1 skipped. All pass. Not rerun here: the 2D journeys
(Emberwick, `examples/2d`, `2d-story`), which step 3 ran at 8.23.0 and which draw nothing with `@pixi/3d`. The 2D code that uses filters or render textures is `packages/automata/src/features/render`
(`filter/post-filter*.ts`, `filter/try-filter.ts`, `letterbox/composite-target.ts`, `renderer.ts`) and `games/emberwick/src/features/scene/scene.ts`; the `@automata/framework` suite and Emberwick's 38 journeys (step 3) exercise it, and nothing moved.

### Two failures before any beta.3 change

1. **`world-kit` `tests/browser/props/ward.test.ts`, "each puts pixels on the screen where it stands": a 15 s timeout, 21 s, in the sequence run.** Passes alone (1 of 1). The case draws every ward prop once on
   four CPUs of software GL after the earlier files; it is load. `world-kit` has no slow-draw timeout of its own, so none is added (the coordinator's rule); the case is recorded here as load.
2. **`retro-crisp` `tests/browser/retro-pass.test.ts`, "the clinic profile grades the frame and the snap puts every colour back on the palette; off puts the frame back"** (line 112). After
   `retro.enabled = false` the frame differs from the frame drawn before the pass existed in 2,253 of 14,400 pixels, all of them empty sky: the clear colour `2e222f` against dithered palette colours
   (`48555b`, `5b5365`, `4b3f50`, `504552`: the retro fade colour `#4b5a56` and the sky, snapped). It fails 3 of 3 runs. **Not a beta.3 change and not step 3's "nothing moved"**: a suite that arrived with main after step 3.

   *Root cause*, found by experiment on the beta.2 + 8.23.0 tree (probes in a scratch folder, none committed):
   - A rebuild of the graph with the pass list unchanged (`view.passes = [...view.passes]`) changes nothing (0 pixels, haze on or off). The haze and the mood grade are not the cause (the same 2,253 pixels with
     `haze: false` and with `haze: false, grade: false`). The pass must have drawn a graded frame first (never drawn graded: 0 pixels). The stale sky stays for 10+ frames and a second on/off cycle leaves different colours.
   - A trace of the WebGL adaptor's `startRenderPass` (target, clear flag, `loadOp`) on the first frame after the toggle: the view's own texture opens with `clear=true`; `sceneColor` asks `clear=17664` (colour, depth, stencil) and the
     two `effectChain` ping-pong targets ask `clear=16384` (colour), **and each of those attachments has `loadOp: 'load'`**.
   - `pixi.js` 8.23.0 `GlRenderTargetAdaptor.clear()` now reads the attachment's own `loadOp` ("a color attachment whose own `loadOp` is `'load'` keeps its contents anyway", its doc comment) and drops the colour clear when it is `'load'`;
     8.22.0 cleared whatever the caller asked (`if (clear & CLEAR.COLOR) ... gl.clear(clear)`, no `loadOp`). `@pixi/3d` beta.2's `RenderTargetCache._createRenderTarget` builds every transient target with `loadOp: "load"` on
     each colour attachment and says "load, store and clear ... are set per bind", i.e. through the `clear` argument. On 8.23.0 that argument no longer clears colour on WebGL.
   - So every transient colour target the graph acquires from the pool (`sceneColor`, `effectChain`) now keeps what the pool's previous user left in it. A scene draws only where there is a mesh, so the sky of `sceneColor` is whatever the texture held:
     blank for a texture used only as a scene colour (as in every earlier frame, which is why it was unseen), a graded frame for a texture that was an `effectChain` target before the pass list changed and the pool lent it as the scene colour.
   - Forcing `loadOp = 'clear'` on an attachment at the bind where a colour clear is asked (a wrapper on `adaptor.startRenderPass`, in the probe only) makes the same test give 0 differing pixels.

   *Which it is*: **(a), a `pixi.js` 8.23.0 change in behaviour that `@pixi/3d` beta.2 does not answer, and our code is not the part to change.** Not (b), 8.23.0 documents it, and not (c), our pass relies on nothing undefined.
   `@pixi/3d` beta.3 sets `attachment.loadOp` from the graph per pass (`RenderGraph._effectiveLoadOp`, `RenderGraph.mjs:1078`), and is built against exactly 8.23.0. **Beta.2's peer `^8.22.0` admits 8.23.0 but beta.2 is not
   a supported pair with it on WebGL**: the interim state step 3 left (8.23.0 under beta.2) was never right for a view that draws through post effects. What else the stale colour reaches on that pair (a blended draw over an uncleared `sceneColor`
   accumulates frame on frame) was not measured, since the pair is left behind by the next commit. The case stays as it is and must pass on beta.3: it is the regression test for this finding.
   The 3D Chromium suites and the 2D suites ran all green at step 3 and above on this pair; none of them toggles a pass after drawing it.

## Handoff 2: the second session, at 90 minutes

Branch `claude/pixi-3d-beta-3`. Pushed: `f1bf5b78` (the beta.3 move, the occluders, `pose.ts` zoom, every pass at `afterToneMapping`) and `ad2f5022` (the colour and effect fixes below). The container was released once after the first
handoff and the work re-created from the session's record; **the frames described below were lost with it and are to be re-shot** (the commands are in the resume list). No golden, snapshot, parity value or sim hash was re-recorded.
The whole `pnpm check` has **not** been run on beta.3 yet.

### What was changed on beta.3, each seen failing first

| Change | File | Test that failed first | Why |
|---|---|---|---|
| `updateShadow()` call deleted | `packages/3d/src/features/camera/occluders/occluders.ts` | `occluders.test.ts` (7 cases, `updateShadow is not a function`); the spy test became a mask test | the mask is computed on demand; a blended mesh leaves the shadow pass |
| zoom folded as beta.3: perspective divides `tan(fov / 2)`, orthographic divides the size | `extensions/character-kit/src/features/painted/pose.ts` | `pose.test.ts`: 762.49 against 720; and against a real `Camera3D.computeProjection` | the camera notes |
| every look and kit pass `stage: 'afterToneMapping'` | 6 core passes, `lcd-panel`, `retro-crisp`, 5 world-kit passes | 4 new unit files, 13 cases (`'beforeToneMapping'` was the default) | each reads or draws palette colours the snap chose; none adds light to the scene |
| `abs(uFxClip.w)` | `world-kit/src/features/sky/{shader-parts,stars-effect,reflect-effect,particles-effect}.ts` | the 4 world-kit browser cases (shafts "which way is up", stars, 2 reflect) | in beta.3 an effect's `uFxClip.w` is negative where the view draws into a texture (measured with a probe pass: `uv` still runs down the frame, the scale is negative); beta.3's own `viewPos` divides a down-running ndc by it |
| vertex colours written as the engine reads them (`engineColours`: the shown colour raised to 2.2) | `packages/3d/src/shared/render/light/vertex-bake.ts`, `scene-light.ts` | `lit-room.test.ts` (saw 136, wanted 64: `0.25^(1/2.2)`); 4 new unit cases + 3 for the scene light | `vertexColorBit` multiplies albedo by the raw vertex colour and the output pass encodes it; beta.2's unlit path skipped the encode |
| `shownAs` removed (an unlit `baseColor` goes in as authored) | `packages/3d/src/app/world-view.ts` | `world-view.test.ts` ("no light to take": 251 against 247) | beta.3 draws an unlit base colour as authored |

Existing unit expectations that read the vertex buffer's value now read it through the 2.2 encode (7 cases in `world-view.test.ts` and `scene-light.test.ts`): the buffer's contract changed, each assertion keeps its meaning and tolerance.
`tsc` over the workspace on beta.3: only `updateShadow` was a type error; none of the other §2 type changes bite (`PassBuilder.sample`, `globalSlots`, `ShaderBit`, `PostEffect.stage`).
FigureBuilder's declaration build (`node vendor/figure-builder/types.mjs`, its view code included) compiles clean against beta.3.

### The picture decisions (item 4), measured in the first session; the frames are to be re-shot

- **4a, tone mapping: nothing to decide.** The framework passes `toneMapping: 'none'` itself at all four `View3D` sites (`create-renderer.ts` ×2, `editor-3d`'s `game-view.ts` and `stage-renderer.ts`), so beta.3's new default changes nothing.
- **4b, unlit colours.** Measured on Chromium, software WebGL, painted pair, `still=1&rig=1` (a beta.2 worktree for "before"):
  - Beta.3 with nothing adapted: the baked rooms wash out. Dressed interior at 640 × 480: mean luma 55.4 to 84.3 (81.5% of pixels differ); dressed street 109.5 to 114.4 (70.3%); the painted figures are identical. Cause: the vertex colours above, caught by `lit-room.test.ts`. Not a decision.
  - With the vertex-colour fix: room 55.4 to 55.6 (2.5% of pixels, dither edges and one shadow edge), street 109.5 to 109.6 (0.9%): the beta.2 picture, kept.
  - **The decision is the fog colour, and a lit moving thing's colour** (`colour-look.ts`, one switch, `'authored'` default or `'beta2'`; the spike takes `?colour=beta2`). `base-3d`, 844 × 390: authored, the sky is the fog colour as written (DUEL ramp 12 step 0, the colour its own comment names;
    beta.2 showed the darker decoded value, near black) and the floor is lighter (mean luma 43.6 to 57.0). The `'beta2'` look gets the black sky back but the floor darker than beta.2's (43.6 to 29.5): **the switch cannot reproduce beta.2 for an unlit floor under fog**, because beta.2 did not mix fog into an unlit surface
    up to the fog colour (the beta's notes: "Fog on an unlit surface now reaches the fog colour"). Recommendation: `'authored'` (what the game's comment asks for, needs no compensation); the Owner decides from the pictures, and the loser's branches and `colour-look.ts` are then deleted.
  - Painted figures, `sprite-light.ts` (pure maths) and the retro fade colour (a post pass at `afterToneMapping`, display colours as in beta.2) need no change.
- **4c to 4e: not started.** 4c: `world-view.ts` already sets `addressMode: 'repeat'` and `scaleMode: 'nearest'`; WebGL against WebGPU (software) to shoot. 4d: no `cull` option is set, so `'gpu'` now; the figures are not skinned. 4e: the room and street diffs above already include the lamp falloff and the 2.2 gamma and are small.

### First beta.3 Chromium run, before any fix, and where each failure went

| Group | Cases | Explained by | State |
|---|---|---|---|
| vertex-colour contract | `lit-room.test.ts` (1) | 4b | fixed, test first |
| fog colour | `lighting.test.ts` sky-meets-fog (2) | 4b, the colour look | both looks tested (4 cases) and the older fog case now runs under both (2); decision pending |
| `uFxClip.w` sign | world-kit: shafts, stars, 2 reflect (4) | the named API change (the effects' Y-up rule) | fixed, test first; WebGL only (the `abs` is sign-free) |
| FigureBuilder view, waits for the fold | `character-kit` `painted-webgpu.test.ts` (3): "The shader template lists the 'global' bind group without `ubo: true`" | FigureBuilder's copied WGSL template (`cell-template.ts`), read only | not fixable on this branch (the coordinator's ruling); WebGL painted passes |
| unexplained | none | | |

After the fixes, Chromium WebGL: `@automata/3d` 51 passed, 2 skipped (WebGPU project not rerun); world-kit 19 (the `ward.test.ts` case times out at 15 s in a sequence on a cold cache and passes alone: load); lcd-panel 9; retro-crisp 10 (the 8.23 finding is gone, §3b);
editor-3d layout 285; base-3d 36 (these three before the fixes; the fixes do not touch them). Unit: `@automata/3d` 1,543, character-kit 228.

### Resume list

1. **Re-shoot the frames** into `frames/` (`docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/frames/`): a scratch worktree of `c1c9b7c2` (the last beta.2 commit; `pnpm install --frozen-lockfile --offline`, link `vendor/FigureBuilder`) for "before"; the spike
   `spikes/eb-look` (vite from `examples/3d`, `ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules`) with `?scene=base-interior-dressed&view=zone&pref=webgl&density=1&crisp=0&field=640x480&still=1&rig=1&figures=painted&fx=0&bloom=0` (and
   `scene=base-exterior-dressed`, `field=640x360`); `base-3d`'s dev server for the third (new game, 60 frames, 844 × 390). Add `&colour=beta2` for the other look (base-3d needs a temporary, uncommitted `setColourLook` call in `main.ts`).
2. 4c: a tiled surface on WebGL and on WebGPU software (`--use-angle=swiftshader --enable-unsafe-swiftshader --enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader`); 4e: mean luma and a diff of one lit frame; 4d: say what is set.
3. Golden groups (item 5): the 3D WebGPU project (`AF_WEBGPU=software`), the journeys (base-3d, examples-3d, editor-3d) and the no-eval check on beta.3 have **not** been run.
4. Items 6 to 8: the no-eval sync proof on beta.3, `PresentEffect`'s depth hazard (the bare-effect case in `scene-depth.test.ts`), `fogSkyColor` is now the colour look; FigureBuilder (the WebGPU template break confirmed above; WebGL not) and the fold's list; the close.
5. Unrelated and intermittent: `packages/tools` `serve-editor.test.ts` "writes an mtime a later guarded write can use even when the clock has not moved" fails 2 of 3 alone (a fractional-millisecond mtime through `utimes`).
6. Fresh-container setup: `pnpm install --frozen-lockfile`; clone FigureBuilder into `vendor/FigureBuilder` **at `23f889c8`** (a shallow clone gets `main`, which has moved), then `node vendor/figure-builder/types.mjs`; the character-kit unit files do not load without it.

## Handoff at 90 minutes

Last commit before the merge below: `5cabf0cd` (step 3), pushed. `main` was merged in at the handoff (it brought two new extensions,
`extensions/lcd-panel` and `extensions/retro-crisp`, whose `package.json` also name the beta.2 tarball: they are in step 4's list now). Steps 1 to 3 are done; step 4 has not started: no `@pixi/3d` file has changed. Resume at
step 4, in this order:

1. Move the `file:` specifier to `pixi-3d-0.1.0-beta.3.tgz` in every manifest that names beta.2 (find them with
   `grep -rl "beta.2" --include=package.json . --exclude-dir=node_modules`: root, `packages/3d`, `packages/editor-3d`, `games/base-3d`,
   `extensions/character-kit`, `extensions/world-kit`, `extensions/lcd-panel`, `extensions/retro-crisp`), `packages/3d`'s peer on `pixi.js`
   stays `^8.23.0` through the floors rule, and `world-kit`'s peer `@pixi/3d` `0.1.0-beta.2` becomes `0.1.0-beta.3`. Then `pnpm install` (lockfile),
   the pins test, `docs/versions.md`, `docs/stack.md` (`pnpm docs:stack`), `vendor/pixi-3d/README.md`'s "used by" column,
   `packages/3d/README.md`, `template-3d.ts` (`PIXI_3D_SPEC` and the tarball path), `pixi3d-markers.ts`, `tooling/consumer-smoke/src/commands.ts`.
2. `pnpm typecheck`: the type errors are the §2 table's: `updateShadow` (occluders), `PostEffect.stage`, `RenderGraph`/`PassBuilder.sample` and
   `globalSlots` (look's passes), `ShaderBit` in `ramp-light-material.ts`, `FlatMaterial.toneMapped`.
3. Test first for: `pose.ts` (zoom now divides `tan(fov/2)` and `orthographicSize`), each look effect's stage (`afterToneMapping` for the DUEL snap, haze, outline,
   present; the world-kit sky effects need a decision each), the occluders' shadow mask.
4. Then run the 3D Chromium suites, WebGL and `AF_WEBGPU=software`; for every 3D golden or recorded value that moves, collect the expected, actual and diff, do not
   re-record, and send the coordinator the list. Commands and baseline numbers are in §1; the per-package loop is
   `npx vitest run --project '<name>*chromium*'` in the package folder.

### The coordinator's additions (messages read after the handoff)

- `main` at `5370df3d` (#654, #655) is merged into this branch already. #655 brings `extensions/lcd-panel` and `extensions/retro-crisp` and the
  look's pass list and switches (`packages/3d/src/features/look`, `LookPass`, `OutlineEffect`); each of those passes was written for beta.2's
  single `'post'` stage, so step 4 says for each whether it runs before or after tone mapping (grades, the LCD panel, outlines and anything on
  the picture as shown are `'afterToneMapping'`). **Re-take the baseline on this merged tree before changing anything:** the Chromium suites
  the coordinator expects are lcd-panel 9, retro-crisp 10, world-kit 19, `@automata/3d` 48 (§1's numbers are from before #655). #654 touches the
  framework's exports and changesets, not rendering.
- Step 4 must answer the coordinator's twelve numbered behaviour changes one by one with the file each touches (the table in §2 is the start of
  it); show the pictures both ways on the `toneMapping` default rather than pinning `'aces'`; group every moved golden by the number that explains it
  and send the groups before anything is re-recorded. Say, in a line each, whether the framework should adopt `FxaaEffect`, `Model3D.materials`,
  `Mesh3D.enablePass`, `View3D.resolution`, `.hdr` environments and `View3D.raycast(out)` (do not adopt them in this branch).
- `examples/3d-story`'s journeys fail on `main` before this work, with this message from the CLI the web server runs (`automata editor . --app suite
  --app-dir …`): `Error: This option is gone: automata editor picks the editors your game needs.` Left as it is: the 3D examples are to be cut and
  rebuilt after the reference game's prologue.
- This branch holds until the Owner has run cross-engine parity (WebKit and Firefox) on the pixi.js bump and the beta.3 move; Chromium alone is
  what ran here. The section "what the three live branches will meet" in step 6 must note that `claude/last-light-prologue` adds an optional `model`
  on a prop and draws meshes through `drawWorld`.
