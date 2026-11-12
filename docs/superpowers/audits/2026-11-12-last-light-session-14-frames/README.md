# The Last Light, session 14: the lavender skin, Ada's clothes in the kit's shells, a close-up

Chromium on software GL (SwiftShader, `AF_WEBGPU=software`), 1024 by 768 for game frames (a field of 512 by 384, shown at 2x). WebKit, Firefox
and a real GPU did not run. The sheets are Ada's own painter cells through the kit (unlit, no grade, no LCD), drawn by a throwaway script
that was not committed. **No picture here meets the standard** (the Owner's ad: a head about 100 texels, flat clean planes of skin, a soft
three-tone hair mass, clean outline, plain calm cloth with real construction); each is judged below.

| File | What it shows, and the judgement |
| --- | --- |
| `crop-skin-before-unlit-after.png` | Ada's head in the opening at 5 s, x4: before (lavender-grey), unlit (the painter's own pink, far too bright for the room), after `holdSkinHue` (warm brown-pink, only darker). The hue is right; it is dim and muddy, because the room takes her three steps down. |
| `ada-before-d8.png` | Ada as she was at density 8 (session 13's outfit): a puffball bob with a beard-like hem, blotchy cream sleeves, no collar, pale blue blotches on the thighs, boots as lumps. Fails. |
| `ada-after-d8-x2.png`, `ada-after-head-d8-x3.png`, `ada-after-d4-d2-d1.png` | The kit's new shirt (collar, rolled sleeves with a cuff fold), waistcoat buttons, jeans (seam, waistband, cropped turn-up), boots (heel, toe cap): the construction reads; the hair, the hips and the cream peplum under the vest are still wrong. |
| `ada2-after-hair-body-d8-x2.png`, `ada2-after-head-d8-x3.png`, `ada2-after-d4-d2-d1.png` | After the coordinator's list: the painter's `bobFringe` (a dome with a fringe that ends at the jaw), hips 0.65, hands close, the vest to the waistband. A coherent person at density 8, 4 and 2. Still not the ad: the collar is a cream yoke, the V edge is a stair, the eyes are thin slits, the legs a little wide. |
| `frame-opening-t5-closeup.png`, `frame-opening-t8-closeup.png` | The close-up with the first outfit (superseded). |
| `frame2-opening-t5-closeup.png`, `frame2-opening-t8-closeup.png`, `crop2-closeup-face-t5-t8-x3.png` | The opening's shot 2 as a head-and-shoulders close-up with the fixed figure: 1.3 m from her face, lens 26 to 28, a zoom of about 8.5 to 9, her head about 85 field pixels, painted at density 8. The face is large and legible, with a clean bob and fringe, but dim and muddy under the room's light, the LCD mesh and the dither; the flat clean planes of the ad do not survive them. |

## What was found and built

- **The lavender skin.** `lightSprite` moves each texel along its own DUEL row. Ada's skin texels are on row 27, whose darker steps are
  554769, 765d73, 977488 and b98c93 (mauve and purple), and the room's flat light steps her down one to three steps; it also tints a quarter
  of the way toward the room's colour (d5a39a, row 27 step 4, goes to b98c93 neutral and b58b94 in a teal light). The LCD and the grade were
  never the cause. The kit's opt-in `holdSkinHue` takes each skin texel the room changes from the DUEL colour nearest its own hue at the shade
  the room gives it, lit by the same light with no colour of its own. Default off.
- **Clothes.** Generic options on the kit's shells: a `shirt` kind, waistcoat `buttons`, jeans `seam`, `waistband`, `crop`, `turn`, a boot's
  `heel` and `toe` cap. Tests first, at density 8 (`shirt.test.ts`, `ada-pieces.test.ts`). Recorded cells unmoved.
- **The close-up.** `content/cutscenes/opening.toml`, shot 2; `maxDensity: 8` in the game's `PLAY_FIGURE`.

## Not done

A pure `cameraAt(t + lead)` on the cutscene director and the kit pre-warming a cut's density (the close-up's first frame still pays for the
density-8 cell); a byte cap on the cache and the measure of a walk's; a close-up for the other cutscenes (the nurse in lights-out); the V
edge of the waistcoat; the 5-head against the 7-head Ada; the lime tiles, the EXIT halo, the curtain screen, task 18's shell half, task 16.
