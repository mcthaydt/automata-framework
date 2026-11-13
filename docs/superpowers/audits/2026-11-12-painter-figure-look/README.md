# The painter's look options: what each changed

Branch `claude/painter-figure-look`, from `main` at `4a505e86` (the figure painter lives in the framework as the private
package `@automata/figures`, `extensions/figures`). The Owner, 2026-11-12: "iterate on the characters until they look good",
"I just want the updated painter and face really", "go with the look from the image generated images rather than our
pre-existing sprites". The findings and the ranked painter list were in the character kit's audit on
`claude/last-light-prologue` (`docs/superpowers/audits/2026-11-12-last-light-figures-look/`); this is the painter's half.

The rule each item works under (the painter's own): everything is a generator plus data, and an option's default leaves every
existing figure byte-identical. **No golden, md5 or hash moved** (the commit hook ran the goldens after every commit; the whole
unit suite, 58 files and 758 tests at the last push, passes).

## Second pass, 2026-11-12: the Owner's bar, and an honest verdict

The Owner, 2026-11-12, after seeing the first pass's sheets (figures at density 1 and 2, 64 and 126 rows tall): **"The quality is
visibly worse than our existing examples"**, and then: **"I don't want you to hand me anything the quality of what you sent again."**
Both are recorded here because the first pass judged its options only at densities 1 and 2, and the Owner's good example is a
fork's figures drawn large.

**The bar, as first briefed:** a figure shown large at density 4: a head of 60 texels or more; clearly drawn eyes with lids and whites,
brows, a nose, lips; hair with shaded mass and a clean silhouette; clothing with folds and shading; clean proportions; clean warm skin,
no blemish-like marks, no dusty skin, no stray dark texels; a silhouette that reads at a glance. A figure that looks worse than the
untouched base woman at the same density fails. **The bar, corrected the same day** (the coordinator looked at the ad's frames enlarged;
the first version over-described the faces): the ad's faces are this painter's faces (slit eyes under a lid line with a small white, thin
brows, the nose a lit plane with a shadow plane beside it, a short mouth line with a lighter lip under it). They look good because of
(1) size, a head of 90 to 110 texels with hair, (2) clean planar skin shading, (3) hair as a soft mass in 3 tones with a few dark strand cuts and
a clean scalloped fringe edge, (4) a clean 1-texel dark outline, (5) clothing as large soft-shaded masses in 3 tones with no loud fabric
tile, (6) large heads, about 4.5 to 5 heads to the body, (7) plain presentation. The verdict below is line by line against those seven.

### The showcase

`showcase.png` (1800 px wide, density 8), left to right: the heroine at 7 heads with the sprite's slit eye; at 7 heads with `eyes.full`; at about 5
heads (a larger head) with the slit eye; at 5 heads with `eyes.full`; the untouched base woman at the same size. Full body at x1, the head and
shoulders at x2, and under them the two `eyes.full` heroines at density 4, 2 and 1 (each at about the same size on the screen, front and 3/4).
`showcase-d4.png` is the same heroine (7 heads) at density 4 beside the base woman, the sheet the first brief asked for.
Made by `pnpm --filter @automata/character-kit study:heroine <dir> 8 variants` (and `<dir> 4 showcase-d4.png`; `study:runway <dir> 4` draws the runway cast, `<dir> 8 heads` their heads): a kit SCRIPT that
dresses the study figure in the runway wardrobe's garment kinds and draws it through the kit's door; the kit's `src` and its recorded cells are untouched.

The heroine is the base woman's body set to the look spec (`BASE[1]`, 162 cm, slim), the small oval face, `skinPeach` (a warm peach whose light step is `#fedfb1`; `face.light` left off: see below),
an auburn `bobRound` (this pass's library bob) with a 13-strand brow-length fringe, a cream `top` shirt with cuffs, an oxblood sleeveless runway `tee` shell over it (the
stand-in for the waistcoat), the runway's `jeans` (plain washed denim, no fabric tile), the runway's `shoes` as ankle boots (`boots: true`, `shaft` .2), `standTrack`, ink `#002219`.
The 5-head variant sets `head` .95, `legs` .15, `neckLength` .1, `height` 158 on the same data.

### Verdict, line by line (against the seven lines of the corrected bar)

**It does not meet the bar. Nothing here is ready to hand to the Owner.** The honest state is "much closer, and still short on four of seven".

1. **Size: not met.** Heads, measured from the cells (hair top to the chin): the heroine at 7 heads is 37 rows at density 4 and 73 at density 8; at about 5
   heads 43 and 84. The base woman's is 58 and 115 (her proportions are 4.45 heads, with a top-knot). The painter's density is any number (the cell is 64D by 96D),
   so 90 rows for the 5-head heroine needs density 9 (about 94), which I did not draw. Density 4 cannot reach the bar's head size for these proportions.
2. **Clean planar skin: partly (reworked after the coordinator's look at the first showcase).** The base pair at density 8 is clean (large flat planes with hard edges, no dither); at density 4 the same planes are a quarter of the area and read as
   specks (the man's orange chin smudge is the chin's lit plane, `faceLight`; `PaintStyle.cluster` merges hair clumps but does not touch the face's planes: tested at 3, 8, 16 and 40).
   The heroine's skin at density 8 is clean planar on the arms, hands, legs and the 5-head face; **the 7-head face has a lit patch on the neck under the chin that reads as a smudge**,
   and `skinFair`'s lightest step (`#ffe2cf`) was near white, so the skin was ghostly beside the oxblood: **the showcase now uses `skinPeach`** (same three darker steps, light step `#fedfb1`, warmer and a little darker; test in `face-tone.test.ts`). The lit smudge under the chin of the 7-head figure is still there. `Material.face.light` .6 is a bug in effect, not an option to show: at
   density 4 and up it turns the face into a hard-edged pale mask against the neck, so the showcase leaves it off (the option stays, default off, as the first pass shipped it).
3. **Hair: partly, better.** The first showcase's `bobFull` read as a mushroom cap (too wide at the cheek, little height over the skull, a straight notched fringe, flat inside). The library now has **`bobRound`** (by options on the same scalp: `lift` .16 for the crown, hem `foot` .5 instead of .8, `under` .3 so the hem curves in, `ridges` 14 strand rows instead of 9): a rounded mass with a higher crown and a narrower hem, a 13-strand fringe, more strand rows; `bobFull` is unchanged. It is still a smooth shell (no dark strand cuts like the base woman's braids, a fringe that is a stepped band, not a soft scallop, and from the side a rounded mass with no back volume). I did not get to the side view's ball or a scalloped fringe edge.
4. **Outline: met.** A clean 1-texel dark teal (`ink` `#002219`), both the first pass's option and this pass's showcase.
5. **Clothing as large soft masses: partly.** The vest, the sleeves and the jeans are large three-tone planes with light knee and thigh patches, and there is no fabric tile (I used the plain
   swatches). But they are flat blocks: no waistcoat opening, no button line, no collar (the base `top.collar` draws as a puffy ruff, so the heroine has none), no creases at the elbow or knee,
   and the ankle boots are brown lumps. The kit's own wardrobe at density 4 and 8 is worse in one way, better in another: its fabric tiles (plaid, gingham, breton, pinstripe, windowpane) read as wallpaper, but it has real shells, collars, hems, soles.
6. **Large heads: met for the 5-head variant, not for the 7-head one.** Which reads better, at density 8: the 5-head one. Its face gets 84 rows against the 7-head one's 73 at the same figure height, and
   the bigger head and shorter neck read at a glance as the same stylised figure as the ad's and the old game's, where the 7-head figure is elegant and anatomically convincing but the face is small
   and the long neck is the first thing the eye lands on. The Owner chooses.
7. **Plain presentation: met.** Flat background, no grid, no grade, the painter's own cells only (the black line is the painter's ground line).

**Eyes.** At density 8 and 4 the sprite's slit eye (a lash row over a 2-row iris) reads half asleep on this face; `eyes.full` (below) reads awake: an iris about a third of the eye's width (it was .45: large dark discs that stared) with a pupil and a catch-light, an opening a row taller than the iris so the white shows under it, the lid over its top, a lower lid. It looks better to me than the slit at density 8, and at density 4 it is a 3 by 3 iris block, better than the slit and still small. The ad's own faces are slit eyes, so
the Owner decides; it is an option, off by default, and the showcase shows both.

### What the base pair is at density 4 and 8, and why the fork's figures look better

Untouched (`d4-d8/base-d4-sheet.png`, `d4-d8/base-d8-sheet.png`): heads 52 (man) and 58 (woman) rows at density 4, 102 and 115 at density 8; 5.1 and 4.45 heads tall. At density 4 the base pair
fails the first bar item by item: thin lidded slit eyes, a hairline nose, a flat 1-texel mouth, no lips, a flat grey tank and shorts with no folds and no collar, tube limbs, blocky bare feet, an
orange smudge on the man's chin. At density 8 it is clean and planar, which is the corrected bar's second line, and still has none of the clothing.

What a fork adds that the base pair lacks. The base wears four garment kinds (`top`, `shorts`, `hair`, `eyes`). The runway wardrobe (character kit `fashion/`, a port of FigureBuilder's `runway-video`)
registers nine kinds through `registerGarment` (`tee`, `hoodie`, `jacket`, `coat`, `skirt`, `dress`, `jeans`, `trousers`, `shoes`) built as real shell parts by `shells.ts` (collar bands, lapels, openings,
hems, a hood behind the neck, a pouch pocket, a zip line), twelve hair styles from the painter's own pieces, the `silk` finish, seven fabrics (`registerFabric`: twill, rib, gingham, breton, pinstripe, plaid,
windowpane) and its own swatches. **Generic machinery already in the painter and unused by the base pair:** the five registries; `top.cuffs` and `top.collar`; hems and the shoe region (`Fit.shoe`, a shaft, a low
heel, a thicker sole, a toe cap); sheer cloth; prints; the skirt and cape groups; the material features (holo, mirror, see-through, stain and wash, strands, a dark gloss as leather); the hair's `foot`, `reach`,
`under` and `parting` (this branch's) and its fringe, front hair and finishes. The faces of the runway cast are the base pair's faces: at density 8 they are clean and planar and still have one-texel marks, which is
what the ad's faces are too; only the clothing and the hair of the fork are better, not its faces.

### What I changed in the painter (all generic, all default off, no golden moved)

Library entries first: `bobRound` (hair, above; `tests/unit/hair/bob.test.ts`) and `skinPeach` (swatches; `tests/unit/paint/face-tone.test.ts`). Then one option on the `eyes` garment, `full`, and its effect from an eye of 6 texels (density 3 and up; at density 1 and 2 it draws what it always drew, byte for byte): the eye's aperture as tall as the eye is wide, a round iris
with a pupil and a catch-light in a white all round; brows of one to three rows that thin to the tail; a lower lid; an upper lip's body and a second row of lower lip; a nose with a side plane, a lit tip and wings.
Tests first, in `tests/unit/figure/eye-full.test.ts` (20): the face is identical with and without it at density 1 and 2 in three views; the aperture is taller and the iris round at density 4; the eyes are level
and mirrored in front; every view draws; and, at density 7, thicker brows, more lip rows and a changed nose region. (The nose test went red for the wrong reason once, by counting skin steps that a darker step does not change: the
metric was rewritten to count the texels that differ before the code was written for it, and I did not re-watch the final test fail against a version without the nose code.) The first pass's options (`bobFull`, `face.light`,
`skinFair`, `eyes.mark`/`nose`/`mouth`/`keep`, `standTrack`, `ink`, `standStoop`) all pass their tests at density 4 now (face-tone, eye-marks, stand-track, stand-stoop and outline-colour test it; the bob's already did): none broke at density 4;
`face.light` is a visual misbehaviour there (the mask), not a test failure.

Commit note: because a lint hook failed once and left the files staged, the brows, lower lid and mouth change landed inside the commit titled `chore(character-kit): a study script that draws the runway cast large` (091a5f24). Its content is right and its title is not; the
history is pushed and I did not rewrite it.

### Ranked list for the character kit (not done here: the kit's `src` is not touched)

For a kit session. Each line: the kind or option, and what it must draw at density 8 (head about 100 rows, a figure about 500 rows; a texel of cloth is about 7 mm, a sleeve is about 40 texels wide). The kit's wardrobe at density 4 and 8 has real shells, soles and collar bands; what it lacks against the ad's clothing (large soft three-tone masses, a pale collar band, hoodies, a quilted jacket, a blouse, a tee) is below, ranked by what the showcase loses.

1. **A waistcoat: a sleeveless open-front kind (`waistcoat`, or `jacket` with `sleeves: 'none'`).** Draw, in the front view: a V opening from the neck to the sternum showing the shirt under it (the `inner` cloth of `jacket` does this), a row of 5 buttons down the closure (a 3 by 3 texel disc each, a step lighter than the cloth with a one-texel dark under-edge: decals, no painter change), a hem that stops at the belt in a shallow point, armholes cut to the shoulder seam so the shirt's sleeve runs out of them, and a back in a second cloth. Today the heroine's waistcoat is a `tee` shell with `sleeves: 'none'`: a dark block with no opening, no buttons and a straight hem.
2. **A shirt collar and rolled sleeves on `tee` (or a `shirt` kind).** A collar: a band round the neck about 5 texels tall at the back and two pointed leaves, about 14 texels long, lying on the chest either side of the V (`collarBand` and `lapels` already exist in `shells.ts`, used by `jacket`; give `tee` a `collar` option). Rolled sleeves: from the shoulder to the elbow the sleeve of the shirt's cloth, ending in a turned cuff about 6 texels tall and a step lighter on its fold, then the bare forearm (`sleeves: 'rolled'`). The base `top.collar` draws as a puffy ruff on a long neck; do not build on it.
3. **A cuff fold and a hem band on any shell.** A cuff at a sleeve end and a hem at the garment's end as a ring part 5 to 6 texels tall, one step off the cloth, with a one-texel dark line at its upper edge. The base `top.cuffs` does it only on the painted-on top and in a contrasting colour that reads as a bandage; match the cloth.
4. **Jeans with a seam and a cropped hem (`jeans` with `crop` and `seam`).** The outer seam: a one-texel line a step darker down the outside of each leg, from the waistband to the hem, with a thin lighter line beside it; a waistband 5 texels tall with a button and a fly line; a hem cropped to just over the ankle bone (`crop` as a share of the shin) with a turned cuff 4 texels tall. The plain washed swatch shows a pale knee and thigh blotch that reads as a stain: the painter's `stain`/`wash` features are what draw it; give the swatch a lower `wash` or none.
5. **An ankle boot (`shoes` with `boots`, `shaft` .2, plus a heel and toe).** A shaft about 22 texels tall rising a hand's width over the ankle, a collar band at its top a step lighter, a heel block 6 texels tall under the heel in the sole colour with a clear step from the sole, a toe cap a step darker than the vamp, a lace or side-zip line (a decal), and the trouser hem breaking over the shaft. The painter's `ShoeForm` already has a low heel, a thicker sole and a toe cap that `shoes` does not pass: use them. Today the boot is a brown lump with a hard-edged top and no heel.
6. **Fabric tiles that read as cloth, not wallpaper (data).** `plaid`, `gingham`, `breton`, `pinstripe`, `windowpane` and the denim `twill22` hatch read as a grid or noise at density 4 and 8, and `windowpane` on Otto's jacket draws a thin grid on a block. Give each a tone-on-tone version (one step apart, 12 to 16 texels a repeat at density 8); the showcase uses the plain swatches.
7. **Creases (shell geometry).** Nothing creases at the elbow, the knee, the waist or a hem: rings pushed in and out along a sleeve or a leg (three ridges across the elbow, two across the knee, a roll at a hem) which the painter then shades as it shades any form; the painter's `folds` knob only wobbles a terminator.
8. **A quilted jacket and a blouse.** Quilting is puffed rows: shell rings eased out between seams about 10 texels apart with a one-texel dark seam line, over the creases' ring machinery. A blouse is `tee` with a longer `length` and `ease` and a neck opening with a gathered yoke, a kit decision.
9. **A pale collar band on the `hoodie`.** In the ad the hood's rim behind the neck is a lighter band; the kit's rim is the hood's own colour, so the neck reads as a bare tube out of a block: a `trim` colour on the hood's opening ring (`Hoodie.trim` exists for the pouch pocket only).

### What was and was not run (second pass)

Node 24.22.1 (this container's `/opt/node24`; the repository asks for 24.21 or later), Chromium only. Per commit: the `goldens` project (9 files, 76 tests, every time) and the commit hook's affected tests. Before a push: the painter's whole unit suite
(`AF_UNIT_FULL=1`), `pnpm typecheck` for the painter and the kit, `pnpm lint`, `pnpm knip`, `pnpm style`; at the end the whole `pnpm check` and the painter's browser suite (below). **Not run:** WebKit and Firefox parity, the GPU runner, the 3D journeys, the character kit's `browser` and `webgpu` projects (they launch
Firefox and WebKit), and the painter's `slow/` and `install/` suites.

**Gates at the last push.** `pnpm check`: exit 0 (lint, typecheck, `boundaries`, `style`, `knip`, every package's unit tests, `changeset status`, `check-changesets`: 77 changesets, 0 problems). The painter's browser suites with `AF_WEBGPU=software`: 2 files, 227 tests passed.
The goldens project (9 files, 76 tests) passed after every painter commit. Two things to know about the runs: the first `pnpm check` of this pass failed, for two reasons that were not the code: the painter's `hair/fringe.test.ts` "build at every slider end" timed out at 262 s (testTimeout 90 s) while the whole repository's suites ran in parallel on this machine, and my new `bobRound` and `skinPeach` tests ran in it before the library entries they test were committed (they were written first, as the rules ask, and failed for the right reason). The second `pnpm check`, on a quiet machine and the committed tree, passed. The painter's whole unit suite alone passed earlier in the pass (60 files, 789 tests, before the last three painter commits; the second `pnpm check` ran it again on the final tree).

## First pass: the study figure and how the sheets are made

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
the character kit, `pnpm lint`, `pnpm knip`, `pnpm style`. At the handoff: the whole `pnpm check` (exit 0, 59 files and 761 tests for the painter, 28 files and 229 tests for the character kit), the
painter's browser suites with `AF_WEBGPU=software` (2 files, 227 tests passed), and the character kit's `webgpu` project with
`AF_WEBGPU=software` (3 tests passed, 1 skipped by the suite). **Not run:** the character kit's `browser` project, which launches
Firefox and WebKit (not installed here), WebKit and Firefox parity, the GPU runner, the 3D journeys.
