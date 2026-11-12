# The Last Light: Ada and the night nurse, looking good

Branch `claude/last-light-figures-look`. The Owner on the 2026-11-12 frame: "iterate on the characters until they look good, she
looks frumpy". Every sheet here is painted in Node by the kit's own helpers (`extensions/character-kit/src/testing/`) and drawn
up by `pnpm --filter @automata/character-kit sheet <out-dir> <round> --old <old-game-checkout>`
(`extensions/character-kit/scripts/figure-sheet.ts`). The numbers files come from the pictures, never typed. The old game is
`mcthaydt/PixiJS3D_Experiment_001` at `92e6704`; its figures are its committed review sheets (`docs/art/ada-figure/ada-review.png`,
`docs/art/nurse-figure/nurse-review.png`), cropped by their grid. Those sheets hold two kinds of row: the **procedural** figure (the
old painter, which our painter descends from; Ada row 7, nurse row 3) and the **approved hand-painted atlas** (Ada row 1, nurse row
1), which is what the old game actually shipped and what "looking good" meant there.

Progress: **round 3 of 3 sheeted** (about 85 %). Round 0 look before touching, round 1 data, round 2 painted garments as generators,
round 3 the nurse's cut (choices open), and the list for the painter, kept as it goes. Left: the Owner's picks, hair as data if the
Owner allows it, the in-game frame.

## Round 0: as they are now

| Sheet | What it shows |
| --- | --- |
| [`round0-ada-play.png`](round0-ada-play.png) | Ada at the size she is played (density 1), each texel 4 pixels, on a mid-dark floor: ours, 8 views, the old procedural figure, the old hand-painted atlas, then our walk, 8 poses. |
| [`round0-ada-detail.png`](round0-ada-detail.png) | Ada at density 2 (each texel 2 pixels so the drawing reads): 8 standing views and 8 walk poses. |
| [`round0-ada-numbers.txt`](round0-ada-numbers.txt) | Silhouette widths and each cloth's texels and rows, ours against the old. |
| [`round0-nurse-play.png`](round0-nurse-play.png), [`-detail.png`](round0-nurse-detail.png), [`-numbers.txt`](round0-nurse-numbers.txt) | The same for the night nurse. |

### Why Ada reads frumpy (measured, front view, density 1)

| | old procedural | old hand-painted | ours |
| --- | --- | --- | --- |
| height in texels (162 cm) | 59 | 61 | **64** |
| shoulder / waist / hip width | 14 / 16 / 18 | 17 / 19 / 20 | **18 / 20 / 24** |
| hip width / height | 0.305 | 0.328 | **0.375** |
| waistcoat texels, widest, rows (share of height) | 100, 10, 0.25-0.46 | 92, 10, 0.23-0.43 | **193, 14, 0.20-0.47** |
| trouser width at the hip, at the hem | 10-11, 8 | 13 | **16, 14 (cuff 9)** |
| boot shaft showing | 0.83-0.97 of the height, 70 texels | 0.74-0.97, 55 | a stump |

1. **The trousers are cloth shells; the old trousers were paint.** The old `trousers` item only recoloured the body's own thigh,
   knee and shin (`garments.ts`: `r.pelvis = r.thigh = r.knee = r.shin = item.trousers`), so the legs stayed the slim limb the sliders
   made. The kit's `trousers` (`legsOf` in `shells.ts`) is a shell: the torso and each leg grown 1.5 clearances and straightened
   to the knee's width x 1.05, so both legs are one block 16 wide at the hip (the old 10) and a pipe of 14-15 to the cuff. This is the
   biggest reason she reads wide at the hip (24 against 18) and short in the leg. The sliders are not the cause: the new `chunk` thickens
   the limbs less than the old one did (leg x1.2 at 1, not x1.35).
2. **The boots are lost under the trousers.** The old boot was a box of leather on the shin, 0.22 of its length, over the trouser
   colour. Ours is a shaft grown 2.4 clearances over a trouser shell of 1.5, so only a stump below the cuff shows, and the cuff
   falls over it: shoes under baggy trousers, not boots under slim ones. The old Ada's boots are 14-23 % of her height.
