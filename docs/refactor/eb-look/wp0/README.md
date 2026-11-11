# WP0: Pixi 3D on WebGPU (2026-11-10)

The Owner's rule: the 3D renderer works on WebGPU as well as WebGL. `gap.md` found that, in headless Chromium here, AF
"takes the WebGPU device and loses it on the first frame in play". This is what that was, what is fixed, and what is not.

## What the loss was: the browser, not AF

The device loss had nothing to do with a mesh, `@pixi/3d`, a format, the no-eval path or a lifetime. A bare page with no
Pixi and no AF, which only configures a WebGPU canvas (`rgba8unorm`, `RENDER_ATTACHMENT`) and clears it, loses its device
on frame 1 in Playwright's chrome-headless-shell (1243) and in the full Chromium 153. The same device with no canvas
survives. The GPU process says why, just before the loss:

```
gpu/command_buffer/service/shared_image/shared_image_factory.cc:1019  Could not find SharedImageBackingFactory with params:
  usage: Gles2Read|RasterRead|DisplayRead|WebgpuRead|WebgpuSwapChainTexture|RasterWrite|WebgpuWrite
gpu/ipc/service/shared_image_stub.cc:225  SharedImageStub: Unable to create shared image
```

then `A valid external Instance reference no longer exists.` The software adapter (SwiftShader) has no shared-image backing
for a WebGPU swap chain unless Chromium also runs Vulkan on it. The spike's earlier theory (Pixi's throwaway WebGL
probes lose a context and take the WebGPU instance with them) is not the cause: with every `loseContext` call
suppressed the device is lost all the same.

**Launch flags that fix it** (measured on the bare page, both `rgba8unorm` and Pixi's `bgra8unorm`, and on AF's scenes):

```
--enable-unsafe-webgpu --use-angle=swiftshader --enable-unsafe-swiftshader --enable-features=Vulkan --use-vulkan=swiftshader
```

`spikes/eb-look/shoot.mjs` has them now. `packages/3d/vitest.config.ts` adds them to the `webgpu` browser project when
`AF_WEBGPU=software` is set (a cloud session or CI with no GPU); on a machine with an adapter it launches with only
`--enable-unsafe-webgpu` and uses the real GPU. AF's other WebGPU test ("draws the same sky as WebGL2") also needs a
presentable adapter, so it could not have run in this sandbox before.

## An AF bug this uncovered, fixed: lit meshes drew black on WebGPU under no-eval

With the device alive, a plain lit box on WebGPU came out **black** (WebGL: 240 px of `162,125,31` and 60 of
`164,127,31`). Run without AF's no-eval shim (pixi's own uniform sync) the same box has exactly WebGL's pixels. Diffing
every uniform buffer between the two runs showed one difference: `uLightTiles` (`array<vec4<i32>, 36>`) and
`uLightDepthMasks` (`array<vec4<i32>, 8>`), the light culling tables of `@pixi/3d`.

