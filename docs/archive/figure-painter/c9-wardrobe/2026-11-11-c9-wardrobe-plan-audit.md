# c9-wardrobe: plan audit

The spec (`docs/superpowers/specs/2026-11-11-c9-wardrobe-design.md`) and the plan
(`docs/superpowers/plans/2026-11-11-c9-wardrobe.md`) on `claude/c9-wardrobe-spec` at `24f8ce3`, audited against FB `main`
(`23f889c`, with c8-lit), the showcase branch (`claude/showcase-ada-nurse`, `f4905a4`), AF `main` (`5d7f40d`) and AF PR #607's
head (`7167af1`, which pins FB `23f889c`). The owner pre-approved the spec, so its decisions (section 8) stand; this audit
checks them against the code. The spec was changed only where it was factually wrong, and each change is marked in it
("Plan audit, 2026-11-11: corrected"). Every finding below is fixed in the plan.

**Counts: 4 blocking, 15 should-fix, 7 nice-to-have.**

## How it was checked

Read: FB `src/` (`outfit/garments.ts`, `outfit/fit.ts`, `body/parts.ts`, `paint/paint.ts`, `paint/raster.ts`, `hair/hair.ts`,
`figure/figure.ts`, `actors/actor.ts`, `motion/motion.ts`), `src/kit.ts`, `src/index.ts`, `tests/api.test.ts`,
`tests/features/outfit/{faces,moods,hooks}.test.ts`, `tests/features/hair/ulp.test.ts`, `docs/contract.md`; the showcase's
README (the 11 gaps) and `characters.ts`; AF's `extensions/character-kit` (door, `fashion/`, `painted/`, the tests and
fixtures named by the plan), #607's diff, issues #592–#594 and the CI workflows.

Run (FB, `npm ci`, scratch scripts not committed): the drawn face's `FaceStamp` and the torso's and wrist's widths
(`bodyOf(...).at`) on both base figures at D1, D2, D4, and the painted silhouette's rows under the eyes.

| Measure (view 0) | base-m | base-f |
|---|---|---|
| Eye width `FaceStamp.eye` at D1 / D2 / D4 | 2 / 4 / 7 | 2 / 4 / 7 |
| Face half-width `FaceStamp.size` at D1 / D2 | 4.6 / 9.3 | 4.0 / 7.9 |
| Torso across at the badge's height, D2 (ring) | about 24 | about 16 |
| Painted silhouette there (arms against the torso), D2 | 41 | 33 to 36 |
| Wrist, a few cm up, D2 (x × z) | 4.5 × 6.0 | 3.4 × 4.5 |
| Foot length, D2 | about 21 | about 20 |

## Blocking

**B1. A shoe form's parts inserted in `body()` move the grain of most of the figure.** `dress()` returns
`[...body(), ...garment and hair parts]` and `body()` builds the left side (arm, hand, leg, foot) then the right; the part
index seeds the grain. The spec put the shaft "after the foot's own", i.e. inside the per-side loop: every later part
(the right arm and leg, every garment, the hair) would shift. F2's own test ("every differing texel lies below the knee")
would fail, and the off-by-default rule would hold only for figures without a form. *Fixed:* every new part is appended
to the end of `dress()`'s `all`, with its seam set explicitly (`surfaces()` runs inside `body()`); the sole keeps its index
as the heel's block; F2 asserts the first `n` parts are today's (Global Constraints, F2; spec 5.2 marked).

**B2. A garment kind cannot know the wearer's skin.** The kit's `hosiery` mixes "from the wearer's skin (`rampOf`)", but
`Wearing` has `m, s, garments, swatch, swatches, ppm, worn, state, body` and no skin (`garments.ts` line 150). *Fixed:*
FB adds `Wearing.skin: string`, filled by `dress()` (no code in FB or AF builds a `Wearing`), in F1 with a test (spec 4's
map and 5.1 marked).

**B3. The badge and watch numbers do not hold.** The spec estimated the chest at about 30 texels at D2 and promised
initials at D2 and the whole name at D4. Measured: the torso is about 24 (base-m) and 16 (base-f) texels across at D2; a
side badge, where the cloth still faces the eye (`stampPrint` drops a print turned past 0.6), has about 9 and 6; at D4
about 19 and 12. "A. VOSS" is 27 texels (29 on a plate): it fits on no side badge at any density. And the wrist is 3.4 to
4.5 texels at D2, so `dial(5)` overhangs it. F0 measured the whole chest, not the badge's usable width, and nothing in the
plan adapted to the result: F7 and A3 asserted the D4 full name. *Fixed:* F0 measures the side badge's usable width and the
wrist and says how the later tasks adapt; F7 tests `fitText` at the measured widths; A3's badge asserts the plate `fitText`
gives at D1, D2, D4 and the watch the largest dial that fits; Checkpoint B shows D1, D2 and D4 with the numbers (spec 5.5
marked with the measured numbers).

