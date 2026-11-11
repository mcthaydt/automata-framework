# c8-lit gate: painted figures lit by the room

Made by `pnpm --filter @automata/character-kit gate lit` (WebGL in Chromium; WebGPU in a Chromium launched with it, SwiftShader on this
machine) from `tests/fixtures/gate-lit.ts`; every number below is copied from `measurements.json`. The base interior at `lampLit` and the
exterior by day, the base man standing (under the pendant, in the interior) and the base woman walking a line in front of him, 720 x 405, the
look on. **Before** is the same scene with `lit: false` (today's frame); **after** is lit.

- `interior.png`, `exterior.png`: before | after (each also alone as `-before`, `-after`); `-webgpu` the same on WebGPU.
- `interior-crops.png`, `exterior-crops.png`: each figure, before | after, x4.
- `interior-walk.png`, `exterior-walk.png`: the walker in four consecutive walk poses, before (top) and after (bottom), x3.
- `measurements.json`: the bench, the light each figure took (flat steps, exposure, the lamp resultant, the key), and the parity counts.

## Numbers

Parity of a lit frame with the builder's `compose` (two figures, a warm lamp, 640 x 360): WebGL 0 of
230400 pixels differ, WebGPU 0 of 230400
(2 lit cells each). The two renderers drew the gate pictures from the same keys.

The bench (`AF_BENCH=1`; the light's cost for eight walking D2 figures, ms a frame, linux x64, node v24.21.0); budget 2 ms at the median, 6 ms at the worst frame:

| scenario | median | p95 | worst | hits | misses |
|---|---|---|---|---|---|
| steady | 1.84 | 4.32 | 14.46 | 3240 | 1560 |
| switch | 0.31 | 4.29 | 7.59 | 3439 | 1361 |
| flicker | 2.00 | 4.35 | 7.52 | 2556 | 2244 |

**The budget is not met on this machine**: steady's median is inside it, flicker's is on it, and every scenario's worst frame is over (the
worst is a single frame of 600 on a shared VM and varied 6 to 14 ms between runs). What got it from the first run (steady median 9.0 ms) to here:
FigureBuilder's `lightSprite` four times faster for the same bytes, the lit cell's key not a hash, a lamp's direction in eighths. Not done, as the plan forbids:
a lower density, lighting every other frame, spreading a relight over frames.

## What the pictures say

- **No colour off its row but by tint**: by construction (`lightSprite` moves a texel along its own row; `grade` is the one way off), and the unit tests hold it. The
  walker's cloth goes khaki and the skin warmer under the pendant: that is the warm tint.
- **Under the pendant the figure is not hotter than the floor round it**: the stander's key is `0|16,13,7|0,8,0;15` (exposure 0): no steps, no exposure, because the floor
  under the pendant is as bright as he is. He is brighter than the dark green wall behind him, which is the room.
- **The form is one step and reads as a side**: the man's torso has one lighter band on the pendant's side; the rim is a thin warm edge on his left.
- **The walker's bands do not swim**: `interior-walk.png`: the cloth's band sits at the same place on the torso in four poses.
- **The exterior figure, by day** (the coordinator's fix: the sun's level x colour is in the flat light as well as in the form): the key is `2|-|-4,6,3;10`: flat light
  +2 steps (it was three steps down and blue: ambient alone), the sun's direction as the one lamp. The ground it is held to is the room's light on the floor round its
  feet plus the sun's pull on a floor, and the figure is within a step of it, so the exposure is 0. In the picture the figures are brighter than the street: the street's
  drawn colour is a dark swatch, so the same light is a dim ground and a bright skin. A sunlit figure on a dim street, not murky; if it reads too bright, the cap is one step
  off `ROOM_LIGHT.hot` (not changed).
- **A figure in shade by day** (the exterior has none of its own): not checked; the sun is not occluded for a painted figure (spec section 11).
- **The eyes** (painted colours of peak 40 or less): FigureBuilder's `sprite.test.ts` prints which are stepped under a bright flat light; in the crops the eyes stay dark.
- **Against EnvironmentBuilder's frames** (`docs/refactor/eb-look/baseline/`): the exterior's baked room light is as dark there; the interior's figure is not a step brighter than
  there under the pendant (the key says step 0).
