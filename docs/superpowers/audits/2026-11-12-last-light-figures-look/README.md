# The Last Light: Ada and the night nurse, looking good

Branch `claude/last-light-figures-look`. The Owner on the 2026-11-12 frame: "iterate on the characters until they look good, she
looks frumpy". Every sheet here is painted in Node by the kit's own helpers (`extensions/character-kit/src/testing/`) and drawn
up by `pnpm --filter @automata/character-kit sheet <out-dir> <round> --old <old-game-checkout>`
(`extensions/character-kit/scripts/figure-sheet.ts`). The numbers files come from the pictures, never typed. The old game is
`mcthaydt/PixiJS3D_Experiment_001` at `92e6704`; its figures are its committed review sheets (`docs/art/ada-figure/ada-review.png`,
`docs/art/nurse-figure/nurse-review.png`), cropped by their grid. Those sheets hold two kinds of row: the **procedural** figure (the
old painter, which our painter descends from; Ada row 7, nurse row 3) and the **approved hand-painted atlas** (Ada row 1, nurse row
1), which is what the old game actually shipped and what "looking good" meant there.

Progress: **round 4 done** (Ada, about 70 % of the whole job): her fringe, open waistcoat, legs and the back of her bob worked as
generators and data; the in-game pair for her next; **round 5 (the night nurse) not started**. Round 3: Ada's face, stand and hair adopted, the nurse's cut open. Round 0 look before touching, round 1 data, round 2 painted garments as generators,
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

## Round 3: Ada's face and stand (adopted), the night nurse's cut (open)

### Why Ada had no face in the front view, and the fix (data)

The painter's **drawn** face (`face.drawn: true`, the old file's) paints an eye from density 2 up; at the play size (density 1) it is a
lid line and a mouth, and the bob's fringe covers the eye row, so the front view is a blank oval (round 0's sheets). Nothing in the
painter is wrong there: it is the cast's data. The builder's **decal** face (`face.drawn: false`) is two dark eye dots, and that is what the
old figure showed at this size. Ada's `face.drawn` is now `false` (the old file's `camera` .6, `turn` .15 and `blink` stay). The test
`shows Ada's eyes from the front at the size she is played` finds an eye pair in the picture (two dark texels two to seven apart on one row, each
with skin beside it) and was watched failing with `drawn: true`. A close-up (density 2 or 4) wants the drawn face back, as a cutscene key
that asks; the figure view only draws the play size today. What the painter could still do: draw the eye at density 1 over a fringe.

### Her stand and her walk, one old number at a time

[`round3-ada-variants-play.png`](round3-ada-variants-play.png) and [`-detail.png`](round3-ada-variants-detail.png), the adopted Ada alone in
[`round3-ada-play.png`](round3-ada-play.png), [`-detail.png`](round3-ada-detail.png), [`-numbers.txt`](round3-ada-numbers.txt).
The old file zeroed her weight on a leg and cut her arm; the old brisk gait's own numbers put them back.

| | what it does | shoulder / waist / hip |
| --- | --- | --- |
| BEFORE (round 2) | weight on neither leg, the arm near straight, the drawn face | 16, 18, 20 |
| A | the decal face: two eye dots | 16, 18, 20 |
| B | A and `stance` .04, `stanceLead` .08, `shift` .012: weight on one leg, one hip up, a shoulder down | 17, 17, 21 |
| **C (adopted)** | B and `idleElbow` .45, `hang` .12: a bent, hung arm, the brisk gait's own | **17, 17, 19** |
| D | C with `standOut` .05 (arms near the body) and `face.turn` .5 | 17, 17, 19 |

The atlas is 17, 19, 20 at 61 texels; the old procedural 14, 16, 18 at 59; adopted Ada is 17, 17, 19 at 64 (hip/height .297); with the bob below, 15, 17, 19 at 65 (the fringe and mass add a row on top and the stand's shoulder moves a texel: `round3-ada-numbers.txt` is measured with it).
`cast.test.ts` was changed first and watched failing: her gait overrides are the old brisk whole and her `armOut` (the old file's
zeroed stance and cut elbow are gone), her face is the old one but `drawn`.

### A bob with a fringe and volume at the ear (kit hair style, built from the builder's own pieces)

Three generic styles in the kit's table (`extensions/character-kit/src/features/fashion/hair.ts`, data only: a scalp shell with a
hairline brought down to the brow and lifted off the skull, and a fall with more clumps and more volume), against the helmet `smoothBob`.
The test `hair-bob.test.ts` was written first and watched failing (no such styles); it measures from the picture on a fair head: the
hair's texels at the play size, its widest row at density 2, and the first row of the face's skin over its middle (a fringe pushes
it down). Sheets: [`round3-hair-ada-play.png`](round3-hair-ada-play.png), [`-detail`](round3-hair-ada-detail.png), and on the builder's base
woman [`round3-hair-woman-detail.png`](round3-hair-woman-detail.png), [`-play`](round3-hair-woman-play.png); numbers in
[`round3-hair-numbers.txt`](round3-hair-numbers.txt).

