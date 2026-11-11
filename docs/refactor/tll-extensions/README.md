# Three render extensions for the clinic (2026-11-11)

`@automata/room-visibility`, `@automata/lcd-panel` and `@automata/retro-crisp` (all in `extensions/`) are the render features
the adventure source's clinic needs that `@automata/3d` does not have. Each takes AF data only, has a README, a one-file
example under `examples/3d/`, unit tests (and WebGL2 browser tests for the two passes), and the screenshots below.

## Where each came from

| Extension | Read in the source (`92e6704`) | What AF has instead |
|---|---|---|
| `room-visibility` | `src/render/room-visibility.ts`, `room-wall-owners.ts`, `room-ownership.ts`, `src/scenes/clinic/visibility.ts`, and how `stage.ts` hides a wall group by `hideFrom` | A Zod `RoomPolicy` and `checkRoomPolicy` that returns problems instead of throwing; the resolver over `@automata/3d/level`'s `insideSector`; wall groups read from an `af-sector/2` level's `cut` and `hideFrom`; `wallGroupAt` ties a drawn wall to its group; `createRoomOwnership(...).layer()` and a `createWallHider()` that needs no renderer |
| `lcd-panel` | `src/render/lcd-panel.ts`, `filter-programs.ts` | A `PostEffect` (GLSL and WGSL) added with `addLookPass`, a Zod profile with the clinic's numbers, uniforms instead of constants, the cell and `snap` as profile settings |
| `retro-crisp` | `src/render/retro-filter.ts`, `crisp.ts`, `look.ts` (`LOOK.post`) | The grade, unsharp, vignette and film fade as a `PostEffect` with uniforms and a Zod profile; the crisp maths and `?crisp=` / `?scale=` flags as pure functions with a profile |

Nothing was copied. The LCD mesh is a port of `lcd-perfect` (MIT, sinedied) and keeps its notice in the shader file.

## Decisions

- **Passes are `PostEffect`s on core's look.** They run after the DUEL snap, in the order added. The retro pass therefore grades
  colours already on the palette; the source's palette LUT and luma-weighted 8 x 8 dither stay core's snap (the retro profile's
  optional `quantise` is the source's no-palette branch). The look sessions' files (world view, vertex bake, the DUEL snap,
  bloom) are untouched.
- **An exact DUEL colour passes unchanged** with `RETRO_NEUTRAL` and with the LCD panel zeroed and its vignette off: proved on the
  CPU (retro) and on a WebGL2 frame for both (`tests/browser/*-pass.test.ts`). The neutral grade is blended in at 0, because a grade
  at its identity values still rounds a channel by a unit in the last place.
- **`uTime` is taken.** A `PostEffect` header already declares it, so the retro pass's clock is `uFilmTime`.

## Open

- **Whole-pixel scaling in the running game.** Core's letterbox scales the field by `viewWidth / logicalWidth`, which is not a
  whole number. `letterboxScale` and `applyCrispLayout` are the maths and the CSS for it; wiring them needs a hook in core's
  letterbox (an option for the scale, or the scale it chose). Asked of the coordinator; not edited.
- **`figureSnap`** is for billboard figures; AF's figures are 3D meshes, so nothing in AF calls it yet.
- **WebGPU parity** is judged by eye from the screenshots. The browser tests run WebGL2 in Chromium; WebKit and WebGPU belong to the
  GPU runner.
- The example rooms are lit by the base interior's own lamp, which is dim; a brighter clinic is the look sessions' to tune.

## Screenshots

Taken by `spikes/tll-extensions/shoot.mjs` (headless Chromium, SwiftShader, the `spikes/eb-look/shoot.mjs` launch flags so
WebGPU draws), at twice the example's field. `shots.json` has what each drew and its console errors. The only console message
is Chromium's note that the WebGPU canvas uses a different format than the device prefers.

| Example | State | WebGL | WebGPU |
|---|---|---|---|
| `lcdpanel-screen` | panel on | [lcd-on-webgl](lcd-on-webgl.png) | [lcd-on-webgpu](lcd-on-webgpu.png) |
| | panel off | [lcd-off-webgl](lcd-off-webgl.png) | [lcd-off-webgpu](lcd-off-webgpu.png) |
| `retrocrisp-grade` | retro on (and the panel over it) | [retro-on-webgl](retro-on-webgl.png) | [retro-on-webgpu](retro-on-webgpu.png) |
| | retro off (the panel alone) | [retro-off-webgl](retro-off-webgl.png) | [retro-off-webgpu](retro-off-webgpu.png) |
| | retro on, crisp colour split (`?crisp=lcd`) | [retro-on-crisp-lcd-webgl](retro-on-crisp-lcd-webgl.png) | [retro-on-crisp-lcd-webgpu](retro-on-crisp-lcd-webgpu.png) |
| `roomvisibility-zones` | zone `hall`: reception and corridor | [rooms-on-hall-webgl](rooms-on-hall-webgl.png) | [rooms-on-hall-webgpu](rooms-on-hall-webgpu.png) |
| | zone `corridor`: the corridor alone | [rooms-on-corridor-webgl](rooms-on-corridor-webgl.png) | [rooms-on-corridor-webgpu](rooms-on-corridor-webgpu.png) |
| | zone `closet`: the supply room alone | [rooms-on-closet-webgl](rooms-on-closet-webgl.png) | [rooms-on-closet-webgpu](rooms-on-closet-webgpu.png) |
| | extension off (`?rooms=0`): every room | [rooms-off-webgl](rooms-off-webgl.png) | [rooms-off-webgpu](rooms-off-webgpu.png) |

By eye, WebGL and WebGPU match in every pair. The rooms are flat floors under a plain orthographic camera, since the example is about
which rooms draw; the lit base interior in the other two is dim by its own baked lamp. The black between rooms is the background
and the walls that face away from the camera.
