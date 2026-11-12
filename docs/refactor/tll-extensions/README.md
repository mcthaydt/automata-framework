# Three render extensions for the clinic (2026-11-11)

> `room-visibility` was not landed in `main`: the Owner's decisions list this branch's clinic work as superseded by the last-light prologue, and
> the prologue builds the rooms a view draws in core (`drawnRooms`), so two answers to one question would not both stand. `lcd-panel` and
> `retro-crisp` landed. The notes and screenshots below stay as the record of all three.

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

- **Passes are `PostEffect`s on core's look.** The retro grade runs **before** the DUEL snap (the coordinator's rule: the final
  snap is DUEL, as the haze runs before it), so its graded, faded and grained colours are snapped to the palette. That needed a
  small core hook: `LookPass.beforeSnap` (`createLookPasses` returns `early` beside `extra`; a pass without it runs where it
  always did). The LCD panel runs after the snap and its output is off the palette on purpose: it simulates the display, as the
  source game's LCD does (its README says so). The source's palette LUT and luma-weighted 8 x 8 dither stay core's snap (the
  retro profile's optional `quantise` is the source's no-palette branch). The look sessions' files (world view, vertex bake, the
  DUEL snap, bloom) are untouched; only the pass registry `look-pass.ts` gained the option.
- **An exact DUEL colour passes unchanged** with `RETRO_NEUTRAL` and with the LCD panel zeroed and its vignette off: proved on the
  CPU (retro) and on a WebGL2 frame for both (`tests/browser/*-pass.test.ts`). The neutral grade is blended in at 0, because a grade
  at its identity values still rounds a channel by a unit in the last place.
- **`uTime` is taken.** A `PostEffect` header already declares it, so the retro pass's clock is `uFilmTime`.

## Open

- **Whole-pixel scaling** is core's letterbox option `scale: 'whole'` (added here, at the coordinator's word: opt-in, the default `'fit'`
  changes no frame, a patch changeset). It rounds the scale down and centres the field; the source's rule of rounding up and
  shrinking the field when rounding down leaves too much border is not in it, because the field's size is the game's.
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
| | whole-pixel scale (core's `scale: 'whole'`), 1440 x 810 window | [crisp-whole-webgl](crisp-whole-webgl.png) | [crisp-whole-webgpu](crisp-whole-webgpu.png) |
| | fractional fit (`?scale=fit`), same window | [crisp-fit-webgl](crisp-fit-webgl.png) | [crisp-fit-webgpu](crisp-fit-webgpu.png) |
| `roomvisibility-zones` | zone `hall`: reception and corridor | [rooms-on-hall-webgl](rooms-on-hall-webgl.png) | [rooms-on-hall-webgpu](rooms-on-hall-webgpu.png) |
| | zone `corridor`: the corridor alone | [rooms-on-corridor-webgl](rooms-on-corridor-webgl.png) | [rooms-on-corridor-webgpu](rooms-on-corridor-webgpu.png) |
| | zone `closet`: the supply room alone | [rooms-on-closet-webgl](rooms-on-closet-webgl.png) | [rooms-on-closet-webgpu](rooms-on-closet-webgpu.png) |
| | extension off (`?rooms=0`): every room | [rooms-off-webgl](rooms-off-webgl.png) | [rooms-off-webgpu](rooms-off-webgpu.png) |

Measured on the crisp pair (runs of equal pixels along the middle 40 rows): the whole-pixel frame is runs of 2 and 4 device
pixels (7430 and 154 runs); the fractional fit is runs of 3 and 2 (5852 and 1336), so some field pixels are drawn a third wider
than others. WebGL and WebGPU give the same counts. The example's field is 512 x 320. The `retro-*` frames use the whole-pixel scale (2, a border round the field) and the `lcd-*` frames
the core default, the fit (2.5, so uneven pixels at 1280 wide); the retro grade is before the snap in every `retro-*` frame. By eye, WebGL and WebGPU match in every pair. The rooms are flat floors under a plain orthographic camera, since the example is about
which rooms draw; the lit base interior in the other two is dim by its own baked lamp. The black between rooms is the background
and the walls that face away from the camera.
