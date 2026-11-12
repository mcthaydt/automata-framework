# Why the baked interiors were near black (2026-11-11)

Branch `claude/eb-look-effects`, fixed in `fix(3d): a baked room shows albedo × light, not its 2.2 power`.

## What was seen

The base interiors drew near black with the baked room light, on WebGL and on WebGPU, although the bake had the source's
sun, key, fill, step and shade (PR #582). With the baked light off (`?light=0`) the walls showed fine.

## The cause

A baked piece is drawn with `FlatMaterial`. That material is unlit and **skips the view's tone mapping, and with it the
display encode** (`toneMapped = false`; the engine's `srgbEncodeBit` is a tone-mapping bit). The bake, though, was written
for a pipeline that encodes:

- the tile texture was `rgba8unorm-srgb`, so the sampler turns each texel into linear light;
- the bake wrote the light as a linear multiplier (`light ** 2.2` for a tile, `toLinear(albedo × light) / toLinear(albedo)`
  for a flat colour), so that after the encode the screen would show `albedo × light`;
- nothing encoded. The screen showed the linear product: `(albedo × light) ** 2.2`.

At a wall's light of about 0.3 that is 0.07 where the source shows 0.3.

## Evidence

Measured on the base interior's diorama on WebGL (SwiftShader, no figures, the snap and haze passes off to read the
frame before them), `spikes/eb-look/probe.mjs`:

| What | Result |
|---|---|
| The bake's per-vertex light (Node, `bakeVertices` on the level's own pieces) against the source's `vertex-light.ts` | Agree: walls median 0.18 per vertex and 0.30 over the frame's wall texels (the source's own frame reads 0.297 there); floor 0.74 over the pool. The light was never the problem |
| Vertex colour forced to 1 (so the screen shows the tile) | The `baseWall` tile has mean (157, 166, 178); the screen showed (90, 101, 117): the tile `** 2.2`. The sampler decoded it and nothing encoded it |
| The wall's brightness against the multiplier's exponent (0, 1, 2.2) | 90, 38, 12: a power law in the multiplier |
| A flat swatch (`?tiles=0`) | The same darkening: `0xa6aeba` under a light of 0.3 showed (13, 14, 13) |
| `FlatMaterial` in `@pixi/3d` | `toneMapped = false`: "Lights, the view's environment, shadows and tone mapping all leave it alone" |

Not the cause: the sRGB/linear handling of the lights themselves, `light.max` or the step clamp, the swatch ladder's base
step, wall normals against the key and fill, and the room's `light` field (it is 1 in the base scenes, so the shade is
`0.85 ** 0`).

## The fix

Bake display-referred, which is also the source's own rule (`litColour`: albedo × light in sRGB, per channel):

- a baked piece's tile is a plain `rgba8unorm` texture (a lit mesh keeps the sRGB one, which its encode brings back);
- a baked flat swatch sits on a white base and its vertex colour is `albedo × light` (clamped at 1);
- a baked tile's vertex colour is the light itself, past 1 where the light is;
- a glow's vertex colour is its step as written; an unlit glow's base colour is the colour that decodes to its step.

After it the interior's wall and floor read (58, 63, 64) and (70, 60, 57) against the source frame's (56 to 67, 65 to 73, 63
to 70) and (71, 64, 58).

A lesson for the next material: anything drawn by `FlatMaterial` is shown as it is computed. If it is meant to be encoded,
the encode is the author's.
