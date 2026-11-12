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
| 4 | `@pixi/3d` beta.3 | not started | |
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
