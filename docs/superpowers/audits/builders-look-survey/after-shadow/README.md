# The painted base pair with a cast shadow

The last task of the plan's group 2 (the plan's amendment 1), `claude/builders-look-figures`: the sheets of
[`../after-figures/`](../after-figures/README.md) shot again with the kit's painted figures casting their shadow on the floor
(`look.switches.shadow`, on by default; `look.figureShadow` 0.6; the room's sun and whole DUEL steps). Shot with

```sh
node spikes/builders-look/shoot.mjs docs/superpowers/audits/builders-look-survey/after-shadow \
  docs/superpowers/audits/builders-look-survey/builders figures=painted
```

Each sheet is the builder's frame, the framework's baked-light panel and the framework with material light only, as before; no
panel logged an error (`shots.json`). Every baked-light panel is within 0.1 to 1.5 of its `after-figures/` brightness (the shadow
darkens a few floor cells), so the room's own ratios in [`../after-room/`](../after-room/README.md) stand.

## The measure

The builder's shadow, measured by drawing its frame twice (`look.figureShadow` 0.6 and 1, EnvironmentBuilder `f7c5356` with
FigureBuilder `23f889c`; `spikes/builders-look/eb-shadow-probe.ts`) and counting the texels that are not a figure's and differ:

| Scene | View | Footprint (texels) | Darkening (luma on over off) |
|---|---|---|---|
| base-interior | diorama | 1223 | 0.61 |
| base-interior-dressed | diorama | 1141 | 0.61 |
| base-exterior | diorama | 1422 | 0.64 |
| base-exterior-dressed | diorama | 1422 | 0.63 |
| base-exterior | fp | 46 | 0.64 |
| base-exterior-dressed | fp | 46 | 0.63 |
| both interiors | fp | 0 | 1 (the pair's feet are out of the frame) |

Ours is `SHADOW_ONLY=1 node spikes/builders-look/shoot.mjs … figures=painted` (`shadow.json`): the same count, between the frame with
the shadow on and with `shadow=0`, over the texels the shadow darkens and the scene does not move by itself between two page loads (a
leaf's sway: a texel that differs between two loads of the shadow-on frame is left out, and a texel that is brighter with the shadow on
cannot be shadow).

**The street's missing shadow was the spike's wiring, not the framework.** The first run found 185 texels in the street's diorama and 239
in first person with a luma ratio above 5: no shadow. The cause (found by reading the room's planes, then a unit check): the spike stood
each figure at y 0 (`at[2] ?? 0`) while the street's pavement plane is at 0.12 m, which is exactly `floorReach`, and the rule is `< 0.12`
(the builder's `onFloor`), so no floor cell passed; with the feet at 0.12 the same cast marks 210 cells, at 0 none. EnvironmentBuilder
stands a sprite at its sector's floor (`at[2] ?? floorAt`), so the spike now does too (`feetOf` in `spikes/eb-look/scene.ts`), and a unit
case in `figure-shadow.test.ts` fixes the rule (a figure on the pavement casts; one at the road's level, 0.12 m under it, is not on it).
The interiors' floors are at 0, which is why the contact ellipse showed there.

Measured after the fix (the numbers the run got to; the rest are for the next session to take with the same command):

| Scene | View | Builder: footprint / darkening | Ours: footprint / darkening |
|---|---|---|---|
| base-exterior | diorama | 1422 / 0.64 | **1357 / 0.69** (the run before the count kept only darkened texels; noise 2979) |
| base-interior | diorama | 1223 / 0.61 | **673 / 0.606** |

The street is the builder's within 5% in footprint and 0.05 in darkening. The interior's footprint is 55% of the builder's, at the
builder's darkening: the contact ellipse alone, and not yet explained (the count leaves out the figures' own pixels in both frames, and the
two figures stand 1.2 m apart, so the ellipses do not overlap). The next session reads the builder's `shadowOf` for the interior (`stage/cast.ts`) against `figure-shadow.ts` to see where the other 550 texels are.
Not measured yet: the
street's first person, both dressed scenes, and the interiors' first person (the builder's footprint there is 0: the feet are out of frame).

## What the sheets show

- The interiors' dioramas: a dark contact ellipse under each pair's feet and nothing more (the lamp is a pendant: no sun), as the
  builder's.
- The street's diorama (and the gameplay and room views of `../after-sizes/`): the pair throw the sun's shadow along the pavement
  to the right, as the builder's do.

## Named differences

1. **A core mesh figure casts no shadow yet.** The shadow is a painted figure's: it is cast from the cell's silhouette (the kit
   hands `SceneLight.shadows` the cell), so a game's mesh `figure()` in `@automata/3d` stands on the floor without one. The mesh
   figure has no silhouette in the picture to cast; giving it one is its own task (a mesh could cast from its rig's projected
   bounds, or from the contact ellipse alone).
