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
the shadow on and with `shadow=0`, leaving out texels the scene moves by itself between two page loads (a leaf's sway).
**Not complete, and a finding.** A first run counted the leaf's sway as shadow (footprint 1333, darkening 12: texels that differ between
two loads brighten as often as they darken). The script now leaves out the texels two loads of the shadow-on frame do not share, and
the street's rerun (`shadow.json`) reads: **diorama 185 texels, first person 239, with a mean luma ratio of 5.5 and 4.7**. A shadow
darkens (a ratio near 0.6, the builder's), so these texels are not shadow: they are what is left of the scene's own movement. **That
is, no measurable cast shadow in the street's two frames, against the builder's 1422 and 46 texels.** The interiors are not measured
(about a minute a shot on software GL; 24 shots), but the interior diorama sheet shows a contact ellipse by eye. This is the first
thing the next session looks at: the first session's tests (a floor under a sun, in a fixture room) pass, so what differs in the
street is in its content (its floor's planes at the feet's height within `floorReach`, or the sun's `lowSun` rule, or the shadow
not being added for the kit's figure in the base scene's renderer). Not accepted as measured; not a pass.

## What the sheets show

- The interiors' dioramas: a dark contact ellipse under each pair's feet and nothing more (the lamp is a pendant: no sun), as the
  builder's.
- The street's diorama: the builder's pair stand in the sun's sheared bands going right from the feet; ours show no shadow on the
  pavement by eye, and the measure above agrees (nothing darkens). A defect to find, as above.

## Named differences

1. **A core mesh figure casts no shadow yet.** The shadow is a painted figure's: it is cast from the cell's silhouette (the kit
   hands `SceneLight.shadows` the cell), so a game's mesh `figure()` in `@automata/3d` stands on the floor without one. The mesh
   figure has no silhouette in the picture to cast; giving it one is its own task (a mesh could cast from its rig's projected
   bounds, or from the contact ellipse alone).
