# The Last Light: Ada and the night nurse, looking good

Branch `claude/last-light-figures-look`. The Owner on the 2026-11-12 frame: "iterate on the characters until they look good, she
looks frumpy". Every sheet here is painted in Node by the kit's own helpers (`extensions/character-kit/src/testing/`) and drawn
up by `pnpm --filter @automata/character-kit sheet <out-dir> <round> --old <old-game-checkout>`
(`extensions/character-kit/scripts/figure-sheet.ts`). The numbers files come from the pictures, never typed. The old game is
`mcthaydt/PixiJS3D_Experiment_001` at `92e6704`; its figures are its committed review sheets (`docs/art/ada-figure/ada-review.png`,
`docs/art/nurse-figure/nurse-review.png`), cropped by their grid. Those sheets hold two kinds of row: the **procedural** figure (the
old painter, which our painter descends from; Ada row 7, nurse row 3) and the **approved hand-painted atlas** (Ada row 1, nurse row
1), which is what the old game actually shipped and what "looking good" meant there.

Progress: **round 7 done.** The Owner changed the target on 2026-11-12: "for the character, just go with what matches better for the scene; I prefer the
old look, I just want the updated painter and face really." So Ada and the night nurse are brought to the old game's proportions (measured with a kept
helper, [`round7-proportions.txt`](round7-proportions.txt)), Ada's eyes are the old size (the kit's `eyeMarks`), and the painter's list is ranked at the end. Rounds 0 to
6 below are as they were (look before touching, data, painted garments as generators, the nurse's cut, Ada's fringe, waistcoat and legs, the nurse's hair and
cap, her first sighting); **round 7 is after round 6**. Left: the Owner's picks (Ada's 154 or 162 cm on the page; the nurse's 200 or 210), and the painter's face tone,
stand and outline colour.

