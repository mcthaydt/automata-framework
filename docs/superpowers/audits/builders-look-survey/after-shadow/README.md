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

**The first counts were contaminated, by the figures themselves.** The painted figures' pose clock is the page's, so a figure's edge moves
between two page loads; the count (texels two frames do not share, a darker half kept) took half of that jitter for shadow, and the
"noise" third load did not remove it (it removes only what the third load differs in). `?still=1` now holds the pose clock at 0
(`spikes/eb-look/scene.ts`), `SHADOW_ONLY` adds it, and the noise is 0 in every run below (it was 382 in the interior, 1568 in the street).
The footprints in the earlier text (185, 239, 673, 1357) are superseded.

Measured with it (`SHADOW_ONLY=1 SHADOW_FRAMES=1 VIEWS=diorama SCENES=base-interior,base-exterior … figures=painted`, `shadow.json`):

| Scene | View | Builder: footprint / darkening | Ours: footprint / darkening |
|---|---|---|---|
| base-exterior | diorama | 1422 / 0.64 | **1327 / 0.575** (93%) |
| base-interior | diorama | 1223 / 0.61 | **286 / 0.564** (23%) |
| base-interior | diorama, the builder's `shadow: false` | 271 / 0.61 | 286 / 0.564 (**106%**) |

## The interior's footprint: a named difference, with its cause

The builder's interior is 4.3 times ours, and it is not the shadow's rule:

1. **The rule is the builder's.** For the same cell (a 64 x 96 silhouette, 73.8 texels a metre, 18°, the same sun) the builder's `shadowOf`
   marks 256 texels for the contact ellipse and 2416 for the silhouette; `castShadow` marks the same area, 255 and 2366 screen texels (a
   unit case in `figure-shadow.test.ts` keeps it, with the builder's numbers). The street's footprint is 93% of the builder's.
2. **What differs is when the silhouette is cast.** The builder casts it when the time's `shadow` is true, along the time's key (by default the
   figures' own painted key, `FIGURE_KEY`), whether or not there is a sun: `castShadow = time.shadow` in `view/render.ts`, `key = keyOf(time)`.
   The interior's time is `lampLit` (`shadow: true`, no sun). With the builder's own frame drawn again with the time's `shadow` set to false
   (`eb-shadow-probe.ts`, the time as `{ preset: 'lampLit', shadow: false }`) its interior footprint falls from 1223 to **271**, and ours is 286.
   The 952 texels between are the silhouette thrown along the painted key.
3. **Ours casts a silhouette only under a sun that casts** (`createFigureShadows`: `lighting.sun?.shadow === true`), and a lamp-lit room has none.

This is kept as a named difference, not tuned: a figure shadow along the figure's own painted key in a room lit by a lamp puts the shadow where
no light of the room is (the key is the painter's, not the room's), and adopting it would move every interior frame with the shadow on, which
is a decision for the Owner, not a measure to match. The darkening is 0.05 darker than the builder's in each scene (0.564 against 0.61, 0.575
against 0.64): the multiplier is the same 0.6, and the framework's steps and dither take it a little further.

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
