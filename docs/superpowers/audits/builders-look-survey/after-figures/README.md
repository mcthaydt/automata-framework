# The painted base pair in the four base scenes

Task 7 of [the plan](../../../plans/2026-11-11-builders-look.md), `claude/builders-look-figures`, on `main` `a024bc4b` with
#607 merged (`ce5d8891`): FigureBuilder at `23f889c`. Shot with

```sh
node spikes/builders-look/shoot.mjs docs/superpowers/audits/builders-look-survey/after-figures \
  docs/superpowers/audits/builders-look-survey/builders figures=painted
```

Each sheet is the builder's own frame, then the framework's baked-light panel, then the framework with material light only
(the gameplay and room-view sheets have no builder frame: the builders draw no such view). In the framework's panels the cast
is the kit's `paintedFigure(BASE[0].def)` (the man) and `paintedFigure(BASE[1].def)` (the woman), standing and turned as the
level places them, lit by the room (`?figures=painted` in `spikes/eb-look/scene.ts`). This is the set before a figure's cast
shadow exists; the set after it is in [`../after-shadow/`](../after-shadow/README.md). `shots.json` holds each panel's mean
brightness (0 to 255) and colour count; no panel logged an error.

## What reads the way the builder's pair does

- **The flat light follows the room.** Under the pendant the interior pair are warm and dim (mean luma of the baked panels
  45.5 to 53.9 against the builder's 47.8 to 50.8 over the whole frame); in the street by day they take the sun's colour and
  stand at the pavement's brightness. The exterior diorama is 106.1 against the builder's 123.2 (the room's own ratio, 0.86,
  as in [`../after-room/`](../after-room/README.md): the figures moved the interior panels by up to +5.4 and the exterior
  ones by at most +2.1).
- **The form and the rim.** A one-step form shows on the near arm and the chest, and the arm's edge on the lamp's side takes
  the lighter step: orange down the man's right arm and the woman's shoulder in the interiors' first-person sheets, as in
  the builder's frames (`base-interior-fp`, `base-interior-dressed-fp`).
- **Depth.** In these framings the pair stand clear of the walls, the tree, the table and the bin, so no sheet shows a wall
  or a chair hiding texels behind it; that cut is held by the kit's own test (`painted-lit`, "lit behind a wall": 0 pixels
  differ from `compose`), not by a picture here. No halo or cut-out edge shows against the tree or the wall.
- **Dressed and bare scenes agree.** The `-dressed` sheets differ from the bare ones by the dresser's props only; the pair
  light the same.

## What differs, each named

1. **No cast shadow.** The builder's pair stand in their own sun shadow on the pavement (`base-exterior-diorama`: the sheared
   bands going right from the feet; the contact ellipse in the interiors); ours stand on the bare floor. Built in the next
   task of this branch, and measured in `after-shadow/`.
2. **A painted figure is never minified.** In the gameplay and room-view sheets (50 mm, 30°, 16 m on a 320 × 180 field) each
   painted texel is at least a pixel, so the pair stand about three times as tall as they should and the man's head is cut
   by the top of the frame. That is the kit's crisp rule (`place.ts`: `scale = max(1, round(zoom / density))`), not the light;
   a game that draws painted figures at a camera this far picks a larger field or the painter's `density: 1`. The prologue's
   dressing task has to choose; the builders' frames have no such view to compare with.
3. **Figures read a little brighter against a dim room than the builder's.** In the interior first-person sheets the woman's
   dress and the man's vest are lighter and browner than the builder's grey vest and dress; their shape and edge read. The builder trims a
   figure's flat light by a trial composite (`view/expose.ts`); #607 holds a figure at its painted cell and no higher. Whether
   that holds against the builder's exposure window is task 8's measure ([`reads.json`](reads.json)).
4. **The room frames are the room's.** Differences in the walls, the floor's pool of light, the sky and the haze are
   [`../after-room/`](../after-room/README.md)'s and are not repeated here.
