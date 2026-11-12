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