pixi.js 8.22's eval-free WGSL polyfill (`generateUboSyncPolyfillWGSL`) writes an integer uniform through the buffer's
`Float32Array`; the eval path writes `dataInt32`. The shader reads the bit pattern of `1.0` where it wants `1`, every
tile table is noise and no light reaches a lit surface. The polyfill is pixi's, but the wrapper that installs it for
`@pixi/3d` is AF's (`features/renderer/no-eval/pixi3d-uniform-sync.ts`), so AF now writes integer uniforms itself for WGSL
buffers (scalars, vectors and arrays of `i32` and `u32`, at pixi's own element stride). Failing tests first:
`tests/unit/renderer/no-eval/pixi3d-uniform-sync.test.ts` ("integer uniforms in a WebGPU uniform buffer") and the lit
crate in `tests/browser/webgpu/mesh.test.ts` (0 yellow pixels before, about 300 after). The no-eval pin test still holds.

## Not fixed: a mesh added after a post effect has run drops every later frame (`@pixi/3d`)

**Where it shows.** In `spikes/eb-look` (the real runtime, the baked room light, the look, two figures and the room's
pieces) every WebGPU frame logs:

```
[Texture "sceneDepth"] usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
synchronization scope. - While validating render pass usage.   ->   [Invalid CommandBuffer] ... Queue.Submit
```

That frame's commands are dropped. What shows is what an earlier pass drew: **the WebGPU panels show the room but not
the figures**, until this is fixed. (With the pieces left out, `?world=0`, the figures draw on WebGPU exactly as on
WebGL.)

**What it is.** A hook on `beginRenderPass`, `createBindGroup`, `createRenderBundleEncoder` and `executeBundles` found the
pass: the scene's forward pass (colour `sceneColor`, depth `sceneDepth`, written) replays a render bundle whose global
bind group (group 0) has `sceneDepth` in slot 7, `@pixi/3d`'s `globalSlots.opaqueDepth`. Every `PostEffect` declares
`reads: { depth: graph.sceneDepth }` and so `sample`s it into that slot; the global bind group is shared, nothing puts the
placeholder back, and a bundle that is re-recorded after an effect has run captures the slot as the effect left it. In
the tests and the spike alike, the bundle recorded on frame 1 (before any effect ran) holds the placeholder and is fine.

**Smallest reproduction** (no AF code; `packages/3d/tests/browser/webgpu/scene-depth.test.ts`, kept as an `it.fails`):
a WebGPU `Application`, a `View3D` with one `PostEffect` that only returns `sampleColor(uv)`, one `CubeGeometry` mesh,
`app.render()` for 10 frames, then `view.root.addChild(secondMesh)` and 30 more frames. From the frame after the add, every
frame logs the error above (166 in 30 frames). Controls with the same scene stay clean: nothing changes, a mesh moves, a
mesh is hidden. (A dynamic buffer updated every frame, a material colour changed every frame, and the base interior with a
figure and a lamp for 150 frames, also stay clean.) So the trigger is a bundle re-record after an effect ran.

For AF this is not only the spike: **on WebGPU, with the look on, any mesh added after the first frame (a figure or prop
that spawns, a door that opens into a new piece) invalidates every frame from then on.** WebGL is not affected.

**Upstream issue text** (for the Owner to file or not):

> **WebGPU: adding a mesh after a PostEffect has run invalidates every later frame** (`@pixi/3d` 0.1.0-beta.2, pixi.js 8.22.0,
> Chromium 153, WebGPU)
>
> With any `PostEffect` in `view.passes` (so the graph composites into `sceneColor`/`sceneDepth`), draw a few frames, then add
> a mesh to the view. Every frame after that fails validation and is dropped:
> `[Texture "sceneDepth"] usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
> synchronization scope. - While validating render pass usage.`
>
> Reproduction: a `View3D` with one effect (`fn effect(uv) { return sampleColor(uv); }`), one cube, 10 frames, then
> `view.root.addChild(cubeB)`, 30 more frames. Nothing else changes; moving or hiding the first cube does not trigger it.
>
> What I found: the forward pass attaches `sceneDepth` for writing and replays a render bundle whose global bind group has
> `sceneDepth` in slot 7 (`globalSlots.opaqueDepth`). `PostEffect.setup` samples `reads.depth` (always `graph.sceneDepth`) into
> that slot; the bind group is shared across passes and the slot is not reset to the placeholder, so a bundle re-recorded
> after the effect ran captures it. A bundle recorded on frame 1 is fine. Expected: the slot holds the placeholder (or the
> opaque-depth copy) in any bundle recorded for a pass that attaches `sceneDepth`.
>
> Workaround on our side: none that keeps the effect; WebGL is not affected.

**Options** (not chosen; the coordinator has put them to the Owner; the brief leaves the vendored package unpatched and the
DUEL snap on `PostEffect` for now):
1. Report upstream and wait. The WebGPU pictures keep the room and lose the figures. (Chosen for now.)
2. Draw the 3D view without render bundles, if `View3D` allows it (`useBundles` is a forward-pass option inside the backend;
   no public switch was found), at a cost in draw calls.
3. Move the look's snap off the `PostEffect` path (a Pixi filter on the view's container), so no pass samples `sceneDepth`
   into the global slot. That changes the look's structure on both backends (ADR 0002 keeps them at parity).
4. Patch the vendored `@pixi/3d` to put the placeholder back after a pass that sampled the slot.

## The pictures

`<scene>-<view>.png`: panel 1 EB (not rendered, see `gap.md`), 2 and 3 AF WebGL (baked room light, material light only),
4 AF WebGPU (baked room light). `shots.json` lists, per panel, what drew, the lamps, any device loss and the console's
errors (the `sceneDepth` error is in every WebGPU one).
