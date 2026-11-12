# The builders' hands: before and after (2026-11-12)

The Owner, today: "can we improve the hands on our builders, make it where it's like 3 fingers merged, index, and thumb
separated, they look kinda dumb now, for the builder itself, not specifically for my character".

This is a sheet for the Owner's eye. **No golden has been re-recorded**: the goldens listed below wait for his yes.

**How it is committed.** The repository's pre-commit hook runs the affected unit tests, so a commit that turns the goldens
red cannot land without skipping the hook, which is not allowed. So the parted hand is committed behind one internal
switch, `HAND_FORM` in `extensions/figures/src/shared/paint/paint-hand-form.ts`, whose default stays `'paddle'`: today's
hand, byte-identical (checked: every frame of the sheet at density 1 and 2 equals `main`'s), so the branch is green. The
sheet draws `'parted'`. **On the Owner's yes:** set the default to `'parted'`, delete `paddleRole` and the switch, record
`pnpm --filter @automata/figures golden` and the kit's cells listed below, and commit the re-record naming this sheet.

## What the hand was

The body's hand parts (`garments-parts.ts` `hands()`) are rasterised, then `paint-hands.ts` `drawHands()` erases them
and stamps a designed hand from the projected wrist and fingertips, in rows down the hand and columns across it. That
shape was a paddle: a rectangle with a one-texel thumb stuck flush on its edge for two rows, and at the tips two cut
corners and one notch, which reads as a comb of stubby teeth under the ink. See [`today-hands-d2.png`](today-hands-d2.png).

## What it is now

`handForm` and `handPiece` (new, in `paint-hands.ts`) give every texel of the stamp a piece: palm, thumb, index or
mitten. Sized from the stamp alone, so every body, slider, pose and density gets it; no character is touched.

- **Thumb:** a third of the hand long (was a quarter), joined at its root, hanging free of the palm along its last two
  rows behind a one-texel slit. Hidden from behind, as before.
- **Index:** the column (two on a broad hand) on the thumb's side below the knuckles, a row short of the tips, parted
  from the mitten by a one-texel gap.
- **Mitten:** the other three fingers as one mass, its corners rounded at the tips.
- A hand too small to part (density 1, a hand seen on its edge) keeps one whole shape: no stray texel.

Over skin of the hand's own colour (a bare thigh behind it, the side views) the slit and the gap would vanish into the
same skin, so there they are drawn as a crease in the ramp's deep step.

The change is a paint stamp only. No body part is added, removed or reordered, so the grain cannot reseed; the item
sockets are rig joints and are untouched (the torch sits where it sat).

## The sheet (density 2 unless named)

| Picture | What it shows |
|---|---|
| [`hands-x10-turn0.png`](hands-x10-turn0.png) | Front: both hands of both figures, x10, before left, after right |
| [`hands-x10-turn1.png`](hands-x10-turn1.png) | Three-quarter |
| [`hands-x10-turn2.png`](hands-x10-turn2.png) | Side |
| [`hands-x10-turn4.png`](hands-x10-turn4.png) | Back |
| [`figure-x4-base-m.png`](figure-x4-base-m.png), [`figure-x4-base-f.png`](figure-x4-base-f.png) | The whole figure x4, front, 3/4, side, back; before above, after below |
| [`walk-x4.png`](walk-x4.png), [`hands-x10-walk.png`](hands-x10-walk.png) | Two walk frames of each, and every walk frame's hands x10 |
| [`held-torch-x4.png`](held-torch-x4.png), [`hands-x10-torch.png`](hands-x10-torch.png) | Holding the library's torch: the item still sits in the grip |
| [`hero-x4.png`](hero-x4.png) | The lookbook hero stands (hands at the hip) |
| [`density1-x8.png`](density1-x8.png) | Density 1: the hand stays whole, nearly as it was |
| [`moved-texels-d2.png`](moved-texels-d2.png) | Every texel that moved: cyan inside the hands, magenta outside |

## Verdict, view by view (density 2, the eye on this sheet)

| View | Reads as thumb + index + mitten? |
|---|---|
| Front (the hand on its edge, 3 to 4 texels across) | Yes: the thumb hangs free behind a notch, the index is parted at the tips. Small (one-texel parts), but no longer a comb |
| Three-quarter | Yes, the clearest: thumb notch at the silhouette, index parted from a broad mitten |
| Side (the hand over the bare thigh) | Partly: the thumb nub shows at the silhouette; the slit and the finger gap are creases over the same skin, readable at x4, faint at x1. The base pair's bare thighs are the cause; a figure in trousers shows real gaps |
| Back | Yes for the fingers (index parted); the thumb is hidden, as it should be from behind |
| Walk | Yes on the swinging hands against the background; over the thigh as the side view |
| Holding the torch | The grip is unchanged in reading, and the torch sits where it sat |
| Density 1 | Nearly unchanged and whole: no stray texel (a test pins it) |

## What moves

Measured with the painter's own frames, before (`main`) and after (`HAND_FORM = 'parted'`). A texel "in the hands" is one
the hand stamp erased or drew in any frame of that figure's run (the walk's smear trails included), grown by one texel
for the outline.

