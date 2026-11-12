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

## Exposure: how the figures read against their rooms (task 8)

[`reads.json`](reads.json) holds, for the baked-light panel of every scene and view, how each figure reads against its ring of 3
texels, with the world kit's own `figureReads` (`extensions/world-kit/src/features/reads/figure-reads.ts`, run by
`shoot.mjs` as it is). A figure's texels are the pixels that differ between the frame and the same frame with `cast=0`, with the
cast shadow switched off (`shadow=0`), so the floor is not counted in them. `hot` is the builder's rule (figure luma over
over `1.1 ×` its ring's, `HOT`), `reads` its edge at least 1.1 (`MIN_EDGE`). Runs under 500 texels are the scene
differing between the two page loads (a leaf), not figures. In the gameplay and room-view frames the pair overlap and are one run.

**Superseded (item 4 of the close of the branch).** This table's gameplay and room (`zone`) rows were shot with a fault in the survey tool (the
camera and haze followed `cast[0]`, which is empty under `cast=0`, so the frame without the figures was a different frame, and the pair
were read as one run); its counts (22 runs, 15 hot) are not the final state. The final state, with the trial exposure, is in
[`../after-exposure/reads.json`](../after-exposure/README.md): **24 runs, 11 hot, every one reading**.

| Scene | View | Texels | Figure luma | Ring luma | Figure over ring | Edge | |
|---|---|---|---|---|---|---|---|
| base-interior | diorama | 3800 | 0.404 | 0.236 | 1.71 | 1.90 | hot |
| base-interior | diorama | 3148 | 0.284 | 0.252 | 1.13 | 1.43 | hot |
| base-interior | fp | 9265 | 0.395 | 0.190 | 2.08 | 1.91 | hot |
| base-interior | fp | 4319 | 0.260 | 0.169 | 1.54 | 1.65 | hot |
| base-interior | gameplay | 18312 | 0.231 | 0.179 | 1.29 | 2.99 | hot |
| base-interior | zone | 43752 | 0.212 | 0.170 | 1.25 | 3.16 | hot |
| base-interior-dressed | diorama | 3584 | 0.406 | 0.283 | 1.43 | 2.50 | hot |
| base-interior-dressed | diorama | 2837 | 0.283 | 0.290 | 0.98 | 2.08 | ok |
| base-interior-dressed | fp | 9181 | 0.398 | 0.205 | 1.94 | 2.18 | hot |
| base-interior-dressed | fp | 4049 | 0.261 | 0.208 | 1.25 | 2.20 | hot |
| base-interior-dressed | gameplay | 17958 | 0.235 | 0.178 | 1.32 | 3.25 | hot |
| base-interior-dressed | zone | 42733 | 0.218 | 0.173 | 1.26 | 3.46 | hot |
| base-exterior | diorama | 3292 | 0.443 | 0.484 | 0.92 | 3.51 | ok |
| base-exterior | diorama | 2854 | 0.347 | 0.512 | 0.68 | 3.13 | ok |
| base-exterior | fp | 5871 | 0.417 | 0.504 | 0.83 | 1.74 | ok |
| base-exterior | gameplay | 34666 | 0.438 | 0.372 | 1.18 | 2.36 | hot |
| base-exterior | zone | 41152 | 0.481 | 0.417 | 1.15 | 3.12 | hot |
| base-exterior-dressed | diorama | 3304 | 0.445 | 0.487 | 0.91 | 3.06 | ok |
| base-exterior-dressed | diorama | 3001 | 0.354 | 0.444 | 0.80 | 2.53 | ok |
| base-exterior-dressed | fp | 5863 | 0.418 | 0.500 | 0.84 | 1.98 | ok |
| base-exterior-dressed | gameplay | 35022 | 0.428 | 0.372 | 1.15 | 2.31 | hot |
| base-exterior-dressed | zone | 41539 | 0.469 | 0.422 | 1.11 | 3.14 | hot |

**Every figure reads** (edge 1.43 to 3.51, the builder's window needs 1.1). **15 of the 22 are hot**: every interior figure
but one, 1.13 to 2.08 times its ring (the fp man under the pendant 2.08, the diorama man 1.71), and the exterior's gameplay and
room-view frames (1.11 to 1.18). The exterior's diorama and first-person frames are not hot (0.68 to 0.92): by day the street
is as bright as the figures.

**Decision: task 9 runs.** #607's hold (a figure is never lit above its painted cell, and taken down by the room's *light*
against its ring's light) does not meet the builder's window in a dim room, because the window is about *luminance*: a
figure's skin and cloth are lighter than the dark floor and wall round it at the same light. Reading that needs the room's
pixels behind the figure, which the kit does not have; see the plan's log for what task 9 therefore needs.
