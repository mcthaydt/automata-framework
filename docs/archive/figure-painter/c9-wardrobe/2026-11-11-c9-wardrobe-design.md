# c9-wardrobe: hosiery, boots, caps, tabards, pleats, sleeves; front hair and a bob; tiny text; more faces

Cycle c9 spans two repositories: FigureBuilder (FB, this one) and automata-framework (AF, `mcthaydt/automata-framework`,
whose `extensions/character-kit` consumes FB as the submodule `vendor/FigureBuilder`). The owner pre-approved this spec
and its plan ("auto approve spec and plans").

## 1. Why

The owner's request, verbatim:

> add clothing: no real stockings or boots, a flat cap, a basic tabard, a skirt with no gathers, no rolled sleeves; hair:
> hair that falls in front of the shoulders, and a proper bob; tiny details: the watch and badge text; faces: Ada's
> portrait expressions (afraid, worried, firm) to the pipeline generically, make sure AF gets it

These are the gaps found when The Last Light's Ada and the Night Nurse were rebuilt as FB characters
(`claude/showcase-ada-nurse`, `f4905a4`: `docs/showcase/ada-nurse/README.md` lists 11; `showcase/ada-nurse/` holds the
stopgaps). The request names gaps 1–7, 9 and 11. Each becomes a generator plus data that any character can use. Nothing
here is Ada's or the Nurse's: they are the two test readers at the end.

## 2. What is there today (read from the code)

- **Garments.** FB base registers no garment kind (H1 `registerGarment`, `outfit/garments.ts`); the base pair wear
  painted-on blocks. The runway's nine kinds (`tee`, `hoodie`, `jacket`, `coat`, `skirt`, `dress`, `jeans`, `trousers`,
  `shoes`) live in AF's kit, `extensions/character-kit/src/features/fashion/` (`garments.ts`, `shells.ts`), registered by
  `registerFashion()` through the door (`src/shared/figure-builder/door.ts`). The showcase's `wardrobe.ts` is a second
  copy of the same shells (both were ported from `claude/runway-video`).
- **Legs and feet.** `body()` builds each leg as one surface, thigh to foot. A foot is `bareFoot()` or, when the `shoe`
  region is repainted, `shoe()`: one profile, heel to toe, on a flat sole box. There is no heel, no shaft and no query for
  the foot's size (`fit.ts` `Body` has `profiles`, `at`, `girth`, `clear`).
- **Sheer cloth.** `Material.mix` (`{ from, to, at }`) already blends two ramps at a fixed share; the hair's fade uses it.
  Nothing makes it denser where the surface turns from the eye.
- **Headwear.** H1's `coversHair` and `press` exist. No crown generator exists; `skull`, `onHead` and `headForm` are not
  on `src/kit.ts`.
- **Hair.** The base `fall` sweeps every clump behind the ear and down the back (`aEar`, `trunkBack`), `length` clamps at
  the chest, and a clump rides the head, a hair bone and (at most half) the neck, so long hair swings out when the head
  pitches or cocks. There is no fringe piece. The library has `shortFade` and `boxBraidPony`.
- **Prints.** `Print` and `stampPrint` stamp a bitmap texel for texel, with letter gaps that close as the cloth turns.
  There is no font: a print's rows are written by whoever uses it.
- **Faces.** `EXPRESSIONS` is `neutral, fear, surprised, sad, angry, talk, smile, dead`. The drawn face (`paint.ts`
  `stampFace`) draws `smile`, `dead`, `angry`, `surprised`, `talk` and the gaze tags; `fear` and `sad` change only the
  undrawn face's decals, so on a drawn face they are neutral (`outfit/moods.test.ts` says so).
- **AF.** `PaintedState` is `moving`, `pose`, `outfit`: no expression reaches the painter. `characterkit-wardrobe` is the
  unpainted core's example (`@automata/3d/figures`); the painted one is `examples/3d/characterkit/characterkit-painted.ts`.
  PR #607 (c8-lit, unmerged, waiting on #602) pins the submodule at FB `23f889c`, today's FB main.