3. **The waistcoat is a tube, not a vest.** The old one was a cropped chest piece (a tapered box of half-height 0.13 k, cut open
   at the front), 21 % of her height and 8-10 wide. Ours is the whole torso shell grown 1.6 clearances from the shoulder to the
   belt: 27 % of her height, 12-14 wide, 193 texels against 100, with a small shirt patch for a V. It covers the shoulder line and
   the waist, widens toward the hem (12 at the chest, 14 at the bottom), and nothing cinches: she is a column from shoulder to
   belt. The cream sleeves are stubs (43 texels against 62).
4. **The sliders do not mean the same here.** `genes.ts` changed after the old file: the head is 0.11-0.16 of the height, not 0.13-0.20
   (Ada's 0.87 is 0.158 H now, 0.203 H then, a fifth smaller); the neck 0.02-0.07, not 0.008-0.06; the legs' share 0.48-0.56, not
   0.44-0.54 (longer, good); the pixel build (`chunk`) thickens arms x1.3 (was 1.5), legs x1.2 (1.35), feet x1.25 (1.5), the waist
   x1.06 (1.18). Net, the body is leaner and the head smaller than the old, so these are data to map by eye in round 1, and the
   garments above are what makes her wide.
5. **She is 8 % taller on the page than the old Ada** for the same 162 cm (64 rows, 59): the cause is not yet isolated (the stand, the
   hair's height and the head all differ); next to the old figure at the same scale she is a bigger person.
6. **The hair is a helmet with a tail.** `smoothBob` is a crown cap and 22 ropes of 0.35 m: from the front a smooth cap, from the
   side a long low tail hanging at the nape (`LEFT`, `RIGHT`), where the old bob has a fringe, volume at the ears and a turned-under
   hem. Ada's hair is 46 texels, the old 88 (half the hair).
7. **Gait and stand.** The builder's `brisk` is a tamer gait than the old one (lean 0.04, was 0.12; `hipYaw` 0.10, was 0.18;
   `crouch` 0.008, was 0.04; `lift` 0.06, was 0.09; `elbowSwing` 0.35, was 0.5). The six overrides copied from the old file do not
   carry the old values, so she walks upright with her arms drifting, not brisk. The standing view has her hands at her thighs and
   her feet together; no weight on a leg (`stance` 0, `shift` 0).
8. **Colour.** The ramps are the old ones, but big flat areas read: the maroon vest and the denim are one 12-16 texel mass each, with
   a blotch of the lighter denim step on each thigh and knee where the old legs had a single dark step with a light waist. The
   outline is the same.
9. **The face at density 1** is a lid line and a mouth: with her head turned 0.15 and a smooth cap of hair around it, the face is
   a small light oval; the old fringe frames it.

### Why the night nurse reads as a tall woman in a white dress, not uncanny

| | old procedural | old hand-painted | ours |
| --- | --- | --- | --- |
| height in texels (210 cm) | 71 | 75 | **80** |
| shoulder / waist / hip | 18 / 18 / 22 | 20 / 23 / 26 | 19 / 19 / 22 |

1. **She stands upright.** The old figure (`uncanny` gait) stoops and cocks her head: 71 texels for 210 cm against our 80, so she
   is 11 % shorter on the page because she leans. Ours has `loose`, which has no such stand and the old arm override only. This is
   the main thing: it is the gait (HELD).
2. **Her face shows.** The old curtain of hair covers it, which is the whole of the uncanny; our `fallLong` hangs down her back, so
   the face is a blank, pale, peach-grey mask under the cap. Blank can read uncanny, but it reads as a mannequin because the hair
   frames it prettily (HELD).
3. **The cap is a bowl.** It sits on the crown like a beret; the old cap is a flat band at the front with the cross.
4. **The arms hang stiffly at the sides** in an A, where the old arms hang forward from bent elbows (the old 0.99 `arms` slider is
   the same; the idle elbow is not).
5. **Her skirt is a smooth bell** (no folds, HELD) with a ragged stain: the stain is right (80 texels against 73); the hem's line
   is clean and round where the old one is torn.
6. **The top is a box** (shoulder 19, waist 19): it does not taper to the waist and the belt reads as a seam.

## Round 1: data (sliders, gait, an outfit item)

Merged `origin/claude/last-light-prologue` first (already up to date). One family changed: the cast data in
`games/the-last-light/src/features/figures/` (`cast.ts`, the old gaits in `old-gaits.ts`) and its test.

| Sheet | What it shows |
| --- | --- |
| [`round1-ada-variants-play.png`](round1-ada-variants-play.png) | Ada at play size, ×4, under the old game's two Adas: BEFORE (round 0), A, B (adopted), C, four views and four walk poses each. |
| [`round1-ada-variants-detail.png`](round1-ada-variants-detail.png) | The same four at density 2. |
| [`round1-ada-play.png`](round1-ada-play.png), [`-detail.png`](round1-ada-detail.png), [`-numbers.txt`](round1-ada-numbers.txt) | The adopted Ada alone, 8 views and the walk, and the numbers. |
| [`round1-nurse-variants-play.png`](round1-nurse-variants-play.png), [`-detail`](round1-nurse-variants-detail.png), [`round1-nurse-play.png`](round1-nurse-play.png), [`-detail`](round1-nurse-detail.png), [`-numbers.txt`](round1-nurse-numbers.txt) | The same for the night nurse. |
| [`figure-looks.ts`](../../../../extensions/character-kit/scripts/figure-looks.ts) | Every round's variants as data over the cast file (`round1-ada`, `round1-nurse`, `round2-ada`, `round2-vest`, `round3-nurse`), for `pnpm --filter @automata/character-kit variants <out-dir> <name> <ada\|nurse> <look> --old <old-game>`. |

**Ada, four versions** (front view, texels):

| | height | shoulder / waist / hip | hip / height |
| --- | --- | --- | --- |
| old procedural / old hand-painted | 59 / 61 | 14, 16, 18 / 17, 19, 20 | 0.305 / 0.328 |
| BEFORE (round 0) | 64 | 18, 20, 24 | 0.375 |
| A: the old brisk gait whole, and the kit's `jeans` for `trousers` | 64 | 18, 20, 22 | 0.344 |
| **B (adopted): A and a leaner build** | 64 | 16, 18, 20 | 0.313 |
| C: B at 152 cm | 59 | 16, 16, 20 | 0.339 |

- A: the whole old `brisk` walk goes over the builder's (lean 0.12, hipYaw 0.18, crouch 0.04, lift 0.09, elbowSwing 0.5) and
  `jeans` take the place of `trousers`. The jeans are the kit's one-clearance cut: the leg stops being a pipe of 16 and the boot
  shaft shows under it. That is the one visible change.
- B: Ada's sliders mapped by what she looks like, not the numbers: `chunk` 0.6 to 0.2, `fat` 0.2 to 0.05, `muscle` 0.5 to 0.3, `hips`
  0.37 to 0.2, `legs` 0.3 to 0.6, `shoulders` 0.47 to 0.55 (the old numbers drew a thin figure, these draw a lean one now, and the new
  `chunk` thickens the limbs by less). Her hips are 0.313 of her height against the old 0.305 and her shoulders 0.250 against 0.237.
- C: the old Ada is 59 rows tall for 162 cm and ours 64. Nothing in the data says why (the head, the hair and the stand all differ).
  At 152 cm she is 59 rows like the old one; it is her canon height changed on the page's account, so **it is the Owner's call**.
- What data cannot do: the waistcoat is still a column from shoulder to belt (166 texels against 100), the cuff of the jeans
  still falls over the boot's top, and the bob is still a helmet with a tail. These are round 2 (the garments) and the painter's.

**The night nurse, four versions** (front view, texels):

| | height | shoulder / waist / hip |
| --- | --- | --- |
| old procedural / old hand-painted | 71 / 75 | 18, 18, 22 / 20, 23, 26 |
| BEFORE (round 0) | 80 | 19, 19, 22 |
| **A (adopted): the old `uncanny` gait whole** (slow cycle 0.8, drag 0.6, the head leading, six poses a step, no shuffle), arms as close as before | 80 | 18, 20, 22 |
| B: A and her head cocked further (`headTilt` 28, `headPitch` 0.4, `posture` 0.3) | 77 | 18, 20, 22 |
| C: A at 200 cm | 76 | 18, 18, 22 |

- A moves the walk (slower, the feet dragging, six poses), not the stand: standing she looks as she did.
- B moves her a texel or two: the builder's stand holds a figure upright whatever the sliders say. The stoop of the old figure
  (71 rows for 210 cm) needs a stand of its own, so it is in `HELD` and on the painter's list.
- I did not take the old arm flare (`armOut` 0.2): it holds her arms out like a coat hanger on the new body (tried, and left
  out of the adopted data).

The test (`tests/unit/features/figures/cast.test.ts`) was widened first and watched failing: Ada's sliders are the old file's with
the six retunes named, her gait is the old `brisk` whole, her outfit is the old one with `jeans` for `trousers`, the nurse's gait is
the old `uncanny` whole, and `HELD` names her stoop where it named her gait.

## Round 2: the kit's painted garments as generators

Merged `origin/claude/last-light-prologue` first (already up to date). The kit's garments now have options a character's data sets, and
every character's clothes take them: a **waistcoat** cut from the torso (`fit` 0 loose to 1 closed in at the waist, `length` 0 at the
waist to 1 at the hip, `armhole` 0 to 1 narrower across the shoulder so the shirt shows), and **legs** that taper (`taper` 0 a pipe
from the knee, 1 the leg's own narrowing to the ankle, on `jeans` and on `trousers`). The tests came first, each watched failing for the
right reason (`extensions/character-kit/tests/unit/fashion/cut.test.ts`: the cloth's own rows, from the picture, with the option at
either end). No new per-character code: Ada's data sets the options.

| Sheet | What it shows |
| --- | --- |
| [`round2-ada-variants-play.png`](round2-ada-variants-play.png), [`-detail.png`](round2-ada-variants-detail.png) | Ada: BEFORE (round 1's cut), A (waistcoat fitted and cropped at the waist, jeans tapered 0.7), **B (adopted: A and an armhole)**, D (B and a brown belt), C (B with the vest to the hip). |
| [`round2-ada-play.png`](round2-ada-play.png), [`-detail.png`](round2-ada-detail.png), [`-numbers.txt`](round2-ada-numbers.txt) | The adopted Ada alone, 8 views and the walk, and the numbers. |
| [`round2-vest-options-detail.png`](round2-vest-options-detail.png), [`-play.png`](round2-vest-options-play.png), [`-diff.txt`](round2-vest-options-diff.txt) | The options on another kit outfit: the figure builder's base pair in a tee, a waistcoat and jeans, the legacy cut against `fit` 1, `length` .05, `armhole` 1. |

What moved: **nothing that already draws.** A generator gains options and does not change what existing data draws, so the waistcoat's
defaults are the legacy cut (`fit` 0, `armhole` 0, the hem a hand over the belt) and Ada's data sets her own options. The test
[`waistcoat-default.test.ts`](../../../extensions/character-kit/tests/unit/fashion/waistcoat-default.test.ts) pins it: the base pair in a
tee, a waistcoat and jeans, eight views at density 2 each, cell by cell (a SHA-1 of every cell recorded from the commit before the
options, `a76c7863`); it was watched failing with an earlier default (`fit` 0.6, `armhole` 0.5) and passes with the legacy one, which
needed the hem and the clearance written exactly (a `lerp` of 1.6 and 1.6 is not always 1.6). No golden file moved: the kit's runway and
core goldens and all the unit tests pass. The trousers' and jeans' `taper` defaults to 0, the same pipe as before.

The options' effect on a figure that is not Ada: the base pair's cells with the options set, against the legacy cut, differ by 1741
texels (base-m) and 1474 (base-f) over eight views at density 2 (`round2-vest-options-diff.txt`, the sheet beside it): the vest closes in
at the waist and ends there, and the shirt shows at the shoulder, on any body.

**Ada, front view, play size** (texels):

| | waistcoat texels | widest | rows (share of her height) |
| --- | --- | --- | --- |
| old procedural | 100 | 10 | 0.25-0.46 |
| round 1 | 166 | 14 | 0.20-0.44 |
| **round 2 (B)** | **144** | **12** | **0.20-0.42** |

- The vest ends at her waist and the jeans' own waist shows under it, where round 1's vest ran to the belt as a tube; the jeans end in
  a slimmer hem (0.7 of the leg's own narrowing); the shirt's sleeve shows at the shoulder. The change at play size is small (a texel
  here and there), which is what a garment can do on this body: the cloth cannot be narrower than the body under it.
- **D, a belt**: it draws a waist the body has not got. It is an outfit choice (the old street outfit has none), so **the Owner's call**.
- What the generator cannot do: the torso under the vest is the painter's body, and the face, hair and stand are still the painter's.

## Round 3: the night nurse's cut (choices open, nothing adopted)

Data only, over round 1's nurse: her skirt's options (`length`, `flare`, both the kit's) and her belt. Taste decides, so the cast file is
**unchanged** and the Owner picks. [`round3-nurse-variants-detail.png`](round3-nurse-variants-detail.png),
[`-play.png`](round3-nurse-variants-play.png), the variants are `round3-nurse` in [`figure-looks.ts`](../../../../extensions/character-kit/scripts/figure-looks.ts).

| | what differs | waist width at play size |
| --- | --- | --- |
| BEFORE | flare .3, length .42, the belt (the old outfit) | 20 |
| A | no belt: the top falls straight into the skirt | 20 |
| B | a straighter skirt (flare .1), a hand longer (length .5), the belt | 18 |
| C | B and no belt: one long, plain line | 18 |

- The belt reads as a grey ring (it stands three clearances off the cloth); without it she reads as one worn dress. It is a piece of the old outfit, so keeping or dropping it is the Owner's call.
- B and C make her skirt a column, not a bell: the waist narrows by two texels and the hem no longer flares over her legs.
- Her cap, her face and her hair are the painter's (the cap is a bowl, the face a blank, the hair a fall down her back): see the table
  below.

## Waiting for the painter (the fold, `claude/builders-fold-figures`)

Kept here as it grows. Each needs a hair piece, a gait entry or a pose in the painter, which this branch does not patch.

| Needs the painter | Why | What it would improve |
| --- | --- | --- |
| The old `bob` hair piece | `smoothBob` is a crown cap and ropes hung from the nape: a helmet with a tail | Ada's head: a fringe, volume at the ears, a turned-under hem (half the old hair's texels) |
| The nurse's `curtain` | no piece hangs a panel across the face | the uncanny: her face hidden, not a blank mask under the cap |
| A stooping stand | the stand holds a figure upright whatever the sliders (round 1, variant B) | her old shape: 71 rows for 210 cm, leaning down |
| Skirt pleats (`folds`) | the painted skirt is a smooth profile of rings | the torn, hanging hem |
| A cap that sits as the old one: a flat band over the brow | the headwear table's cap is a bowl | the nurse's head |
| A brisk, leaning stand and pose for Ada standing | the stand is the builder's relaxed one: feet together, arms at the sides | her first-night posture |
| Eyes at density 1 | the front view at play size draws no eyes (a lid line at most), where the old painter's figure showed two dark dots | Ada's face at the size she is played |

## Log

- Round 2: waistcoat `fit`, `length` and `armhole` and legs' `taper` in the kit's garments (`accessories.ts`, `shells.ts`, `garments.ts`),
  `cut.test.ts` written first, `waistcoat-default.test.ts` pinning the legacy default; Ada's waistcoat and jeans set the options; `figure-variants.ts` can count the texels two variants differ by.
- Round 1: the old `brisk` and `uncanny` gaits whole as overrides (`old-gaits.ts`), Ada's six retuned sliders and `jeans`, the cast test
  widened first, `figure-variants.ts` and its looks (`figure-looks.ts`); sheets and numbers above. Merge of `origin/claude/last-light-prologue`:
  already up to date.
- Round 0: kit testing helpers `paintedStand`, `paintedWalk`, `rowWidths`, `silhouette` and a PNG/raster kit (`raster.ts`) with their
  unit tests (watched failing first); the sheet script; the round 0 sheets.
