# The Last Light against the old game, round three (stage 4 session 10, 2026-11-12)

Chromium on software GL (SwiftShader), 1024 by 768. The old game's frames are the earlier sessions' real-play captures of `92e6704` (no `?debug`, Begin clicked); ours are
shot by `games/the-last-light/tests/e2e/shots.test.ts` (new: `AF_SHOOT=<folder> AF_SHOOT_AT='opening:5,8;lightsOut:10'`, a named cutscene at named sim seconds). WebKit, Firefox and a
real GPU did not run: the new shader arithmetic is unproven there.

## Item 2: cutscene facing (framework defect in the game's figure view)

`figure-view.ts` handed a cutscene's `facing` to the painted figure as it was, skipping `kitYaw` (the half turn between the sim's heading, 0 = +z toward the play camera, and the kit's yaw 0, -z). Every scripted facing was half a turn off: the nurse's back in lights-out, Ada's back in shot D. `tests/unit/features/figures/cutscene-facing.test.ts` drives the actor's `place` and reads where the face points (red on 0 and pi, then green); the nurse's data patch (pi) is out and her keys are the old script's 0 again. Not done: a frame-by-frame check of every cutscene against the old game (the nurse in lights-out was checked, below).

## Item 3: the opening's close shot

[`strip-item3-opening-close-old-before-after.png`](strip-item3-opening-close-old-before-after.png): old, ours before, ours after (t = 8 s). **Cause:** `occluderHooks` read the camera rig's pose while a cutscene writes `view.camera` itself, so the south wall stayed cut for the play camera. **Fix:** the hook takes the camera that is *drawing* (`drawing` option, `Pixi3dCameraOptions.drawing`; the look point stands for the player), and a hand-over is a cut. Chosen over "walls whole in cutscenes" because a shot from outside a room still wants the wall between it and its subject cut.

## Items 4 and 6: contact shadow on lamp light, the dither's weight, the grade's place

[`strip-item4-6-play-old-before-contact-grade.png`](strip-item4-6-play-old-before-contact-grade.png): old, ours at the end of session 9, ours with the contact opt-in, ours with it and the dither/grade options. Mean luma / hue of the same rectangles as session 9 (old / session 9 / contact / contact + dither + grade):

| Region | Old | S9 | Contact | + dither, grade |
|---|---|---|---|---|
| floor (250 560 450 700) | 44.5 | 44.7 | 43.7 | 43.1 |
| east wall (690 110 880 300) | 41.6 | 55.9 | 53.7 | 54.6 |
| west wall (0 170 110 400) | 24.6 | 30.0 | 29.8 | 29.8 |
| lamp pool (740 340 840 440) | 63.2 | 90.4 | **73.4** | 72.9 |
| far dark (390 120 580 260) | 35.6 | 25.5 | 24.4 | **29.3** |

The framework's bake already had the old contact shade (same constants) but applied it only to ambient, key and fill; the old multiplies its whole light. `SceneLighting.contact` (strengths as parameters, `lamps` the share lamp light takes, default 0) is the opt-in; the game sets 1. It takes the pool from 90 to 73 (old 63). **What else closes it:** the light space. The old multiplies *linear* albedo by light and shows the product raw; the framework's `srgb` light multiplies the sRGB colour, so a bright pool compresses less than the old's (session 8's proposal; the `lamps = 0.7` stopgap is calibrated on the dim floor). Not built.

[`item6-bench-shadows-2x-old-before-after.png`](item6-bench-shadows-2x-old-before-after.png) (2x nearest; the left panel is only a rough old crop): the middle is before (black speckle in the shadow under the bench), the right is after (`lumaWeight` 0.5, `shadowTaper`, the grade after the snap): smooth. The cost of `after-snap`: the final frame is no longer strictly DUEL (the old frame was not either). B is the coordinator's call, open to the Owner's correction; reverting is one line (`gradeAt` in `app/look-passes.ts`).

## Item 5: lights-out, properly dark

[`strip-item5-lights-out-old-before-after.png`](strip-item5-lights-out-old-before-after.png) (old, before, after, t = 10 s). **Cause:** the lights-out cutscene keys only the five lamps the old script names; every other lamp burned as the level lit it (the exit lamp at 1.25 beside the far wall, the old dress has 0.95; the cool fills at full), so the corridor was a lit green room. The stage now lays `content/lights-out.toml` under the scene's keys while that cutscene plays, and the file gained `dim` (every burning lamp takes that share more; 0.4: the same light-space difference makes a wall beside a lamp too bright). Mean luma old / before / after: left wall 27.0 / 44.1 / **27.0**; right wall 26.4 / 53.2 / 33.3; back wall above the door 42.6 / 93.8 / **45.7**; floor 33.9 / 41.7 / 31.0; the nurse's box 41.0 / 44.5 / **40.9** (she follows the floor ring, which is now dark: nothing extra needed); whole frame 32.4 / 43.9 / 28.3. **Not done:** the window's glass is still a bright cyan: a swatch named in the level's window `glass` (a dim violet) changed nothing, so the cyan is not that swatch (unread cause; the sky or the moon patch are next to read); the old EXIT's warm halo ring; the bars top and bottom of the old's cutscene letterbox (the proposal "bars per cutscene" is listed).

## Item 7 (the table owed) and item 8: not done, and what is known

Surfaces the level uses, by swatch (count of uses): `crateWood` 23 (kit photograph `planks`: photo-made), `ward-wainscot` 17 (the kit's wall-tile photograph, but the old's cream glazed tile on a dark joint is not in the library: **the photo needed is a cream glazed wall tile, about 15 by 15 cm tiles with a 2 mm dark-grey joint, flat even light, square-on, at least 1 m of wall**), `linen` 9 (flat sand step 6: tone-only), `ceiling` 8 and `ceilingTile` 7 (kit photographs: photo-made), `ward-plaster` 7 and `ward-floor` 6 (game tiles through the pipeline: photo-made), `steelGrey` 3, `brass` 2, `metalBox` 2, `bottleClear` 2, `carRed` 2, `enamel` 1, `exit-green` 1, `exit-plate` 1, `ward-cork` 1 (flat colours), `laminate` 1 and `fabricKnit` 1 (kit photographs). The 62 models carry their own textures. Not converted: no time; not measured: the mesh-pipeline five-rule table, the floor's hue (182 against 154), the curtain screen, the IV stand, the noticeboard slips.
