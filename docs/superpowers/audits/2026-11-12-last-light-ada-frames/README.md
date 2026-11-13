# The Last Light: Ada's look in play (the ada session)

Painted in Node by the kit (`extensions/character-kit/scripts/ada-density2.ts`), or shot in Chromium on software GL (`AF_WEBGPU=software`) at
1024 by 768. WebKit, Firefox and a real GPU did not run. The reference (FigureBuilder's `eye-swap.png`, lower half) is not committed.

## Item 1: her eyes (`item1-head-x10.png`, `item1-body-x4.png`)

Base man, base woman, Ada, density 2, x10 nearest. Ada's crease, hood and liner are base-f's own (.4, .35, 0; `eyeSize` unset on both), done in
8d820269 with the cast test that pins them to the base data. Looked at: her eye is the woman's, a one-texel dark lid line over the white and the
iris, not the man's heavy hooded lid; it reads open, so `eyeSize` is left as the base woman's. Her brow stays bolder (.75) than base-f's.

## Item 2: her build (`item2-builds-in-play-1to1.png`, `item2-five-heads-head-x10.png`, `item2-five-heads-body-x4.png`)

Shot in play (the hall, facing us at the south wall, and in three-quarter by the beds), 1:1 crops of 1024 by 768 frames, a texel 4 screen pixels:
seven heads (height 190, head .85: 146 rows, a head of 20 by 20 texels), six heads (today's 160 and 1.25: 124 rows, 20 by 18), five heads
(160 and 2: 125 rows, 25 by 22). The head slider moves the ratio; height alone scales the head with the body (every height stays about six heads).
Kept five (head 2.05): her face reads largest by far, and her body is still a slim adult's in both views; seven is elegant but its face is no
bigger than six's, and its hair nearly meets the top of the three-quarter frame. At 2 the chin's catch-light came back under the lower lip (the
cast test caught it); 2.05 clears it. The `head` slider is exempt now from the cast test's "within .3 of the base woman" rule, as height was:
the build is the Owner's call ("go with what looks the best"). The cast tests that read the face in fixed rows under the crown now read windows
that are the same shares of the head's measured rows, so they still test the mouth and the eyes on a larger head.
The shots needed `play-shots.test.ts` to hold two keys at once and let both go in one task (one key let go a tick early turned her side-on).

## Item 5, first round: the gameplay frame (`item5-gameplay-frame-1024x768.png`, `item5-head-from-that-frame-x2.5.png`)

The five-heads build, facing us at the hall's south wall, as the game plays it (no item 3 work in it yet). Her head is cropped from that same
frame and enlarged x2.5 nearest, so a texel is 10 pixels, the reference's size. Looked at beside the reference's lower half, feature by feature:
brows bold and two texels thick (they read, bolder than base-f's); the lid is the woman's, a dark row over the white and the iris (reads); the
whites show both sides of each iris and are near-white but greyed by the mesh; the nose is a faint column, weaker than the reference's shadow;
the lips are two tones but low in contrast, a grey-pink band; the skin is a pale pink-peach, cooler than the reference's warm tan; crispness
falls short: the LCD panel's mesh crosses every texel, off the texel borders. The structure matches; the finish does not, which is item 3's.

## Item 2, round 2: back to six heads (`item2-round2-six-between-five-head-x10.png`)

The coordinator did not accept five heads, and the picture agrees: the painter's features are one or two texels whatever the head's size, so a
larger head spreads the same brows, eyes and four-texel mouth over a wider, emptier face (eyes far apart, a small mouth in a large chin); in play
it reads as a bobble-head child. The measure is how much of the face the features fill, as in the reference, not how large the face is. Painted at
x10: base man, base woman, six heads (1.25), between (1.45, the most within .3 of base-f's 1.15), five (2.05). At six the features fill her face as
base-f's do; between is wider and emptier, and the red-brown patch at her temple shows more. Kept six: `head` is 1.25 again and the cast test's
"within .3 of the base woman" rule holds it once more (the exemption is gone). Kept from round 1: the cast tests' face windows as shares of the
head's rows, and the play shots' key pairs. The item 5 frame above is the five-heads build and is re-shot below.

## Item 5, round 2: the gameplay frame at six heads (`item5-round2-gameplay-frame-1024x768.png`, `item5-round2-head-from-that-frame-x2.5.png`)

The six-heads build, facing us at the hall's south wall; her head cropped from that frame and enlarged x2.5 nearest (10 pixels a texel). Beside the
reference: the features fill her face as base-f's do (brows bold and two texels thick; the woman's lid, a dark row over a white each side of
the iris; a nose; a mouth under it). The finish is round 1's: the mesh crosses every texel; the mouth reads as one dark band, its two tones barely
apart; the nose is faint; the skin is a pale pink-peach, cooler than the reference's warm tan. It falls short in crispness, lips and skin.

## Item 3: why the mesh cannot be moved onto texel borders by its numbers (not done)

The panel is a post pass on the field (512 by 384 at 2x), where a texel is two field pixels and the mesh's cell one: a mesh of period 2 sits at
the Nyquist limit (the pass fades it out), and at period 4, whatever its phase, each texel gets one lighter and one darker pixel, so a line still
cuts every texel. A clean face needs one of two generic, opt-in changes in `extensions/lcd-panel`, in both shaders: draw the mesh at the screen's
pixels after the field is scaled (a 4-pixel mesh, the old game's, whose period is one texel and whose phase follows the field's whole scale), or
read a figure mask (the figures' pixels written to a target the pass samples) and leave those pixels out of the mesh, stripes and scanlines. Then
the room's panel can go back to full strength. Not started in this session.

## Item 3(b): the veil on her colours (`item3b-veil-panel-gain-heads-x2.5.png`)

Her head from four play frames, x2.5 nearest: the panel's gain at 1.55 (as it was), 1, 1.28 (kept), and the panel off. The veil is the panel's
`brightness`, the gain that gives back the light its mesh absorbs: 1.55 was set for the full-strength mesh, and over session 16's mesh held to a third
it lifts every dark and washes the skin pale pink. Measured (her face's mean, 1024 by 768): panel off (129, 94, 80); the softened mesh at gain 1
(114, 85, 72), so it absorbs about 12%; at 1.55 (144, 106, 91), 10% over. 1.28 gives back exactly what the mesh takes: (129, 96, 82). Set in this
game's `look.toml`; the panel's default is unchanged. The halation (`glow`) costs her face under 1% and stays. What is left: the skin is her painted
`skinWarm` under the room's light, paler and pinker than the reference's tan (a data choice of her skin, not a stage), and the mesh's haze (3a).

## Item 5, round 3 (`item5-round3-gameplay-frame-1024x768.png`, `item5-round3-head-from-that-frame-x2.5.png`)

Six heads, the panel's gain 1.28. Against the reference: brows bold (read); the woman's lid over whites each side of the iris (read); the nose a
faint column; the lips a dark band with a lighter row, still low in contrast; the hair's dark tones a little deeper than round 2 and the skin a
little less pink, but still paler and pinker than the reference; the mesh's haze over every texel. Better than round 2, not yet the reference.

## Item 3(a): the mesh on texel borders, scoped for the next session (not done here)

**Why the panel's numbers cannot do it.** The LCD panel (`extensions/lcd-panel`) is a 3D `PostEffect` on the look's field (512 by 384 here,
shown at a whole scale of 2). A figure texel is two field pixels (`PLAY_FIGURE`, crisp at density 2). A mesh period of 2 field pixels is the
Nyquist limit (`derivePitch` fades it out; integrated over each pixel, both pixels of a period get the same mean, so nothing is drawn); a period
of 4, at any phase, gives each texel one lighter and one darker pixel. A line can only sit between texels when it is drawn at a finer grid than
the field: the screen's.

**1. A filter slot on the upscaled composite (`packages/automata`).** `CompositeTarget` (`src/features/render/letterbox/composite-target.ts`)
draws the world and UI at the logical size and shows them through `composite.sprite`, nearest-upscaled into the letterbox at device pixels. Today
every `postFilters` entry goes on `composite.stage` (`renderer.ts`, `sceneFilters`), at field pixels. Add an opt-in placement to the declaration:
`postFilter(name, { glsl, wgsl, at: 'screen' })` (default `'field'`, today's), kept by the same `PostFilterSlot` under its name, and set on
`composite.sprite.filters` with `resolution` the renderer's (device pixels). Give the filter the whole scale (device pixels a field pixel, from the
letterbox's `whole` layout) and the sprite's device-pixel origin as uniforms, so a shader can say where each field pixel's edges are. Without a
composite (`pixelArt: false`) an `at: 'screen'` filter is left out with the slot's existing warning.

**2. The panel as a screen filter (`extensions/lcd-panel`).** A second entry, `lcdPanelScreenFilter(profile)`, from the same Zod profile
plus `cellPixels` (device pixels a mesh cell; at this game's 2x, 4 = one figure texel), GLSL and WGSL, the mesh, stripes and scanlines as today's
`lcd-shader.ts` maths but with `p = (devicePixel - origin) / cellPixels`, so the period is whole device pixels and phase 0 is the field's own
origin; the dark of the mesh on the last device pixel of each cell (the cell's border), never inside. The field pass keeps its own profile with
`grid`, `subpixels` and `scanlines` at 0 when the screen filter draws them (`look.toml` would say which). `brightness` stays the gain for what the
mesh absorbs (see 3b: it has to follow the mesh's strength).

**3. The phase rule (`extensions/character-kit`).** A 4-device-pixel cell is 2 field pixels, so its borders are a figure's texel borders only when
the figure's cell starts on an even field pixel. `place()` in `src/features/painted/place.ts` rounds the cell's top-left to a whole pixel
(`Math.round(ax - scale * anchor)`): add an opt-in `grid: true` to `PlaceOptions` (and `PLAY_FIGURE`) that rounds it to a multiple of `scale` (the
texel's field pixels), so every figure's texels lie on the field's 2-pixel lattice and therefore on the screen mesh. Default unchanged.

**Tests first.** Unit: `postFilter` with `at: 'screen'` lands on `composite.sprite.filters`, `'field'` and the default on `composite.stage`
(`packages/automata`'s render tests); `place()` with `grid: true` puts `screen` on multiples of `scale` for anchors and positions that today round
odd, and leaves today's placements alone without it; the lcd-panel's uniform maths for `cellPixels` (period, phase 0 at the origin). Browser
(`extensions/lcd-panel/tests/browser`): a flat field at scale 2 with a 4-pixel cell, read back: every darkened column and row is a device pixel
whose index mod 4 is 3, none inside a field-pixel pair that forms one texel. The existing panel tests stay as they are. Then the game: shoot the
room with the panel at full strength (the old .3s) and at session 16's third, her head x2.5 from each, and keep full strength if the face is clean.

**Ruled out: a figure mask.** The pass would need the figures' pixels in a target of their own (a second draw of every painted figure into a mask
in the 3D graph, kept in step with depth and occlusion), and the face would then show no panel at all while the room does, which is not the old
game's look; the screen mesh keeps one panel over everything and puts its lines between texels, as the old game's did.

## Item 4: her directions in play (`item4-eight-directions-in-play-1to1.png`; partly done, nothing fixed)

Shot in the hall at the gameplay scale by walking her with each key and key pair from the spawn (`play-shots.test.ts`), 1:1 crops. What the keys
gave: N her back; NE her back three-quarter; E the same as NE (a wall stopped her, so she kept her facing); SE and S her front; SW her front
three-quarter; W her profile; NW hidden behind the waiting-room chairs. So the shoot still lacks a true E and her back three-quarter on the other
side, and the walk frames (the harness shoots only once a key is up). Looked at:

- Front, front three-quarter, profile: read well; the face's features read in all three; the bob's side and the rolled sleeves and boots are clean.
- From behind: the `bobOpen` is a smooth round dome from crown to collar with no nape or fall, a ball on her shoulders. The generator's back of the
  bob wants a nape step (the hair ending a row or two above the collar, with the neck's skin under it) and a darker under-row. Not fixed.
- The waistcoat's back: a lighter brown triangle across the oxblood (its shading split down the back) reads as a patch. Not fixed.
- The camera, not hers (the sister session's): facing away at the hall's north end the frame cuts her at the waist; at NW the chairs hide her whole.
- The dark-red blotch at her right temple (session 16's note) shows in the painted x10 heads; not fixed.

## Item 6: the gates (whole `pnpm check`, uncached, `TURBO_FORCE=true`)

Lint, typecheck, boundaries and style passed. `source-names` failed on a test comment of session 15's (`968e7f56`) naming the old source
project; reworded. `knip` then found the density-2 study (`72ba4462`) unused: its header documented an `ada-d2` script that the kit's
`package.json` never had; added (`1d7dd241`). The unit tests, re-run with `--continue` so one failure does not cut the rest: 66 of 67 tasks pass;
`@automata/api-report` fails one test, `3d.api.md` out of date against `@automata/3d`'s source. Not this branch's: session 15 added the 3D
views' fields (`a162c8f9d`) and listed `pnpm api-report --update` as not run; the brief gives the API reports to the camera session.
`check:changesets`: 0 problems. No published package changed here (the kit and the game are private): no changeset. The character kit's and
the game's own unit suites pass inside that run; the kit's browser suite, the journeys and the build did not run.

## Session 2, item 1: the mesh on texel borders (`s2-item1-panel-strengths-heads-x2.5.png`, `s2-item1-gameplay-frame-1024x768.png`, `s2-item1-head-from-that-frame-x2.5.png`)

Done as item 3(a) scoped it, tests first, generic and opt-in: `postFilter(..., { at: 'screen' })` and the stage's `screenFilters` slot on the
composite's upscaled sprite, told `uScreenScale` and `uScreenOrigin` each frame (`@automata/framework`, changeset); `lcdPanelScreenFilter(profile,
{ cellPixels })`, GLSL and WGSL, a line on the last device pixel of each cell, as dark as the field mesh's trough (`@automata/lcd-panel`); `grid:
true` in the kit's `place()` and `paintedFigure` (a 1 mm sweep: on the lattice, a texel at a time, never back, still under a following camera).
Browser: the panel's lines read back at 3 mod 4 from the field's origin, and a figure at 2x under a 4-pixel mesh keeps every 4-by-4 block one
texel, WebGL2 and WebGPU (software). The game: `[lcd]`'s mesh, stripes, scanlines and gain off on the field; `[lcdScreen]` 4 pixels a cell;
`PLAY_FIGURE.grid`. The HUD is DOM and is not under the mesh.

Shot in play at the hall's south wall, her head x2.5 nearest from each frame: no screen mesh; full (.3) with the stripes at .3; full without
stripes; a third; and the one kept. Measured on her face (the same box in each frame, 1024 by 768): no mesh (150, 114, 96); full, stripes .3, gain 1
(115, 88, 75); full, no stripes, gain 1 (124, 94, 79); a third, gain 1 (128, 98, 84). The gain that gives back what the screen mesh takes is
(150 / 124)^2 = 1.46 for the kept mesh (the field's 1.55 does not carry over); at 1.46 her face is (147, 111, 94).

Looked at: with the stripes at .3 every texel has a red, a green and a blue column, a woven face, so the stripes are off. Without them each
texel is one flat colour and every line falls between texels (crispness inside a texel: met). Kept: full strength, stripes 0, gain 1.46, as the
brief asked when the face stays clean. But honestly: at full strength a dark line every 4 pixels reads as a grid laid over her face, and the
head with no screen mesh is plainly the closest to the reference. The coordinator may prefer a third on the room, or no mesh over figures.
`content.hash` moved (look.toml is in the content build). No other recorded picture or hash moved.

### Item 1, round 2: the strength (`s2-item1-round2-strengths-heads-x2.5-and-1to1.png`, `s2-item1-round2-gameplay-frame-1024x768.png`, `s2-item1-round2-head-from-that-frame-x2.5.png`)

The coordinator did not accept full strength (the mesh outlines every texel; the frame reads as a mosaic, her face as a grid) and asked for the
weakest strength at which the panel still reads on the room while her face shows no grid at a glance, the character winning if none does both.
Shot with the stripes off at gain 1: a third (.1), a quarter (.075) and a fifth (.06) of the old mesh and scanlines. Looked at, heads x2.5 and
1:1 and the whole frames: a third and a quarter still draw a lattice over her face at 1:1; at a fifth the full frame shows the panel only as a
faint texture on the floor's lighter tiles and her face shows no grid at a glance, though a faint lattice is still there in a 1:1 crop looked at
closely. No strength did both, so the character wins: kept a fifth. The gain was measured on two large areas of the room (her face's box moves
with her placement between frames and was too noisy): a third 1.15, a quarter 1.11, a fifth 1.09 (the maths says 1.087). At 1.09 the two areas
are (17.2, 21.6, 22.4) and (28.2, 37.3, 36.3) against (17.3, 21.6, 22.4) and (28.3, 37.3, 36.2) with no screen mesh. If the faint lattice on
her face is still too much, the next step is the mesh off over figures or off altogether.

## Session 2, item 2: lips and nose (the cause found, not fixed)

Her face's texels in play (the no-mesh frame and the kept one, 1024 by 768) against the painted cell (`pnpm --filter @automata/character-kit
ada-d2`): skin `#ce9770` plays `#b5816a` (its hue kept); the upper lip `#7c4b47` plays `#583736` (reads); the lower lip `#d28d7a` plays
`#c58c77`, and is only a little pinker than the skin in the painted cell too (low contrast is partly her data); the nose's highlight `#edb67c`
plays a grey-beige `#c7b194` / `#b9ad92`. A shot with the retro grade's `moodBlend` at 0 still has it grey-beige (`#e6d0af`), so not the grade.
The four paints are DUEL colours, so `holdSkinHue`'s skin set does hold them. The stage is `warmer()` in `extensions/character-kit/src/features/
painted/skin-hue.ts`: a Python replica of its metric picks, for the highlight a step darker, `#cfaf8e` (95% of its lightness) and `#c0a588` (90%),
and for her base skin `#b39783` (95%) and `#857565` (80%): grey-beige steps, because the chroma term weighs only .25. At 2 the replica keeps the
highlight warm (`#d89f75` at 90%) and the skin on its own ramp (`#bf7e63`, `#ad6e51`, `#9a624c`). The same grey steps are the likely cause of the
pale far-cheek patch and the grey cheek in profile (item 4). Not changed here: it is the kit's generic metric and moves the kit's lit goldens; it
wants a test first (a highlight a step darker keeps chroma), the kit's goldens looked at and listed, and the head shot again.

## For the tracker (the ada session 2)

Branches no longer edit `docs/superpowers/progress.md` (the coordinator, 2026-11-12); this row goes into the tracker when the branch merges.
Where to resume: item 2's fix in `warmer()` (test first; the kit's lit goldens looked at and listed), then items 3 to 5 of the brief.

| 4. Look, game branch, the ada session 2 | Opus 5.5 (look session, no subagents) | `claude/last-light-ada` | 2026-11-12, from `80656856` (node_modules installed with `pnpm install --frozen-lockfile`). Frames, numbers and verdicts: [ada folder](audits/2026-11-12-last-light-ada-frames/README.md), sections "Session 2". **Done, tests first, pushed:** (1) the LCD mesh on texel borders: `postFilter(..., { at: 'screen' })` and `stage.screenFilters` on the composite's upscaled sprite with `uScreenScale` and `uScreenOrigin` (`@automata/framework`, `5fda196`, changeset patch; `pnpm build`, `api-report --update` and `api-index --write` committed, `3d.api.md` was stale); `lcdPanelScreenFilter` in GLSL and WGSL, a line on each cell's last device pixel (`@automata/lcd-panel`, `cf6a1bb`); `grid: true` in the kit's `place()` and `paintedFigure` (`2a92304`); the game draws the mesh and scanlines at the screen's pixels, stripes off, figures on their lattice; full strength (gain 1.46 measured) outlined every texel and was rejected by the coordinator; a third, a quarter and a fifth shot, a fifth kept (`3b6dddd`: a faint texture on the room, no grid on her face at a glance, a faint lattice in a 1:1 crop), gain 1.09 measured on the room's large areas; `content.hash` moved (look.toml). Browser tests on WebGL2 and WebGPU (software) for the panel and the kit. Every texel is one flat colour and lines fall only between texels. (2) lips and nose: the cause of the grey nose highlight found and not fixed: `warmer()`'s chroma weight (.25) in the kit's `skin-hue.ts` picks grey-beige DUEL steps for a skin colour a step darker; 2 keeps them warm (a replica's numbers in the README). **Not done:** item 2's fix; item 3 (the gameplay frame at 10 px a texel against the reference, beyond the s2-item1 head crop); item 4 (directions: `bobOpen`'s nape, the waistcoat back, the temple blotch, the cheek patches, likely the same `warmer()` greys); item 5's whole uncached `pnpm check` (the pre-commit hook's affected unit tests passed on each commit; lcd-panel and kit browser suites ran in Chromium only). Chromium (software GL, software WebGPU) only; WebKit, Firefox and a real GPU unrun; journeys not run (the camera session's). |

## Session 3, item 1: warm steps (`s3-item1-head-before-after-x2.5.png`, `s3-item1-gameplay-frame-1024x768.png`)

Test first (`extensions/character-kit/tests/unit/painted/skin-hue.test.ts`): for each of the six skin swatches the kit ships (skinWarm,
skinBrown, skinPale, skinTan, skinGolden, skinDeep), each painted tone dimmed one, two and three steps down its own DUEL row must play a hue
inside the swatch's own hue span (15 degrees either side) with a chroma at least .6 of the painted. Today's `warmer()` failed 11 of them, all
grey-beige (skinWarm #edb67c -1 #c0a588, -2 #9e8c79, -3 #857565; #ce9770 -2 #857565; skinGolden #d89f75 -1 #b39783; skinPale #b98c93 -1
#917a7b; ...). Fixed in `d4df32b`. Why weights alone could not: holding the texel's OWN hue at a darker lightness asks for a colour no skin
has: every swatch reddens as it darkens (skinWarm 67 to 28 degrees of OKLab hue, skinGolden 81 to 30, skinPale 77 to 8), and at a shadow's
lightness DUEL answers a highlight's yellow with an olive or a grey (tried: chroma weights .25 to 16 left 5 or 6 failures; holding the hue
with a ramp chroma picked olives #9e6520, #854f12). So the target is now the swatch's own ramp at the room's lightness (between two painted
tones, their mix; past the ends, the end tone), and the lost chroma is counted as a share of the target's chroma in units of one mean DUEL
step of lightness (losing all the colour costs one step): scale-free, so pale skin's faint colour is guarded as much as deep skin's. The hue
arc keeps its old weight (6). With it every dimmed warm, golden and tan tone lands exactly on its swatch's next painted tone.

The cool-room test's "no texel moves 20 degrees of hue" was restated as "no texel leaves its swatch's hue span (5 degrees either side)":
Ada's old `fair` highlight #ebbd9d (56 degrees) now darkens to its own swatch's #d5a39a (30), as the painter's shading does; the lavender that
test guards against (row 27's #977488 at -16 degrees) is far outside the span. Said here because it is a changed assertion.

Recorded cells: none moved. `holdSkinHue` is opt-in and no kit golden or recorded cell uses it; the kit's unit suite (368) and browser suite
(Chromium + WebGPU software: 66 passed, 3 skipped) pass unchanged, so there is no before/after golden sheet to make; the game's unit tests
(445) pass. Her head in play (the hall's south wall, x2.5 nearest, before left, after right): the grey-beige band over her brows and the grey
nose column are warm skin now. Not yet fixed: the lower lip (item 2), the temple blotch and the grey-green at both temples (item 4).

## Session 3, item 2: lips (`12f6339`)

Test first in the game's cast test: the lower lip at least .06 from her skin in OKLab (three just-noticeable steps) and at least .15 lighter
than the upper. It failed on the data (.033: #d28d7a on #ce9770). Painted at x10 beside four DUEL candidates (#c17e7a, #ae6b60, #c7826c,
#ac6f6e): #c17e7a is a rose a step deeper, natural, and clearly apart (.076 from the skin, .19 lighter than the upper #7c4b47); #ae6b60 nearly
meets the upper lip. Kept #c17e7a (`lipsAda` paint[1]; the mouth stays four texels, no painter change). In play the lower lip reads #a5715d to
#a97864 under the upper #563030 on skin #bf8a73: a band of its own. Item 1's fix does not touch it (the lips are not in the skin set).

Found, not fixed: the mouth's corner texels and the nostrils play a GREY #685f59. The painter's face stamp shades them two steps down the skin's
own tones (`shade(x, y, 2)` in `extensions/figures/src/shared/paint/paint-stamp.ts`, from `tones[face.skin]`), and the painted cell holds
#945d4f there, a DUEL colour (row 24) that is not in her swatch's paint, so `skinColours()` leaves it out of the held set and the room lights
it along row 24 and tints it grey. The generic fix: `skinColours(def)` (kit, `skin-hue.ts`) should hold every tone the painter draws as skin
(the face stamp's `tones[face.skin]`, not only the swatch's paint), test first with a painted face whose shade steps are off the paint list.

## Session 3, item 3: the gameplay frame for the Owner (`s3-item3-gameplay-frame-1024x768.png`, `s3-item3-head-from-that-frame-x2.5.png`)

1024 by 768, the hall's south wall, facing us, Chromium on software GL; her head cropped generously from that frame (whole hair and the
collar) and enlarged x2.5 nearest, so a texel is 10 pixels, as the reference's. Against the reference, feature by feature:
brows: bold, two texels, dark (read, as the reference's). Lid: a dark row over the eye (reads). Whites: near-white each side of the iris (read).
Nose: a lit warm column now (item 1), but its nostril texels are a grey smudge (the #945d4f cause above), where the reference's is a warm
shadow. Lips: two tones now, a dark upper over a rose lower, but the corners are grey. Skin: warm and clean across the face and forehead (item
1); no grey-beige band. Crispness: chunky, one flat colour a texel; the screen mesh at a fifth leaves a faint lattice when looked at closely.
Hair: the crown's right side has a grey-mauve sheen and the hard dark-red patch at her right temple stays (item 4). Short of the reference in
the nostrils and mouth corners (cause found, next), the hair's sheen and temple patch. Not gone round again: out of time.

## For the tracker (the ada session 3)

Where to resume: (a) the grey mouth corners and nostrils: `skinColours()` holding the face stamp's skin tones (test first); then re-shoot item 3;
(b) item 4 (every side: 8 directions and two walk frames; `bobOpen` from behind, the waistcoat back's triangle, the temple blotch, re-check the
cheek patches after item 1); (c) item 5's gates.

| 4. Look, game branch, the ada session 3 | Opus 5.5 (look session, no subagents) | `claude/last-light-ada` | 2026-11-12, from `8661cd6`. Frames and verdicts: [ada folder](audits/2026-11-12-last-light-ada-frames/README.md), sections "Session 3". **Done, tests first, pushed:** (1) warm steps: `holdSkinHue`'s `warmer()` targets the skin swatch's own ramp at the room's lightness, lost chroma counted against one mean DUEL step (`d4df32b`, kit); 11 grey-beige picks across the six kit skins fixed; the cool-room test's hue bound restated as the swatch's hue span (explained); no recorded cell moved (opt-in, no golden uses it); her nose and forehead are warm in play. (2) lips: `lipsAda`'s lower lip #d28d7a to #c17e7a (`12f6339`, game data, cast test). (3) the gameplay frame and its head at 10 px a texel, verdict in the README. **Found, not fixed:** grey nostrils and mouth corners (#945d4f, a painter shade step outside the held skin set). **Not done:** item 4 (directions); item 5's gates (`pnpm check` uncached, `pnpm build`, api-report/api-index, lcd-panel suites, framework render tests did not run this session; the kit's unit and Chromium browser suites and the game's unit tests ran and pass; the pre-commit affected unit tests passed on each commit). No changeset: only private packages changed this session. `content.hash` not moved (no `look.toml` change; the cast's swatches are TypeScript). Chromium (software GL, software WebGPU) only; WebKit, Firefox and a real GPU unrun; journeys not run. |

## Session 4, item 1: the last grey on her face (`1ba72ba`; `s4-item1-head-before-after-x2.5.png`, `s4-item1-gameplay-frame-1024x768.png`)

The cause was one step further than session 3 found: the face stamp shades her nostrils and mouth corners in her swatch's deepest tone,
#a76057, which IS in the paint; the painter's colour budget then merges that rare tone, the whole tone at once, into a near colour of the
figure, her boots' #945d4f (counted in Node: 12 texels of #945d4f before the stamp, 19 after the budget). No list of her skin's colours can
name a colour the budget borrows from another material, so the held set alone could never cover it.

Test first (kit, `skin-hue.test.ts`): the base woman painted in each of the six kit skins and in a blue probe skin, front, three-quarter and
profile; every texel the probe paints blue and that changes under a far kit skin is skin. Failing before: exactly each swatch's line and fold
were missing (skinWarm #753b09 and #885041; skinGolden #733d3b and #945d4f; ...): the painter derives them for the skin and the held set
never had them. A second test dims every held colour one to three steps down its row: each stays inside its swatch's hue span. A third, a
cell with a stand-in nostril pair ringed by skin, an upper lip and a lone boot texel of the same colour.

The fix, generic and opt-in: the painter's kit entry adds `paintedTones` (additive; contract changelog and api pin); `skinColours` is the
skin's painted tones, line and fold included; `holdSkinHue` takes the cell's width and holds a stand-in (a colour within the budget's own
merge reach of a skin tone, of its hue) where the held skin closes round it (five of eight neighbours). A first try held the fold by colour:
the fold #885041 is her auburn hair's base tone, and her crown went the skin line's orange in play. So `sharedColours` names the skin
colours another material the character wears also paints (hers: #a76057, #753b09, #885041), held only where the skin rings them.

Measured in play, the hall's south wall (1024 by 768, the texel's centre): nostrils #655b56 / #6e6059 before, #774a3f / #875a4d after; mouth
corners #685f59 / #6c6159 before, #805548 / #815546 after: warm browns, as the reference's shadow. Looked at, before left, after right: the
grey smudge under the nose and the grey corners are gone. A single orange-brown texel sits at her left cheek's edge (the skin's own line,
#753b09, darkened along the skin's ramp); it reads as the jaw's edge at 1:1. Not touched: the hair (item 2). Recorded cells: none moved (the
painter's goldens pass, 730 tests; the hold is opt-in). Kit unit 373, game unit 446 pass.

## Session 4, item 2: the hair (cause found; no generic fix stands; `f69303f` for the face; `s4-item2-*.png`)

Her crown in play, texel by texel (the hall, 1024 by 768): warm browns (#87594a), a grey-mauve (#785652, #74514e, #7d5a57) and a maroon
(#5f302e, #613230, #683937, the "blotch" on her right side). Her painted front cell's hair is three tones above the eyes: #49251c (46 texels),
the auburn gloss's shine #a76057 (44), the base #885041 (33). Lit in Node under four room lights (cool to very dim), #49251c holds, #885041
plays #733d3b and #a76057 plays #904647 or #712b3b.

- **Stage by stage.** With the retro grade's `moodBlend` at 0 (`s4-item2-hair-grade-on-off-x2.5.png`, grade on left, off right) the crown's
  patch stays, pinker and less grey: the grey is the grade's saturation (.85) on a rose; the rose is the lit sprite's. The grade is the room's
  and is not changed.
- **Not a hue drift.** Auburn's paint spans 22 to 36 degrees of OKLab hue; every lit crown colour falls inside it (#904647 at 20.6 within five
  degrees, #733d3b at 23). DUEL has no lit brown between #885041 and #49251c in auburn's hue: row 2's step 1 is #662b29 (24 degrees, chroma
  .086), which is auburn's own paint[1] and where the room's darkening takes #885041. The maroon is that step; the mauve is the shine's rose.
- **Tried and dropped: holding the hair on its own ramp**, the same mechanism as the skin (built, tested, shot: `s4-item2-hair-held-try-x2.5.png`,
  before left, held right). It took the shine to a pale pink-tan band across the crown (it reads as scalp) and left the maroon (it is on the
  ramp). No evidence the hair needs the hold, so it is not in the kit. Clothes are not held either; they take the room's colour.
- **What would fix it is data, the Owner's call:** a hair ramp without a red step (DUEL offers none in auburn's hue on a lit step; #583126 is
  step 0, which the light holds unlit), or a browner hair swatch (the reference woman's hair is a mauve-brown, base-f's `hairBraid`). Not
  changed: the Owner chose auburn.

Found on the way, fixed (`f69303f`, kit, tests first): the skin's line #753b09 sat at the dark end of the held ramp, so her deepest tone and fold
darkened to an orange and her jaw edge played orange specks; a held texel now takes its swatch's painted ramp (`skinRamp`). The five-of-eight
ring became a border vote per patch (`holdHue`). `s4-item2-head-before-after-x2.5.png`: item 1's frame left, this one right: no orange speck at
the jaw, nostrils and mouth corners warm, the hair as it was.