| | what it is | Ada's hair texels, front at play size | widest row at density 2 |
| --- | --- | --- | --- |
| BEFORE `smoothBob` | the helmet with a tail | 45 | 20 |
| A `bobFringe` | a fringe, volume at the ear | 70 | 22 |
| **B `bobFringeFull` (adopted for Ada)** | more mass at the ear, a longer line (curl .1) | **82** | **24** |
| C `bobFringeShort` | A to the jaw | 70 | 22 |

The old Ada's hair is 88 texels (the old atlas 89). Ada wears B, the nearest to the old; A and C are the Owner's to pick (the style is
one word in her outfit). The fringe is at the brow (hairline height 0.12 on the skull; a fringe lowered to 0 touches the eyes and
below that covers them, as the sweep of fringe heights on Ada at density 2 showed). A fold of the ends under (a bob's turned hem) and a
side part need a hair piece of the painter's, so they stay on the painter's list.

### What `knip` and `check:changesets` say here (so it is clear whether they are real)

- `knip` says: two `ERROR: Error loading site/vite.config.ts` and `site/playground/vite.config.ts` (`File './.svelte-kit/tsconfig.json' not
  found`: SvelteKit's generated file, made by `svelte-kit sync`, which this container did not run); then `Unresolved imports` of `./$types`
  in eight `site/src/routes/**` files (the same generated types), six `Unused files` under `site/playground/` (their entries are not
  found with the config unloaded), two unused dependencies of `site` and two unused exports in
  `site/src/features/playground/protocol.ts`. All of it is `site/` with its generated types missing: an artefact of this container, not of the
  branch. None names a file of this work; the first run also named my variants files under `docs/`, which are now one script that
  `figure-variants.ts` imports.
- `check:changesets` runs `changeset status --since=origin/main` and fails with `Error: Failed to find where HEAD diverged from
  "origin/main". Does "origin/main" exist and it's synced with remote?`: this clone has no `origin/main` ref (only the two branches
  were fetched). An artefact of this container too. No published package is changed by this work (the kit and the game are private).

### The night nurse's cut (choices open, nothing adopted)

Data only, over round 1's nurse: her skirt's options (`length`, `flare`, both the kit's) and her belt. Taste decides, so the cast file is
**unchanged** and the Owner picks. [`round3-nurse-variants-detail.png`](round3-nurse-variants-detail.png),
[`-play.png`](round3-nurse-variants-play.png), the variants are `round3-nurse` in
[`figure-looks.ts`](../../../../extensions/character-kit/scripts/figure-looks.ts).

| | what differs | waist width at play size |
| --- | --- | --- |
| BEFORE | flare .3, length .42, the belt (the old outfit) | 20 |
| A | no belt: the top falls straight into the skirt | 20 |
| B | a straighter skirt (flare .1), a hand longer (length .5), the belt | 18 |
| C | B and no belt: one long, plain line | 18 |

- The belt reads as a grey ring (it stands three clearances off the cloth); without it she reads as one worn dress. It is a piece of the old
  outfit, so keeping or dropping it is the Owner's call.
- B and C make her skirt a column, not a bell: the waist narrows by two texels and the hem no longer flares over her legs.
- Her cap, her face and her hair are the painter's (the cap is a bowl, the face a blank, the hair a fall down her back): see the table
  below.

## Round 4: Ada's fringe, waistcoat, legs and the back of her bob

Merged `origin/claude/last-light-prologue` first (clean). The coordinator's read of round 3 had four faults and a keeper (the boots); each
was diagnosed from the picture and fixed as a generator option or data, test first, each test watched failing for the right reason.
Sheets: [`round4-ada-variants-play.png`](round4-ada-variants-play.png) (the two old rows on top, then BEFORE, A (adopted), B, C, D, each
as four stands and four walk poses, texels ×4), [`-detail`](round4-ada-variants-detail.png) (density 2), numbers in
[`round4-ada-variants-numbers.txt`](round4-ada-variants-numbers.txt); the adopted Ada alone with the old figures' numbers:
[`round4-ada-play.png`](round4-ada-play.png), [`-detail`](round4-ada-detail.png), [`-numbers.txt`](round4-ada-numbers.txt).
The variants are `round4-ada` in [`figure-looks.ts`](../../../../extensions/character-kit/scripts/figure-looks.ts).

| | BEFORE (round 3) | **A (adopted)** | what changed it |
| --- | --- | --- | --- |
| skin above the eyes, front, play size | none (hair on the eye row) | a row | the fringe's edge on the skull, 0.12 to 0.3 (hair.ts `FRINGE`) |
| shirt texels (cream) | 36 | **65** (old procedural 62, atlas 63) | `open`, `chest`, `hem`, `neckline` on the waistcoat |
| waistcoat texels (maroon) | 129 | **105** (old 100 / 92) | the same |
| floor between the legs, knee to ankle, texels | 0 | **10** (5 rows) | `taper` 1, `gap` 1 on the jeans, the hips slider .9 |
| hip row / hip over height | 19 / 0.292 | **21 / 0.323** (old 18 / 0.305, atlas 20 / 0.328) | the hips slider |
| hair, back view, last row below the head's top (density 2) | 39 | 39 (B: 32) | `bobFringeBlunt` is B, not adopted |

**Item 1, the fringe covers her eyes.** True: the old eye test passed because it only asked for two dark texels with skin beside them, and
the fringe's lower row (29) sat directly on the eye row (30), so the eyes read as part of one dark band. The test now also needs skin right
above each eye (`cast.test.ts`, watched failing at 0.12). The painter's decal eyes are fixed: one texel each, two apart (the old figures'
are two tall and four to six apart; that is the painter's, on the table below). The kit's three bob styles share one fringe line; its front
height is now one number. 0.2 passed, then failed once the wider hips moved the head by a sub-texel (the edge sat on a texel's boundary), so it
is 0.3, which keeps a row of forehead and most of the fringe (the sweep: 0.2, 0.3 and 0.4 and over leave one skin row, then a thinner fringe).

**Item 2, the waistcoat is open.** The waistcoat gained `open` (0 the V of shirt it always had, 1 a strip of the shirt from the collar to
the hem), `chest` and `hem` (the strip's half-width at the neck and the hem as a share of the torso's half-width there, default .3 and .2)
and `neckline` (how far below the neck it starts, so the shirt's collar shows). Tests first (`cut.test.ts`: the shirt's texels between the
vest's two sides, from the picture, with each option at either end). `waistcoat-default.test.ts` still pins the legacy cut. Ada: `open` 1,
`chest` .4, `hem` .3, `neckline` 1. The strip reads as an open vest on a shirt, as the atlas has it; the old procedural has a scooped
collar and no strip. **Nearer to: the atlas** here.

**Item 3, the legs, diagnosed.** The hypotheses, one by one:
- The jeans' shells merge two legs: partly. With `taper` .7 each shin is 70 % of the way from the knee's width to its own, so the cloth is
  a pipe; `taper` 1 alone opens 14 texels of floor in the base figure at density 2 and none at play size.
- `track`: no effect on the stand. The stand's feet are the builder's relaxed stand: the weight foot is drawn in 25 % toward the middle,
  both feet at 0.75 of the hip joints' half-width, whatever `track` says (it only sets the walk).
- The body itself: the bare legs, no jeans, have 0 texels of floor between them at play size too (the painter outlines each leg, so two
  legs 4.4 texels apart and 4 wide with their outlines touch). The sliders cannot widen it enough: `hips` at 1, `chunk` 0, `muscle` 0
  together still give one texel on one row.
- So the stand is the limit, and the slider that spaces it is `hips`, which round 1 had taken down to .2 for a leaner pelvis. With `taper` 1
  and `gap` 1 the floor between the legs at play size is 0 at hips .2 to .4, 1 at .5, 2 at .6, 5 at .7 and .8, **10 at .9** (and at 1): the
  hips slider is set to .9, at a cost of two texels on the hip row (19 to 21). I first set the joint's gene directly (`genes.hips` .11),
  which draws the same pixels as the slider at .9; the slider is the plainer data, so it is the slider.
The generator option is `gap` on `jeans` and `trousers` (`legsOf`): 0 the cloth clears the leg all round (as before), 1 the inside of each
leg's cloth lies on the leg and only the outside keeps the clearance, ramping in from the hip to the knee. It cannot open floor the body
has not got, so alone it adds floor only where the body has some (14 to 18 texels in the base figure at density 2 with `taper` 1); with
the hips slider at .9 it makes 10 at play size. Tests: `cut.test.ts` (the floor at the knee and the shin, `rowGaps`, a new testing helper with its own
test; the outer line is unchanged) and `legs-default.test.ts`, which pins the base pair's trousers, wide tapered trousers and tapered
jeans, eight views each, recorded before the option. **Nearer to: the procedural** (two legs with floor between); the atlas has boots
over jeans, which ours does not.

**Item 4, the back of the bob.** The fall's `length` at 0.1 removes the tail and a raised back line (the hairline of what hangs, -0.2 at the
nape) lifts the hem: style `bobFringeBlunt`, hem 7 rows higher at density 2 with the ear's mass unchanged (`hair-bob.test.ts`, written first,
failed on the missing style). **It still tapers to the nape**: from behind the hair is a bell narrowing from 28 wide to 10, so a hem as
wide as the ears is not a thing the pieces do (every line and volume I tried narrows). It is the Owner's bob, so Ada keeps `bobFringeFull`
and `bobFringeBlunt` is variant B; on the painter's list.

**Not changed: the boots (kept), the belt (off), her height (162), variant D's arms and head turn, the nurse's cut.**

**Choices open for the Owner:** B (the blunt bob), C (a narrower strip of shirt), D (the legs together, hip 19).

### Verification

`pnpm --filter @automata/character-kit test:unit`: 35 files, 279 tests; the game's `vitest --project unit`: 51 files, 365 tests; typecheck
of both clean; biome on the files touched (its seven warnings are the existing `3.1416` literals). No golden moved: the kit's runway cells
and core goldens pass, and the pinned cells of the base pair for the waistcoat and for the three leg cuts are unchanged.

## Waiting for the painter (the fold, `claude/builders-fold-figures`)

Kept here as it grows. Each needs a hair piece, a gait entry or a pose in the painter, which this branch does not patch.

| Needs the painter | Why | What it would improve |
| --- | --- | --- |
| The old `bob`'s turned-under hem and parting | `bobFringeFull` and `bobFringeBlunt` (kit styles of the builder's pieces) have the fringe and the mass at the ear; from behind the hair still narrows to the nape (28 wide to 10), where the old bob's hem is as wide as the ears, and no piece turns it under or parts it | the last of Ada's hair: the old bob's shape |
| The nurse's `curtain` | no piece hangs a panel across the face | the uncanny: her face hidden, not a blank mask under the cap |
| A stooping stand | the stand holds a figure upright whatever the sliders (round 1, variant B) | her old shape: 71 rows for 210 cm, leaning down |
| Skirt pleats (`folds`) | the painted skirt is a smooth profile of rings | the torn, hanging hem |
| A cap that sits as the old one: a flat band over the brow | the headwear table's cap is a bowl | the nurse's head |
| A brisk, leaning stand and pose for Ada standing | the stand is the builder's relaxed one: feet together, arms at the sides | her first-night posture |
| The decal face's eyes | the decal eyes are one texel each, two apart (the old figures': two texels tall, four to six apart, black) | Ada's face at play size: bigger, wider-set eyes |
| A wider stand | the relaxed stand draws the weight foot in 25 % and keeps the other near it, so two legs touch at play size; Ada's hips slider is at .9 to open them (the hip row grows two texels) | legs that stand apart without a wider pelvis |
| The drawn face's eyes at density 1 | the drawn face is a lid line there (eyes from density 2), under a fringe: Ada uses the decal face for now | a face with a mouth and a nose at play size, not two dots |

## Log

- Round 4: the fringe's height as one number (0.3), the waistcoat's `open`, `chest`, `hem` and `neckline`, `gap` on the jeans and trousers, `bobFringeBlunt`, `rowGaps`; Ada's eye test widened, her waistcoat, jeans and hips slider set; `legs-default.test.ts`; the variants script writes its own numbers.
- Round 3: the kit's `bobFringe`, `bobFringeFull` and `bobFringeShort` hair styles (`hair-bob.test.ts` first), Ada wears `bobFringeFull`; Ada's `face.drawn: false` (eyes at play size), her stance and arm from the old brisk gait, the eyes test, the nurse's cut sheeted.
- Round 2: waistcoat `fit`, `length` and `armhole` and legs' `taper` in the kit's garments (`accessories.ts`, `shells.ts`, `garments.ts`),
  `cut.test.ts` written first, `waistcoat-default.test.ts` pinning the legacy default; Ada's waistcoat and jeans set the options; `figure-variants.ts` can count the texels two variants differ by.
- Round 1: the old `brisk` and `uncanny` gaits whole as overrides (`old-gaits.ts`), Ada's six retuned sliders and `jeans`, the cast test
  widened first, `figure-variants.ts` and its looks (`figure-looks.ts`); sheets and numbers above. Merge of `origin/claude/last-light-prologue`:
  already up to date.
- Round 0: kit testing helpers `paintedStand`, `paintedWalk`, `rowWidths`, `silhouette` and a PNG/raster kit (`raster.ts`) with their
  unit tests (watched failing first); the sheet script; the round 0 sheets.