## 3. Goals, non-goals, anti-goals

**Goals**
1. Every item of the request exists as a generator plus data, usable by any character, and is tested on FB's base pair
   with it and without it, with every slider at both ends.
2. AF has all of it: the submodule at FB main, the names through the door, the kinds registered by `registerFashion()`,
   an example that shows it, and a parity test against FB.
3. Ada and the Nurse are re-rendered with the new pieces in place of the stopgaps, with a before and after.

**Non-goals** (gaps of the showcase the owner did not name)
- A hair part driven by a state (gap 8) and a richer stain or wear texture (gap 10).
- A stockinged foot with no shoe: a foot is bare or shod, as today.
- High heels: the foot bone does not pitch, so a heel is low (section 5.2).
- Ada and the Nurse as AF content: they stay on FB's showcase branch.

**Anti-goals** (it fails if any of these happen, even if it works)
- A base-pair pixel moves, or any FB golden, or AF's runway golden or showcase cells.
- Code that names a character, a hand-placed pixel, or a fit fix for one body.
- A garment that reads as a costume or a stereotype (the cap is a soft cap with folds; a nurse's cap is that plus data).
- Nudity: hosiery is opaque on the pelvis whatever its opacity.

## 4. Where each piece lives (the key decision)

### Approaches considered for the garment kinds

- **(a) The kinds in AF's kit, through H1.** The new kinds go in `fashion/` beside the runway's nine and are registered by
  `registerFashion()`. FB gains only the machinery a kind cannot make through the hooks.
- **(b) The kinds in FB, as garment machinery a fork registers.** FB would carry `registerWardrobe()` in an opt-in
  module; AF and the showcase would both call it.
- **(c) Everything in FB base.** Rejected at once: CLAUDE.md keeps every registry empty in base, and a wardrobe is fork
  material.

**Chosen: (a), with a short list of generic machinery in FB.** Reasons:

1. Four of the six clothing items are options on kinds the kit already owns (`skirt` and `dress` gain a waist seam,
   pleats and gathers; `tee` and `dress` gain rolled and three-quarter sleeves) or are built from its shells
   (`top`, `tail`, `patch`, `piece`, `legsOf` in `shells.ts`). Under (b) the shells would have to move to FB or exist
   twice, and the runway golden would be at risk for no gain.
2. CLAUDE.md: "Brand and content material (a wardrobe, characters, ads) belongs in forks", and all five registries are
   "empty in base (so no base pixel moves)". (a) keeps that true with no new rule.
3. (b) splits one wardrobe across two repositories: nine kinds in the kit, six in FB.
4. What (b) is good at, one copy for both AF and the showcase, is handled by a sync script (section 5.9): the showcase's
   wardrobe is already a copy of the kit's lineage.

What a kind cannot make through the hooks goes in FB, generic and off by default: a sheer material's edge, the shod
foot's form (heel, sole, shaft), the foot's measures, the head's form for headwear, the glyphs, the hair pieces and the
drawn moods.

### The map

| Item | FB base (generic machinery, tested on the base pair with and without) | AF kit `fashion/` (H1 kinds and data) |
|---|---|---|
| Hosiery | `Material.mix.edge` (5.1); `rampOf` on `kit`; `Wearing.skin` (5.1) | `hosiery` kind |
| Boots | `Fit.shoe` (shaft, heel, sole, cap) built by `body()` and `dress()`; `Body.foot` (5.2) | `boots` kind; `shoes` gains `heel`, `thick` (its `sole` swatch is today's) *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` B1, N2]* |
| Soft caps | `skull`, `onHead`, `headForm` on `kit` (5.3) | `cap` kind (crown: flat, folded, pleated; band; brim) |
| Tabard, apron | none | `tabard` kind |
| Waist seam, pleats, gathers | none | options on `skirt` and `dress` |
| Rolled, three-quarter sleeves | none | options on `tee` and `dress` |
| Front fall, bob, stand-off | `Fall.front`, `Fall.turn`, `Fall.rest`, `length` to 2; the `fringe` piece; styles `bob`, `bobFringe`, `longFront` (5.4) | nothing to register: `HAIR_STYLES` comes through the door |
| Tiny text and marks | `paint/glyphs.ts`: `lettering`, `fitText`, `dial`, `plate` (5.5) | `badge` and `watch` kinds |
| Faces | `fear`, `sad`, `worried`, `firm` drawn (5.6) | `PaintedState.expression`, `mood` |

## 5. The design

Everything in 5.1–5.6 is FB and is off by default: with the new field or name left out, the code path and every texel
are today's. Section 7 says how that is held.

### 5.1 Sheer cloth: `Material.mix.edge`

`mix` gains `edge?: number` (0–1, default 0). At a texel whose normal faces the eye by `f` (0 edge-on, 1 square on), the
share is `at + (1 - at) * edge * (1 - f)²`: sheer cloth stretched over a limb is denser at its rim, which is how hosiery
is drawn. The mixed tone snaps to DUEL as `mix` does today. With `edge` 0 or absent nothing changes.
`src/kit.ts` adds `rampOf(material): string[]` (a material's four painter tones as hex), so a kind can mix the wearer's
own skin with its cloth.
*[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` B2]* A kind cannot know the wearer's skin today: `Wearing` has no skin (the `skin` passed to `dress()` is not on it).
So `Wearing` gains `skin: string`, the wearer's skin swatch, always filled by `dress()` (no code outside `dress()` builds a
`Wearing`, in FB or AF), and the kit's `hosiery` mixes from `rampOf(c.swatch(c.skin))`.

### 5.2 The shod foot: `Fit.shoe` and `Body.foot`

`Fit` gains `shoe?: ShoeForm`; the last garment in the outfit that sets one wins.

```ts
/** The shod foot's form (body() builds it; ignored on a bare foot). Every field optional; none set is today's shoe. */
export interface ShoeForm {
  /** The shaft: 0 none; up the shin to this share of the way from the ankle to under the knee (0.15 an ankle boot, 0.5 mid, 1 knee). */
  shaft?: number;
  /** A low heel, 0–1 of the most the flat foot allows (0.035 · k): an arch is cut between the heel block and the ball. */
  heel?: number;
  /** The sole's thickness, 1 today's, to 2. It thickens upward: the foot bone and the figure's height do not move. */
  sole?: number;
  /** A toe cap: a swatch on the front fifth of the upper. */
  cap?: string;
}
```

- The shaft and the shoe are one surface (one seam per side, 3007 and 3008), so no line is drawn at the ankle and the
  shaft's top edge draws against the shin. The shaft is the leg's own profile plus `Body.clear`, so it clears any calf the
  sliders make. It carries the leg's group and rides the shin's bones.
- The heel is carved, not added: the foot stays flat and no gait changes. Never more than `0.035 · k`.
- New parts are appended to the end of the figure's whole part list (`dress()`'s `all`, after the garment and hair
  parts), and only when a field asks: with no `Fit.shoe` the part list, and so the grain, is today's, and with one, no
  existing part's index moves (the sole keeps its index as the heel's block). *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` B1: "after the foot's own" would put
  them inside `body()`'s per-side loop, moving the grain of the right arm and leg, every garment and the hair.]*
- `Body` gains `foot: { length: number; width: number; ankle: number; knee: number }` (m; the ankle's and the knee's
  height above the floor), read by the kit's `boots` and by `legsOf` to clear a shaft.

### 5.3 The head's form for headwear

`src/kit.ts` adds `skull`, `onHead`, `headForm` and the types `Skull`, `HeadForm` (re-exports; the hair uses them
today), so a headwear kind sizes its crown from the head the sliders make.

### 5.4 Hair

All in `hair/hair.ts`, as fields of the base `fall` and one new base piece; no registry is used.

- **`Fall.front?: number`** (0–1, default 0). The share of the clumps rooted ahead of the ear that stay ahead: they pass
  in front of the ear, down in front of the shoulder and on over the chest, clear of the dressed trunk's front (the same
  `reach` probe as `trunkBack`, forward). They never cross the face: their path stays outside the outer eye. At 0 every
  clump goes behind, as today.
- **`Fall.length`** runs to 2 (1 the chest, 2 the waist); values to 1 are today's.
- **`Fall.turn?: number`** (−1 to 1, default 0). The ends' under-turn: over the last fifth of a clump its path curls
  toward the neck (positive) or flips out (negative), by at most two rope radii.
- **`Fall.rest?: 'head' | 'trunk'`** (default `'head'`, today's skinning): the stand-off model. With `'trunk'`, a clump's
  points below the shoulder line ride `J.chest`, those between the jaw and the shoulder blend head, neck, chest by height,
  and the hair bones' swing fades to nothing by the shoulder. Long hair then lies on the shoulders and back and stays put
  when the head pitches or cocks; only the part by the head moves with it.
- **The `fringe` piece** (a base piece, beside `scalp`, `rows`, `tail`, `bun`, `fall`):
  `{ from: Line; width: number; length: number; count: number; rope: Rope; sweep?: number }`. Clumps from the crown
  forward over the forehead, `width` rad either side of the front, to `length`: 0 the hairline, 1 the brow, 2 the chin,
  3 the chest (past 1 it lies over the face, clear of it and of the dressed trunk's front). `sweep` (−1 to 1) combs it
  to a side. To 1 it never reaches the eye row: a fringe does not hide the eyes unless the data asks for more.
- **Library styles** (`hair/library/*.json`, data): `bob` (scalp, a fall to the jaw with `turn`), `bobFringe` (the same
  with a `fringe` to the brow), `longFront` (a fall to `length` 1.6, `front` 0.5, `rest: 'trunk'`). Generic styles; the
  base pair wear neither.

### 5.5 Glyphs: tiny text and marks

A new file, `src/features/paint/glyphs.ts`, with its data in `src/features/paint/library/glyphs.json`: a 3 × 5 font
(A–Z, 0–9, space and `. - ' / : + !`). A font is library data, like a swatch; nothing is placed by hand on a figure.

```ts
/** Rows for a Print: '#' ink, ',' the gap between letters (stampPrint closes it as the cloth turns), '.' none. Unknown characters throw. */
export function lettering(text: string): string[];
/** The longest of: the text, its initials, its first letter, a two-texel bar, whose lettering is at most `width` texels wide. */
export function fitText(text: string, width: number): string[];
/** A dial `size` texels across (3, 5 or 7): '#' the rim, 'o' the face, 'h' the hands at `time` ([hour, minute]); `flip` upside down (a fob watch). Size 3 has no hands. */
export function dial(size: 3 | 5 | 7, time: [number, number], flip?: boolean): string[];
/** Rows on a ground: 'o' around and between them, `pad` texels each side, so a mark reads on any cloth. */
export function plate(rows: string[], pad?: number): string[];
```

All four go on `src/kit.ts`. `stampPrint` is unchanged.

**What fits.** `stampPrint` lays one bitmap texel on one cell texel, so a print's size in metres falls as the
density rises. *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` B3; the first draft said the chest is about 30 texels at D2, a badge carries the whole name at D4, and a watch is
`dial(5)` at D2.]* *[Task F0, 2026-11-11: measured on the painted cell with `npm run c9 -- out --measure`, view 0, replacing the audit's estimates.]* The usable width of a side badge (the torso texels on one side of the centre, at the badge's height, that
turn less than 50° from the eye, less a texel) is **5 and 3** (base-m, base-f) at D1, **10 and 6** at D2 and **22 and 13**
at D4; the whole torso is 12/9, 23/16 and 47/32 texels across; the chest's central run (what a fob hangs on) is 10/5,
21/12 and 43/24. "A. VOSS" is 27 texels in a 3 × 5 font (29 on a plate): wider than a side badge at every density. So at
D2 a badge carries initials on base-m (`AV`, 7 texels, on a plate of 9 × 7) and its first letter on base-f (a plate 6 wide
holds a 5-wide plate: `A`), at D4 initials (the whole name fits at none), at D1 a bar (`##`); `fitText` makes that choice
from the width it is given (the usable width less the plate's two pad texels), for any text. The wrist is 4.3 × 5.6
(base-m) and 3.2 × 4.2 (base-f) texels at D2, 8.4 and 6.2 across at D4 and 2.2 and 1.7 at D1, so a wrist watch is the largest dial
that fits it: `dial(3)` (no hands) at D2, `dial(5)` at D4 (`dial(7)` on base-m's wrist only), and at D1 a wrist has no room for
one (the dial is dropped); a fob on the chest, 21 and 12 wide at D2, can be `dial(7)` or `dial(5)` there. The face's eye is 2, 4 and 7 texels wide at D1, D2 and D4 and its half-width 4.6/4.0, 9.3/7.9 and 18.5/15.8; the
shod foot is about 10, 20 (base-m) and 19 (base-f), and 39 and 36 texels long at D1, D2 and D4. That is what "legible at D2" means here, and the spec does not promise more.

### 5.6 Faces

`EXPRESSIONS` gains `worried` and `firm` at its end; `fear` (the owner's "afraid") and `sad` are drawn at last. The drawn
set becomes `smile, dead, angry, surprised, talk, fear, sad, worried, firm`. Each is marks the painter already has,
moved by whole texels:

| Mood | Brows | Eyes | Mouth |
|---|---|---|---|
| `fear` | up a row, and the inner end up one more | wide: the lid a row higher, white above the iris (at D1 the eye is two tall) | parted, narrow (one or two texels of the mouth's dark) |
| `worried` | the inner end up a row | as neutral | closed, a texel narrower each side, level |
| `sad` | the inner end up a row, the outer end down a row | the upper lid a row lower over the white (not `dead`'s full lid) | corners down a row |
| `firm` | level, a row lower, no slant | as neutral | a straight line a texel wider each side, no corners, the lower lip in its dark tone |

- They compose with `talk` and the gaze tags as today's moods do.
- At D1 (an eye under 3 texels) each keeps the one or two marks that fit, by the table's first column that still shows.
- The undrawn face's decals (`face()` in `garments.ts`) gain `worried` (the `fear`/`sad` brows) and `firm` (the closed
  mouth, `size: [2, 1]`, today `sad`'s and `angry`'s) in their `when` lists, and both join the open eye's `when`, so both
  faces agree. *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` S1: there is no "level mouth" decal, and an expression missing from the eye decal's `when` has no eyes.]* The base pair draw their faces, so no golden sees it.
- Every pair of the ten faces (neutral and the nine) differs at D2; at D1 each differs from neutral. A mark is put only
  on the face's own skin texels (`own()`), so nothing lands on hair, a cap or the outline.

### 5.7 The kit's kinds (AF, `extensions/character-kit/src/features/fashion/`)

Each is sized from `Wearing.body`, so it clears any body. Lengths are shares, never metres.

| Kind | Item | How it is built |
|---|---|---|
| `hosiery` | `{ hosiery: string; opacity?: number; top?: 'waist' \| 'thigh' \| 'knee'; welt?: boolean; seam?: boolean }` | Repaints `thigh`, `knee`, `shin` (`knee`: the knee and shin) with a material of its own (`Fit.materials`): `mix` from the wearer's skin (`rampOf`) to the cloth, `at: opacity` (0.15–1, default 0.6), `edge: 0.6`. `top: 'waist'` (tights) also repaints `pelvis`, opaque. `welt`: a band a clearance out at the top (three quarters up the thigh, or under the knee). `seam`: a back seam, the leg shell's rear gore on its own seam number. |
| `boots` | `{ boots: string; height: 'ankle' \| 'mid' \| 'knee' \| number; heel?: number; sole?: string; thick?: number; toe?: string }` | Paints `shoe` and `sole`; returns `Fit.shoe` (`shaft` 0.15, 0.5, 1 or the number; `toe` as its `cap`). *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` S8: the toe cap was `cap`, the `cap` kind's name; `kindOf` matches items by their keys]* |
| `shoes` (gains) | `heel?: number; thick?: number` | `Fit.shoe` with no shaft. Left out: today's. |
| `cap` | `{ cap: string; crown: 'flat' \| 'folded' \| 'pleated'; folds?: number; band?: string; brim?: number; tilt?: number; mark?: { text?: string; ink: string } }` | A dome lofted over the skull one clearance out, cut into `folds` gores on alternating seams (so each fold draws as a line); a band round the head at the brow; `brim` 0–1, a peak forward. `flat`: low, pulled forward over the brim (a flat cap). `folded`: a stiff front whose top edge turns back (a nurse's or a cook's cap). `pleated`: a full soft crown gathered into the band. `coversHair` with `press`. |
| `tabard` | `{ tabard: string; length: number; bib?: number; width?: number; sides?: 'open' \| 'tied'; ties?: string; fold?: boolean; pockets?: { count: 1 \| 2; depth: number; swatch?: string }; back?: 'panel' \| 'cross' \| 'none' }` | Built `last`. A bib (0 none, 1 to the chest's top) and a front panel to `length`, patches of the torso shell and a `tail` cut to the front arc; `back`: a matching panel, straps that cross, or nothing (an apron). `sides: 'open'` leaves the flanks showing what is worn under; `'tied'` adds a tie each side at the waist. `fold`: the panel's halves on two seams, so a crease draws down the centre. Pockets: patches a clearance out on their own seam, `depth` their height. |
| `skirt`, `dress` (gain) | `waist?: true \| string; pleats?: number; gathers?: number` | `waist`: a band ring on its own seam at the waist (in the cloth or a swatch). `pleats`: the tail cut into that many gores on alternating seams, alternate gores half a clearance in. `gathers` (0–1): the top ring steps out from the band by up to two clearances and short gores run a quarter of the way down. Left out: today's smooth cone. |
| `tee`, `dress` (gain) | `sleeves: … \| 'three-quarter'; roll?: true \| string` | `three-quarter`: the sleeve ends at the forearm's middle. `roll`: a ring two clearances out at the sleeve's end, on its own seam, in the cloth's shade or a swatch. |
| `badge` | `{ badge: string; text: string; ink: string; at?: 'chestL' \| 'chestR' \| 'waistL' \| 'waistR' }` | A decal with `Print`: `plate(fitText(text, w))`, `w` from the chest's ring at that height and the density; printed on the surface under it (`seams`). |
| `watch` | `{ watch: string; face: string; ink: string; at: 'wristL' \| 'wristR' \| 'fob'; time?: [number, number] }` | `dial` at the size the density allows; `fob` hangs it on the chest, flipped. |

`registerFashion()` registers them after the nine, in the order of the table, so no existing figure's parts reorder.

### 5.8 AF: the door, the state, the example, the parity test

- **Submodule.** `vendor/FigureBuilder` moves to FB main once FB's c9 merges. AF's c9 branch is cut from AF main after
  #607 merges; if #607 is still open when the FB work is done, the AF tasks wait (the plan says where to stop).
- **The door** (`src/shared/figure-builder/door.ts`) adds, each by the change that first uses it: `EXPRESSIONS`,
  `type Expression`, `type ShoeForm`, `type Print`, `type Decal`, and from `figure-builder/kit`: `rampOf`, `lettering`,
  `fitText`, `dial`, `plate`, `skull`, `onHead`, `headForm`, `type HeadForm`. `door-view.ts` does not change. The door rule
  (`tests/unit/shared/door.test.ts`) is untouched: no other file imports `figure-builder`.
- **The state.** `PaintedState` gains `expression?: Expression` and `mood?: readonly string[]`; `checkState` throws on an
  expression that is not in `EXPRESSIONS`, naming the list. `Painter.paint` passes both to `Figure.update`, and the
  expression to a stand's `ScriptedActor` (`expressions: [{ t: 0, is }]`); the stand's key gains the expression.
- **The example.** A new painted example, `examples/3d/characterkit/characterkit-painted-wardrobe.ts`, with its e2e test:
  the base pair in a room, each in an outfit made of the new kinds, stepping through `worried`, `firm` and `fear`.
  (`characterkit-wardrobe` is the unpainted core's and stays as it is; its header gains a line pointing here.)
- **Parity against FB**, two checks:
  - **P1, the machinery.** FB records `tests/golden/wardrobe.json` (5.10). AF's `tests/unit/fashion/c9-parity.test.ts`
    paints, through the door, every frame of it that needs data only (the three hair styles and the ten expressions on
    the base pair; *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` S6: ten, `EXPRESSIONS`' length]*) and expects FB's md5s, copied by `scripts/record-c9-cells.ts` from the submodule, never by hand.
  - **P2, the kinds.** As c7 did for the runway: the kit's `C9_OUTFITS` (`src/testing/`, each new kind on the base pair)
    painted in AF equal, to the byte, the cells FB's showcase branch paints with its synced copy (5.9).
- **The gate sheet** (`scripts/gate.ts`): each new kind on both base figures, 8 views, standing and walking, D2, × 8.

### 5.9 The showcase

On `claude/showcase-ada-nurse`, after both merges: merge FB main; replace the stopgap kinds in
`showcase/ada-nurse/wardrobe.ts` with the kit's `fashion/` files, copied by a script (`showcase/ada-nurse/sync-kit.sh`:
it takes an AF checkout and a SHA, copies the files into `showcase/ada-nurse/kit/` beside a generated `door.ts` that
re-exports the AF door's names from `../../../src` and `../../../src/kit`, and points the copies' door import at it;
*[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` S11: the kit's files take names of both entries through one import, so a path rewrite alone cannot split them]*),
never edited by hand; replace the `veil` piece and the `fringeBob` and `curtain` styles with `bobFringe` and
`longFront` plus a `fringe` of `length` 3; give Ada her hosiery, boots, tabard, pleated ward dress, rolled sleeves,
badge and watch, and the Nurse her cap; add `worried`, `firm` and `fear` hero frames. Re-render and write
`docs/showcase/ada-nurse/c9-compare.md`: each of the 11 gaps, before and after, with the gaps left open named.

### 5.10 A sixth FB golden, new

`tests/golden/wardrobe.json` (recorded from `tests/golden/wardrobe.ts`, read by `tests/golden/wardrobe.test.ts`,
`npm run golden -- wardrobe`): an md5 per frame of the base pair with each c9 piece of FB's: the three hair styles (8
views, D2), the ten expressions (front, D1 and D2), and, through test fixtures (`tests/features/outfit/wardrobe-fixtures.ts`,
tests only, as `paint/fabric-fixtures.ts` is), a sheer leg, the four shoe forms and a lettered plate. It is a new file,
so it moves nothing; it pins c9 so a later cycle cannot move it unseen, and it is what P1 reads.

## 6. Checks

Every FB item has a test under `tests/features/` that draws a base figure with it and without it (CLAUDE.md's rule),
and `body/sliders.test.ts`'s both-ends sweep runs over it:

| Item | Test | It asserts |
|---|---|---|
| `mix.edge` | `paint/sheer.test.ts` | with `edge` the rim texels of a leg are darker than its middle; with 0 the cell equals `mix` alone; every colour is DUEL |
| `Fit.shoe` | `outfit/shoe-form.test.ts` | each field changes the foot and nothing above the shaft; no field: the cell equals today's shod figure; the shaft clears the calf at every slider end; the feet texel and the figure's height do not move; the heel never exceeds its cap |
| `Body.foot` | `outfit/fit.test.ts` | it is `body()`'s own foot, at slider ends |
| `Fall.front`, `turn`, `length`, the styles | `hair/front.test.ts` | front clumps lie ahead of the shoulder and outside the face; none enters the dressed trunk; at defaults the cell equals today's |
| `Fall.rest` | `hair/standoff.test.ts` | with the head pitched ±0.4 rad and rolled ±0.3 rad, and `headTilt` at both ends, no hair vertex below the shoulder enters the trunk or leaves it by more than its clearance plus two texels, and the painted cell has no background hole enclosed by hair and trunk; `'head'` equals today's |
| `fringe` | `hair/fringe.test.ts` | to `length` 1 no texel of the eye row is hair; past 1 it covers the face and clears it; sliders at both ends |
| glyphs | `paint/glyphs.test.ts` | every glyph is 3 × 5 and distinct; `lettering` widths; `fitText` falls back in order; `dial`'s hands at four times and flipped; a plate stamped on a base figure differs from none and is DUEL |
| moods | `outfit/moods.test.ts` (extended) | the ten faces pairwise distinct at D2; each differs from neutral at D1; symmetric at the front; with `talk` and gaze; no mark off the face |
| defaults | `paint/identity.test.ts` (extended) and the five goldens | nothing moves |

AF: unit tests per kind (builds on the base pair and on the fit bodies, with and without, no skin through cloth, by
`fit.test.ts`'s two counts), `state.test.ts`, P1, P2, the example's e2e, and the runway golden and showcase cells
unchanged.

## 7. Constraints

- CLAUDE.md's rules: the layer order, DUEL only, whole steps along a ramp, never reorder a figure's parts, never cut hook
  machinery as dead, no per-character code, no hand-drawn pixels, never nudity, no costume or stereotype.
- **No FB golden moves** (base, lit, actors, sprites, sprite). If one goes red the change is wrong. `wardrobe.json` is new.
- **AF:** the runway golden and the showcase cells do not move, across the submodule bump and across the kit's changes.
  A moved cell is investigated, never re-recorded.
- **The contract.** The names and fields are additive: new optional fields (`Fit.shoe`, `Material.mix.edge`, the `Fall`
  fields), two always-filled ones (`Body.foot` by `bodyOf`, `Wearing.skin` by `dress()`), new names on `kit` and two new
  members at the end of `EXPRESSIONS`. One change is not a name: `fear` and `sad`, today painted as `neutral` on a drawn
  face, are drawn. No consumer passes either (AF's character kit passes no expression, at `main` and at #607), and moved
  cells have not raised the version before (c8-lit's), so `STAGE_VERSION` stays 1 and the package stays 0.2.0; the
  changelog names the change, and `tests/api.test.ts` the new names. *[Plan audit, 2026-11-11: corrected; `docs/superpowers/audits/2026-11-11-c9-wardrobe-plan-audit.md` S2: the first draft said everything is additive]*
- AF's own rules (`AGENTS.md`): tests first, the door, a file under 600 lines, `pnpm check`, a patch changeset for the
  published kit.

## 8. Calls made here (the owner may overrule any)

1. Kinds in AF's kit, machinery in FB (section 4).
2. "Afraid" is `fear`, the name `EXPRESSIONS` already has; no alias.
3. `sad` is drawn too (a natural sibling; `surprised` and `angry` already are).
4. At D2 a badge reads as initials; the full name needs D4 (5.5).
5. A heel is low and carved; the foot never pitches (5.2).
6. An apron is a `tabard` with `back: 'none'`: one kind.
7. A fringe past the brow covers the face: the Nurse's veil is `fringe` data, not a piece of its own.
8. A new painted example rather than a change to `characterkit-wardrobe`, which shows the other figure core.
9. A sixth golden for c9's own frames.
10. Three visual checkpoints, not two, because the kinds are drawn in AF: A (FB: hair and the garment machinery),
    A2 (AF: every kind on the base pair) and B (FB: expressions and prints).

## 9. Left to the builder

- The exact curves: the fringe's path, the front clumps' path, the crown's loft, the pleats' depth. Each is judged on the
  checkpoint sheets.
- Whether `Fall.rest: 'trunk'` needs a second skin for clumps that hang in front (the chest carries those too).
- The `ink` characters a plate uses and how `badge` picks its plate's width from the ring.
- If `mix` cannot take an eye-facing term where it is computed today, the same rule may live where the painter resolves
  a texel's tone, as long as section 5.1's formula and the off-by-default rule hold.
