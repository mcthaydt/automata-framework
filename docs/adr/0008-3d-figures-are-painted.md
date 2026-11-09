# ADR 0008: 3D figures are painted

- Status: Accepted (Owner, 2026-11-09: "We should only ever do 3D figures with the painter, cut whatever crap we were doing before"; 07:57, "Make the 3D view look like the references I sent, it should be that, but a game")
- Date: 2026-11-09
- Supersedes: the figure passes of [ADR 0007](0007-3d-look.md) (the flat-colour figure meshes and the sprite-light the mesh path used)
- Plan: [3D painted look](../refactor/2026-11-09-3d-painted-look-plan.md), spec [there](../refactor/2026-11-09-3d-painted-look-spec.md)

## Context
ADR 0007 drew the world and the figures by passes on Pixi 3D. The figures were flat-colour meshes with a plus or minus 18 %
shade. Next to FigureBuilder's painted figures (faces, hands, an outline, light in whole steps, a rim) they read as toys,
and the Owner ruled that no 3D figure is ever drawn another way.

## Decision
- A 3D figure is **FigureBuilder's painter's cell**: colours (DUEL), a normal map and a per-texel depth, painted on the CPU
  from the parts `build()` makes, one density per view, cached, lit as a sprite, hazed and snapped to DUEL on the CPU.
- Pixi 3D still draws every frame (law 6): a cell is a texture. A scene-stage `Pass3D` (`CellCompositePass`, at
  `afterTransparent`) draws each cell as a quad at whole field pixels, one texel to one pixel, writing straight colour with
  blending off and each texel's own depth, so the depth test hides a figure's legs behind a table. There is no CPU frame.
- **Alpha codes** carry what the post chain must know about each pixel: `0` nothing, `160/255` the sky, `192/255` painted,
  `224/255` glowing, `1` world. A pixel is read as the code its alpha is nearest, within half a byte; any other non-zero alpha
  is world (a blended wall leaves no code). The snap passes painted pixels through; the finish writes alpha 1 where
  anything was drawn and colour 0 where nothing was (the last pass is blended onto the 2D stage as premultiplied colour).
  Two rules keep a code honest: the forward template writes `vec4(colour * alpha, alpha)`, so a material writing a code
  divides its colour by the code in its last bit; and a hand-placed quad takes its y flip from the bound projection.
- The mesh figure path is deleted, in core and in the editors. There is no option and no fallback.
- The field's short side is 360 (Owner, 2026-11-09 07:27).

## Not taken
`Sprite3D` billboards: they cannot give a per-texel depth (a figure behind a table would be cut by a plane), and their
material would premultiply a code away. They stay the fallback only if the composite pass cannot be built on a backend.

## Consequences
- Law 6 holds: Pixi draws; the painter makes textures. ADR 0002 gains a consequence line. ADR 0007's figure passes are
  superseded; its world passes (stepped light, the snap, the outline) stand and are rebuilt by the plan.
- A figure's cell costs CPU (measured 11 ms at density 1, 20 ms at density 2 in Node), so painting is one cell a frame and
  cached; the worker is the step after, only if the iPad misses its budget.
- A view with no mesh draws no frame at all in `@pixi/3d` 0.1.0-beta.2 (its pipe returns early), which no room hits.