**B4. Nothing keeps the c9 frames stable across arches, and AF checks them on arm64.** AF's `checks` job (unit tests,
so P1 and P2) runs on `af-mac`; FB records `wardrobe.json` on Linux. c8 found a hair pole whose normal was decided by the
last bit of `Math.sin`; the fringe, the front clumps and the bob's turned ends are new hair paths of the same kind. *Fixed:*
`tests/golden/wardrobe-ulp.test.ts` (F9) draws every `wardrobe.json` frame under `nudged`; A6 nudges the P1 frames as
`tests/unit/fashion/ulp.test.ts` does; a new pole takes `grid()`'s rule (F6); a Mac-only miss is a generator bug, never an
arch override.

## Should-fix

**S1. The undrawn face would draw `worried` and `firm` with no eyes, and "the level mouth" does not exist.** `face()`'s
open eye decal is `when: ['neutral', 'sad', 'angry', 'talk']`; the mouths are the open one and the closed `size: [2, 1]`
(`sad`, `angry`). `faces.test.ts` would still pass (a face with no eyes differs from neutral). *Fixed:* F8 adds both to
the eye's `when`, `firm` to the closed mouth, and `faces.test.ts` asserts every undrawn face has eyes (spec 5.6 marked).

**S2. "Everything is additive" was not true.** `fear` and `sad` painted as `neutral` on a drawn face; c9 draws them, a
visible change for an existing input of `Figure` (section 5's list). Checked: AF's character kit passes no expression
(`main` and #607), and moved cells have not raised the version before (c8-lit's). `STAGE_VERSION` 1 stands, but the
changelog says it plainly. *Fixed:* F9's changelog text; spec 7 marked. `Material` (on the breaking-change list) gains an
optional field only: additive.

**S3. Fixture kinds cannot be removed.** F2's `withKind` "registers a kind for one test and removes it after", but FB
has no unregister; `hooks.test.ts` relies on vitest isolating files. *Fixed:* fixtures register once per file, guarded, the
form in the item, under `fx…` names (Global Constraints, F2).

**S4. `pinned()` does not exist, and importing it from `identity.test.ts` would run that file's tests twice.** *Fixed:*
`tests/support/pins.ts` holds the pins and their recipes; `identity.test.ts` asserts them (F0).

**S5. The stand-off test missed the case that broke.** Gap 4 is the Nurse: `headTilt` 15 (the sweep's ends are ±10),
`posture` 0.52, and a loose hair spring (`hang`, `trail`), whose bones roll against the tilt and trail in the walk
(`figure.ts` `swingHair`). F5 posed only static pitch and roll at ±10. *Fixed:* F5 adds those sliders and spring, standing
and over a walk; Checkpoint A shows `rest: 'head'` beside `'trunk'` for that case. The model itself does address the loop:
below the shoulder the clumps ride `J.chest` and the hair bones' swing fades out, so neither the head's pitch nor the
spring's roll carries them.

**S6. The faces frames had no recipe AF could repeat.** F9 said "drawn as `tests/golden/sprites.ts` draws a frame", but
`standing` and `hero` take no expression. *Fixed:* F9 states the recipe (`Figure`, three updates of 1/60 s, `view` built
from `SPRITE_PITCH`, `clock: 0`), all through the door; "nine expressions" is ten (spec 5.8, 5.10 marked).

**S7. AF's CI facts were missing.** The known reds #592 (WebKit `look-pixel-art`), #593 (`3D - parity` on `af-mac`) and
#594 (capacity, ports, cancelled runs); one push per round (`cancel-in-progress`); a browser project's `hookTimeout` from
the preset's `defineTests`, not the command line; the arm64 Mac (B4). *Fixed:* a section before A1, and A6's PR body.

**S8. The boots' toe cap was a field named `cap`, the `cap` kind's name.** `kindOf` matches an item by its keys in
registration order; it would work only because `boots` registers first, against `garments.ts`'s own rule. *Fixed:* `toe`
(A3; spec 5.7 marked).

**S9. `patch` is not exported from `shells.ts`.** Its export list is `collarBand, frontAt, heights, lapels, legsOf,
longTail, opening, piece, tail, top`. *Fixed:* A3 exports it.

**S10. A plate's letter gaps would show the cloth.** `stampPrint` never inks `,`, so the gap column between letters on a
plate is a stripe of cloth through the card. *Fixed:* `plate` writes ground over gaps; F7 tests it.

**S11. The sync script could not work as written.** The kit's files import names of both FB entries through one door
import, with `.ts` specifiers; FB's tsconfig has no `allowImportingTsExtensions`; and P2 needs the kit's swatches and
`C9_OUTFITS`, which were not copied. *Fixed:* S1 copies `swatches.ts` and `c9-outfits.ts`, writes a local `door.ts`
re-exporting from `src` and `src/kit`, and sets the showcase tsconfig to AF's strictness (spec 5.9 marked).

**S12. The badge must be built `last`** to find the surface under it in `c.worn` for `Print.seams`. *Fixed:* A3.

**S13. The checkpoints did not show what the coordinator must judge.** A had no pitched-and-cocked head (gap 4) and no
slight build; B showed the marks at D2 only (the claim is about D1, D2, D4); A2 comes after FB merges, so an FB problem
seen there costs a second FB PR. *Fixed:* A's hair sheet adds the gap-4 case and a slight build; B shows D1, D2, D4 with
the measured widths and a hero row; a draft A2 (boots and cap, local AF checkout at the FB PR's head) goes with B; F9's PR
waits for A's and B's word; A2 adds the heavy and thin bodies.

**S14. F2 named a slider `foot`; the slider is `feet`** (`foot` is the gene). And `Body.foot`'s length was ambiguous
between the bare foot and the shoe: it is the shod foot's, the one a boot covers. *Fixed:* F2.

**S15. A fork could register a hair piece named `fringe`.** `registerHairPiece` refuses the own kinds by a literal list.
*Fixed:* F6 adds `'fringe'` to it and tests it.

## Nice-to-have

**N1.** There is no `KIT_NAMES` in `tests/api.test.ts`; the kit's names are an inline array, and types are not in
`Object.keys`. *Fixed:* F3's wording.

**N2.** Spec 4's map said `shoes` gains `heel` and `sole`; `Shoes.sole` is already a swatch. It gains `heel` and `thick`
(5.7 had it right). *Fixed:* spec 4 marked.

**N3.** The kit's own seams had no range. *Fixed:* A3 gives each kind a block of ten from 4100, clear of FB's and the
runway's 4000.

**N4.** A region's last painter wins, so hosiery listed after the base pair's `shorts` would replace the block on the
thighs. *Fixed:* A3 puts it before.

**N5.** FB's new style names must not be in AF's `FASHION_HAIR` (`registerFashion()` throws on a clash; AF has
`smoothBob`, no clash). *Fixed:* A1's expected result says so.

**N6.** At D1 the eye is already two rows (lid line over iris), so "at D1 the eye is two tall" does not distinguish
`fear`. *Fixed:* F8 says what `fear` is at D1.

**N7.** The F1 handoff question: `tonesOf` mixes once per material, so the edge needs four tone sets per edge material,
picked per texel from the G-buffer normal; lighting finds a texel's ramp by its colour (`onRow`), so the lit paths need
no change. *Fixed:* F1 says so and tests `lightFigure` and `lightSprite`; A2's door test follows c8's.

## Checked and sound

- **Placement.** Every FB addition is generic and off by default: `Material.mix.edge` (branch on 0/absent), `Fit.shoe`
  (no form: today's parts, B1 fixes the form's placement), `Body.foot` (a query), the head's form on the kit
  (re-exports; `kit` sits above `hair` and `body`), `Fall.front`/`turn`/`rest` (defaults are today's), the `fringe` piece
  (a name the base pair do not use), the glyphs (functions), the moods (names; `fear` and `sad` per S2). Each has a
  with/without test on a base figure in its task, and none moves a golden; the shoe's 3007/3008 are free (body 3000–3006,
  ears 1001–1004, hair 2000–2999).
- **The kit.** With S9 and B2 fixed, everything the kinds need is on `index` or `kit` and reached through AF's door:
  `rampOf`, the glyphs, `skull`/`onHead`/`headForm`/`HeadForm`, `ShoeForm`, `Print`, `Decal`, `EXPRESSIONS`, `Expression`;
  `Body`, `Measure` and `Skeleton` come in through `Wearing`. No deeper import.
- **Reading at D2.** The face at D2 is about 16 to 19 texels wide with a 4-texel eye (`big`: lid, white, brows of shape,
  two-tone lips), so each mood is a whole-texel move of a mark the painter has; pairwise distinct at D2 is reachable. At
  D1 (eye 2, face about 8 to 9 wide) brows, lid line and mouth still draw (`!big` branch), so "each differs from
  neutral" is reachable; pairwise at D1 is rightly not promised.
- **Long hair when the head pitches.** See S5: the model addresses the loop.
- **AF.** The painted example is new (`characterkit-painted-wardrobe`), `characterkit-wardrobe` is the unpainted core's and
  only gains a pointer; P1 (machinery, data only) and P2 (kinds, against the showcase's synced copy) are both copied by
  script, never by hand; the AF tasks stop if #607 is not merged (it is open, waiting on #602, and pins FB `23f889c`).
  `PaintedState.expression` matches #607's `Painter.paint` shape (the `light` argument stays); the stand's key gains the
  expression; a held pose has no mood tags (`ScriptedActor` takes `expressions` only), which A4 documents.
- **Gaps 8 and 10** stay out of scope as non-goals and are named open in S1's compare doc.
