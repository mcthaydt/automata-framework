# Exposure by the builder's own trial (the dressed interior, 640 x 480)

The dressed interior's room view at 640 x 480, the old game's picture ([`base-interior-dressed-zone-640x480.png`](base-interior-dressed-zone-640x480.png):
left density 1 whole pixels a texel, right density 1 true size). Shadow off in the numbers, on in the sheet.

`SceneLight.groundLuma` gives the floor as the room shows it; the figure's luma is no longer estimated from the painted cell
but **trialled**: `roomLight` lights the figure's cell at each candidate step through the cached lit cells (`litCells().shown`,
the mean luma of the lit cell's opaque texels, on the CPU, no readback) and steps down while it is over 1.1 times the floor.

| Figure (the same view) | Painted-luma estimate (`8455d307`) | The trial |
|---|---|---|
| man: his luma over the floor round him | 0.421 over 0.353 = **1.19 (hot)** | 0.374 over 0.352 = **1.06** |
| woman | 0.33 over 0.333 = 0.99 | 0.255 over 0.336 = 0.76 |
| the man's edge against the ring (reads at 1.1 or more) | 2.669 | 2.432 |

- Before the probe at all (`6eb8ca1e`, the tint's ring only): the man 0.37 over 0.345 (1.07), the woman 0.258 over 0.335 (0.77).
- The floor round the figures is the same in each run (0.352 and 0.353), so the numbers describe one view.
- Caveat: the "estimate" column is the earlier session's measure of the same view; it was shot without `density=1&crisp=0`, the "trial" column
  with it (`READ_ONE=base-interior-dressed:zone:640x480:after node spikes/builders-look/shoot.mjs out builders 'figures=painted&density=1&crisp=0'`).
  Luma does not depend on the figure's size, the floor round it matches, and the edge is above the 1.1 of "reads" in both.
- Raw rows: [`trial-reads.json`](trial-reads.json) (the trial), [`after-reads.json`](after-reads.json) (the estimate), [`before-reads.json`](before-reads.json).

## The black slabs (item 2): wall fixtures seen from behind, not a prop's top

Three dark flat rectangles in the dressed interior's room view, (29, 29, 33). Bisected with `?tiles=0` and the spike's new `?only=<regex>` (the pieces whose id matches), same view, no figures drawn in the `-without` frames:

| Shot ([`slabs/`](slabs/)) | What it shows |
|---|---|
| [`tiles-off.png`](slabs/tiles-off.png) (`tiles=0`) | The slabs stay: it is not the tile (UVs, wrap or colour). |
| [`only-prim-props.png`](slabs/only-prim-props.png) (`only=prop[123]\.`, the three `prim.*` props) | The box, the table and the bin draw with their tile, tops included, and no slab. |
| [`only-props.png`](slabs/only-props.png) (`pieces=moving`: every prop) | The slabs are among the other props. |
| [`only-fixtures.png`](slabs/only-fixtures.png) (`only=fixture`) | Only the slabs and the small wall things remain. |

The slabs are **the backs of wall fixtures**: `room:fixture:14` (the sea canvas, x -1.85 to -1.15, y 1.19 to 1.71) and `room:fixture:15` (the oak pinboard, x 1.0 to 2.0, y 1.11 to 1.79) hang on the near wall (z = +2.49), `fixture:12` (the radiator) and the vents on the side walls.
The room's walls are single-sided faces: the near wall is culled when the camera looks at it from outside, so it is not drawn, but a fixture on it is a thin box, whose back face is geometry and does draw. The back of a box faces away from every lamp, so the bake gives it the ambient alone, one flat colour. The earlier reading ("the tops of the `prim.*` props") was wrong: a unit probe of the real bake gives the three props' tops 0.4 to 0.7 and a spread of colours (see the plan's log).
EnvironmentBuilder's frame has no such rectangles (`builders/base-interior-dressed-diorama.png`): it draws no decor of a wall the camera stands behind.