| | In the hands | Outside the hands |
|---|---|---|
| Density 2, 40 frames (8 standing, 8 walk, hero, 3 torch, per figure) | 1,415 texels | 154 texels |
| Density 1, the same 40 frames | 251 | 24 |

**Outside the hands:** every one of the 154 (and 24) is a single texel moving one step along its own ramp (skin, two on
the shorts' grey); none changes the silhouette; they lie on the hand's own arm and on the thigh it covers
([`moved-texels-d2.png`](moved-texels-d2.png), magenta). The cause is not the grain (no part changed): each surface's tone
thresholds are quantiles of its visible texels, and the hand's texels share their arm's surface and cover the thigh, so
a hand of another shape shifts a few of those thresholds. It cannot be zero without changing the painter's thresholds:
taking the hand's texels out of the arm's pool was tried and moves 1,250 arm texels at density 2 (eight times more), so
it is not done. This is a finding for the Owner, not hidden.

### The goldens that will move on the Owner's yes

Measured against the recorded data (nothing written):

| Golden | Moves |
|---|---|
| base (`tests/unit/golden/base.test.ts`) | every sheet but `base-m-hero-d1`: D1 turn 37 / 34 texels (man / woman), walk 89 / 84, hero 0 / 6; D2 turn 217 / 183, walk 510 / 485, hero 24 / 30 |
| lit (`golden/lit.test.ts`) | 46 of 50 frames |
| actors (`golden/actors.test.ts`) | 286 of 294 frames |
| sprites (`actors/actors.test.ts`) | 4 of 4 |
| sprite (`golden/sprite.test.ts`) | 64 of 64 |

**The exact tests that turn red with `HAND_FORM = 'parted'`** (measured: the painter's whole unit suite, 756 tests, and
the kit's unit suite, 233, run with the default flipped, then restored). Every one is a pin or golden drawing the base pair
or a figure with bare hands; no behaviour test fails:

- Painter, 51 of 756: `golden/base.test.ts` (2: D1, D2), `golden/lit.test.ts` (1), `golden/sprite.test.ts` (1),
  `golden/actors.test.ts` (2: base-m, base-f), `actors/actors.test.ts` (4: the sprites md5s, both figures at D1 and D2),
  `stage/sheets.test.ts` (3: the stage keeps the base goldens, D1, D2 and the lit frames through `cellOf`),
  `paint/identity.test.ts` (35: the materials probe pins, the unfabricked-lit pins, the c9 wardrobe pins and the face
  pins `face/*@D1|D2`), `hair/front.test.ts` (1), `outfit/shoe-form.test.ts` (1), `paint/sheer.test.ts` (1): the last
  three are "the cell it drew before c9" pins.
- Character kit, 16 of 233: `tests/unit/fashion/showcase-cells.test.ts`, 8 characters x 2 (every direction's cell, and
  the fit check's slider extremes, against the showcase's recorded cells). The runway golden does not move.

These are the cells the re-record writes on the Owner's yes. Not run: the browser suites (WebGL, WebGPU), WebKit, Firefox.

## Round 2 (the coordinator's eye on round 1)

The coordinator, on round 1: at x4 before and after were nearly the same hand, a 3 to 4 texel sliver seen on its edge
ending in black-inked teeth; the hand was too small and edge-on to carry a shape, and one-texel ink slits ate it. Round 2,
same rules (generator only, behind `HAND_FORM`, nothing recorded):

- **Size.** The stamp now carries the hand's full breadth (`HandStamp.breadth`). The parted hand shows 70% of the way
  from its edge to that breadth, as a relaxed hand hangs with its back turned out, and is 1.15 times larger
  (`PARTED_HAND = { size: 1.15, turn: 0.7 }`, one factor for every body). Measured at density 2: the man's hand
  is 7 to 8 texels across the knuckles in every view and the woman's 5 (in front and back they were 4 and 3), 8 to 9
  long; the thumb adds one or two columns more.
- **Thumb.** A bump two texels across off the palm's side, its top corner rounded, creased from the palm along its last
  two rows, its tip clear of the palm by one texel of background.
- **No ink inside the hand.** Thumb and palm, index and mitten are parted by a crease one step under the hand's own tone,
  never by a gap. The outline stays on the outside.
- **Silhouette.** The index (two columns on a broad hand) runs to the last row; the mitten stops one row short with its
  little finger's corner rounded, so the index steps out. No teeth.
- **Density 1.** A plain mitten with a thumb bump. It is larger too (one factor for every density), and reads chunkier,
  more like a glove than before: say if density 1 should keep its old size.

Tests: the round-1 tests that pinned ink slits (the thumb's slit beside the palm, the index's gap to the mitten, the
index a row short, the views' rows parted by background, the deep step over skin) are rewritten to pin the 2-texel
thumb bump with its crease and clear tip, the index's crease and its one-row step past the mitten, the mitten as one
block of 3 or more columns, a hand 4 or more texels broad in all 8 views, and no row parted by background but beside the
thumb's tip. The density 1 tests are kept as they were. 25 tests.

### Round 2's sheet (suffix `-round2`; before is `main`, after is round 2)

| Picture | What it shows |
|---|---|
| [`round1-vs-round2-x4.png`](round1-vs-round2-x4.png) | **Round 1 above, round 2 below**, x4: front, 3/4 and back of each figure |
| [`figure-x4-base-m-round2.png`](figure-x4-base-m-round2.png), [`figure-x4-base-f-round2.png`](figure-x4-base-f-round2.png) | The whole figure x4: front, 3/4, side, back |
| [`hands-x10-turn0-round2.png`](hands-x10-turn0-round2.png), [`-turn1-`](hands-x10-turn1-round2.png), [`-turn2-`](hands-x10-turn2-round2.png), [`-turn4-`](hands-x10-turn4-round2.png) | Hands x10: front, 3/4, side, back |
| [`walk-x4-round2.png`](walk-x4-round2.png), [`hands-x10-walk-round2.png`](hands-x10-walk-round2.png) | The walk |
| [`held-torch-x4-round2.png`](held-torch-x4-round2.png), [`hands-x10-torch-round2.png`](hands-x10-torch-round2.png) | Holding the torch |
| [`hero-x4-round2.png`](hero-x4-round2.png) | The hero stands |
| [`density1-x8-round2.png`](density1-x8-round2.png) | Density 1 |
| [`moved-texels-d2-round2.png`](moved-texels-d2-round2.png) | Moved texels: cyan in the hands, magenta outside |

### Round 2's verdict (x4 first)

| View | At x4 |
|---|---|
| Front | A hand: a mitten block with a thumb bump, clearly not the sliver it was |
| Three-quarter | The best: the thumb stands out from the palm and the index steps past the mitten |
| Back | A mitten block; the thumb hidden, as it should be |
| Side | Still weak: the hand hangs over the bare thigh in the same skin, so only its outline and the thumb's bump read |
| Walk | The swinging hands read as hands with thumbs |
| Torch | The grip is larger and the torch still sits in it |
| Density 1 | Whole, with no stray texel, but chunkier |

### Round 2: what moves outside the hands (a finding)

Over 40 frames per density: 4,286 texels in the hands and 794 outside at density 2, and 1,095 in and 126 outside at
density 1. None changes the silhouette. Most of the outside moves are one ramp step on the arm and the thigh, as in round
1, and there are more of them because the hand is larger and covers more. **The base man's torch frames move about 150
texels each on his hair and the neck's line.** The cause is the painter's figure-wide colour budget (`paint-budget.ts`
`budget`): the larger hand covers more of the torch, the figure's colour count changes, and the merge of its closest
colour pair lands elsewhere. It is not the crease: drawn with no crease at all, the same texels move. Leaving it as it is
needs no painter change; making it zero means changing the budget, which is the Owner's call, not part of this work.

### Round 2: the goldens that will move on the Owner's yes (they replace round 1's list above)

Measured with `HAND_FORM = 'parted'` against the recorded data, then restored (nothing written):

| Golden | Moves |
|---|---|
| base | every sheet: D1 turn 197 / 123 texels (man / woman), walk 371 / 332, hero 27 / 25; D2 turn 799 / 630, walk 1,525 / 1,099, hero 48 / 71 |
| lit | 50 of 50 frames |
| actors | 293 of 294 frames |
| sprites | 4 of 4 |
| sprite | 64 of 64 |

The red tests are the same files as round 1: the painter's 51 of 755 (`golden/base` 2, `golden/lit` 1, `golden/sprite` 1,
`golden/actors` 2, `actors/actors` 4, `stage/sheets` 3, `paint/identity` 35, `hair/front` 1, `outfit/shoe-form` 1,
`paint/sheer` 1) and the kit's 16 of 233 (`fashion/showcase-cells.test.ts`). No behaviour test fails.

## Round 3: the resume list (the coordinator's visual audit of round 2, for the Owner)

Round 2 is better than today's hand and not ready to record. Same rules: generator only, behind `HAND_FORM`, nothing
recorded. Judge at x4 on the whole figure: relaxed open hands, a thumb, a visible index, calm posture. The new sheet takes
the suffix `-round3` with rows before | round 2 | round 3, and moved-texels is shot again.

1. **It reads as a clenched fist.** Make an open, relaxed hand, clearly longer than wide (length about 1.4 to 1.6 times
   the knuckle breadth): a palm, then a finger block hanging down, its end gently tapered, not a ball.
2. **No index.** At x10 the index is one isolated darker texel in the front and back views. It needs a continuous
   one-texel crease from the knuckle row to the tip, separating a 2-column index from the 3-finger mitten, the two
   ending on different rows. Rule: no isolated crease texel; a crease is a run of 3 or more texels or it is not drawn.
3. **The thumb is a spike** (3/4 view, far hand: it sticks out sideways like a pointing finger). A relaxed thumb lies
   along the palm's side, angled down, its tip clear of the palm by a notch; never more than 1 to 2 texels out, never
   horizontal.
4. **Side-view artefacts.** The woman's near hand shows a lone triangular nub on the thigh; the man's creases draw a "T"
   across it. Where the hand overlaps skin of its own colour, give it a closed contour one step darker on its own ramp,
   so it reads as a hand against the thigh; nothing pokes out as a lone triangle.
5. **Density 1 is worse than before** (oven mitts). Density 1 goes back to its old size (no 1.15, no turn): a plain
   mitten with a one-texel thumb bump, never wider than the forearm + 1.
6. **The hair moves.** In the base man's torch frames the figure-wide colour budget (`paint-budget.ts` `budget`)
   recolours a patch of hair. A hand change must move zero texels on the head, hair and neck. Fix the cause: the
   budget's merge must not depend on the stamp's coverage (take it from the figure before the stamp, or keep the
   stamp's colours inside the set the budget already holds). Prove it with the moved-texels map: nothing above the
   shoulders in all 40 frames at each density. Keep driving the arm and thigh one-step moves down where a cheap way
   appears.

Tools to rebuild (scratch, not in the repository): a render of the 40 frames per density with a recorder of every
texel `drawHands` erases or draws (the hand mask), before/after crops at x10 centred on each stamp's box, whole-figure
crops at x4, and a moved-texels map masked by the hand region grown by one texel. Flip `HAND_FORM` to `'parted'` only
in the working tree to measure, and restore it before committing (the pre-commit hook runs the goldens).

## Round 3: what was done (`dd2319a6`), and where to resume

Done, behind `HAND_FORM` (default `'paddle'`, no golden moves), with the form tests rewritten first (29 tests):

- **1, open hand:** at least 1.5 times as long as its knuckles are broad (`PARTED_HAND.long`), the knuckle row half
  way, the mitten's end tapered on both corners, the breadth trimmed (`size` 1.15 to 1.05).
- **2, index:** two columns, creased from the mitten by one continuous run from the knuckle row, a row longer than the
  mitten. No crease is a lone texel: a run of 3 or more, or none (pinned by a test).
- **3, thumb:** one texel out, along the palm's side, never a sideways spike (pinned: nothing two columns past the
  palm), the row under its tip clear.
- **5, density 1:** keeps the size its view gives it, with no enlargement: a plain mitten with a thumb bump.

The sheet, rows before (`main`) | round 2 | round 3:
[`figure-x4-base-m-round3.png`](figure-x4-base-m-round3.png), [`figure-x4-base-f-round3.png`](figure-x4-base-f-round3.png),
[`walk-torch-x4-round3.png`](walk-torch-x4-round3.png), [`density1-x8-round3.png`](density1-x8-round3.png). Hands x10
before | round 3: [`hands-x10-turn0-round3.png`](hands-x10-turn0-round3.png), [`-turn1-`](hands-x10-turn1-round3.png),
[`-turn2-`](hands-x10-turn2-round3.png), [`-turn4-`](hands-x10-turn4-round3.png). Moved texels:
[`moved-texels-d2-round3.png`](moved-texels-d2-round3.png).

My eye at x4: relaxed open hands in front, 3/4 and back, the thumb along the side, the index's step at the tips; calm.
The side view is unchanged (item 4).

Moved, before to round 3 (40 frames per density): density 2, 4,124 texels in the hands and 747 outside, of them **187
above the shoulders** (the base man's hair in the torch frames, item 6); density 1, 331 in and 26 outside, **0 above the
shoulders**.

**Not done, resume here:**

- **Item 4**, the closed contour one step darker where the hand lies over skin of its own colour (the side view's nub
  and "T").
- **Item 6**, the colour budget: the base man's torch frames still recolour his hair (187 texels at density 2).
- The goldens' counts for round 3 (round 2's are above). The red test files will be the same; measure them with the
  default flipped in the working tree only.

## Round 4: three shapes, sharply divided (2026-11-12)

The Owner, relayed by the coordinator during this round: **"there should be a sharp divide between the combined 3
fingers, index, and thumb"**. That overrides rounds 2 and 3's "no ink inside the hand, a one-step crease": the divides
are now the outline's ink. Same rules: generator only, behind `HAND_FORM` (default `'paddle'`, byte-identical to `main`:
every golden green), nothing recorded.

### What changed

- **Size first.** `PARTED_HAND.size` 1.05 to **1.25**. Measured at density 2 (palm columns at the knuckles; the thumb adds
  two more): the man 8 to 9 in every view (10 to 11 with the thumb), the woman 6 to 7 (8 to 9). Length 1.5 times the
  knuckles, as round 3. Density 1 keeps the size its view gives it.
- **Three shapes** (`handForm`/`handPiece`, the piece `'divide'`; `partedRole` returns `DIVIDE`, which `drawHands` writes
  as the outline's tone and the painter colours **ink**):
  - **Thumb**: two texels thick, rooted at the palm's side a row or two under the wrist, angled down and one column away
    (its tip at most two columns past the palm), three or four rows long, ending above the knuckle row; an ink divide
    down its free length, its tip standing free (a notch, background under and beside it).
  - **Index**: two columns on the thumb's side, to the last row.
  - **Mitten** (the other three fingers): three columns or more, a row short of the index, its outer corner rounded where
    it is four broad; an ink divide from the knuckle row between it and the index, opening into a notch between their
    tips. No ink texel is alone: every divide runs to the silhouette (pinned).
  - A hand narrower than six columns (none of the base pair's at density 2) is **two shapes**: all four fingers as one
    mitten, and the thumb with its divide.
  - **Density 1** (my choice, the coordinator asked me to say): a plain mitten with a one-texel thumb bump, the row under
    its tip clear, as round 3. The one divide there is that notch, which the painter's outline draws. Three shapes, or a
    two-texel thumb with an ink divide, do not fit in a 3 to 4 texel hand without eating it.
- **Item 4, the contour.** Where the parted hand lies over skin of its own colour that is not its own arm (the bare thigh
  in the side views), every texel of that skin beside the hand is ink: a closed contour, so it reads as a hand lying on
  the leg, and the divides' notches close into the same line. No lone triangle, no "T" (pinned for both figures, views
  2 and 6).
- **Item 6, the hair** (`7c361722`). Cause, measured: the budget merges the closest pair of colours and keeps the
  commoner. In the base man's front torch frame the hair's darkest `#181f2f` (93 texels) and a near-black `#1d1d21` (89
  with the paddle, 102 with the parted hand: mostly the hand's and the torch's) swap which one is the commoner, and the
  hair is recoloured. Fix: the commoner is counted outside every hand's reach (`handReach`: a disc round each wrist as
  large as the largest form; a tie falls back to every texel), so the hand's form or swing cannot decide that merge.
  It comes with the parted hand (`PaintStyle.hand`): `main`'s own paddle decides that pair in the base man's
  three-quarter torch frame and in three of the actors' torch-swing frames (`base-m/swing/0..2@D2`), so giving the paddle
  the vote would move goldens before the Owner's yes. With the default flipped, the vote is always on.

### The above-the-shoulders count: not zero, and why

Measured over the 40 frames per density (8 standing, 8 walk, hero, 3 torch per figure), against `main`:

| | Density 1 | Density 2 |
|---|---|---|
| Round 3 | 0 | 200 (base-m torch 0 and 1) |
| Round 4 | **0** | **202**: base-m torch 1 (114), base-f torch 1 (84), base-f torch 2 (4) |
| Round 4 against the paddle under the same budget rule | 0 | 88: base-f torch 1 and 2 |

- **base-m torch 1 (114)** is `main`'s own: there the paddle's hand votes the hair's darkest into the near-black (117
  texels, 94 of them within the hand's reach). The parted hand, with no vote, keeps the hair's colour; `main` does not.
  No rule that ignores the hand can match `main` there.
- **base-f torch 1 and 2 (88)** are the budget's speck floor, a second stage that also counts the whole figure: a colour
  on fewer than 2·D² texels of the figure is folded into its neighbour. The hair shares a colour with the torch, the
  larger hand covers more of the torch, and a few hair texels cross the floor. Same cure (count outside the hands'
  reach), but it changes which colours are specks and moves `main`'s own frames; **not done, resume here**.
- Pinned (`tests/unit/paint/hand-vote.test.ts`): the budget's vote (a unit case), and no texel above the shoulder row
  moves between paddle and parted for both figures at density 1 and 2 over the 8 standing views, the walk and the torch
  from the front (it fails with the vote off: 270 bytes in the base man's front torch frame). The three-quarter and side
  torch frames are left out of the pin for the reason above.
- The arm and thigh's one-step moves (each surface's tone thresholds are quantiles of its visible texels) are left as
  they are: no cheap, principled way appeared. The walk frames' magenta round the hands in the map is the walk's smear
  trail, which the scratch mask does not include.

### The sheet (suffix `-round4`; rows before | round 3 | round 4 unless named)

| Picture | What it shows |
|---|---|
| [`figure-x4-base-m-round4.png`](figure-x4-base-m-round4.png), [`figure-x4-base-f-round4.png`](figure-x4-base-f-round4.png) | The whole figure x4: front, 3/4, side, back |
| [`walk-torch-x4-round4.png`](walk-torch-x4-round4.png) | Four walk frames and the torch in three-quarter, x4 |
| [`hands-x10-turn0-round4.png`](hands-x10-turn0-round4.png), [`-turn1-`](hands-x10-turn1-round4.png), [`-turn2-`](hands-x10-turn2-round4.png), [`-turn4-`](hands-x10-turn4-round4.png) | Hands x10, before \| round 4: front, 3/4, side, back |
| [`density1-x8-round4.png`](density1-x8-round4.png) | Density 1, x8 |
| [`moved-texels-d2-round4.png`](moved-texels-d2-round4.png) | Every moved texel at density 2, before to round 4: cyan in the hands, magenta outside, red above the shoulders |

### My verdict (x4 first, then x10)

| View | Verdict |
|---|---|
| Front | Different from before at a glance: a large open hand, the index's ink line clear, the thumb a two-texel shape at the top of the palm's inner side with its notch. The woman's thumb is busy at x10 (ink on three sides of a small shape) |
| Three-quarter | The best: the far hand's thumb stands free, the index line runs to the notch; the near hand over the shorts reads, darker |
| Side | The closed contour makes the hand lie on the thigh: no nub, no "T"; the thumb bump at the front edge |
| Back | **Weak**: a large plain block. The thumb is hidden from behind (the palm faces the thigh, the thumb forward), and the index's side lies behind the shorts, so no divide shows |
| Walk | The swinging hands read as hands with a thumb and an index line |
| Torch | The grip is a large block with one ink bar across the shaft; reads as a hand on a stick |
| Density 1 | As round 3, plus the contour in the side view |

Risks for the Owner's eye: the hand is now large (a stylised hand, 1.25), and ink inside the hand is new to this painter
(it drew ink only on the silhouette); at x1 the divides are single dark texels.

### Round 4: the goldens that will move on the Owner's yes (they replace round 2's list)

Measured with `HAND_FORM = 'parted'` in the working tree, then restored (nothing written). Texels per base sheet are from
the scratch frames (the sheets' 8 standing views, the walk, the hero), before (`main`) to round 4:

| Golden | Moves |
|---|---|
| base | every sheet: D1 turn 66 / 51 texels (man / woman), walk 144 / 87, hero 6 / 6; D2 turn 1,519 / 925, walk 3,470 / 1,541, hero 172 / 109 (the test reports `base-m-turn-d1` 178 bytes and `base-m-turn-d2` 4,409 bytes first) |
| lit | 48 frames (the test's count) |
| actors | 147 of 147 frames per figure |
| sprites | 4 of 4 |
| sprite | 64 of 64 |

The red tests are the same files as rounds 1 and 2. Painter, 51 of 772: `golden/base` 2, `golden/lit` 1,
`golden/sprite` 1, `golden/actors` 2, `actors/actors` 4, `stage/sheets` 3, `paint/identity` 35, `hair/front` 1,
`outfit/shoe-form` 1, `paint/sheer` 1. Character kit, 16 of 233: `fashion/showcase-cells.test.ts`. No behaviour test
fails. **On the Owner's yes:** set the default to `'parted'`, delete `paddleRole`, the switch and the vote's gate in
`paint-colour.ts`, record `pnpm --filter @automata/figures golden` and the kit's showcase cells, and commit the
re-record naming this sheet.

### Where to resume

- The budget's speck floor (above): count a colour's texels outside the hands' reach there too, measure what it moves on
  `main`, and bring base-f's three-quarter and side torch frames to 0 above the shoulders.
- The back view shows no divide (the index's side is behind the shorts); if the Owner wants one there, it is a
  question of anatomy, not of the stamp.
- Not run: the browser suites, WebKit, Firefox, the GPU runner.
