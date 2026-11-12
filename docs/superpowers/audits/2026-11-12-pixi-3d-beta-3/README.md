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
| 3 | `pixi.js` 8.22.0 → 8.23.0, on its own, with beta.2 | not started | |
| 4 | `@pixi/3d` beta.3 | not started | |
| 5 | Workarounds the beta makes unnecessary | not started | |
| 6 | Close: build, API report and index, changesets, the whole check, this record | not started | |

Progress: 2 of 6 steps (33%).

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
8.23.0 from the npm registry the same way. The beta's repository is invite-only and `github.com` is refused here, so no release
notes were readable (neither the beta's nor `pixi.js` 8.23's). What follows is read from the declarations (`dist/**/*.d.ts`
compared export by export with the TypeScript API for `.`, `./extras`, `./webgl` and `./webgpu`), the bundled JavaScript and the
new `skills/pixijs-3d` folder.

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
