# c8-lit gate: painted figures lit by the room

Made by `pnpm --filter @automata/character-kit gate lit` (WebGL in Chromium; WebGPU in a Chromium launched with it, SwiftShader on this
machine) from `tests/fixtures/gate-lit.ts`; every number below is copied from `measurements.json`. The base interior at `lampLit` and the
exterior by day, the base man standing (under the pendant, in the interior) and the base woman walking a line in front of him, 720 x 405, the
look on. **Before** is the same scene with `lit: false` (today's frame); **after** is lit.

- `interior.png`, `exterior.png`: before | after (each also alone as `-before`, `-after`); `-webgpu` the same on WebGPU.
- `interior-crops.png`, `exterior-crops.png`: each figure, before | after, x4.
- `interior-walk.png`, `exterior-walk.png`: the walker in four consecutive walk poses, before (top) and after (bottom), x3.
- `measurements.json`: the bench, the light each figure took in the lit frame (flat steps, exposure, the lamp resultant, the key; the before frame is unlit, so it has none), and the parity counts.

## Numbers

Parity of a lit frame with the builder's `compose` (two figures, a warm lamp, 640 x 360): WebGL 0 of
230400 pixels differ, WebGPU 0 of 230400
(2 lit cells each). The two renderers drew the gate pictures from the same keys.

The bench (`AF_BENCH=1`; the light's cost for eight walking D2 figures, ms a frame, linux x64, node v24.21.0). **This table copies `measurements.json`'s `bench`
entry, number for number** (the file holds them to two places). The bench first walks one full lap of the circle, lit but not timed (a declared warm-up: every view and place
the walk reaches is lit and cached once), then times 600 frames. The budget is 2 ms at the median, and the bench asserts it; the worst frame is recorded and not asserted (it is
one frame of 600 on a shared machine and has ranged 4.9 to 43.6 ms between runs here).

| scenario | median | p95 | worst | hits | misses |
|---|---|---|---|---|---|
| steady | 1.51 | 3.54 | 6.9 | 3209 | 1591 |
| switch | 0.15 | 3.36 | 5.77 | 3429 | 1371 |
| flicker | 1.66 | 4.94 | 9.44 | 2555 | 2245 |

All three medians are inside the 2 ms budget. The worst frames (5.77 to 9.44 ms here) are the frames where several figures relight at once; they are not a budget. What got the
first run (steady median 9.0 ms) to here: FigureBuilder's `lightSprite` four times faster for the same bytes, the lit cell's key not a hash, a lamp's direction in eighths. Not done, as the plan
forbids: a lower density, lighting every other frame, spreading a relight over frames.

## What the pictures say

- **No colour off its row but by tint**: by construction (`lightSprite` moves a texel along its own row; `grade` is the one way off), and the unit tests hold it. The
  walker's cloth goes khaki and the skin warmer under the pendant: that is the warm tint.
- **Under the pendant the figure is not hotter than the floor round it**: the stander's key is `0|16,13,7|0,8,0;15` (exposure 0): no steps, no exposure, because the floor
  under the pendant is as bright as he is. He is brighter than the dark green wall behind him, which is the room.
- **The form is one step and reads as a side**: the man's torso has one lighter band on the pendant's side; the rim is a thin warm edge on his left.
- **The walker's bands do not swim**: `interior-walk.png`: the cloth's band sits at the same place on the torso in four poses.
- **The exterior figure, by day** (after the implementation audit): the key is `0|-|-4,6,3;10`: flat light 0 steps (flat [1, 1, 1]), the sun's direction as the one lamp. The sun is in the
  flat light and in the ring the exposure compares with, but a figure is never lit above its painted cell (`ROOM_LIGHT.lift`, 0): the painter's key light already is the daylight look, and
  a lift of +2 (the first build) washed the woman's brown skin to cream and the man's navy hair to cyan. In `exterior-crops.png` the figures keep their painted skin, clothes and hair; the sun
  is a side (one lighter step) and a rim. The interior's keys and pictures are byte for byte the same as before the change.
- **A figure in shade by day** (the exterior has none of its own): not checked; the sun is not occluded for a painted figure (spec section 11).
- **The eyes** (painted colours of peak 40 or less): FigureBuilder's `sprite.test.ts` prints which are stepped under a bright flat light; in the crops the eyes stay dark.
- **Against EnvironmentBuilder's frames** (`docs/refactor/eb-look/baseline/`): the exterior's baked room light is as dark there; the interior's figure is not a step brighter than
  there under the pendant (the key says step 0).
