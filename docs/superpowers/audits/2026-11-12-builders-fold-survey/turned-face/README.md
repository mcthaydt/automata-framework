# A turned face keeps both eyes: the before-and-after sheet

Task 4d of [the builders fold](../../plans/2026-11-12-builders-fold.md). **Nothing is re-recorded until the Owner has
looked at these four pictures and said yes.** Each shows a cell the fix changes: the cell before, the cell after, and the
changed texels in red on the after, cropped about them and drawn at 8 times, nearest neighbour.

## What the fix is

FigureBuilder's `claude/turned-face-both-eyes`, commit `cfc4333` (filtered `3cf1f2a`), `fix(paint): a turned face keeps
both eyes`, cherry-picked here. On a head turned three quarters, the paint decided the far eye was "behind something
worn" because an ear's rim, painted in the skin's own tones, counted as a worn part over it, so the far eye was left
out. The rim is now counted as skin (`stampFace`'s `shaded()` asks `skinFamily`, which is `paint`'s `skinny`): 8 lines
of `paint/paint.ts` and one test (`eyes.test.ts`). The branch's second commit re-recorded goldens as they stood on
2026-11-09 and is not brought; the re-record is made afresh, after this sheet.

## What moves (measured on Node 24.21, the painter's whole suite and the character kit's)

Five tests in four files fail with the fix and nothing else does (579 tests, 574 pass):

| Test | What differs |
|---|---|
| `tests/golden/actors.test.ts`, `base-m` | 10 frames: `wave` 1, 2 and 3, `swing` 1 and `punch` 1 at D2; `stand-armsCrossed` 2 and `stand-handOnHip` 2 at D1, `stand-handOnHip` 1 at D2; the long script's frames 2 and 10 at D1 |
| `tests/golden/actors.test.ts`, `base-f` | 8 frames: `wave` 1 and 2 and `swing` 1 at D2; `stand-armsCrossed` 2 at D1 and D2; `stand-handOnHip` 1 at D1; the long script's frames 2 and 10 at D1 |
| `tests/golden/base.test.ts`, density 1 | one sheet, `base-m-hero-d1` (the lookbook stand): 9 bytes, the first at 6284, which is 3 texels |
| `tests/features/actors/actors.test.ts`, "sprites stay pixel-identical" | one md5, `base-m-D1`, frame 0 (the hero): the same cell as the base golden's |
| `tests/features/stage/sheets.test.ts`, "the stage keeps the base goldens" | `base-m hero0 at D1`: 3 texels. It reads the base golden's data, so it moves with it and needs no recording of its own |

The lit and sprite-lit goldens, the identity pins, `ulp.test.ts`, every guard test and **all of the character kit's
suites** (unit 229 tests; Chromium 58 tests, software GL) pass with the fix: no cell of the kit moves, and nothing in the
kit is re-recorded.

The 20 cells that differ (the table is [`table.md`](table.md); the pictures are the four PNGs here):

| Picture | Cells | Texels moved in each |
|---|---|---|
| [`actors-base-m.png`](actors-base-m.png) | 10 | 3 at D1, 12 or 13 at D2 (and 4 in the long script's frame 10) |
| [`actors-base-f.png`](actors-base-f.png) | 8 | 3 at D1, 10 or 11 at D2 (and 1 in the long script's frame 10) |
| [`base-base-m-hero-d1.png`](base-base-m-hero-d1.png) | 1 | 3 |
| [`sprites-base-m-D1.png`](sprites-base-m-D1.png) | 1 | 3 (the same cell as the one above) |

## What the pictures show, in words

- In every cell but the two noted below, the changed texels are the **far eye**: skin before, the eye's lid, white and
  dark after, on the face's far side of the nose, where the near eye has its counterpart. Nothing else on the face
  moves. At D1 it is a 3-texel mark, at D2 a block of 10 to 13.
- **Two cells change something that is not an eye.**
  - `base-m/script/10@D1`: besides the 2 eye texels at (34, 34) and (34, 35), two outline texels near the hand and
    torch, (42, 57) and (41, 61), go from the dark brown (49, 34, 42) to the grey-blue (45, 49, 54) the neighbouring
    outline already has. This is the colour budget (`budget()`, 24 colours a figure): the far eye adds two colours to a
    figure that already had 24, the closest pair on one material merges, and the rarer of the two (the brown, 2 texels)
    goes into the commoner (the grey-blue, 53 texels). Measured: 24 colours before, 25 after (the two new, the one
    merged away). It is the budget doing what it does, not a second change of the fix.
  - `base-f/script/10@D1`: one texel, (34, 38), skin (199, 130, 108) before, the eye mark's dark (74, 53, 60) after, on
    the face's front edge beside the outline, in a frame where the head is turned far round and tilted. It is the one
    texel I cannot judge from the picture to be exactly where an eye belongs; it is in the face and in the eye's own
    colour, and it is the Owner's to judge.
- The rest of each cell, the body, the hair, the arm and everything the actors hold, is texel for texel the same.

## What happens on the Owner's word

- **Yes:** the re-record is made with the painter's own recorder (`golden -- actors`, `-- base`, `-- sprites`), and the
  commit shows only the recorded files that moved: `tests/golden/actors.json` (18 md5s), `tests/golden/sprites.json` (one
  md5), and the one sheet `tests/golden/base/base-m-hero-d1.rgba.gz`. One commit, naming each golden, the count of cells
  moved in each, this folder and the Owner's words.
- **No:** the fix is reverted, and the fold goes on without it.

## How the sheet was made

`turned-face-sheet.ts.txt` here, run from `extensions/figures/scripts/` three times with the painter before the fix, with
it, and pairing the two (the actors' frames came from a copy of `tests/golden/actors.ts` that keeps each frame's pixels
in place of its md5). Both runs draw the three goldens' frames with the goldens' own recipes, so a cell is in the sheet
exactly when its recorded md5 or bytes would differ. The scripts are not kept in the package.
