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
| 4 | `@pixi/3d` beta.3 | in progress: the third session's list, items 1 to 8 done at the second 90-minute mark: the crates stop is what is left (and the `--force` check, if wanted) | [third session](#third-session-the-work-list-in-order) |
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

## Third session: the work list in order

Branch continued from `4036dbef`. Item 1 (setup, `origin/main` merged as `c9cf169b`, the whole `pnpm check` on beta.3): **exit 0, 56 of 56 static tasks and
65 of 65 unit tasks, 10 m 18 s, 78 changesets, 0 problems; nothing to fix.** Unit files: `@automata/3d` 145, `@automata/character-kit` 28, `@automata/world-kit` 22,
`@automata/framework` 218, `@automata/tools` 95, `@automata/editor-3d` 160, `@af-games/base-3d` 20, `@af-games/emberwick` 17, lcd-panel 4, retro-crisp 7.

### Resume list for the next session (the coordinator's messages of 07:35 and 08:13, read at the 90-minute mark; none of it is done)

1. **The crates, reduced.** The cause is shown at the level of the room (they are past `FOG.far`, see the stop under item 6) but not at the level of the shader. Reduce it: one ramp-lit crate and the floor inside the fog, beta.2 (`c1c9b7c2` worktree) against beta.3, a pixel each. Read `ramp-light-material.ts`'s `postLighting` (it sets `finalColor = albedo * stepped + emissive`) against beta.3's fog placement and colour helpers
   (`decodeColor`, `inputTint`, display-space against linear paths). If it is ours, fix test first (a browser case: a ramp-lit object inside fog keeps a stated contrast against the floor, WebGL and WebGPU). Re-shoot `base-3d` at the journeys' camera with Wick and an ember inside the fog's near plane, beta.2 against beta.3.
2. **The fog decision as a conversion, not a choice.** Write down both formulas (what beta.2 did with the fog colour on lit and unlit surfaces: it showed the fog colour's linear value, `0x8b9bb4` as `0x425474`, and did not mix an unlit surface up to the fog colour; what beta.3 does: the fog colour as authored, every surface reaches it at `far`), derive a conversion of the fog content (colour, near, far) that gives
   beta.2's picture under `'authored'`, apply it to the night room and `base-3d`, and shoot beta.2 | beta.3 authored + converted fog | diff x4 with luma. If it lands within dither noise like the baked-room fix, there is no fog decision left, and the games' fog content is converted once with a note for games in the release notes. The lit figures' colour is its own conversion (keep beta.2's picture by the correct beta.3 input); keep a switch only if a conversion cannot be exact, and say which.
   Also say which colour of the night room's plant (tan or green) and lamp shade (black or yellow) is the **authored** one, so the Owner knows which picture is correct.