**Not run for round 7** (this container has Chromium only, software GL): the kit's Firefox and WebKit parity and WebGPU suites, the 3D browser suites and
journeys, `pnpm check` as a whole (`knip` and `check:changesets` need `site/`'s generated types and an `origin/main` ref; the kit and the game are private,
so no changeset), `pnpm build` and the packed install. Run: the kit's unit suite (304), its Chromium browser project (55 passed, 2 skipped), the game's unit
suite (384), both typechecks, Biome on the changed files; no golden moved (no existing option's default changed).

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

### The pair in the game

Chromium on this container's software GL, `AF_SHOOT=<folder> pnpm exec playwright test tests/e2e/frames.test.ts --grep "frames at"`, desktop context
(no touch buttons), 1024 by 768; the old game's frames are the earlier session's own shoot
(`../2026-11-12-last-light-prologue-first-draw/old-*-1024x768.png`, the old game's `?debug`, unchanged since it is archived). Old left, ours right:
[`round4-ingame-cutscene.png`](round4-ingame-cutscene.png) (the opening's first line typed: the old frame is its title card, a different
moment of the same cutscene) and [`round4-ingame-play.png`](round4-ingame-play.png) (the hall at the spawn after the opening, Ada's back to the
camera); the singles are `round4-ingame-ours-*-1024x768.png`. In play she is about 90 lines tall and the player sees her back: the open
vest and the floor between her legs do not show from there, the back of the bob and the shoulders do. In the cutscene her front shows,
with the strip of shirt and the lowered neckline readable at that size.

### Verification

`pnpm --filter @automata/character-kit test:unit`: 35 files, 279 tests; the game's `vitest --project unit`: 51 files, 365 tests; typecheck
of both clean; biome on the files touched (its seven warnings are the existing `3.1416` literals). No golden moved: the kit's runway cells
and core goldens pass, and the pinned cells of the base pair for the waistcoat and for the three leg cuts are unchanged.

## Round 5: the night nurse

Merged `origin/claude/last-light-prologue` first (nothing new). Sheets: [`round5-nurse-variants-play.png`](round5-nurse-variants-play.png) (the two old
rows, then BEFORE, A (adopted), B, C, D, E: four stands and four walk poses each, texels ×4), [`-detail`](round5-nurse-variants-detail.png) (density
2) and [`-numbers.txt`](round5-nurse-variants-numbers.txt); the adopted nurse alone, with the old figures' numbers:
[`round5-nurse-play.png`](round5-nurse-play.png), [`-detail`](round5-nurse-detail.png), [`-numbers.txt`](round5-nurse-numbers.txt). The variants are
`round5-nurse` in `figure-looks.ts`. Her cut (the skirt, the belt) stays the Owner's: nothing of it is adopted.

| | BEFORE | **A (adopted)** | old |
| --- | --- | --- | --- |
| skin in the rows of her head, front, play size (`pale` texels) | 24 | **at most 8** (the test) | none shows: the hair is a panel over the face |
| `pale` texels over the whole figure | 73 | **51** | |
| hair texels (`inkBlack`) | 35 | **62** | |
| height in texels (210 cm) | 80 | **78** (the cap sits lower) | 71 procedural, 75 atlas |
| shoulder / waist / hip | 18 / 20 / 22 | 18 / 20 / 22 | 18 / 18 / 22 procedural, 20 / 23 / 26 atlas |

**What changed (adopted).**
- **Her face.** `fallCurtain`, a kit hair style of the builder's own pieces: the long fall behind, and a scalp shell whose front hairline is
  brought down to the mouth (-0.55 on the skull, lifted .14), so from the front her face is black hair and from the side a curtain at the
  cheek. `hair-bob.test.ts` (written first, failing on the missing style): far less skin shows from the front than under `fallLong`, and more
  hair. The cast test `hides the night nurse's face under her hair` was written first and failed at 24 skin texels. **It is a shell on the head, not
  the old `curtain`**: it hugs the face and ends at the chin, where the old hair hangs over the chest to the skirt. I tried a fall from the
  lowered hairline (four lines and lengths): the builder's falls hang behind the figure whatever their hairline, so the curtain over the chest
  stays on the painter's list.
- **Her cap.** `nurseBrow` in the headwear table (data): a flat band low and forward across the brow, the cross on its face, where the
  `nurse` style is a pitched disc on the crown (a beret). The test is on the table (lower and further forward, the mark kept, it paints); the
  picture was judged on the sheet: it is nearer the old figures' cap, which is a small flat band in front, and it takes two rows off her height
  (80 to 78, nearer to the old 71 and 75).
- Her `HELD` entries and `asDrawn` were changed with the cast data: `curtain` is now `fallCurtain`, `nurse` the cap `nurseBrow`.

**Open for the Owner (not adopted):** B, her arms closer and forward (`armOut` .03, `standElbow` .3): the picture does not move at play size, so
it is not worth a change to the data. C, a skirt close at the waist: **a generator option on the skirt, `ease`** (the clearance at the waist and
hips, 2 when left out, as it was; `cut.test.ts` first, failing; the base pair's skirts did not move) at .5 gives a waist of 18 and a hip of 20
(old procedural 18 / 22, atlas 23 / 26) and takes the box out of her top, but it is her cut. D, the new hair under the old bowl cap, to see the
cap alone. E, long sleeves (the old file says short; the old pictures show a sleeve to the wrist, and the forearm's skin is what makes her
arms read as an A): a taste call and a departure from the old outfit.

**Nearer to:** the **atlas** in the face (hair over it) and the cap; the **procedural** in the silhouette (a straight, tall, thin figure). What
still separates ours from both: she stands upright (the old figures stoop: 71 and 75 rows for 210 cm), her hair ends at the chin, her skirt is a
smooth bell with a clean hem, and her top is a box.

### Verification (round 5)

`pnpm --filter @automata/character-kit test:unit`: 36 files, 289 tests; the game's `vitest --project unit`: 51 files, 365 tests; typecheck of both
clean. No golden moved: `skirt-default.test.ts` pins the base pair's two skirts (flared, and long and plain), eight views each, recorded from the
commit before `ease`, and the runway's and core's goldens pass.

## Round 6: the night nurse's loose hair, and her first sighting in the game

Sheets: [`round6-nurse-variants-play.png`](round6-nurse-variants-play.png) (the two old rows, then BEFORE (round 5's hair), A (adopted), B, C; four stands
and four walk poses each, ×4), [`-detail`](round6-nurse-variants-detail.png), [`-numbers.txt`](round6-nurse-variants-numbers.txt); the adopted nurse alone:
[`round6-nurse-play.png`](round6-nurse-play.png), [`-detail`](round6-nurse-detail.png), [`-numbers.txt`](round6-nurse-numbers.txt) (the old figures' `inkBlack`
texels there are not comparable: their hair is not that swatch's colours). The variants are `round6-nurse` in `figure-looks.ts`.

| | BEFORE (round 5) | **A (adopted)** | old |
| --- | --- | --- | --- |
| hair from behind, widest row below the head, play size | 3 (a tied tail) | **16** (loose, to the waist) | loose black hair to below the shoulders |
| hair beside the face and neck, from the front | 11 wide at the head | **17** wide, past the shoulders | falls past the shoulders on both sides |
| `inkBlack` texels, the whole figure | 62 | 144 | (not comparable) |
| shoulder / waist / hip | 18 / 20 / 22 | 19 / 20 / 22 | 18 / 18 / 22 procedural, 20 / 23 / 26 atlas |

**Why the hair was a tail, and what hangs wide.** The builder's `fall` draws each rope straight down below the jaw and, by design, narrows it toward the
spine (`x * (1 - 0.3 w)`, "never out"), and ropes of any radius I tried (0.14 to 0.6, 16 to 50 of them, any volume, any hairline) end as a bundle behind
the neck: a bell-shaped head and a thin tail. A `tail` piece with `hang: 'down'` and a wide `spread` (the ropes "fanning below the shoulders") is
the builder's one way to hang hair wide, so `curtainLoose` (kit hair table, builder's pieces only) is the scalp shell over the face of `fallCurtain`
and a tail of 22 fat ropes spread 1.2 to 2.0 of the half-width, no tie. From behind it covers the neck and the upper back to the waist; from the front
it shows beside the neck over the shoulders. Tests first (`hair-bob.test.ts`, failing on the missing style; `cast.test.ts`, failing at a 3-texel tail):
the widest hair row below the head from behind is twice the curtain's tail and at least 18 at density 2, from the front there is hair below the head,
and the face is still hidden (at most 10 skin texels in her head's rows at play size, the loose hair leaving her chin and neck a texel more than round 5's).

### The nurse where she is first seen in the game

The moment is the lights-out cutscene, where the camera shows her in the corridor doorway (about 7 s in). Old left, ours right, 1024 by 768, picture effects on:
[`round6-ingame-nurse.png`](round6-ingame-nurse.png); the singles are [`round6-ingame-old-nurse-1024x768.png`](round6-ingame-old-nurse-1024x768.png),
[`round6-ingame-ours-nurse-1024x768.png`](round6-ingame-ours-nurse-1024x768.png) and an earlier frame of ours,
[`round6-ingame-ours-nurse-earlier-1024x768.png`](round6-ingame-ours-nurse-earlier-1024x768.png). The old frame is the old game's own shoot
(`scripts/verify/shoot.mjs`, `?debug&renderer=webgl&scene=prologue`, `cutscene: lightsOut`, the game stepped 7 s on its paused clock; the old repo's `npm ci` was
run in this container, nothing of it is on the branch). Ours is the frame at the cutscene's 210th tick after the route's bed-made step, played through the page
(a temporary spec, not committed: the route to the lights-out and a screenshot every half second); the frame series is not on the branch, only the two frames.
Our cutscene's timing is not the old one's (the same second shows Ada's close-up in ours), so the frame was chosen by eye from the series.

What the pair shows: **ours has her loose hair to the waist, a wide blue-black mass over her shoulders and back, and the stained skirt and dark legs** as the old figure
has them, at about the old size. **The difference is which way she faces:** in the old frame she faces the camera (a curtain of hair over the face and down the front),
in ours she stands in the doorway with her back to it, so the frame shows the hair from behind. That is the cutscene's staging (her facing at that
moment), not the figure: the front of the figure, with its hair over the face, is on the sheets. I did not change it (the cutscene is the game branch's).

**C's skirt `ease` (.5), by the numbers: not adopted.** Against the old procedural (18 / 18 / 22): A is off by 1, 2, 0 (3 in all), C by 1, 0, 2 (3);
against the atlas (20 / 23 / 26): A is off by 1, 3, 4 (8), C by 1, 5, 6 (12). It ties the procedural and is further from the atlas, so it stays the
Owner's pick (variant C).

**B, a wider fan (spread 1.5 to 2.4):** the shoulder row goes to 21 (old 18 / 20), so it is wider than either old figure; not adopted.

**Still the painter's:** the curtain *in front*: the old hair hangs over her chest, a panel over the face and down the front; ours is a shell on the face
and loose hair behind and beside her, nothing hangs in front of the chest.

## Round 7: Ada brought to the old game's proportions (the target changed)

The Owner, 2026-11-12, first: "I'm not satisfied with how the scene looks ... I'm open to some changes" (a realistic-proportions target for
the figures was set), then, after the first measuring: **"for the character, just go with what matches better for the scene; I prefer the old
look, I just want the updated painter and face really."** So the target is the old game's Ada and nurse, drawn by our painter, with a face that
reads; no realistic adult. The measuring helper stays, with the old figures as the target column.

**The helper.** `extensions/character-kit/src/testing/proportions.ts` (test first: `tests/unit/testing/proportions.test.ts`, a synthetic figure
checked exactly, and the base woman against the painter) reads a painted cell: the head's rows on a bald copy (hair and headwear taken off the
outfit), the neck as skin under the chin, the trunk and legs in rows, the shoulder, waist and hip widths, where the legs part, and the foot;
the joints' heights (hip, knee, elbow, wrist, fingertips) come from the rig, since a front view cannot show where two legs that touch start.
`pnpm --filter @automata/character-kit proportions <out> --old <old-game>` prints the table; [`round0-proportions.txt`](round0-proportions.txt) is
the cast after round 6, [`round7-proportions.txt`](round7-proportions.txt) after this round, and the old figures are cropped from their review
sheets. The old night nurse's head cannot be read (her hair hangs over her face), so her column has no head rows.

**What the table said (Ada, play size, ours before / old procedural / old atlas):** 65 / 59 / 61 rows tall; head with its hair 12 / 13 / 17 rows;
neck 3 / 3 / 0 skin rows; trunk 16 / 14 / 14; legs 34 / 29 / 30 (52 % of her, the old 49 %); shoulder, waist, hip 17, 17, 21 / 16, 16, 18 / 20, 19, 20;
foot 12 / 11 / 11 texels. The first reading ("an oversized head") was wrong: her head was *smaller* than the old with hair. She was 10 % taller
on the page, her legs 5 rows long and her hips 3 texels wide.

**Adopted (data only, `cast.ts`; `cast.test.ts` changed first and watched failing on the height, the sliders and the picture):**

| | before | **adopted** | old procedural / atlas |
| --- | --- | --- | --- |
| height slider | 162 cm (65 rows) | **154 cm (62 rows)** | 59 / 61 rows (the old file says 162 cm too) |
| head with hair, rows (heads tall) | 12 (5.4) | **13 (4.8)** | 13 / 17 (4.5 / 3.6) |
| legs slider, leg rows | .6, 34 | **.3 (the old file's), 31** | 29 / 30 |
| trunk rows | 16 | 16 | 14 / 14 |
| hip joint, knee (rig, share of her height) | 53 %, 29 % | **50 %, 27 %** | |
| shoulder / waist / hip | 17, 17, 21 | **17, 17, 19** | 16, 16, 18 / 20, 19, 20 |
| hip over shoulder | 1.24 | **1.12** | 1.13 / 1.00 |
| floor between her legs, texels | 10 | 12 | |

- The head is set by the gene (`genes.head` .28 m, chin to crown), because the `head` slider moves it by less than a texel at this size (slider
  .87 to 1.1 changed nothing; the sliders in general move a limb by under a texel at play size: a texel is 2.7 cm).
- Her `hips` slider is **1**, not .9: with her legs shorter the floor between them fell to 5 texels, and 1 gives 12 with no wider a hip row (the
  hip is 19 by the helper, 21 by the older silhouette bands either way). The leg `gap` option was already on; the stand's feet are the
  limit (painter list below), so the slider is the only lever that opens floor.
- **The one trade-off: 154 cm.** At her canon 162 cm the painter draws her 65 rows, 8 % bigger than the old figure at the same scale. The alternative
  (variant B on the sheet) keeps 162; the choice is the Owner's. The cast test pins 154 and says why.
- Sheet: [`round7-ada-variants-play.png`](round7-ada-variants-play.png), [`-detail`](round7-ada-variants-detail.png), numbers
  [`round7-ada-variants-numbers.txt`](round7-ada-variants-numbers.txt); the variants are `round7-ada` in `figure-looks.ts`.

**The night nurse, to the old numbers (data only; `cast.test.ts` first, watched failing at 78 rows and 210 cm).** Before: 78 rows, legs 43 (55 % hip joint), trunk 20,
shoulder, waist, hip 18, 18, 22. The old procedural and the atlas: 71 and 75 rows, legs 35 and 37, trunk 25 and 26, 18, 18, 22 and 21, 21, 26. Adopted:
height 200 cm, `legs` .2, `neckLength` .5, `hips` 0 (the old -.29 drew a hip row of 20 once her legs were shorter): **75 rows, legs 37, trunk 25, hip joint 49 %,
shoulder, waist, hip 18, 18, 22**, a head with hair of 10 rows (7.5 heads; the old head cannot be read, it is under the curtain). Variant B keeps 210 cm
(78 rows). Sheet: [`round7-nurse-variants-play.png`](round7-nurse-variants-play.png), [`-detail`](round7-nurse-variants-detail.png), numbers
[`round7-nurse-variants-numbers.txt`](round7-nurse-variants-numbers.txt), table [`round7-proportions.txt`](round7-proportions.txt). Her stoop, her curtain and her
folds are still the painter's (list below).

**The face: the eyes the kit can draw, the tone and the stand it cannot.** Tried first, over the adopted data, on a head crop at x10 beside the old
two: the drawn face (`face.drawn`) with `eyeSize` and `eyeSpacing` at 1, `hood` 0, `camera` 1 and `turn` 0; the skin swatch's `tones` from +.05 to -3; the
`headWidth` gene; a lighter skin ramp. None moves the eyes: the drawn face at play size is a lid line and a brow (worse than two dots under a fringe),
`eyeSize`/`eyeSpacing` act only from density 2, the swatch's `tones` change no texel of the face (counted: 0 / 21 / 9 / 0 of the four skin steps in every
case), `headWidth` .78 spaces the dots by under a texel. The old face is two black texels, **2 tall**, 4 apart, on a face that is mostly the lightest
skin step (#ebbd9d, 21 to 25 texels in the head's rows); ours was two texels, 1 tall, 2 to 3 apart, mostly the middle step (#d5a39a, 21), a dark chin.

The garment hook is the kit's, so **the eyes are done in the kit**, not waiting for the painter: `eyeMarks` (`accessories.ts`, test first in
`tests/unit/fashion/eye-marks.test.ts`, watched failing on the unknown kind) is the builder's `face()` decal pair with a `size` (default 1 by 2), a `spread`
(0.6 of the head's half-width, the builder's is 0.42) and a `height`; it draws only on a face that is not drawn. Ada's `{ eyes: 'eyeDark' }` is now
`{ eyeMarks: 'eyeDark' }` (`cast.test.ts` first: eyes two texels tall and four or more apart, found in the picture). Nothing that does not name it moves
(the builder's `eyes` is untouched; no golden moved). [`round7-ada-face.png`](round7-ada-face.png) (head at x10: eyeMarks at spread .6, .5, .75 and height .42,
then the old procedural and the atlas): the eyes now read as the old figures' do. What is still the painter's is the face's *tone* (the old face is lit, ours dusty
with a dark chin: list item 2) and, at the opening's close shot, nothing else in this branch can lift her face: that shot is density 1 too. Single adopted-Ada
sheets: [`round7-ada-play.png`](round7-ada-play.png), [`-detail`](round7-ada-detail.png), [`-numbers`](round7-ada-numbers.txt).

### Round 7 in the game

Chromium on this container's software GL, `AF_SHOOT=<folder> pnpm exec playwright test tests/e2e/frames.test.ts --grep "frames at"`, desktop
context, 1024 by 768, shot after the eyes (the final data). Old game left, ours before (round 4's own frames, `round4-ingame-ours-*`), ours after:
[`round7-ingame-cutscene.png`](round7-ingame-cutscene.png) and [`round7-ingame-play.png`](round7-ingame-play.png); the singles are
`round7-ingame-ours-*-1024x768.png`; [`round7-ingame-ada-crop.png`](round7-ingame-ada-crop.png) is Ada in the opening, before and after, cropped and x3.
**The lighting does not compare**: the "before" frames are round 4's, shot when the room's look was an earlier one, and the opening's frames are
different moments of the cutscene (the "after" caught the title card, the nurse not yet in the door). Read them for Ada.
- In play she is about a fifth shorter on screen (the old Ada's height is between the two), slimmer, with the old figure's head and legs; from behind no
  face shows.
- In the opening's close shot her eyes now read: two dark texels, two tall, set wide, where there were two dots (crop). The face around them is still the
  painter's tone (dusty, darker than the old figure's lit face: list item 2), and in the room's dark it is dim.
- Her outline is black where the old game's is the DUEL teal (list item 4); the room's dark takes her well otherwise (her jeans and vest are the old
  swatches). Her size against the props I did not measure; the numbers above are rows of the sprite.

## Waiting for the painter (the fold, `claude/builders-fold-figures`)

Kept here as it grows, **ranked by what each buys at the size she is played** (the first two are the face the Owner asked for; they are the first
painter task after the fold merges). Each needs painter code, which this branch does not patch.

| # | Change, file and function | What it buys |
| --- | --- | --- |
| 1 | (done in the kit as `eyeMarks`, Ada wears it) `src/features/outfit/garments.ts`, `face()`: the neutral eye decal (`when: ['neutral', 'sad', 'angry', 'talk']`) is size 1x1 at `x * hw * 0.42`, `h * 0.45`; give it `size: [1, 2]` (the `fear`/`surprised` decal already is) and widen the x to about `hw * 0.6` | every figure's decal eyes would be the old size without the kit's garment; Ada's are now 2 tall and 4 apart |
| 2 | `src/features/paint/paint.ts`, `PAINT.model` (the face's tone budget `[0.06, 0.1, 0.02, 0.08]`: the least and most shares of skin in the light tone and in shadow) and `PAINT.face` (`[0.78, 0.22, -0.4]`, the key's thresholds on a face's planes): at density 1 raise the least light share to about .5 (the old face is mostly the lightest step) and lighten the chin's shadow; `PAINT.shadow` 2 draws the fringe's shadow over the brow | a lit, readable face (a bright mass with two dark eyes) in place of a dusty-pink one with a dark chin |
| 3 | `src/features/figure/figure.ts` / `motion.ts`, `standing`: the stand draws the weight foot in 25 % (`under: 0.25`) and the free foot at `Math.max(gait.track, 0.75)` of the hip joints' half-width (motion.ts around lines 217 and 518); make the stand's `under` and its feet's track a gait number (`standTrack`) | legs that stand apart on a narrow pelvis (Ada's `hips` slider is at 1 only to open the floor between her legs) |
| 4 | `src/features/paint/paint.ts`, `INK` (`'#000000'`, line 22): the outline on the shadow side and under; the old game's was the DUEL teal `RAMP_OUTLINE` 0x002219 (`duel-ramps.ts`); make `INK` a `PaintStyle` field | an outline that sits in the room's dark instead of a black line (the in-game frame) |
| 5 | The decal face's eyes also under a fringe: a fringe at its hairline covers the eye row at the lowest fringe heights (`hair.ts` `FRINGE`) | a lower, fuller fringe without losing the eyes |
| 6 | The old `bob`'s turned-under hem and parting | `bobFringeFull` and `bobFringeBlunt` have the fringe and the mass at the ear; from behind the hair still narrows to the nape (28 wide to 10), where the old bob's hem is as wide as the ears; no piece turns it under or parts it |
| 7 | The nurse's `curtain` in front | no piece hangs a panel in front of the face and chest free of the head; `curtainLoose` (adopted) is a shell on the face and loose hair behind and beside |
| 8 | A stooping stand | the stand holds a figure upright whatever the sliders (round 1, variant B): her old shape, 71 rows for 210 cm, leaning down |
| 9 | Skirt pleats (`folds`) | the painted skirt is a smooth profile of rings: the torn, hanging hem |
| 10 | A cap as the old one exactly | the kit's `nurseBrow` is a flat band low on the brow (adopted); the old cap is a hand-tuned piece |
| 11 | A brisk, leaning stand and pose for Ada standing | her first-night posture (the stand is the builder's relaxed one) |
| 12 | The drawn face's eyes at density 1 | a face with a mouth and a nose at play size, not two dots (eyes from density 2 now) |

## Log

- Round 7: the kit's `eyeMarks` garment (`eye-marks.test.ts` first), Ada's eyes two tall and four apart; the proportions helper and its table (`proportions.test.ts` first), Ada brought to the old game's numbers (height 154, legs .3, hips 1, `genes.head` .28; `cast.test.ts` first), the painter list ranked. The Owner's change of target recorded.
- Round 6: `curtainLoose` in the kit's hair table (a scalp shell over the face and a wide-spread tail), the nurse wears it (`hair-bob.test.ts` and `cast.test.ts` first); C's `ease` weighed by the numbers and left to the Owner; her first sighting in the game against the old game's.
- Round 5: `fallCurtain` hair and `nurseBrow` cap in the kit's tables, a skirt `ease` option, the nurse wears the first two (`cast.test.ts` first: her face at most 8 skin texels in her head's rows); `round5-nurse` looks and sheets.
- Round 4: the fringe's height as one number (0.3), the waistcoat's `open`, `chest`, `hem` and `neckline`, `gap` on the jeans and trousers, `bobFringeBlunt`, `rowGaps`; Ada's eye test widened, her waistcoat, jeans and hips slider set; `legs-default.test.ts`; the variants script writes its own numbers.
- Round 3: the kit's `bobFringe`, `bobFringeFull` and `bobFringeShort` hair styles (`hair-bob.test.ts` first), Ada wears `bobFringeFull`; Ada's `face.drawn: false` (eyes at play size), her stance and arm from the old brisk gait, the eyes test, the nurse's cut sheeted.
- Round 2: waistcoat `fit`, `length` and `armhole` and legs' `taper` in the kit's garments (`accessories.ts`, `shells.ts`, `garments.ts`),
  `cut.test.ts` written first, `waistcoat-default.test.ts` pinning the legacy default; Ada's waistcoat and jeans set the options; `figure-variants.ts` can count the texels two variants differ by.
- Round 1: the old `brisk` and `uncanny` gaits whole as overrides (`old-gaits.ts`), Ada's six retuned sliders and `jeans`, the cast test
  widened first, `figure-variants.ts` and its looks (`figure-looks.ts`); sheets and numbers above. Merge of `origin/claude/last-light-prologue`:
  already up to date.
- Round 0: kit testing helpers `paintedStand`, `paintedWalk`, `rowWidths`, `silhouette` and a PNG/raster kit (`raster.ts`) with their
  unit tests (watched failing first); the sheet script; the round 0 sheets.
