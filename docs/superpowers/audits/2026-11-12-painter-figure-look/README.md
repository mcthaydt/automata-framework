# The painter's look options: what each changed

Branch `claude/painter-figure-look`, from `main` at `4a505e86` (the figure painter lives in the framework as the private
package `@automata/figures`, `extensions/figures`). The Owner, 2026-11-12: "iterate on the characters until they look good",
"I just want the updated painter and face really", "go with the look from the image generated images rather than our
pre-existing sprites". The findings and the ranked painter list were in the character kit's audit on
`claude/last-light-prologue` (`docs/superpowers/audits/2026-11-12-last-light-figures-look/`); this is the painter's half.

The rule each item works under (the painter's own): everything is a generator plus data, and an option's default leaves every
existing figure byte-identical. **No golden, md5 or hash moved** (the commit hook ran the goldens after every commit; the whole
unit suite, 58 files and 758 tests at the last push, passes).

## The study figure and how the sheets are made

`pnpm --filter @automata/figures study <out-dir> <item>` runs `extensions/figures/scripts/painter-look-study.ts`. It draws ONE
study figure from data only: the builder's base woman (`BASE[1]`) set to the audit's adopted variant "D" (the generated
turnaround's look spec): `height` 162, `fat` .1, `chunk` 0, `muscle` .3, `legs` .38, `head` .45, `hips` .3, `frame` .95,
`neckLength` .25, `posture` .9, `shoulders` .4; the turnaround's small oval face (`width` .5, `jaw` .2, `chin` .4, `eyeSize` .7,
`liner` .45, `crease` .3, `hood` .1, `browWeight` .2 …); the arms near the body (`armOut` and `standOut` .03); auburn hair, an
oxblood top, washed-denim shorts. **Where the reference's garment is the character kit's, the nearest painter base garment stands
in for it**: the waistcoat is a short-sleeved `top` in the waistcoat's oxblood with the shirt's cream `cuffs`, the jeans are
`shorts` in the jeans' washed blue, and the boots are bare feet (the painter's base library has no waistcoat, jeans or boots, and
its hair styles are its own `bob` and `bobFull`, not the kit's `bobFringeFull`). Each sheet shows, for each look: the 8 standing
views and the 8 walk poses at density 2 (x2), the face at x8 (front, 3/4, side), and density 1 at x4 (front, 3/4, back) with the
face at x12. The `…-numbers.json` beside each sheet is measured from the same pictures, never typed.

## The generated turnaround's numbers (from `ada-look-spec.md`, for the eye; the images are not copied here)

6.8 heads tall with the hair on (head with hair 14.8 % of her height); legs, crotch to floor, 50.6 %; the hair 17.8 % of her
height across (1.2 heads) at the eye row, 1.2 heads at the ears; the hair adds about 1 to 2 rows over the skull; eyes 69 % of the
way down the head, one eye about 30 % of the face's width, a gap between them about one eye; skin a warm light peach, `#ebbd9d`
mid (a DUEL colour), shade `#c58267`; the outline in the old game's pixel versions the DUEL teal `#002219`.
The study figure at density 2: 7.6 to 7.8 heads tall (the base woman's head and the 7-heads slider data differ from the kit's
helper's count), the hair 1.14 heads wide in front (1.2 on the base woman), 0 to 2 rows over the skull.

## 1. A full bob (`hair/`, commit 9504b8b2) — `hair-sheet.png`, `hair-numbers.json`

The scalp's shell gains `foot` (the lift at its hem by angle, easing to `lift` over `reach` of its height), `under` (the lift
falls to nothing at the very edge, so the hem is a rounded lip on the head), `parting` (one column in the hair's deep step from
the hairline to the crown) and finer rows when it has a foot. `bobFull` is the library style built on them: one shell, to the jaw
all round, no tail, no fall. Tests: `tests/unit/hair/bob.test.ts` (written first; each option drawn with and without it; naming the
default `reach` .25 draws the same cells; the library style held to the numbers below).

| study figure, density 2 | library `bob` (before) | `bobFull` | `bobFull` + fringe |
| --- | --- | --- | --- |
| rows over the skull (front, side, back) | 3, 3, 3 | 0, 0, 0 | 2, 2, 2 |
| hair width, in heads (front, side, back) | 1.07, 1.20, 1.07 | 1.14, 1.07, 1.14 | 1.14, 1.07, 1.14 |

On the base woman `bobFull` is 1.21 heads wide in front and behind and adds at most 2 rows over the skull. The README's 6 to 8
rows did not reproduce for the library `bob` on this figure (3). `under` is tested at the mesh level (the shell's lowest ring lies
on the head), not by pixel width.

## 2. Face tone at small sizes (`Material.face.light`, `skinFair`, commit 772b11c0) — `skin-sheet.png`

`Material.face.light` on a skin swatch is the least share of the face in the skin's lightest step; `skinFair` is a warm peach on
DUEL steps (`#ffe2cf`, `#ebbd9d`, `#c7826c`, `#a76057`; the reference's light `#f9ceb0` snaps to `#ffd59b` on DUEL, so `#ffe2cf`
is the light step). Test: `tests/unit/paint/face-tone.test.ts`.

| share of the face's skin texels in the lightest step | density 1 | density 2 |
| --- | --- | --- |
| today | 6 % | 10 % |
| `face.light` .6 | 71 % | 67 % |

Not done: a `shadow` option. The face's shadow comes from the cast-shadow and crevice passes (a nose, a fringe, the chin), not
from the key-light budget, so a number on the budget changed nothing; it was removed rather than shipped dead. Where the room's light
then tints the face is the game's business.

## 3. Eyes (the `eyes` garment, commit b8a94b91) — `eyes-sheet.png`

`mark: { size, x }` sizes and sets the neutral eye mark of an undrawn face (default 1 by 1 at .42 of the half-width; the lid follows
it): this replaces the character kit's stopgap `eyeMarks`. `nose: false` and `mouth: false` leave those drawn marks off.
`keep: true` draws the eyes on the skin a fringe leaves bare (down to three rows) instead of leaving them out. Test:
`tests/unit/figure/eye-marks.test.ts`. At density 1 a step from .42 to .6 moves no whole texel (the head is about 3 texels across a
side), so `x` shows from about .8, or at density 2. In profile at these sizes the painter draws no mouth, so only the nose switch
has a mark there. The reported `eyeSize` over .7 blanking behind a library fringe did not reproduce (the length-1 fringe stays above
the eyes at every `eyeSize`); `keep` is for a longer fringe or other hair over the eyes.

## 4. The stand (`Gait.standTrack`, commit 490c96e7) — `stand-sheet.png`

How far each foot stands from the middle, a share of the hip joints' half-width (default .75 as it always was; the relaxed stand's
`under` is 1 − `standTrack`). Test: `tests/unit/motion/stand-track.test.ts`. The arms were already a gait number (`standOut`).

