# After the lit room: the sheets, the measure and what still differs

**Branch:** `claude/builders-look-room` (workstream 4, plan tasks 1 to 5). **Shot with:**
[`spikes/builders-look/shoot.mjs`](../../../../../spikes/builders-look/shoot.mjs) on `main` `9938e9c3` + #589 (`0024f81a`,
merged) + the dark-room fix (`680bbc31a`) + the sun-grid fix of this branch; headless Chromium on software WebGL
(`--use-angle=swiftshader --enable-unsafe-swiftshader`). The builders' frames are the survey's own
(`../builders/`, EnvironmentBuilder `f7c5356`). The figures in every AF panel are still core's mesh figures: painted
figures are group 2 (`claude/builders-look-figures`).

[`shots.json`](shots.json) holds each panel's brightness and colours. [`shots-before-sun-fix.json`](shots-before-sun-fix.json)
is the same shoot one commit earlier (everything of this branch but the sun-grid fix), kept so the fix's own effect can be read.

Sixteen sheets, not twelve: the survey's gameplay sheets drew the page's `tll` view, which #589 renamed (the spike now
knows `af` and `zone`; any other name falls back to the diorama), so `shoot.mjs` now shoots the gameplay camera as `af`
(50 mm, 30°, 16 m, as the survey) and adds a `zone` sheet per scene (#589's per-room view). The survey's gameplay numbers
were taken before that rename and are comparable with `-gameplay.png` here.

## The measure

The baked panel's mean brightness over the builder's, for the eight scene sheets (the plan's band: 0.80 to 1.20).

| Sheet | Builder | `main` (survey) | + #589 + dark-room fix | + sun-grid fix (this branch) | Ratio | In the band |
|---|---|---|---|---|---|---|
| base-interior, diorama | 50.8 | 15.7 | 44.4 | **44.4** | 0.87 | yes |
| base-interior, first person | 47.8 | 22.2 | 48.5 | **48.5** | 1.01 | yes |
| base-interior-dressed, diorama | 50.7 | 22.2 | 43.1 | **43.1** | 0.85 | yes |
| base-interior-dressed, first person | 48.2 | 24.0 | 47.3 | **47.2** | 0.98 | yes |
| base-exterior, diorama | 123.2 | 35.4 | 90.1 | **104.0** | 0.84 | yes |
| base-exterior, first person | 129.3 | 92.1 | 114.8 | **121.9** | 0.94 | yes |
| base-exterior-dressed, diorama | 121.5 | 36.4 | 89.2 | **102.9** | 0.85 | yes |
| base-exterior-dressed, first person | 128.6 | 91.9 | 114.3 | **121.3** | 0.94 | yes |

All eight are in the band, and each sheet has been looked at (below). The gameplay and zone sheets have no builder panel:
gameplay reads 45.5, 45.5, 101.5 and 99.9; zone 48.6, 48.7, 114.1 and 111.9 (interior, interior dressed, exterior,
exterior dressed).

The material panels (the ramp material under the look's light, which this branch does not change) read as they did, within a
shoot's own spread: 41.5, 40.4, 42.1, 37.5, 38.4, 93.5, 39.9 and 93.4 against the survey's 41.4, 40.1, 42.2, 37.3, 38.4, 93.5,
39.9 and 93.5; their colour counts do not fall (35, 29, 42, 37, 49, 59, 59, 60 against 30, 27, 37, 36, 49, 59, 59, 60).
The albedo and the tiles are not regressed.

## The street: what the diagnosis found

After #589 and the dark-room fix the street was still short of the builder's (0.73 in the diorama). The plan's method
(`docs/refactor/eb-look/dark-interior.md` on #590: measure each stage on both sides until one differs) gave:

1. **Not the light: figures and bars out.** The mesh figures are black silhouettes on the baked street, and the letterbox's
   bars (18 rows each of 360 in the diorama, 10 of 200 in first person) are in the AF panel only. Diorama: 90.0 whole, 92.4 with
   no figures (`cast=0`), 97.9 over the field inside the bars as well, against 123.2: 0.795. First person: 114.8, 116.1, 124.3
   against 129.3: 0.96. The first person gap was almost all the bars; the diorama's was real.
2. **The inputs agree.** EnvironmentBuilder's `look.json` and `times.json` for `day` and `worldLighting(world, day)` give
   the same ambient (0.45, `#c7d6ff`), fill (0.12, `#c6ecff`, fade 1.5 4 0.25), key (0.3 0.8 0.5 at 0.09), sun (1.0, `#fff3d6`,
   shadowed, direction the time's key turned out of an 18° pitch), cap 1.6, step 0.1 and shade 0.85, and `vertex-light.ts`'s
   `baseLight` is the same formula term for term.
3. **The screen is the bake.** With the surface's albedo under a white ambient (`?uniform=1`, a switch added to the spike) each
   surface's screen value over its albedo gave the light it was drawn with: AF 0.75 on the wall, 0.9 on the shaded pavement, 0.98
   on the sunlit one and 1.0 on the road, EnvironmentBuilder 1.0, 1.2, 1.15 and 1.28. A browser probe (a grey flat swatch and a grey
   tile, ambient 0.5 to 1 and a key on top) draws `albedo × light` exactly, past 1 too (64, 128, 160 and 192 for 128 × 0.5,
   1, 1.25 and 1.5). The screen is the product; the bake was low.
4. **The bake: the sun's sample grid.** `bakeVertices` over the street's floor under the day: every vertex of the open road took
   0.97, where the formula (ambient and key 0.52 × tint + sun 1.0 × N·L 0.777) gives 1.19, and the wall facing the sun 0.63
   against 0.88. With the sun's shadow off, or the occluders taken out, the road was 1.19 at every vertex. The cause is in
   `sunShare`: it spreads its 3 × 3 rays across the sun's rays, so on open ground three of the nine start below the floor plane
   (which is itself an occluder) and are blocked by it; likewise behind a wall's own plane. Lit by 6 or 7 of 9, every floor and
   wall facing the sun lost a quarter. **Fix:** the grid lies in the vertex's own surface, which is what its doc comment said.
   Tests first, each seen failing: an open floor under a slanted sun lit in full (0.74 against 1.0), a wall plane the same
   (0.49 against 0.65), and the open road's light against the builder's formula (0.967 against 1.2). No constant was changed,
   and no existing expectation in `packages/3d` moved (1373 tests pass, 3 added).

After the fix the street reads 104.0 in the diorama (0.84 of 123.2; 114.0 over the field and no figures, 0.925) and 121.9 in
first person (0.94). What is left is the figures and the bars (the AF panel's top and bottom 5 and 10 per cent are bars, the
builder's has none), the day panes and the haze (below). The interiors have no sun and did not move (the table's two
middle columns are equal to the tenth).

## The survey's eleven differences

1. **The baked room is near black: fixed.** [`base-interior-diorama.png`](base-interior-diorama.png) and
   [`base-interior-fp.png`](base-interior-fp.png): the walls, the ceiling (it was black), the floor's tiles and the table read; the room
   is 0.87 to 1.01 of the builder's. The street is 0.84 to 0.94
   ([`base-exterior-diorama.png`](base-exterior-diorama.png)): the wall's bricks, the pavement's slabs and the road's cracks read, and the tree's and pole's
   shadows fall on the pavement in the gameplay and zone sheets.
2. **The material-lit street is as dark as the baked one: unchanged, as ruled.** The material panel is what a game with no `lighting` gets;
   it reads 38.4 as before. The builder lights scenery with the baked term only, so the bake was the path to fix.
3. **No lamp glow: fixed by #589.** The pendant's bulb is drawn at its own step with the bloom's ring round it
   ([`base-interior-fp.png`](base-interior-fp.png)); the street lamp in the gameplay sheet glows at its head.
4. **Windows are flat blue: still there.** #589 draws a lit window's room at night and the street's windows by day are still flat
   blue panes with their frame; the builder's reflection streaks are absent ([`base-exterior-diorama.png`](base-exterior-diorama.png)). It stays a named
   difference; the streaks are a reflective pass (group 3's effects), not the room's light.
5. **No pool of light that reads: fixed.** The pendant lays a warm pool on the tiled floor in the diorama, the zone and
   the dressed sheets ([`base-interior-zone.png`](base-interior-zone.png), [`base-interior-dressed-diorama.png`](base-interior-dressed-diorama.png)).
6. **No figure shadows: built in group 2.** The coordinator's amendment after the plan audit: a figure's cast shadow is the last task of
   `claude/builders-look-figures`, after figures are lit as sprites. Nothing is built for it here; it stays named on these sheets.
7. **Figures are core meshes in a level: group 2.** The painted figures lit by their room (#607) are task 6 and the base pair in the four scenes is task 7. The
   black silhouettes on the street sheets and the flat orange and red pair in the room are that, not the light.
8. **The dollhouse cut: still there, a framing difference.** The builder's diorama cuts the near wall and shows the side walls; AF's
   occluder rule hides the near wall and the ceiling and insets the room. Not the look.
9. **The gameplay picture is small: fixed by #589's room views.** [`base-interior-zone.png`](base-interior-zone.png) and
   [`base-exterior-zone.png`](base-exterior-zone.png) frame the room at the distance its view names (the room fills the frame where the 16 m gameplay
   camera gave a quarter of it).
10. **A green veil off the room: not the haze, not a fault.** On `base-interior` gameplay the field outside the room is the same with
    the haze pass off (`haze=0`: 32.9, 50.3, 47.2 in both) and with the look off (35.5, 50.5, 45.0); with the sky pass off it is
    the renderer's navy background (35, 50, 77). So it is the sky pass's lowest band under a camera looking 30° down, drawn
    by `SkyEffect` as written, and the haze (which leaves a pixel with no mesh alone) does not touch it. By the plan's rule it is
    the sky's and right. It is greener than the builder's navy side bands; the sky pass is not this branch's, so it is left named.
11. **What already matched still does:** the sky's bands, clouds and the city horizon in first person, the tiles on walls,
    floor and road, the dresser's furniture, sign and props, and the camera's lens and tilt
    ([`base-exterior-dressed-fp.png`](base-exterior-dressed-fp.png) beside the builder's).

## Every 3D example's first frame

The 19 examples of `examples/3d`, built (`pnpm --filter @af-examples/examples-3d build`) and served statically, each past its Play
button and drawn for 40 frames in Chromium on software WebGL, 844 × 390. **None draws under a brightness of 20**: the lowest is
`worldkit-generated-map` at 43.3, then `look-pixel-art` 45.6 (it was 19.7 to 32.3), `render3d-lighting-fog` 46.3 and
`worldkit-furnished-room` 57.0; `world-level-room` reads 74.5 (it was 4.6) and the rest 64.7 to 206.1. **None logs an error or a
feedback-loop warning.** The only console messages are `warning: figure on <id> took 22 to 155 ms to build (budget 5 ms)`, one per
figure on 13 of the 19, which is the first build of a figure on software rendering in a cold page, in each example as on
`main`'s; it is not new and nothing here changes it. They are cut with Ember Hall soon.

## A fault found on the way, not fixed here

`drawWorld`'s tile textures are cached per tile in a module-level `WeakMap` (`textureOf`), not per renderer: a second renderer
made after the first was disposed in the same page draws a destroyed texture, black. A probe that made four renderers in one page
saw it (`tile@1+0` read 0, 0, 0 on the second); one renderer per page, as every game and the spike have, never meets it. It is not
this branch's and nothing here depends on it.
