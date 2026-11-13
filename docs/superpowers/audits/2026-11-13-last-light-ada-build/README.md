# The Last Light: Ada's build, her seat and her standing arms (2026-11-13)

Look session, no plan, no subagents. From `claude/last-light-prologue` at `3954f492`, on `claude/last-light-ada-build`. The Owner, on
the joined gameplay frame (`../2026-11-13-last-light-join/shots-gameplay/hall-south.png`): "also her hips are too wide and her arms
being bent like that is odd", then "maybe not hips but ass". Ada is otherwise frozen ("okay stop tweaking ada, move on"): her face, hair,
skin, outfit colours, light and mesh are untouched. Only her data changed (`games/the-last-light/src/features/figures/cast.ts`); no
generator, painter or kit file changed.

## What changed (her data, exact lines)

| Commit | Line in `ADA` | Before | After |
|---|---|---|---|
| `da1f5b98` arms | `gaitOverrides` | `{ ...OLD_BRISK, armOut: 0.03, standOut: 0.03 }` | `{ ...OLD_BRISK, armOut: 0.03, standOut: 0.03, standElbow: 0.34, hang: 0.02 }` |
| `65820dfa` seat | `sliders.hips` | `0.55` | `0.5` |
| `65820dfa` seat | `sliders.seat` | not set (the painter's default `0.5`) | `0.2` |

### The arms: what posed them

Her stand is the gait's idle (no stand preset in her file). Standing, the painter bends each elbow by `standElbow` when the gait has
one, else by `elbow + idleElbow` (`extensions/figures/src/shared/motion/motion-gait.ts`, the arm block), and hangs the arm forward by
`hang`. Her old brisk gait (`old-gaits.ts`) has no `standElbow`, so she stood at `0.25 + 0.45` = **0.70 rad** (40°) on one arm and 0.56
on the other, hung **0.12** forward: elbows out, forearms angled in, hands at mid-thigh. The painter's own natural stand is the
`loose` gait's, the base woman's: `standElbow 0.34`, `hang 0.02`. She takes those two numbers; her walk is unchanged (it reads
`elbow`, `elbowSwing` and `armSwing`, not the stand's numbers).

- The walk, checked (Node, density 2, the cycle three-quarter front): the arms swing with an ordinary carried elbow and come in at
  mid-swing; no bent, held-out arm at the rest frames. Nothing changed there.
- A held item: the prologue gives her none (no stand, hold or prop for her in the game's figure code), so there is nothing to keep in the hand.

### The seat: what makes the width

Measured at density 2 in Node (the kit's `paintedCell`, no room), the widest row of her jeans (`fadedDenim`) in the seat's band
(42 to 62 % of her height) against the widest row of her shirt (`cream`, with the sleeves) at the shoulders (16 to 30 %), in texels:

| | front (s) | three-quarter (se) | profile (e) | back (n) |
|---|---|---|---|---|
| before, shoulders / seat | 30 / 27 | 23 / 27 | 16 / 18 | 30 / **31** |
| after, shoulders / seat | 30 / 27 | 23 / 27 | 16 / 17 | 30 / **30** |

The sliders found (`extensions/figures/src/shared/body/genes.ts`): `hips` (the hip width), `seat` (0.5 today's; the hips' rings deeper
behind, 0.93 to 1.12, and wider, 0.94 to 1.06), `fat` and `chunk` (they also widen the head, `headWidth`, so they are off limits: her face is
frozen) and `frame`. The jeans have no fullness or rise parameter: `legsOf` (`extensions/character-kit/src/features/fashion/trousers.ts`)
grows the torso shell from the belt down by a fixed one clearance (`jeans` passes `ease` 1); `taper` and `gap` only act from the
crotch and the knee down.

What her data could do, and where it stops:

- `seat` 0 or 0.5 at any `hips` moved the seat by one texel at most, in profile and from behind.
- `hips` under 0.5 closes the floor between her legs at density 2 (the game's test needs 16 texels of gap; 0.45 gives 14, 0.35 gives 7).
  That test was not loosened, so 0.5 is her floor.
- `seat` 0.2 is as far as the guard "each body slider within 0.3 of the base woman's" allows. That guard read `NaN` for a slider the
  base woman leaves out (`seat`), so it never held one; it now compares with the painter's default 0.5 (stricter, not looser).

**The cause is mostly in the generator.** The sheet's two lower rows show the painter's base woman bare, and the base woman in Ada's
clothes: her seat from behind is as full as Ada's, and the jeans add their one clearance over it. Not changed in this session.

## Pictures (all opened)

- `ada-eight-standing-d2-before-after-x3.png`: the eight directions standing, density 2, x3 nearest neighbour, painted in Node (no
  room, no passes). Rows: before (`3954f49`'s values), after, the base woman bare, the base woman in Ada's clothes.
- `hall-south-before-1024x768.png`, `hall-south-after-1024x768.png`: the gameplay frame, the join's harness
  (`games/the-last-light/tests/e2e/play-shots.test.ts`, default step `hall-south:KeyS:150`, 1024 by 768, Chromium, `AF_WEBGPU=software`).
  The before was shot from a worktree at `3954f492` in this container. `hall-south-ada-before-after-x2.png`: her, cropped from both, x2.
- `hall-south-idle-poses-1to1.png` and `hall-south-before-other-idle-1024x768.png`: three shots of the same before commit (two here, one
  from the join) land on three different idle poses (head turn and weight shift): the harness waits on sim ticks, and a software
  renderer lands on different idle frames. So the head differs between before and after in play for that reason, not for any change of
  hers; compare the arms and the seat only.

## What I see

- **Arms, fixed.** In the sheet every side shows the arms hanging close with a soft bend, hands by the upper thigh; the profiles no
  longer show the forearm carried forward, and the three-quarter backs no longer show a forearm pointing out. In play (x2 crop) the
  forearms now run straight down beside the thighs; before, the elbows stood out and the hands turned in.
- **Seat, a texel.** From behind her jeans are now no wider than her shoulders (30 and 30), and a texel shallower in profile. In the
  sheet the back views read a little slimmer at the seat, mostly because the arms now hang close; the jeans still flare out under the
  waistcoat's hem. From the front in play the jeans read as wide as before (they were already narrower than her shoulders, 27 to 30).

## Still weak

- The seat from behind and in three-quarter back is still full: the generator's woman's seat under a fixed clearance of denim. A
  generator change (the trousers' seat shell, or a garment parameter for its ease) is the fix; it would move the painter's goldens and
  is not this session's.
- From the front in play her silhouette is still a block from the hem of the waistcoat to the knee: the jeans' torso shell joins the two
  legs down to the crotch.

## What moved

- **No recorded picture or pinned hash of the game moved**: the game's unit suite (61 files, 474 tests) passes with no re-record. The
  game has no pinned cell hash of Ada; her cells are held by measured tests (`cast.test.ts`), and three of those are new or changed: the
  arms' stand values, the seat no wider than the shoulders from the front and behind, and the build guard's default for an unnamed slider.
- **No painter golden moved**: the figures' `goldens` project (in the unit suite and in Chromium) passes unchanged.
- `content.hash` and `sim-content.hash` did not move: the game's build recompiled its content and left the tree clean (her figure is code, not content).

## Gates

Node 24.22.1, pnpm 10.34.6, `pnpm install --frozen-lockfile`, on `65820dfa` (the docs commit after it changes no code).

| Gate | Result |
|---|---|
| `pnpm format` | exit 0, no file changed (741 warnings, 190 infos, as on the branch) |
| `TURBO_FORCE=true pnpm check` | **exit 0**: lint, typecheck, boundaries, style, knip, `test:unit` over 67 tasks (0 cached, 13 min 17 s), `changeset status`, `check-changesets` (87, 0 problems) |
| `TURBO_FORCE=true pnpm build` | **exit 0**, 16 of 16, 0 cached |
| The game's unit suite (in `check`) | 61 files, 474 tests, all pass |
| The game's build (content compile) | passes; `content.hash` unmoved |
| `@automata/figures` unit, `goldens` in it (in `check`) | 54 files, 730 tests, all pass |
| `@automata/figures` browser (chromium), webgpu, goldens, `AF_WEBGPU=software` | 11 files, 303 tests, all pass |
| `@automata/character-kit` unit (in `check`) | 49 files, 379 tests, all pass |
| `@automata/character-kit` browser (chromium) and webgpu, `AF_WEBGPU=software` | 10 files passed, 3 skipped; 66 tests passed, 3 skipped (the tests' own no-adapter guards, as at the join) |
| The play-shots harness, before and after | ran (the frames above) |

Not run: WebKit and Firefox (not installed here; parity pending for CI), `pnpm test:browser:2d`, the game's own browser, e2e and journey
suites other than the frame shoots, the 3D workflow. Not needed: `api-report` and `api-index` (no published package's exports or doc
comments changed), a changeset (only the private game changed).

## Round 2: seat below 0.2? (the coordinator: "one texel is not what the Owner asked for")

The coordinator allowed `seat` under 0.2 (the build guard widened for `seat` only) and asked for a strip first.
`seat-0.2-0.1-0.0-and-base-man-back-and-profiles-d2-x3.png`: density 2, x3, the back (N), both three-quarter backs (NE, NW) and both
profiles (E, W), at seat 0.2 (now), 0.1 and 0.0, and the painter's base man in her clothes as a measure of "ordinary". Opened.

By eye the three seat rows are the same picture. In texels (shirt at the shoulders / waistcoat's narrowest / jeans' widest at the seat):

| | N | NE | NW | E | W |
|---|---|---|---|---|---|
| seat 0.2 (now) | 30 / 17 / 30 | 23 / 12 / 23 | 21 / 12 / 25 | 16 / 15 / 17 | 17 / 14 / 17 |
| seat 0.1 | 30 / 17 / 30 | 23 / 12 / 23 | 21 / 12 / 24 | 16 / 15 / 17 | 17 / 14 / 17 |
| seat 0.0 | 30 / 17 / 30 | 23 / 12 / 23 | 21 / 12 / 24 | 16 / 15 / 17 | 17 / 14 / 17 |
| base man in her clothes | 42 / 24 / 33 | 33 / 15 / 24 | 33 / 14 / 33 | 20 / 17 / 20 | 20 / 18 / 20 |

**Chosen: stay at 0.2.** 0.0 moves one texel in one view (NW 25 to 24) and none elsewhere, so widening the guard buys nothing the eye
can see. The guard is left as it is. Nothing re-shot: her data did not change in this round, so the sheet and frames above are current.

Why the slider cannot do it: `seat` is a deliberately narrow range in the painter. At 0 the hips' rings are 0.93 as deep and 0.94 as
wide as at 0.5 (`measure` in `extensions/figures/src/shared/body/genes.ts`; the ends are pinned by the painter's own
`extensions/figures/tests/unit/body/bust-seat.test.ts`, "seat 0.93–1.12 deep and 0.94–1.06 wide"). What makes the woman's seat full is
elsewhere: the frame (her `frame` 0.95) gives the torso's depth `D` a factor `lerp(1, 1.12, f)` and the hip rings' width
`lerp(0.95, 1.06, f)` on the build term (`extensions/figures/src/shared/outfit/fit.ts`, the three rings from `hipY + 0.08 k` down), and
the jeans grow that torso shell a fixed one clearance from the belt down (`legsOf`, `trousers.ts`). `frame`, `fat` and `chunk` also set
her head's width, so they are not hers to move while her face is frozen. The base man's ratio, seat to shoulders, is about 0.79 from
behind (33 to 42); hers is 1.0 (30 to 30).

### The next step, the generator's (the Owner's to see first; NOT done)

One change, smallest first, in `extensions/figures/src/shared/body/genes.ts`:

```ts
// now
seat: { rz: about(s.seat, 0.93, 1.12), dz: 0.012 * (0.5 - s.seat) * 2, rx: about(s.seat, 0.94, 1.06) },
// proposed: a flat seat really flat; 0.5 still exactly 1
seat: { rz: about(s.seat, 0.8, 1.12), dz: 0.012 * (0.5 - s.seat) * 2, rx: about(s.seat, 0.85, 1.06) },
```

What it would move:
- `bust-seat.test.ts`'s pinned ends (0.93 and 0.94 at seat 0) would be re-set to 0.8 and 0.85: the painter's own spec of the slider.
- `about` is exactly 1 at 0.5, so every figure at the default seat (the base pair, which leave `seat` out) paints the same: the base
  pair's goldens should not move. Not run, so not claimed: the figures `goldens` project and the kit's recorded cells must be run to
  show it, and any figure in a library or fixture with a seat under 0.5 would move.
- Ada at seat 0.2 would take about 0.88 of the default depth and 0.91 of the width at the seat: by the scale above, some three texels
  narrower from behind at density 2. Measured only once the change exists.

A second lever, if that is not enough, is the jeans' seat: `legsOf` grows the torso shell by `ease` (1 clearance for `jeans`) all the way
down; a smaller ease behind the hip rings would take a texel off every figure in jeans or trousers, and would move the kit's recorded
runway cells. Larger, and the Owner's.

## Round 3: the generator's seat range (the coordinator, on the Owner's words)

Authorised in the brief: widen the `seat` slider's low end in the painter, then bring Ada's seat down with it.

### The generator, done (`830308e3`)

`extensions/figures/src/shared/body/genes.ts`, `measure`:

```ts
// was
seat: { rz: about(s.seat, 0.93, 1.12), dz: 0.012 * (0.5 - s.seat) * 2, rx: about(s.seat, 0.94, 1.06) },
// now
seat: { rz: about(s.seat, 0.8, 1.12), dz: 0.012 * (0.5 - s.seat) * 2, rx: about(s.seat, 0.85, 1.06) },
```

Test first: `bust-seat.test.ts`'s pinned low ends set to 0.8 and 0.85 failed for the right reason ("expected 0.93 to be close
to 0.8"), then passed with the change. The default 0.5 is still exactly 1 and the high ends are unchanged.

**No existing figure moved.** Run on the change, before Ada's data was considered:

- figures, `AF_UNIT_FULL=1 pnpm test:unit` (unit and goldens, the slider-ends tests included): 54 files, 730 tests, all pass;
- figures, Chromium `browser`, `webgpu` and `goldens`, `AF_WEBGPU=software`: 11 files, 303 tests, all pass;
- character kit, `test:unit` (the recorded runway cells included): 379 tests pass. One, `skin-hue.test.ts`, timed out at 5 s while
  the commit hook's figures run shared the four cores, then passed run alone (15 of 15). Nothing in it reads the seat;
- character kit, Chromium `browser` and `webgpu`, `AF_WEBGPU=software`: 10 files passed and 3 skipped; 66 tests passed and 3 skipped (as
  at the join). The config's WebKit and Firefox instances were not run (not installed here);
- `git grep`: no figure, fixture or library sets `seat` under 0.5 but Ada (0.2). The kit's runway `curvy` figure has 1 and its runway cast 0.95.
- Not changed: `packages/3d/src/features/figures/body/genes.ts`, the 3D package's own copy of the same range. It was out of the brief's scope.

### Ada at the new range: the strip

`seat-range-0.8-strip-0.2-0.15-0.1-0.0-and-base-man-d2-x3.png`: density 2, x3 nearest neighbour, painted in Node (the kit's
`paintedCell`), views N, NE, NW, E, W (directions 4, 3, 5, 2, 6), at seat 0.2 (her value), 0.15, 0.1 and 0.0, and the painter's base
man in her clothes. Opened. In texels: shirt (`cream`) widest at 16 to 30 % of her height / waistcoat (`oxblood`) narrowest at 30
to 42 % / jeans (`fadedDenim`) widest at 42 to 62 %, then seat over shoulders:

| | N | NE | NW | E | W |
|---|---|---|---|---|---|
| seat 0.5 (the default; the same at either range) | 30/17/30 (1.00) | 23/12/23 (1.00) | 21/12/25 (1.19) | 16/14/18 (1.13) | 17/15/17 (1.00) |
| seat 0.2, old range (round 2's table) | 30/17/30 | 23/12/23 | 21/12/25 | 16/15/17 | 17/14/17 |
| seat 0.2, new range | 30/17/30 (1.00) | 23/12/23 (1.00) | 21/12/24 (1.14) | 16/14/16 (1.00) | 17/14/16 (0.94) |
| seat 0.15 | 30/17/30 (1.00) | 23/12/23 (1.00) | 21/12/24 (1.14) | 16/14/16 (1.00) | 17/14/16 (0.94) |
| seat 0.1 | 30/17/30 (1.00) | 23/12/23 (1.00) | 21/12/24 (1.14) | 16/14/16 (1.00) | 17/14/16 (0.94) |
| seat 0.0 | 30/17/30 (1.00) | 23/12/23 (1.00) | 21/12/24 (1.14) | 16/14/16 (1.00) | 17/14/16 (0.94) |
| base man in her clothes | 42/24/33 (0.79) | 32/14/24 (0.75) | 33/14/33 (1.00) | 20/17/20 (1.00) | 20/18/20 (1.00) |

(Round 2 measured the waist in a different band, so its waistcoat column differs by a texel in profile.)

What I see: in profile her seat is a texel shallower at 0.2 than before the change (E 17 to 16, W 17 to 16). Under 0.2 nothing moves
in any view. From behind the four rows are the same picture: the jeans are 30 texels at every value, as wide as her shoulders.

**Step 4 applies, so I stopped here. Ada's data is unchanged (`seat` 0.2), and so are her guard test, the eight-directions sheet and the
frame.** The seat cannot narrow her from behind, and neither can the jeans:

- Row by row from behind (direction 4, 42 to 62 % band), the denim is 30 texels wide for twelve rows at seat 0.5 and at 0.0, then
  29, 28, 28, 27, 26, 26 down the thighs. Without the jeans and the waistcoat (her shirt and the body), the whole silhouette's rows are also
  identical at 0.5 and 0.0. The widest rows are her **two thighs side by side**, not the seat: the seat's rings (`fit.ts`,
  `g.hips · 1.02 · seat.rx` and the two above it) sit inside the legs' outer edge (`hx + 0.078 · l`, `hx = g.hips`), so narrowing them
  is hidden from behind.
- The jeans' ease, tried locally and reverted (`garments.ts`, `legsOf(c, i.jeans, 1, …)`): ease 0.5 leaves N at 30; ease 0 gives
  28 (0.93 of the shoulders) and the base man 31. Even no cloth at all does not reach 0.8 to 0.9.
- Pulling the thighs' top two rings in with the seat (`rx · seat.rx` and `dx: hx · seat.rx`, tried locally and reverted): N 30 to 29
  at 0.2 and 0.0. The thighs below them keep the width.

### What would do it (the Owner's to see first; NOT done)

From behind her width is the leg spacing (`g.hips`, `genes.ts`: `H · lerp(0.045, 0.065, s.hips) · lerp(0.95, 1.08, frame)`) plus each
thigh's girth (`fit.ts`'s leg rings, `0.078 · l` at the top to `0.066 · l` at 0.4 of the thigh). Her data cannot reach either: `hips`
under 0.5 closes the floor between her legs (the game's 16-texel test); `fat`, `chunk` and `frame` also set her head's width.
The two generator changes, smallest first:

1. **A thigh slider** in the painter (`Sliders.thighs`, default 0.5 = exactly 1 through `about`, as `seat` is): a factor on the leg rings'
   `rx` from the hip to the knee (the first four rings of `leg` in `profiles`), with the leg spacing `hx` reduced by the same
   amount, so the inner edges, and so the gap between her legs, stay where they are. At the default every figure paints the same.
   Ada at, say, 0.2 would then lose width from behind with her legs' gap kept.
2. Or untie the head's width from `fat`, `chunk` and `frame` (the head's own `face.width` already exists), so her build can be slimmed
   with her face kept. This moves every figure whose head is set by those sliders, so every golden would be re-recorded.

The jeans' ease (`ease` 1 for `jeans` in `garments.ts`) is not the lever: at 0 it buys two texels from behind and would move every
figure in jeans and the kit's recorded runway cells.

## For the tracker

| Session | Model | Branch | Row |
|---|---|---|---|
| Ada build (look) | Opus 5.5, no subagents | `claude/last-light-ada-build` | 2026-11-13, from `3954f492`. The Owner: "her hips are too wide and her arms being bent like that is odd", "maybe not hips but ass". **Done, tests first, pushed:** her standing arms take the painter's `loose` stand (`standElbow 0.34`, `hang 0.02`; was `elbow + idleElbow` 0.70 rad, hung 0.12) (`da1f5b98`); her seat `hips 0.55 -> 0.5`, `seat 0.5 -> 0.2`, at density 2 from behind no wider than her shoulders (31 -> 30), the build guard now holds an unnamed slider to the default (`65820dfa`). The rest of the seat's fullness is the generator's (base woman shown); not changed. Round 2: seat 0.1 and 0.0 measured (one texel in one view), so 0.2 stays and the guard is unchanged; the generator's seat range (`genes.ts`, `about(s.seat, 0.93…/0.94…)`) is the next step, written down, not done. Frames: `docs/superpowers/audits/2026-11-13-last-light-ada-build/`. |
| Ada seat, generator (look) | Opus 5.5, no subagents | `claude/last-light-ada-build` | 2026-11-13, from `bdf1bd1a`. **Done, test first, pushed:** the painter's `seat` slider's low end, `genes.ts` `about(s.seat, 0.93→0.8, 1.12)` deep and `about(s.seat, 0.94→0.85, 1.06)` wide (`830308e3`). No golden or recorded kit cell moved (figures 730 + 303, kit 379 + 66). **Stopped at step 4:** from behind Ada's jeans stay 30 texels (her shoulders 30) at seat 0.2 down to 0.0. The width is her two thighs (leg spacing and girth), which neither the seat nor the jeans' ease (0 gives 28) reaches. Her data is unchanged; in profile her seat is a texel shallower at 0.2 with the new range. Next, written down, not done: a `thighs` slider that keeps her legs' gap, or untying the head's width from `fat`/`chunk`/`frame`. Strip: `seat-range-0.8-strip-…-d2-x3.png`. |