| front, density 2, width of the figure over its last 6 rows | texels |
| --- | --- |
| `standTrack` .5 | 16 |
| default (.75) | 19 |
| `standTrack` 1 | 23 |

## 5. The outline colour (`PaintStyle.ink`, commit 535251ed) — `outline-sheet.png`

Black by default; a game sets `paintStyle.ink` to a dark DUEL colour (the old game's `#002219`). Test:
`tests/unit/paint/outline-colour.test.ts`: every texel the painter outlines in ink takes the colour and no other texel moves, on both
base figures in three views and at both densities, for `#002219` and `#181f2f`. One change beside the field: the painter's colour-merge
pass never joins a speck to a non-black outline colour. Black texels in the front view at density 2: 275; `#002219` texels: 258 (the
17 other black texels are not outline). Not covered: the sprite lighting (`lighting/sprite.ts`) keeps black and `#002219` as its
outline texels, so another outline colour is lit like any texel there.

## 6. A stooping stand (`Gait.standStoop`, commit ab9b161c) — `stoop-sheet.png`

The relaxed stand's chest pitched forward by this many radians, the head coming up half as far. Test:
`tests/unit/motion/stand-stoop.test.ts`. Study figure, front, density 2: heads tall 7.64 (upright), 7.51 (.35), 7.26 (.7).

## Not done

Hair that hangs in front of the face and chest free of the head (the nurse's curtain) and skirt pleats / a torn hem (`folds`): out of
time. The sprite lighting's treatment of a non-black outline (item 5). The README's `shadow` for the face (item 2).

## What was and was not run

Node 24.22.1 (this container's `/opt/node24`; the repository asks for 24.21 or later), Chromium only: no WebKit or Firefox, no GPU runner.
Per push: the painter's whole unit suite (`AF_UNIT_FULL=1 pnpm --filter @automata/figures test:unit`), `pnpm typecheck` for the painter and
the character kit, `pnpm lint`, `pnpm knip`, `pnpm style`. At the handoff: see the last message to the coordinator for `pnpm check` and
the browser suites.
