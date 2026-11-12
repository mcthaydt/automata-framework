# The Last Light, session 15: the painter's density-2 Ada in play

The Owner, 2026-11-12: the characters should look like the painter's density-2 faces (bold brows two texels thick, eyes with whites under a dark
lid, a nose, a mouth, chunky clean pixels), and the camera, the field, the room's scale and the figure's size are free to change to get it in play.
Chromium on software GL (SwiftShader, `AF_WEBGPU=software`), 1024 by 768 for game frames (a field of 512 by 384 shown at 2x). WebKit, Firefox and a
real GPU did not run. The reference (FigureBuilder's `eye-swap.png`) is not committed: it is described, never copied.

## Item 1, the reference reproduced

`item1-base-pair-d2-head-x10.png`: the painter's base man and woman, front, head and shoulders, density 2, x10 nearest, drawn by this repository's
painter. The faces match the record's "after the swap" feature for feature (two-texel brows, a dark lid, whites at the corners, an iris, an under-eye
shadow, a lit nose bridge, lip rows). The record's pinned commit (`23f889c8`) could not be fetched into a shallow clone; the same file at FigureBuilder's
HEAD (`c29284c`) was compared.

## Item 2, Ada standing alone, plain (no room light, no passes)

`item2-adopted-head-x10.png`, `item2-adopted-body-x4.png` (base man, base woman, Ada); `item2-head-x10.png`, `item2-body-x4.png` add today's
(session 14's) Ada and two intermediate faces; `item2c-cast-*.png` is the cast file as committed after the coordinator's review of round 1 (the eyes were asleep: eye size .8 and hood .05 closed them; now the base man's lid with the base woman's eye size, hood .15, lips .9). Made by `extensions/character-kit/scripts/ada-density2.ts`.

Ada is the base woman's data with her skin (`skinWarm`), the painter's `bobFringe`, her clothes and a bolder lid and brow (brow weight .75, crease .6,
hood .15, liner .5, lips .9; eye size the base's); her body sliders are the base woman's slimmed a little (fat .25, hips .55, arms .3, chunk .6); 160 cm is 124 rows
in the 128 by 192 cell. No painter or kit code changed.

## Item 3, the camera

| | before (session 14) | now |
| --- | --- | --- |
| lens, the 24 mm gate | 50 mm | **79 mm** (a view's own `lensMm`) |
| distance, tilt | 16.6 / 16 / 15 m, 30 degrees | 16.6 (hall) / 16.8 / 16.8 m, 30 degrees |
| field | 512 by 384, 2x | the same |
| follow | the hall fixed (`follow` 0.12), the others locked on | locked on in all three, with a lead of 1.5 m (hall, corridor) and a focus box per view |
| figure | density 1, a texel 1.4 field pixels (`crisp: false`) | **density 2, a texel one field pixel (`crisp: true`)** |
| Ada on the screen | about 87 field pixels tall | **about 124 field pixels (the cell's 124 rows), 248 screen pixels at 2x** |
| the room across, floor depth | 10.6 by 15.9 m | **6.9 by 10.4 m** (field pixels a metre at her feet: 74, was 52) |
| a density-2 texel | not used in play | exactly 1 field pixel, 2 screen pixels |

Why these numbers: a density-2 texel is one field pixel when the camera's zoom at her feet is 2 (74 field pixels a metre; the painter's cell is 96 rows
for 2.6 m at density 1). On a 24 mm gate the lens that gives it at 16.6 m is 79 mm, so the lens carries the scale and the walls and the room's haze stay
where the level put them. `crisp` placement keeps a texel whole at any depth; it rounds the zoom so her size does not change as she walks nearer or
farther (the room's floor does, by about 17 % over the hall's depth: the cost of a whole-pixel figure in a perspective room).
`tests/unit/app/camera-rules.test.ts` pins the zoom at her feet to 2 within 3 % in every view.

What the camera needed for the narrower view (new, generic, opt-in in `@automata/3d`'s views, defaults unchanged):
- `lensMm`: a view's own lens.
- `focusBounds`: a floor rectangle that a locked-on look stays inside, so the camera stops at a room's edge and Ada walks on across the frame. The hall's is
  x -2.2..1.9, z -0.4..4.4, which keeps her whole on screen from the south wall to the end of the ward bay; the corridor's is nearly fixed (the whole corridor
  fits the frame with her feet 25 px from the bottom and her head 26 px from the top at its two ends); the closet's is one point.
  The numbers come from projecting her feet and her 124-row sprite through the camera for the room's extremes.
- `lead`: the look runs ahead of a walking Ada by up to 1.5 m, eased in and out over half a second, so the doorway she walks to is on screen before she reaches it.
- Why the earlier `follow` 1 attempt "refused to boot": it did not; the level boots with `follow` 1 on the hall (shot here). The study patch that tried it was
  at fault, not the level.

Frames: `item3-play-spawn.png` (the spawn, her back to us), `item3-play-hall-south.png` (the south wall, facing us), `item3-play-hall-east.png` (the east wall).
Not yet checked: the corridor and closet at their ends in play (the walk could not reach them in one run), the cutscenes at the new lens (item 5).

## Honest verdict on the face in play (item 3's frame)

`item3-play-hall-south.png`: she is the right size and her silhouette, hair, shirt and waistcoat read; at x4 her brows, her eyes' whites and a nose can be found, but
**her face does not yet read like the reference**: the skin is a dark olive gold (the room's green light and the grade), the LCD mesh crosses every texel, and the
mouth is lost. Item 4 is that.
