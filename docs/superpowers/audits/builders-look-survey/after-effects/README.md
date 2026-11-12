# The effects branch's sheets (`claude/builders-look-effects`)

Shot on the branch's state after #590 and #588 were merged (and task 10a), Chromium on software WebGL (`--use-angle=swiftshader`),
the builders' own frames from [`../builders/`](../builders/) (EnvironmentBuilder `f7c5356`). **Group 3 is not finished: see "Not done" below.**

## 1. The slabs (task 10a)

[`base-interior-dressed-zone-640x480.png`](base-interior-dressed-zone-640x480.png): the dressed interior's room view at 640 x 480
(the old game's picture), left density 1 whole pixels a texel, right true size, painted pair, `?still=1&rig=1`. The three dark
rectangles of [`../after-exposure/base-interior-dressed-zone-640x480.png`](../after-exposure/base-interior-dressed-zone-640x480.png)
are gone, and what they hid shows (the bin, the desk with its book and paper). `?rig=1` (new in the spike) runs the occluder rule once,
as a game's camera rig does each frame; the spike has no rig of its own, so without it the near wall's fixtures stay drawn.

## 2. The day sheets with every effect off (task 12, step 2)

`node spikes/builders-look/shoot.mjs after-effects builders 'figures=painted&fx=0'`: the 16 sheets of [`../after-figures/`](../after-figures/README.md)
again. The plan's bound: each panel within 2.0 in mean brightness of `after-figures/shots.json`.

**39 of 40 panels are within 1.6; one is not: `base-interior-fp.png`, the baked panel, 53.9 to 50.4 (-3.5).** The cause is group 2's
exposure, not an effect: the kit at `6eb8ca1e` (before the exposure's probe and trial) drawn with this branch's spike in the same
view and `still=1` gives 53.7 (`after-figures/` was shot before exposure was built), the kit as it is gives 50.3, and the same
view with the mood grade pass taken out (`?grade=0`) is pixel for pixel the same frame as with it (50.33 both), so neither the
merged passes nor the wall fixtures (not registered with the occluders in first person) move it. No panel logged an error.

| Sheet | Panel | `after-figures/` | now | change |
|---|---|---|---|---|
| [`base-interior-diorama.png`](base-interior-diorama.png) | EnvironmentBuilder's CPU frame | 50.8 | 50.8 | +0.0 |
| [`base-interior-diorama.png`](base-interior-diorama.png) | AF main, baked room light | 45.5 | 44.9 | -0.6 |
| [`base-interior-diorama.png`](base-interior-diorama.png) | AF main, material light only | 44 | 43.9 | -0.1 |
| [`base-interior-fp.png`](base-interior-fp.png) | EnvironmentBuilder's CPU frame | 47.8 | 47.8 | +0.0 |
| [`base-interior-fp.png`](base-interior-fp.png) | AF main, baked room light | 53.9 | 50.4 | -3.5 |
| [`base-interior-fp.png`](base-interior-fp.png) | AF main, material light only | 52.7 | 52.8 | +0.1 |
| [`base-interior-gameplay.png`](base-interior-gameplay.png) | AF main, baked room light (50 mm, 30°, 16 m) | 48.1 | 47 | -1.1 |
| [`base-interior-gameplay.png`](base-interior-gameplay.png) | AF main, material light only (50 mm, 30°, 16 m) | 49.2 | 49.2 | +0.0 |
| [`base-interior-zone.png`](base-interior-zone.png) | AF main, baked room light (the room's view) | 51 | 49.4 | -1.6 |
| [`base-interior-zone.png`](base-interior-zone.png) | AF main, material light only (the room's view) | 50.8 | 50.7 | -0.1 |
| [`base-interior-dressed-diorama.png`](base-interior-dressed-diorama.png) | EnvironmentBuilder's CPU frame | 50.7 | 50.7 | +0.0 |
| [`base-interior-dressed-diorama.png`](base-interior-dressed-diorama.png) | AF main, baked room light | 44.2 | 44.1 | -0.1 |
| [`base-interior-dressed-diorama.png`](base-interior-dressed-diorama.png) | AF main, material light only | 44.6 | 44.7 | +0.1 |
| [`base-interior-dressed-fp.png`](base-interior-dressed-fp.png) | EnvironmentBuilder's CPU frame | 48.2 | 48.2 | +0.0 |
| [`base-interior-dressed-fp.png`](base-interior-dressed-fp.png) | AF main, baked room light | 52.7 | 52.6 | -0.1 |
| [`base-interior-dressed-fp.png`](base-interior-dressed-fp.png) | AF main, material light only | 50 | 50.3 | +0.3 |
| [`base-interior-dressed-gameplay.png`](base-interior-dressed-gameplay.png) | AF main, baked room light (50 mm, 30°, 16 m) | 48.1 | 48.1 | +0.0 |
| [`base-interior-dressed-gameplay.png`](base-interior-dressed-gameplay.png) | AF main, material light only (50 mm, 30°, 16 m) | 50.2 | 50.2 | +0.0 |
| [`base-interior-dressed-zone.png`](base-interior-dressed-zone.png) | AF main, baked room light (the room's view) | 51.3 | 51.3 | +0.0 |
| [`base-interior-dressed-zone.png`](base-interior-dressed-zone.png) | AF main, material light only (the room's view) | 53.7 | 53.8 | +0.1 |
| [`base-exterior-diorama.png`](base-exterior-diorama.png) | EnvironmentBuilder's CPU frame | 123.2 | 123.2 | +0.0 |
| [`base-exterior-diorama.png`](base-exterior-diorama.png) | AF main, baked room light | 106.1 | 105.7 | -0.4 |
| [`base-exterior-diorama.png`](base-exterior-diorama.png) | AF main, material light only | 39.6 | 39.7 | +0.1 |
| [`base-exterior-fp.png`](base-exterior-fp.png) | EnvironmentBuilder's CPU frame | 129.3 | 129.3 | +0.0 |
| [`base-exterior-fp.png`](base-exterior-fp.png) | AF main, baked room light | 121.7 | 121.7 | +0.0 |
| [`base-exterior-fp.png`](base-exterior-fp.png) | AF main, material light only | 97 | 97.2 | +0.2 |
| [`base-exterior-gameplay.png`](base-exterior-gameplay.png) | AF main, baked room light (50 mm, 30°, 16 m) | 101 | 100.9 | -0.1 |
| [`base-exterior-gameplay.png`](base-exterior-gameplay.png) | AF main, material light only (50 mm, 30°, 16 m) | 43.9 | 44.2 | +0.3 |
| [`base-exterior-zone.png`](base-exterior-zone.png) | AF main, baked room light (the room's view) | 114.7 | 114.3 | -0.4 |
| [`base-exterior-zone.png`](base-exterior-zone.png) | AF main, material light only (the room's view) | 51.1 | 51.2 | +0.1 |
| [`base-exterior-dressed-diorama.png`](base-exterior-dressed-diorama.png) | EnvironmentBuilder's CPU frame | 121.5 | 121.5 | +0.0 |
| [`base-exterior-dressed-diorama.png`](base-exterior-dressed-diorama.png) | AF main, baked room light | 105.1 | 104.7 | -0.4 |
| [`base-exterior-dressed-diorama.png`](base-exterior-dressed-diorama.png) | AF main, material light only | 41 | 41.1 | +0.1 |
| [`base-exterior-dressed-fp.png`](base-exterior-dressed-fp.png) | EnvironmentBuilder's CPU frame | 128.6 | 128.6 | +0.0 |
| [`base-exterior-dressed-fp.png`](base-exterior-dressed-fp.png) | AF main, baked room light | 121.2 | 121.1 | -0.1 |
| [`base-exterior-dressed-fp.png`](base-exterior-dressed-fp.png) | AF main, material light only | 96.9 | 97.2 | +0.3 |
| [`base-exterior-dressed-gameplay.png`](base-exterior-dressed-gameplay.png) | AF main, baked room light (50 mm, 30°, 16 m) | 99.5 | 99.4 | -0.1 |
| [`base-exterior-dressed-gameplay.png`](base-exterior-dressed-gameplay.png) | AF main, material light only (50 mm, 30°, 16 m) | 44.1 | 44.4 | +0.3 |
| [`base-exterior-dressed-zone.png`](base-exterior-dressed-zone.png) | AF main, baked room light (the room's view) | 112.8 | 112.4 | -0.4 |
| [`base-exterior-dressed-zone.png`](base-exterior-dressed-zone.png) | AF main, material light only (the room's view) | 51.4 | 51.5 | +0.1 |

## 3. The effects at night (task 12, step 3)

[`night/`](night/): the base exterior (and the dressed street, if its sheet is here) at night, EnvironmentBuilder's own (day) frame, then
AF with no effects, with the effects (shafts), and with the coloured outline ([`night/base-exterior-diorama.png`](night/base-exterior-diorama.png)).
- **A street lamp's shaft**: a warm cone on the wall in whole steps and a dither, with the brick showing through; the builder's day
  frame has none (it has no night frame).
- **The coloured outline**: the near shape's own deep step round the figures, post and bin, a step lighter on the key's side.
- The figures here are core mesh figures (the spike's default); `figures=painted` was not used in these.

## 4. LCD panel and retro grade at the old game's picture sizes

No sheet yet. They are tested in real Chromium pixels at 640 x 360 and 640 x 480
(`extensions/lcd-panel/tests/browser/lcd-field-sizes.test.ts`, `extensions/retro-crisp/tests/browser/retro-field-sizes.test.ts`): the LCD mesh and stripes
show over a flat colour at both, a zeroed panel and the neutral retro profile leave the picture alone, the clinic's grade moves it and the snap
puts every colour back on the palette. The clinic's numbers match the old game at `92e6704` (`src/render/lcd-panel.ts` `LCD_PANEL`, `LCD_CELL` 2;
`src/render/look.ts` `POST.fade` and `POST.grade`). **Reduced motion**: the retro pass's film (grain, dust, scratch) and the world kit's
moving passes (stars, rain, particles, shafts) now hold still under `prefers-reduced-motion` (a game's own setting through
`addRetroPass({ reducedMotion })`); the LCD panel has no motion. Unit cases seen failing first (`film-clock`, `pass-clock`) and a browser case that fails
when the wiring is cut (seen).

## Named differences (what is left of the survey's eleven, with this branch's state)

4. **Windows are flat blue by day: still there, and not a pass.** The builder's reflection streaks are the swatch's own pattern, not a reflective
   pass: `glassDay` has `pattern: { kind: "glass", size: [1.3, 0.09], step: 2 }`, which EnvironmentBuilder's `paint/paint.ts` (`case 'glass'`) paints per
   texel as diagonal stripes (`fr(u * 0.9 + v * 0.7, 1.3)` under 0.09, and between 0.144 and 0.189, a step lighter). AF's `swatches.json` carries
   the same `pattern`, and nothing draws it (a pane is one flat step). The way to build it is an albedo tile for a swatch with a `glass` pattern in
   the world kit (a 1.44 x 1.86 m tile repeats the stripe exactly), laid on the pane the way `tileUvs` lays a photo tile. Not built.
10. **The green veil off the room**: unchanged, the sky pass's lowest band ([`../after-room/README.md`](../after-room/README.md), difference 10).
- **The interiors' man still reads hot in some views** and **a lamp-lit room casts no silhouette from its key lamp** (group 2's, [`../after-exposure/README.md`](../after-exposure/README.md)).

## Not done (where the next session resumes)

1. A sheet for each effect beside the builder's own (the dressed street at night with painted figures; reflections and particles need a wet ground and an emitter in
   the spike, which has neither; the LCD panel and the retro grade at 640 x 360 and 640 x 480 from `examples/3d/lcdpanel` and `retrocrisp` with `spikes/tll-extensions/shoot.mjs`).
2. The day panes' streaks (above), if the coordinator wants them built.
3. The close: `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, `pnpm exec changeset status` (every changed package is private; the
   letterbox's changeset came with #588), `origin/main` merged, the whole `pnpm check`, the Chromium suites for 3D, world-kit, character-kit, lcd-panel, retro-crisp and
   the 3D journeys.