3. The whole `pnpm check --force` on the final tree, and Emberwick's six language projects.
4. Record 4d (leave `'gpu'`, measure on the Owner's real GPU) and 4e (accept) as already recommended under item 7. Push after each, and confirm the last pushed commit in the message.

### Item 2: the picture frames (`frames/`)

All shot on Chromium, software GL (`--use-angle=swiftshader --enable-unsafe-swiftshader`), one browser at a time. "Before" is a worktree of `c1c9b7c2` (the last beta.2 commit);
"untouched beta.3" is a worktree of `f1bf5b78` (the move, before the colour fixes); "fixed" is this branch. Each file is `beta.2 | beta.3 | |difference| x4`, the title row carrying
the mean luma (Rec.601 on the 8-bit sRGB values, `0.299 R + 0.587 G + 0.114 B`) and the share of pixels that differ by more than 2/255 in any channel. The spike is
`spikes/eb-look` (now with `?fog=near,far,rrggbb`); the commands are in the resume list above and `scene.ts`'s header, the queries below.

| Frame file | Query | beta.2 | beta.3 | Differ |
|---|---|---|---|---|
| `room-640x480-beta2-vs-beta3-untouched.png` | `scene=base-interior-dressed&view=zone&pref=webgl&density=1&crisp=0&field=640x480&still=1&rig=1&figures=painted&fx=0&bloom=0` | 55.4 | **84.4** | 81.5% |
| `room-640x480-beta2-vs-beta3-fixed.png` | same | 55.4 | **55.7** | 2.9% |
| `street-640x360-beta2-vs-beta3-untouched.png` | same with `scene=base-exterior-dressed`, `field=640x360` | 109.5 | **114.3** | 73.6% |
| `street-640x360-beta2-vs-beta3-fixed.png` | same | 109.5 | **109.6** | 1.1% |
| `fog-base-3d-beta2-vs-authored.png` | `games/base-3d` dev server, 844 x 390, New game, 60 frames, canvas only | 43.9 | **57.2** | 68.7% |
| `fog-base-3d-beta2-vs-beta2look.png` | same with `setColourLook('beta2')` called from a temporary, uncommitted line in `main.ts` | 43.9 | **29.6** | 42.0% |
| `fog-night-room-beta2-vs-authored.png` | `scene=base-interior-dressed&at=night&fog=5,14,31222a`, the room query above | 32.9 | **48.7** | 85.2% |
| `fog-night-room-beta2-vs-beta2look.png` | same with `&colour=beta2` | 32.9 | **38.5** | 48.9% |

Room and street agree with the first session's numbers to within 0.3 (55.4 to 84.4 untouched and 55.7 fixed; 109.5 to 114.3 and 109.6). The room and street rows are not a decision: the untouched row is the vertex-colour contract
(fixed, `ad2f5022`) and the fixed row is the beta.2 picture kept (2.9% and 1.1% of pixels: dither edges and one shadow edge).

**The fog decision, from the three scenes (the Owner's):**
- `'authored'` lifts every fogged scene: the haze reaches the fog colour as written. In `base-3d` the sky is the colour its own comment names (DUEL ramp 12 step 0) where beta.2 showed
  near black, and the floor is lighter (43.9 to 57.2). On the night room (a hazy night interior, the sort of scene the reference game has) the back wall and the furniture come out of the dark
  (32.9 to 48.7); the plant, lamp and figures keep beta.2's colours.
- `'beta2'` keeps the dark sky and the dark room (38.5 on the night room, 29.6 on base-3d, which is darker than beta.2's 43.9: it cannot reproduce beta.2 for an unlit floor under fog), **and it
  recolours things**: the night room's plant turns from beta.2's tan to bright green and the lamp shade from a dull black to yellow (the diff panel marks both). The look keeps a lit moving
  thing's linear value as its display value, which beta.2 never did for a baked or plant colour; so the switch does not give beta.2 back on a room either.
- **A finding in `base-3d` that the Owner should see before choosing:** the dark blocks the beta.2 frame shows on the middle platform (the crates and barrels) **vanish in both beta.3 looks**, and in untouched beta.3 as well. The frame is a fully fogged room (the play camera is past the fog's far plane): see
  "A stop (item 6)" below. So `base-3d`'s frame is not a fair picture for the fog colour; the night room frame is.
- **The switch also decides the colour of core's lit moving figures** (the cast drawn as core meshes, not the painted pair; `frames/figures-core-room-beta2-vs-authored-vs-beta2look.png`, the dressed room by day,
  `figures=core`): `'authored'` lights them up (a dark brown shirt turns grey, black trousers brown, red shoes orange; 6.9% of pixels differ from beta.2, mean luma 53.7 to 56.2) and `'beta2'` keeps the beta.2
  picture (2.7%, 53.9). So the two halves of the switch want different answers: the fog colour wants `'authored'` (the haze, the sky), a lit figure's colour wants `'beta2'` (what the figures were tuned to).
  Splitting `colour-look.ts` in two (fog and sky; tinted colour) is one small change, and is the recommendation once the Owner has seen both frames. Painted figures do not depend on it.
- Recommendation: fog and sky `'authored'` (needs no compensation and makes a night room readable); a lit moving figure's colour as beta.2 drew it; `base-3d`'s fully fogged frame needs the stop below answered first.

### Item 3: WebGPU (`AF_WEBGPU=software`)

**Before this item no test drew any of the look's effects or the kit's sky effects on WebGPU.** Only `@automata/3d` (`webgpu`: mesh and `scene-depth`, 7 cases) and `character-kit` have a WebGPU project; the world-kit, lcd-panel and
retro-crisp suites say "WebGPU and WebGL2 parity is the GPU runner's", and no runner had one for them.

- **A real bug, older than beta.3.** The kit's WGSL hash (`HASH_WGSL`, `extensions/world-kit/src/features/sky/shader-parts.ts`) wrote `u32(a) * k ^ u32(b) * k ^ ...`; WGSL refuses `*` mixed with `^` without parentheses, GLSL does not. The shader
  module fails to compile, **nothing throws and nothing reaches `uncapturederror`** (found by reading `getCompilationInfo()` of each module), the pass's pipeline is invalid and the frame goes black. Stars, shafts, reflections and rain drew a black frame on WebGPU; particles
  and glow (no hash) drew. The same probe on the beta.2 worktree (`c1c9b7c2`) gives the same black frames, so it is not the move. Fixed with the parentheses core's own sky pass already has.
  Test first: the new WebGPU cases failed with `line 164: mixing '*' and '^' requires parenthesis`, and a unit test over the kit's WGSL (`tests/unit/sky/shader-parts.test.ts`, no GPU needed) fails without the fix and passes with it.
- **New: `extensions/world-kit` `webgpu` project** (`tests/browser/webgpu/effects.test.ts`, 5 cases: stars above the horizon, a high lamp's shaft above a low one's, the puddle mirror below the ball, a high flame above a low one, the rain) that reads each WGSL module's compile messages
  and the properties above; `test:browser` runs it and `test:webgpu` alone. The `browser` project's folder is `{sky,props}` (as `character-kit`'s is `{painted,parity}`). Two backends in one page do not work (a first try drew WebGL then WebGPU: Pixi's shared textures stay bound to the destroyed
  renderer: `[BindGroup] no usable resource for the shader's 'textureSource17'`), so the cases are WebGPU-only and the WebGL2 cases of `tests/browser/sky` are their pair (a WebGL2 flame-orientation case was added, `particles.test.ts`). **All 5 pass; world-kit's WebGL browser project: 19 passed and `ward.test.ts` timed out at 15 s in the sequence as before (passes alone).**
- **New: `@automata/3d` `look-compiles.test.ts`** (a `webgpu` case, and `src/testing/shader-compile.ts`, the module watcher both use): the haze, grade, snap, outline, sky and present passes compile as WGSL. Control: breaking the parentheses in core's sky hash makes it fail with the compiler's message. `@automata/3d` `webgpu` project: 8 passed (7 before).
- **`abs(uFxClip.w)` is the right rule, not a hiding place.** The four kit effects build `ndc` from `uv` (y down), so only the projection's size is needed from `uFxClip.w`, never its sign; the orientation cases pass on WebGL2 (negative `w` under the letterbox's texture, measured last session) and on WebGPU. The sign itself was not measured on WebGPU (a probe pass placed before the
  present pass was overwritten by it); the answer rests on the orientation cases, which would fail on a sign mismatch. Nothing was replaced.
- **Not judged:** core's `SkyEffect` (`sky-pass.ts`) still divides `ndc.y / uFxClip.w` signed. A probe with it as the first pass on WebGL2 shows no sky pixel in either beta (every pixel of the column is the clear colour `2e222f`), so `sky-palette.test.ts` passes without seeing a sky and
  no test says which way up the sky is. It is not in the default look. To settle before the sky is used on beta.3: a test that sees the sky and its orientation on both backends. Likewise no test draws `lcd-panel`'s or `retro-crisp`'s WGSL on WebGPU.
- Other WebGPU failures: the 3 painted cases of `character-kit` (item 4).

### Item 4c, samplers: tiled and point-filtered textures, WebGL2 against WebGPU (one frame each)

`frames/samplers-room-webgl-vs-webgpu.png` and `samplers-street-webgl-vs-webgpu.png`: the dressed room and street through `spikes/eb-look` with `figures=core`, `pref=webgl` and `pref=webgpu` (`AF_WEBGPU=software` flags), the world's tiled `albedoTiles` surfaces (the floor, the camouflage-patterned walls) and their `nearest` texels. **They match:** 0.5% of the room's pixels differ and 0.1% of the street's, mean luma 56.2 and 56.2, 109.5 and 109.5; the differing pixels are the figures' edges (core cast, drawn by the engine's default style), none on a tiled surface. `world-view.ts` already sets `addressMode: 'repeat'` and `scaleMode: 'nearest'`
on each tile, which is what beta.3's per-texture sampler asks for. Recommendation: nothing to change; keep these two as the proof.

### Item 4: the painter's view waits for the fold; what the port will be

Not done on this branch (the ruling: no vendoring, patching or copying of the painter's files). `claude/builders-fold-figures` brings the painter into the framework as `extensions/figures` on beta.2, merges first, and this branch then ports the view
(`docs/superpowers/plans/2026-11-12-builders-fold.md` §4 has the list; read against FigureBuilder `23f889c8`, `src/features/view/`, 482 lines, nothing copied):

1. **`cell-template.ts` (110 lines), the copy of beta.2's WGSL material template, remade from beta.3's, and its guard `tests/unit/view/template.test.ts`**, which reads the installed `@pixi/3d` and fails until the copy is. The beta.3 failure
   seen here is its first line: "the shader template lists the 'global' bind group without `ubo: true`". The template stays: **beta.3's `FragmentOutput` carries colour locations only (`dist` has no `frag_depth` anywhere), so a bit still cannot write `@builtin(frag_depth)`** and the painter's per-texel depth still needs its own template.
2. `bindGroups: ['global', 'camera', 'batch']` becomes `[{ name: 'global', ubo: true }, 'camera', 'batch']`; the template's fragment follows beta.3's: `FragmentOutput`, `finalColor` and `alpha` set before the `end` slot, `{{materialAccess}}` named `{{storeAccess}}`, and the names `outputs`, `Outputs`, `FragmentOutput`, `decodeColor`, `inputTint`, `decodeFrame`, `inputExposure`, `decodeToLinear`, `viewTexel`, `depthTexel`, `PI` now reserved (`CellFragment` and `cellDepth` are unaffected).
3. **`CellMaterial extends FlatMaterial` under beta.3's display encoding of an unlit colour** (it draws as authored now; beta.2 drew a 128 grey as 55): the byte equality of the painted frame with the CPU frame, which the character kit's browser suite proves, must be proven again; the colour the painter writes to a texture is a display value, and the cell material's base colour is white, so the likely answer is "no change", but the suite says.
4. **Per-texture samplers in place of the texel snap**: the template snaps `vUV` to the texel centre because beta.2's one batch sampler was linear; beta.3 samples each texture with its own `source.style` on WebGPU, and the colour and depth `BufferImageSource`s already say `scaleMode: 'nearest'`, so the snap (and its `material.texSize` read) goes. A packed depth must still never be filtered: the test is the byte equality again, on WebGPU.
5. `Sprite3D` takes one options object (`cell-sprite.ts` already passes one); `cull` defaults to `'gpu'` (a billboarded quad: `cull: 'off'` if one vanishes); `stage-view.ts` passes `toneMapping: 'none'` itself.
6. **One more `file:` specifier** in `extensions/figures/package.json` (and its `pixi.js` peer to `^8.23.0`); `vendor/figure-builder/package.json`, where this branch moved the `pixi.js` pin to 8.23.0, **goes away with the fold** (a modify/delete conflict on merging `main`: delete it and move the pin).
7. Proof: `extensions/character-kit` `painted-webgpu.test.ts` (3 cases failing today) and the painted WebGL cases (passing), plus the frames of item 2 with `figures=painted` on WebGPU.

### Item 6: every recorded value that moves on beta.3, grouped by cause (nothing re-recorded)

**No golden file, snapshot file, parity hash or sim hash was re-recorded or edited** (`git diff c1c9b7c2 HEAD` touches no `goldens/`, no `__snapshots__`, no hash). What moved is expectations written in test code, which were
edited, each with the reason in its comment and each of them the Owner's to overrule. Counts are cases whose expected value changed; "frames" are pictures, not recorded values.

| Group | Cases | Expected (beta.2) | Actual (beta.3) | Diff and where the rest are |
|---|---|---|---|---|
| **The vertex-colour contract** (`vertexColorBit` reads the raw vertex colour as linear light and the output pass encodes it) | **8**: `lit-room.test.ts` (1, browser) and 7 unit expectations (`world-view.test.ts`, `scene-light.test.ts`) | `lit-room`: a baked grey drew 64; the buffer held the shown colour | `lit-room` saw 136 before the fix (the buffer must hold the shown value raised to 2.2); the 7 unit cases read the buffer through `shown = v ** (1 / 2.2)` and keep their tolerance | frames `room-…-untouched.png` (55.4 to 84.4, 81.5% of pixels) and `…-fixed.png` (55.7, 2.9%); the rest in `packages/3d/tests/unit/app/world-view.test.ts`, `…/shared/render/light/scene-light.test.ts`, new `vertex-bake.test.ts` |
| **Unlit base colours drawn as authored** (`shownAs` removed) | 1 (`world-view.test.ts` "no light to take") | an unlit base colour was given pre-decoded (247) | given as authored (251) | the picture is the beta.2 one (room 55.4 to 55.7, street 109.5 to 109.6) |
| **Fog colour** | **2 moved, 4 added**: `lighting.test.ts` "sky meets fog" light and dark (moved), "fog turns the floor toward the fog colour" now under both looks (+2), sky-meets-fog under both looks (+2) | the fully fogged colour was the fog's linear value (`0x3e3546` drew as `0x0c0910`) | the fog colour as written under `'authored'`; the `'beta2'` look reproduces the old values | frames `fog-base-3d-*` (43.9 to 57.2 / 29.6) and `fog-night-room-*` (32.9 to 48.7 / 38.5); **the Owner's decision** |
| **Lit moving things' colour** (the same switch) | 0 recorded values; frames | core's cast figure colours (dark shirts, red shoes) | `'authored'`: lighter, greyer (6.9% of pixels differ); `'beta2'`: as beta.2 (2.7%) | `figures-core-room-beta2-vs-authored-vs-beta2look.png`; painted figures unchanged |
| **The effects' Y sign** (`uFxClip.w` negative when the view draws into a texture) | 4 browser cases of world-kit (shafts "which way is up", stars, 2 reflect) | each expects the effect where it belongs; the expectation did not change | failed with the sign unhandled, pass with `abs(uFxClip.w)` | no recorded value; orientation cases on WebGL2 and WebGPU (item 3) |
| **Camera zoom** (`zoom` divides `tan(fov / 2)` and `orthographicSize`) | **2 moved** in `extensions/character-kit/tests/unit/painted/pose.test.ts`, 1 rewritten to read `Camera3D.computeProjection` | perspective, zoom 2, 53.13 deg, 360 high: f = 762.5; orthographic, size 4, zoom 2, 640 wide: 80 px a metre | f = 720; 160 px a metre | at zoom 1 identical; the rest of the painted pose files unchanged |
| **Light falloff and the 2.2 gamma** | 0 recorded values | n/a | n/a | the dressed room and street, the beta.2 frame against this branch: 2.9% and 1.1% of pixels, dither edges and one shadow edge; no lamp-lit parity value moved |
| **Samplers** | 0 | n/a | n/a | WebGL2 against WebGPU: 0.5% (room) and 0.1% (street), figure edges only (`samplers-*.png`) |
| **Culling** | 0 | n/a | n/a | no figure, prop or piece vanished in any suite or journey |
| **The painter's view, waits for the fold** | **3**: `character-kit` `painted-webgpu.test.ts` | the painted figures draw on WebGPU | "The shader template lists the 'global' bind group without `ubo: true`" (the painter's copy of beta.2's WGSL template) | item 4; the WebGL painted cases pass |
| **Fog past `far`** (was unexplained) | **1 picture** | `base-3d` frame 844 x 390: three dark blocks on the middle platform (the crates and barrels, `mud` step 3, against the floor's `dusk` step 4) | gone in both beta.3 looks: their pixels are the floor's palette colours (`authored`), or the floor falls to theirs (`beta2`) | `fog-base-3d-beta2-vs-*.png`; see "A stop" below |

**A stop (item 6): the crates and the fog on `base-3d`, found and since explained (below).** What is known:
- The crates (and barrels) vanish **in untouched beta.3 too** (`f1bf5b78`, before every colour fix): their pixels are the floor's palette colours (`554769`, `56506f`, `5b5c69`), where beta.2 had `3b303c`, `2e3d47`, `2d3136`. So the move itself does it, not the colour look.
- The frame the fog decision was made on is **a fully fogged room**: `FOG` is `near 5, far 14`, and with the game's camera at the play distance every surface is past 14 m. With the fog pushed out (`near 40, far 90`, a temporary, uncommitted edit; `frames/base-3d-no-fog-beta3.png`) the same
  beta.3 build shows what the room is: a light blue floor, the orange embers, the yellow lip along the channel, the brown crates and the blue Wick. In the fogged frames of both betas the embers are not visible at all and Wick is a small dark glyph (beta.2) or gone (beta.3): so in beta.3 a fogged room loses
  the crates and Wick as well as the walls, because beta.3's fog mix reaches the fog colour on every surface at the far plane (the notes: "Fog on an unlit surface now reaches the fog colour"). `look/ramp-light-material.ts` is not the cause: it swaps only the lighting bit (`createLightingBit`) and leaves
  the engine's fog to the engine, so the custom-bit hypothesis is out. **Shown by a sweep** (temporary, uncommitted edits of `FOG` in `games/base-3d/src/features/scene/scene.ts`, near 5, beta.3 `'authored'`, the crate's place in the frame, 20 x 20 px): `far` 14 (the game's): floor colours only; `far` 20: browns return (`75686e`, `7e6c54`, `725a51`, `857565`; `frames/base-3d-fog-far-20-beta3.png`); `far` 30: `b29062`, `cca96e`, `bd7d64` and more; `far` 60: the embers' `ffbc4e` fills it.
  So the crates (and Wick) are past the fog's `far` of 14 m at the play camera, and beta.3's fog now reaches the fog colour there on every surface where beta.2's left a lit one dark: **the game's `FOG` (near 5, far 14), tuned for beta.2, puts the whole play field inside full fog on beta.3.** Group "Unexplained" is therefore **explained: fog**, a game decision (`FOG`'s `far`, or the camera's distance) on top of the Owner's colour decision; it is not a framework fault.
- **Whether beta.2's picture at this camera was the intended one is the Owner's to say** (its crates read, its embers did not). What to do next, in order: (1) done (the sweep above); (2) a frame of `base-3d` at the journeys' own camera with Wick and an ember in range of the fog's near plane, beta.2 against beta.3; (3) then the fog decision. Until then **the fog colour decision above stands on the three frames, but `base-3d`'s frame is not a fair one**; the night room (`fog-night-room-*`) is.

### Item 5: the journeys and the no-eval check (Chromium)

| Journeys on beta.3 | Result |
|---|---|
| `@af-games/base-3d` (`base-3d`, `base-3d-dev`) | 14 passed, 2.6 min |
| `@af-examples/examples-3d` (`examples-3d`) | 22 passed, 3.1 min (every test draws under the CSP) |
| `@automata/editor-3d` journeys | 16 passed (3 files) |
| `@af-games/emberwick` (`phone`, `compact`, `ipad`, `dev`, Chromium; the six language projects were not run) | 35 passed, 2.0 min |
| `@af-examples/examples-2d` (`examples`, `examples-compact`, `runner`, `runner-compact`, `demos`, `ui-primitives`) | 106 passed, 2 skipped, 2.4 min |
| `@af-examples/story-2d` (phone, iPad) | 10 passed, 1.3 min (the phone flake did not occur) |
| `@af-examples/story-3d` | not run: its web server does not start on `main` (known) |

**No-eval.** The uniform sync is still needed, proved on this tree with a throw-away browser file (deleted): a `pixi.js` `Application` with a `View3D` and a lit cube, WebGL, importing only `pixi.js/unsafe-eval` draws **nothing** (centre pixel `0,0,0`) and throws `TypeError: functionMap[i] is not a function` from
pixi's generated uniform sync; with `@automata/3d/no-eval` (the shim) the same file draws the cube (centre pixel `209,106,56`, no error). `pixi3d-uniform-sync.test.ts`, which pins the four parsers' source strings and the polyfill methods, and the no-eval allowlist test passed in the whole check; the base-3d, examples-3d and editor-3d journeys
run with Ruken's no-eval CSP and fail on a violation. The shim stays.

### Items 7 and 8

**7. The remaining decisions.**
- **4c samplers:** see above, they match; nothing to change. Recommendation: keep `addressMode: 'repeat'` and `scaleMode: 'nearest'` as they are.
- **4d GPU culling by default:** no `cull` option is set at any of the four `View3D` sites, so every view culls on the GPU now where beta.2 drew a view of 300 meshes or fewer unculled. Nothing vanished in any suite, journey or frame (the figures are generated geometry, not skinned meshes; the one risk the notes name does not apply),
  but software GL cannot tell whether `'gpu'` costs or saves on a small view and WebKit takes the CPU path. Recommendation: leave the default and let the Owner's real-GPU run (item 8) say; if a figure or a piece ever vanishes at the screen's edge the one-line answer is `cull: 'off'` at the four sites (`create-renderer.ts` twice, `editor-3d`'s `game-view.ts` and `stage-renderer.ts`).
- **4e the size of the light and gamma change:** measured on a lamp-lit night room, painted figures, no fog (`frames/lit-night-room-beta2-vs-beta3.png`): mean luma 50.1 to 50.4, 3.3% of pixels differ (dither edges near the lamps). On the day room 55.4 to 55.7 (2.9%), the street 109.5 to 109.6 (1.1%). Small; **recommendation: accept**, no compensation.

**8. This branch cannot merge until all four hold.** Where each stands:
- **(a) The fold's first group is on main and the painter's view is ported here.** Not yet: `origin/main` (`80012fef`) has the fold's plan and audit only, not `extensions/figures`. Item 4 has the port list. 3 `character-kit` WebGPU cases fail until then.
- **(b) The Owner decides the fog colour.** Frames are in `frames/`; recommendation: fog and sky `'authored'`, a lit moving thing's colour as beta.2 drew it (split `colour-look.ts` in two), and do not decide on `base-3d`'s fully fogged frame (see the stop above).
- **(c) The Owner answers the grouped list** (item 6): no group is unexplained any more (the crates are the fog's `far`).
- **(d) Cross-engine parity on the Owner's machine.** Chromium alone ran here. The exact commands (a machine with a real GPU, WebKit and Firefox installed: `pnpm exec playwright install chromium webkit firefox`), run one at a time, without `AF_WEBGPU` so WebGPU uses the real adapter:
  1. `pnpm install --frozen-lockfile` and `node vendor/figure-builder/types.mjs` (with `vendor/FigureBuilder` at `23f889c8`).
  2. Parity, every engine: `cd packages/3d && npx vitest run --project browser` (WebGL2 in Chromium, WebKit, Firefox), `cd extensions/character-kit && npx vitest run --project browser`, `cd extensions/world-kit && npx vitest run --project browser`, `cd extensions/lcd-panel && npx vitest run --project browser`, `cd extensions/retro-crisp && npx vitest run --project browser`, `cd packages/automata && npx vitest run --project browser` (the 2D layout contract, all engines).
  3. WebGPU on the real adapter: `cd packages/3d && npx vitest run --project webgpu`, `cd extensions/world-kit && npx vitest run --project webgpu`, `cd extensions/character-kit && npx vitest run --project webgpu` (the last has 3 known failures until the fold's port).
  4. Journeys in WebKit: `cd games/base-3d && npx playwright test --project base-3d-dev-webkit`, `cd examples/3d && npx playwright test --project examples-3d-webkit`, `cd games/emberwick && npx playwright test --project emberwick-phone-webkit --project emberwick-ipad-webkit`.
  5. Then `pnpm ci:local` (the gate and both CI paths), and report which of these ran.

### The whole `pnpm check` on the final tree

First on the merged tree at `c9cf169b` (before this session's code changes): exit 0, all 65 unit tasks run (item 1). Again on the tree at `69c3ea29` (all the code of this session: `e25da151`'s world-kit WGSL fix, the world-kit `webgpu` project, `@automata/3d`'s `look-compiles.test.ts` and
`shader-compile.ts`): **exit 0, 65 of 65 unit tasks, 78 changesets, 0 problems, but 62 of the 65 unit tasks came from turbo's cache** (the same inputs had passed in the pre-commit hook's affected-test run), so only 3 ran afresh; `pnpm check` with `--force` is the uncached proof if the Owner wants it.
Also run on it: `typecheck` for `@automata/3d` and `@automata/world-kit`, `pnpm knip` and `pnpm style`: clean.

## Fourth session: the conversion, not a choice

Branch continued from `b3160de1`. Goal: beta.3 draws what beta.2 drew wherever a conversion can do it, so the Owner is not asked to choose between two pictures.

| Item | What | State |
|---|---|---|
| 1 | Setup, `origin/main` merged (already), `pnpm check --force` | done: exit 0, 78 changesets, 0 problems, no cache |
| 2 | The two fog formulas, written down | done, below |
| 3 | The conversion derived; a browser case per surface kind, expected colours from beta.2 | done: derived above; the case watched failing (6 of 12) before the fix |
| 4 | Applied to the default look and every game and example that sets fog; the game note; `the-last-light`'s note | done: `392a7ca5` (whole check green), the list above |
| 5 | Frames: night room with haze, base-3d at the play camera | done: within noise outside the painted figures; the figures wait for the fold |
| 6 | Lit moving figures' colour | not started |
| 7 | `SkyEffect`'s signed `uFxClip.w`; WebGPU cases for the LCD panel and the retro grade; Emberwick's language projects | not started |
| 8 | The grouped list and the merge conditions | not started |

Progress: 5 of 8 items (62%).

### Item 2: the fog formulas, from the code of each beta

Read from the two tarballs unpacked in a scratch folder outside the repository (`core/shader/bits/fog/linearFogBit.mjs`, `core/gl/shader/MaterialSystemGl.mjs`,
`core/gl/View3DPipeGl.mjs`, `materials/BaseMaterial3D.mjs`, `materials/flat/FlatMaterial.mjs`, `core/shader/bits/colorSpaceBits.mjs` and the tone-mapping bits),
then checked against pixels (below). Common to both: the view is `toneMapping: 'none'`, exposure 1, `Fog.type: 'linear'`, no post effect that runs before tone mapping
(every effect of the look is `afterToneMapping` on beta.3 and `'post'` on beta.2, so a material encodes itself in both).

`linearFogBit`'s text is **byte for byte the same in both betas**: `fogFactor = smoothstep(near, far, viewDepth)` and `finalColor = mix(finalColor, uFogColor, fogFactor)`, with
`viewDepth = -(viewMatrix * worldPosition).z` (the distance along the camera's axis, not the distance to the eye). The two betas differ in what `finalColor` is when it reaches that line, in what `uFogColor` is, and in what follows.
Write `dec_pw(c)` for the piecewise sRGB decode (beta.2's `srgbToLinear`), `dec(c) = c^2.2` (beta.3's), `enc(l) = l^(1/2.2)` (the encode both betas end a tone-mapped material with), `s = smoothstep(near, far, viewDepth)`, `C` the fog colour as given and `B`
a surface's base colour as given.

| Surface kind | beta.2 (pixi 3d 0.1.0-beta.2) | beta.3 (0.1.0-beta.3) |
|---|---|---|
| `uFogColor` | `dec_pw(C)` (times exposure), linear light | `dec(C)` (times exposure), linear light |
| **Lit** (Phong, and `RampMaterial`, ours: only the lighting differs) | `finalColor` = linear light `dec_pw(B) * light`; fog mixes in **linear** light; then `enc`. Shown `enc((1-s) * L + s * dec_pw(C))`; fully fogged: `enc(dec_pw(C))`, which is `C` within about 1 of 255 for a light fog and a few steps off for a dark one (0x31222a: `enc(dec_pw(C))` is 52.4, 38.9, 46.0 of 255 against 49, 34, 42) | the same line with `dec(B)`, `dec(C)`: shown `enc((1-s) * L + s * dec(C))`; fully fogged `C` exactly. Beta.2 and beta.3 agree on a lit surface to 1 or 2 of 255 for the same `C` (measured) |
| **Unlit** (`FlatMaterial`; ours: the baked rooms, props, embers, tinted figures) | `toneMapped = false`: no encode. `finalColor = dec_pw(B)`; fog mixes toward `dec_pw(C)` **in the same linear-as-display space**. Shown `(1-s) * dec_pw(B) + s * dec_pw(C)`: a **straight mix of display values**, ending at `dec_pw(C)` (0x8b9bb4 as 0x425474). The framework fed `dec_pw`-inverse colours so that `dec_pw(B_given)` was the palette colour `P`: shown `(1-s) * P + s * dec_pw(C)` | unlit with fog is no longer "display": `selectColorSpaceBit` takes the linear space whenever the fog bit is present, so `finalColor = dec(B)`, mixes toward `dec(C)` in **linear** light, and the encode runs. Shown `enc((1-s) * dec(P) + s * dec(C))`: a **power mean** (exponent 2.2) of `P` and `C`, ending at `C`. Without fog and without vertex colours it is the display path (`P` as authored, no decode, no encode) |
| **Background** | not the engine's: the framework fills the view's rectangle with a 2D `Graphics` colour (`create-renderer.ts`, `skyOf`), drawn exactly, under the view: `fogSkyColor(C) = dec_pw(C)` so it met the unlit fully fogged colour | the same fill; the look in force (`authored`: `C`) |
| After the material | the look's effects (haze, mood grade, the snap to a palette, outlines, present) read the picture as shown, unchanged by the fog | the same, at `afterToneMapping` |

The unlit rows are the difference. **What beta.2 did with a fog on a lit and an unlit surface was not one rule**: a lit surface reached `C` at `far`, an unlit one (and the sky) the darker `dec_pw(C)`, and
they were mixed in different spaces. That is the picture the games were tuned on. The earlier note that beta.2 "did not mix an unlit surface up to the fog colour" is exactly this: it did mix, toward `dec_pw(C)` and in display values.

**Checked on pixels** (`packages/3d/tests/browser/parity/shared/parity/fog-probe.test.ts`, a scratch case, not committed: planes facing the camera at 3, 6, 8, 10 and 14 m, `near 4`, `far 12`, `C = 0x8b9bb4`, base `0xa0c0e0`, Chromium software GL, WebGL2; beta.2 from `/home/user/b2tree` at `c1c9b7c2`):

| Plane | beta.2 at 6 / 8 / 10 / 14 m | beta.3 at 6 / 8 / 10 / 14 m |
|---|---|---|
| unlit | 86,126,179 / 78,109,153 / 70,92,128 / 66,84,116 | 157,187,218 / 150,175,203 / 143,161,188 / 139,155,180 |
| lit, Phong | 111,130,151 / 123,140,163 / 133,150,174 / 138,154,179 | 111,130,151 / 123,141,164 / 134,151,175 / 139,155,180 |
| lit, ramp | 170,203,238 / 158,185,216 / 144,164,191 / 138,154,179 | 172,205,239 / 159,186,217 / 146,166,193 / 139,155,180 |

The unlit rows are the formulas above to the digit (beta.2: `(1-s)*dec_pw(B) + s*dec_pw(C)`; beta.3: `enc((1-s)*dec(B) + s*dec(C))`, computed by hand). The lit rows agree to 1 or 2 of 255.

### Item 3: the conversion, derived

Given a fog as a game states it (colour `C`, `near`, `far`; no exposure, no tone curve in the framework), find what beta.3 needs to show beta.2's colour on each surface kind.

- **Lit surfaces (Phong, `RampMaterial`): the engine's fog is already beta.2's, if it is handed beta.2's `uFogColor`.** Both betas run the same fog line in linear light before the same encode, so what differs is
  only `uFogColor`: `dec_pw(C)` on beta.2, `dec(C)` on beta.3. Hand beta.3 the colour `F = enc(dec_pw(C))` (a float triple, which `Fog.color` takes as a `ColorSource`) and its `uFogColor = dec(F) = dec_pw(C)`: the same number. The two shown colours then
  differ only by the albedo's decode curve (`dec_pw(B)` against `dec(B)`, the "2% more linear light" of §2), which is the lit figures' colour, item 6. Measured with `F = C` (no conversion): 1 to 2 of 255 for a light fog, 3 for the night room's dark fog
  (`C` is 49, `F` should be 52): that 3 is what `F = enc(dec_pw(C))` removes.
- **Unlit surfaces: no `(colour, near, far)` of the engine's fog can give beta.2's picture, so one definition cannot serve both kinds, exactly.** Beta.2 mixed display values straight: `(1-s) * P + s * D`, `D = dec_pw(C)`. Beta.3's unlit
  fog is `enc((1-s) * dec(P) + s * dec(F))`, a power mean with exponent 2.2. Choose `F` so the end points agree (`dec(F) = D`) and the middle still does not: with `P = 160` and `D = 66` of 255, at `s = 0.5` beta.2 shows 113 and beta.3 shows 149.5; at `s = 0.25`
  136.5 and 154.8; and the same `s` with a darker `P = 40` shows 53.0 and 103.6. The gap depends on the surface's own colour, so no remap of `near`, `far` (or of `s`) closes it for every surface: a change to the fog's numbers is out.
  What does close it is the mix itself, in display values, as beta.2 ran it.
- **The smallest correct thing: one shader bit of ours on our unlit material.** `UnlitMaterial` (a `FlatMaterial`, same options, in `@automata/3d`) switches the engine's fog off for itself (`fog: false`) and adds a bit that, at the end slot before the engine's encode, mixes
  the *display* value toward the fog colour: `shown = enc(finalColor); shown = mix(shown, uFogColor, smoothstep(near, far, viewDepth)); finalColor = dec(shown)`. `uFogColor` is `dec(F)` = `D`, the colour beta.2 mixed toward, so the bit
  reads the engine's own uniform and the game states **one fog**. The engine's encode then returns `shown`. It runs in linear space (the material is `colorSpace: 'linear'`, so the engine decodes the base colour and encodes the result whether or not
  the mesh has vertex colours; at no fog the round trip `enc(dec(x))` is the identity, within float error). It needs `uFogParams.y > uFogParams.x` to switch itself off on a view with no fog (the uniform is zero until a fog is set).
- **The sky**: unchanged by the conversion; it was `D` on beta.2 and stays `D = dec_pw(C)` (the 2D fill meets the unlit fully fogged colour with no edge, as it did). So **the content states one fog colour `C`; lit things reach `C`, unlit things and the sky reach the darker `D`**, as on beta.2.
- **What is left for games:** nothing in their fog numbers. A game draws unlit meshes with `UnlitMaterial` instead of `FlatMaterial` (the framework's own meshes do; a game's own `FlatMaterial` keeps beta.3's linear-mix fog, brighter in the middle of the range, until it is changed).

**The test, first:** `packages/3d/tests/browser/parity/shared/parity/fog-surfaces.test.ts`: four surface kinds (unlit, baked room, lit, stepped-lit) x no fog, a light fog (`0x8b9bb4`) and a dark one (`0x31222a`, the night room's), planes at 6, 8, 10 and 14 m under `near 4`, `far 12`,
expected colours **recorded from beta.2** (`/home/user/b2tree`, `c1c9b7c2`, pixi.js 8.23.0; no post effect in the frame, so the 8.23 render-target change does not touch it; the unlit input pre-decoded the way beta.2's framework gave it). Watched failing on beta.3 as the formulas say it must:
unlit light and dark fog (157 against 145 at 6 m), baked light and dark (104 against 91), lit and stepped-lit dark fog at 14 m (49 against 52); the three no-fog rows and the two light-fog lit rows pass (within 2 of 255).

### Item 4: applied

**What changed** (commit `392a7ca5`, the whole `pnpm check` green on exactly that tree): `shared/render/light/view-fog.ts` hands the engine `engineFogColour(C) = enc(dec_pw(C))` as floats and keeps `fogSkyColor(C) = dec_pw(C)`; `shared/render/views/unlit-material.ts` is `UnlitMaterial`
(exported from `@automata/3d`); every `FlatMaterial` of the framework's own that fog can reach is one now (`box-view.ts` x3, `world-view.ts` x5, `figure-meshes.ts`, and base-3d's `ember-view.ts` x2; `figure-shadow-view.ts` keeps `FlatMaterial` with `fog: false`: a shadow takes no fog).
The colour look's fog half is deleted (`colour-look.ts` keeps only the lit moving thing's colour until item 6); `lighting.test.ts`'s two fog cases are beta.2's own again (the two looks gone; floors are `UnlitMaterial`). New: `src/testing/fog-surfaces.ts` and the two cases that use it
(`tests/browser/parity/shared/parity/fog-surfaces.test.ts`, 12 cases on WebGL2; `tests/browser/webgpu/fog-surfaces.test.ts`, 8 on WebGPU software, the bit's WGSL twin). Unit: `view-fog.test.ts` pins `engineFogColour` (0x31222a is 52, 39, 46) and the sky (0x8b9bb4 as 0x425474).
`tooling/api-report/reports/3d.api.md` gained `UnlitMaterial` (the one report that moved).

**Where fog is set, and what each needed** (the conversion is inside `viewFog`, so a game's fog content stays as it was):

| Where | Fog | Change |
|---|---|---|
| `games/base-3d` (`scene.ts` `FOG`, `main.ts`) | near 5, far 14, `0x31222a` | none; its embers use `UnlitMaterial` now |
| `examples/3d/render3d/render3d-lighting-fog.ts` | near 5, far 11, `0x2f3f38` | none (drawn through the framework's views) |
| `examples/3d/look/look-pixel-art.ts` | near 16, far 30, `0x31222a` | none |
| `spikes/eb-look/scene.ts` (`?fog=near,far,rrggbb`) | the query's | none (a spike; draws through `drawWorld`) |
| `packages/editor-3d` `dollhouse/game-view.ts` | the game's, for the sky behind the room | none (it calls `fogSkyColor`, which is beta.2's) |
| `packages/tools` `create-game` 3D template | none set | none |
| the builders' survey scenes (`packages/3d/tests/fixtures/base-scenes-builder.json`) | none | none |
| `games/the-last-light` (branch `claude/last-light-prologue`, not merged here) | `#121a18`, the focus at the camera's distance | a note, below |

**What a game's fog numbers mean on beta.3.** Nothing about them changed: `near` and `far` are metres along the camera's axis, the colour is the colour you wrote, and the picture is the beta.2 one. Two things to know. (1) As on beta.2, the fully fogged colour is not one colour:
a lit surface reaches the colour you wrote and an unlit one (and the sky) reaches its darker decoded value (`0x8b9bb4` as `0x425474`), so write the colour the lit things should fade to and the sky takes the matching dark one. (2) A game that draws its own unlit mesh must use `UnlitMaterial` from `@automata/3d`
where it used `FlatMaterial`: a plain `FlatMaterial` takes the engine's fog, which on beta.3 mixes in linear light and reads brighter in the middle of the range and ends at the colour as written (and a `PhongMaterial` or `RampMaterial` needs nothing). A mesh whose material draws through its own shader template (the painter's cell sprite) needs
the same display-space fog in its template; that is the fold's port (item 4 above).

**`games/the-last-light`, for its branch** (do not merge here): (a) its fog `#121a18` with the focus at the camera's distance keeps its numbers; on beta.2 a lit surface at `far` was `#121a18` and an unlit surface and the sky were `dec_pw` of it (`#060a09`), which is what `viewFog` and `fogSkyColor` now give. (b) Where it makes a mesh with `FlatMaterial`
(its props that carry an optional `model` and anything it draws through `drawWorld` besides the world's own pieces), use `UnlitMaterial`. `drawWorld`'s pieces already are. (c) After merging this branch, run `fog-surfaces.test.ts` on its tree and its journeys' frames at the play camera, beta.2 against beta.3, as item 5 does here.

### Item 5: the frames

Shot on Chromium, software GL, WebGL2; beta.2 from a scratch worktree of `c1c9b7c2` (pixi.js 8.23.0). **The night room's frame has the look's post effects, and the 8.23 render-target finding of §3b applies to beta.2 on WebGL; it needs a pass toggled after drawing, which these frames never do, but the beta.2 frame was not re-shot on a pixi.js 8.22.0 tree to prove it**; its luma (32.9) is the figure the earlier sessions measured on the same worktree. base-3d at the journeys' camera has the look's effects too; the numbers are the mean luma (Rec.601, 8-bit) and the share of pixels that differ by more than 2 of 255 in a channel; each file is `beta.2 | beta.3 converted | |difference| x4`.

| Frame | Query | beta.2 | beta.3 converted | Differ |
|---|---|---|---|---|
| `frames/fog-night-room-beta2-vs-converted.png` | `scene=base-interior-dressed&at=night&fog=5,14,31222a&view=zone&pref=webgl&density=1&crisp=0&field=640x480&still=1&rig=1&figures=painted&fx=0&bloom=0` | 32.9 | 34.2 | 6.5% |
| the same, outside the two painted figures | | 31.20 | 31.30 | 1.0% |
| `frames/fog-base-3d-journey-camera-beta2-vs-converted.png` | `games/base-3d` dev server with `VITE_AF_JOURNEYS=1`, `?route=ember` (Wick beside the first ember, the journeys' camera), 844 x 390, New game, 90 frames, canvas only | 42.6 | 42.6 | 0.1% |
| `frames/fog-night-room-core-figures-beta2-vs-converted.png` | the night room with `figures=core` | 32.8 | 34.5 | 5.7% |

The beta.2 -> authored numbers these replace: night room 32.9 -> 48.7 (85.2% differ), base-3d 43.9 -> 57.2.
**Result: the room and base-3d are within dither noise; there is no fog decision for the Owner.** In base-3d the crates, Wick and the embers are back as beta.2 drew them with the game's `FOG` unchanged (the earlier "far 20 brings them back" is not needed). What is left, and where:
- **The two painted figures in the night room** (67,300 of the frame's 80,084 differing pixels; 1.0% of the frame elsewhere): the painter's `CellMaterial` is a `FlatMaterial` with its own WGSL template (vendor/FigureBuilder, read only), so the engine's linear fog reaches it, lighter than beta.2's display mix and the dark outline lost. The painter's view is ported with the fold; its material must
  mix fog in display space (`UnlitMaterial`'s bit does it: the cell template needs the same lines at its `end` slot). Without fog the painted figures are identical to beta.2 (item 4 of the third session).
- **The core figures' colour in the third frame** (the 1.7 of luma): the lit moving figures' tinted colour, item 6.

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
