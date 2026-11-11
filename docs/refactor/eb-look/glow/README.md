# Glow, lit windows, bloom, light through openings, baked props and the zone camera (2026-11-11)

Branch `claude/eb-look-glow`. Drawn with `spikes/eb-look` (`EB_PANELS=glow`), WebGL only, SwiftShader. EB's panel is EB's own
CPU frame from `claude/eb-base-renders` (`docs/renders/base/`). The three AF panels are the same scene with switches:

1. **no glow** (`?glow=0&bloom=0`): a bulb lit as a surface and a window flat.
2. **glow and windows** (`?bloom=0`): glowing swatches at their own step, lit windows with a room behind the glass, props baked.
3. **glow, windows and bloom**: the above with the kit's `GlowEffect` told the scene's glow colours (`glowColours`).

Baked props and the occluders cut at openings have no switch: they are in all three AF panels. For the old props, compare
with `../haze-sky/` (same scenes, same cameras).

| Sheet | Shows |
|---|---|
| [`base-interior-diorama.png`](base-interior-diorama.png), [`base-interior-fp.png`](base-interior-fp.png) | The pendant's bulb glows in its own step; EB's has a shade and a bloom. The room is still near black: the sun, key and fill of the bake (WP2) are not this batch's. |
| [`base-interior-dressed-diorama.png`](base-interior-dressed-diorama.png), [`base-interior-dressed-fp.png`](base-interior-dressed-fp.png) | The waiting room: the lamp's pool falls on the floor, the table and the chairs, which are baked props now. |
| [`night/base-exterior-dressed-diorama.png`](night/base-exterior-dressed-diorama.png) | The street at night (`?at=night`, no EB frame): the panes are lit and show a room (back wall, a sofa, a lamp's pool) where panel 1 has dark glass. |
| [`zones/`](zones/) | The base scenes through the default gameplay camera (50 mm, 30°) at the 16 m default, and at the zone's own distance (9 m interior, 10.2 m exterior). |

`shots.json` beside each set has what each panel drew (renderer, pieces, lamps, passes, console errors).

## What is not done here

- A window's room is a tile seen at a fixed 25° into the wall, so it does not move as the camera turns. The source traces a
  ray per texel, which needs a shader on the glass.
- The bloom's mask is a colour match. A lit surface that lands on one of the glow colours (an orange wall under a warm lamp)
  would ring too. A true mask needs a second target the post passes do not have.
- A doorway is open to light: a hinged door is not an occluder, so a closed door does not stop a lamp in the next room.
- The WGSL of the bloom was not run on a device: the WebGPU frames here fail on `@pixi/3d`'s open `sceneDepth` issue
  ([wp0](../wp0/README.md)) before any pass can be judged. It compiles as GLSL in Chromium.
