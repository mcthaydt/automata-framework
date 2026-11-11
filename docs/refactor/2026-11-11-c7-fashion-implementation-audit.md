# c7 implementation audit (Tasks 1 to 8)

The audit of `claude/c7-af` at `0cd2d6dd` against [the spec](2026-11-11-c7-fashion-spec.md), [the plan](2026-11-11-c7-fashion-plan.md)
with its log's rulings, [the plan audit](2026-11-11-c7-fashion-plan-audit.md), [gate 1](c7/gate-1/README.md) and the codebase.
2026-11-11, no subagents. FigureBuilder (FB) was read at the pinned `d6e3c9f`, and its showcase branches at `cb4aa9f`
(`claude/runway-video`) and `8fb0242` (`claude/demo-characters`), from a read-only clone; nothing tracked was changed to reach it.

Tasks 9 and 10 (the runway example and gate 2) are on hold by the Owner's decision, relayed by the coordinator: "We can hault
progress for the fashion runway until the envbuilder is done with stage 2 so the runway actually looks good". The plan's log and
`progress.md` (row 7) both say so, and that nothing of the runway is on the branch. The hold is not counted as a gap here.

**Result: 1 blocking, 9 should-fix, 6 nice-to-have.** The painter is not at fault anywhere: the 9% gap at gate 1 is the
measurement comparing a different frame, and the last 1% is the floor hiding the soles. The wardrobe port is byte for byte the
showcase's. The one blocking item is that `pnpm check` fails on the branch.

## What ran

| What | Where | Result |
|---|---|---|
| `pnpm check` | Node | **Fails** at `test:unit`: `@automata/versions` (B1). Lint, typecheck, boundaries, style, source-names and knip pass |
| `turbo run test:unit --continue` (every package) | Node | 60 of 61 pass; `@automata/versions` fails (B1). The kit: 159 pass |
| `pnpm check:changesets` | Node | Passes once `origin/main` is fetched (41 changesets, 0 problems); the shallow clone had no `origin/main` |
| The kit's browser suite | Chromium | 46 pass, 2 skipped (WebGPU: no adapter; the gate-sheet case runs only under `scripts/gate.ts`) |
| The kit's browser suite | WebKit 26.6 | 46 pass, 2 skipped (the same two) |
| `characterkit-painted`, `-hair`, `-wardrobe` journeys | Chromium and WebKit | 6 of 6 pass, 35 s |
| The gate's capture of `characterkit-painted`, four runs, measured against FB's cells | Chromium | See finding S1 |
| The showcase wardrobe run unchanged on FB `d6e3c9f`, against the kit's port | Node | 32 of 32 cells equal (8 models, 4 directions) |
| The base pair's cells before and after `registerFashion()` | Node | 32 of 32 equal (D1 and D2, 8 directions); FB's base swatches, hair styles and poses unchanged |
| Mutations of the fit test (shells' clearances) | Node | See finding S4 |
| Case 3 of `painted-depth` with no allowance, and the depths at each differing pixel | Chromium, WebKit | Chromium 0 px; WebKit 2 px, both where the two figures' test depths are 10 µm and 29 µm apart (S3) |
| `pnpm build` | Node | 16 of 16 pass; nothing of `@pixi/3d` or the builder in a published `dist` (S8) |

Not run: Firefox (headless Firefox has no WebGL here; the GPU runner's), the GPU runner itself, `pnpm api-report` and
`api-index` (no published package's exports changed: the diff touches only private packages and the root).

## Blocking

**B1. `pnpm check` fails on the branch.** `tooling/versions/tests/unit/versions.test.ts` ("records every exact pin in a
package.json") fails: `expected [ 'tsx@4.23.15' ] to deeply equal []`. Task 5 added `"tsx": "4.23.15"` to the kit's
devDependencies for `pnpm --filter @automata/character-kit gate`, and `docs/versions.md` does not record it (`grep tsx
docs/versions.md` finds nothing). The pre-commit hook runs only the affected packages' unit tests, and `@automata/versions` is
not one, so no commit saw it. `progress.md` row 6 says the whole unit suite ran through the pre-commit hook; it did not run
this test. Pull requests run `pnpm check`, so this fails CI.

*Fix:* run the gate the way the kit's other scripts run (`node --import ../../packages/3d/scripts/extensionless-ts.ts
scripts/gate.ts`, as `goldens` does) and drop `tsx`; or record `tsx@4.23.15` in `docs/versions.md`. Then run `pnpm check`
whole, not through the hook.

## Should-fix

**S1. Gate 1's "texels equal the builder's cell" compares a different frame, and is not repeatable.** Investigated as asked:

- The stander is drawn by FB's `Figure` standing idle (`painter.ts`: no `pose`, so `Figure.update(dt, …)`), whose breath and
  weight shift move with its own clock. The gate compares her with FB's `standing(cast, 6)`, which is that idle three updates in
  (0.05 s). The page's first drawn frame is reached by stepping the fake clock until the canvas shows 15 colours, so the
  stander is sometimes on that idle step and sometimes on the next.
- Measured, four captures of the same build: three gave **0.9099** against `standing`, one **0.9885**. The three at 0.91
  match FB's idle at t = 0.083 s (one pose step later) at **0.9885**. So the 91% in the plan's log and the 99% in the gate's
  README are the same render at two idle steps. Across the idle's first 8 s, `standing` against each idle step is 0.76 to
  0.92: a moment's difference alone moves this number that far.
- The remaining 1.15% is **27 texels, all in cell rows 180 and 181**, in every capture. The cell's anchor (the ground) is at
  row 178.5; rows 180 and 181 are the soles' outline, 2 to 3.4 cm below the ground line, at a depth of about 0.14 m toward the
  camera. Under the 25° follow camera they fall under the room's floor (`occluders.box`, top at y = 0), which is nearer there,
  so the floor hides them. That is the depth rule doing its job (contract section 4b: off the painter's pitch, a texel's
  depth is where its surface is), not a painter mismatch. It is also why her height is 126 px against 128 painted rows: the
  1.016 "texels a pixel" is 1.000 with two rows under the floor.
- Not the cause: pitch (the cell is painted at 18° and matches at 98.85% with only the sole rows differing), direction
  (direction 6 matches), placement or rounding (the best offset is a whole-pixel shift and the parity cases are 0 px), the
  DUEL snap or a look pass (the example sets none; the matched texels are equal to the byte).

So the gap is a test-setup difference. *Fix (like for like):* compare the render with the cell the painter drew for that frame,
not with a sheet at another moment: give the stander one of FB's stands in the example (`state: () => ({ moving: false, pose:
'…' })`, a `ScriptedActor` whose cell does not move with time) and compare with FB's own `hero` of the same stand, or have the
gate take the best of FB's idle cells for the first second and name the step it matched. Count the texels below the anchor
row that the floor hides on their own line, and measure the height from the anchor up so the floor does not shorten it.

**S2. Gate 1's README and the records state numbers and causes the artifacts do not support.**

- README: "99% … (the rest is the idle pose's blink and hair at a different moment …)". The rest is the soles under the floor
  (S1), and 99% is one of two outcomes run to run. The plan's log says 91% and leaves the rest "not yet attributed between the
  idle pose's moment and the DUEL snap": S1 attributes it.
- `progress.md` row 5: "before … 1.76 texels a pixel"; `measurements.json` says `1.7826086956521738` (1.78). Typed, not
  measured.
- README, "What ran": "Not run: WebKit and Firefox (neither can be installed in this container)". WebKit ran later (row 6 and
  the plan's log), and here.
- `parity.json` gives case 4 (the wall) `compared: 230400`; three rows (1,920 px) are skipped there, so 228,480 were compared.
- `scripts/gate.ts`'s header documents `gate runway`, which does not exist on the branch (the script throws "unknown gate").

*Fix:* regenerate gate 1 after S1; write the attribution from the measurement; take the numbers from the JSON; correct
"What ran"; have the sheet count what it compares; say in the header that `runway` comes with Task 10.

**S3. The crossing allowance in `painted-depth` case 3 is global and four times what is needed.** `CROSSING = 8` lets case 3
differ from `compose` anywhere, in any engine. Measured with no allowance: Chromium 0 px, WebKit 2 px, at (301, 203) and
(311, 227) in the second pair, where the two figures' test depths are 19.988836 / 19.988807 m and 20.11905 / 20.11904 m:
true crossings, 29 µm and 10 µm apart, inside the depth step. FB's contract section 4b covers exactly these ("the pixels
within the GPU's depth step of the crossing can differ by a pixel"). So the allowance is justified in kind, not in size or
place: eight wrong pixels anywhere (a hand a pixel off, a missed tie) would pass, in Chromium too.

*Fix:* skip a pixel only where two sprites' test depths there (from `texelDepths`, less each rank's bias) are within the depth
buffer's step, about 1e-4 m at the ortho fixture's 20 m, and require 0 elsewhere. That needs no count and holds in every
engine. Failing that, 2 for WebKit and 0 for Chromium.

**S4. The fit test catches little.** Mutations of `shells.ts`, each restored after:

| Mutation | Fit test |
|---|---|
| a top's clearance 0 (`const cl = 0` in `top`) | 1 of 16 outfit cases fails |
| a top's clearance inverted (`-c.body.clear`) | 1 of 16 fails |
| trouser legs' clearance 0 (`legsOf`) | 0 fail |
| trouser legs' clearance −2 | 4 of 16 fail |

Seven of the eight outfits wear a top, so a shell sunk into the body passes in six of them. The test counts painted area
against the bare body, on the base woman's sliders only, with the outfits copied into a fixture rather than read from
`RUNWAY_CAST`, and it redefines the plan's check ("no texel inside a garment's painted region is a skin swatch's ramp
colour") as a layer count. The plan's own check was never written.

*Fix:* add the strong check this audit could run: the cast's cells equal FB's showcase wardrobe's on the pinned FB (I measured
md5 per model at directions 0, 1, 3 and 6 with `standing` at D2: 32 of 32 equal). Record those as a golden the kit's unit suite
checks (made by a script, from the showcase at `cb4aa9f` on FB `d6e3c9f`, and re-made only when the submodule moves). Then
write the plan's skin check: on each slider extreme, no skin-ramp texel in the rows a garment spans except where that
garment leaves skin (hands, a short sleeve's forearm, below a skirt), counted against the bare body. Read the outfits and
bodies from `RUNWAY_CAST`.

**S5. The plan's steps for Tasks 1 to 8 are all unticked.** 0 of 51 boxes are ticked, though `progress.md` rows 4 to 6 say the
tasks are done. AGENTS.md: "Tick a plan step only when its checks pass." *Fix:* tick each step of Tasks 1 to 8 whose checks
passed; leave the WebKit, Firefox and GPU-runner parts of Task 3 Step 6 and Task 5 Step 3 unticked where they did not run, and
say which.

**S6. ADR 0007 describes the door as it was.** `docs/adr/0007-3d-look.md`, the 2026-11-10 amendment: the door is
`src/features/painted/door.ts` (it is `src/shared/figure-builder/door.ts` and `door-view.ts` since Task 1), the quad "faces the
camera" (it is square to the image plane, painted at 18° whatever the tilt), and "the builder's coming painted-cell contract …
replaces the door's exports when it lands" (it has landed: `STAGE_VERSION` 1). The plan left this to Task 10, which is on hold;
Tasks 1 to 8 merge ahead of it. *Fix:* amend the ADR now, in the same change as S5.

**S7. The root now hoists `@pixi/3d` for every workspace package.** The root `package.json` lists `pixi.js` and `@pixi/3d`
(the plan's ruling: the builder's view sources resolve them from their real path inside the submodule, up to the root's
`node_modules`). That is sound for the kit, and the root is private. But `node_modules/@pixi/3d` now resolves from any package,
so a published package (`private` not `true`) that imported it by mistake would no longer fail to resolve at build time and
could bundle the closed beta. The site is guarded (`site/scripts/scan-closed-beta.ts`); the npm packages are not:
`pnpm boundaries` forbids `@pixi/3d` in `packages/editor` only. *Fix:* forbid `@pixi/3d` and `figure-builder` in every
publishable package (one `--forbid` per package, or a unit test over `tooling/release/src/publishable-packages.ts` that greps
their sources), so the anti-goal "a build that contains `@pixi/3d` published" is enforced, not only true today.

**S8. The private-beta build check has not run for what merges first.** Plan Task 10 Step 4 runs `pnpm build` "to see nothing
published includes `@pixi/3d`"; Task 10 is held, and Tasks 1 to 8 merge ahead. This audit ran it: 16 of 16 build tasks pass, and in the
publishable packages' `dist` folders `@pixi/3d` appears only in a doc comment (`render-delta-consumer.d.ts`) and the boundaries
tool's error text, both from their own sources; `figure-builder` and `CellSprite` appear nowhere. So it holds today. *Fix:* keep
`pnpm build` and that search in the merge checklist of Tasks 1 to 8, not only gate 2's (S7 makes the search a check).

**S9. The branch is not ready to merge onto main as it stands.** It is stacked on #577: its base `a66b4e0e` is not on `main`
(15 of its 28 commits are #577's). It is 41 commits behind `origin/main`, and a merge conflicts in `docs/refactor/progress.md`.
*Fix:* merge #577 first (or open this pull request against its branch), then bring `main` in and resolve `progress.md`; run
`pnpm check` after.

## Nice-to-have

**N1. The soles go under an AF floor.** Off the painter's pitch, a figure's lowest two rows (the soles' outline, below the
anchor) fall under a floor whose top is the ground (S1). It is the contract's rule, and FB's `compose` with a floor `Backdrop`
would do the same, but no test pins it and FB's own renders show those rows. Add a floor case to `painted-depth` (equal to
`compose` with a ground-plane backdrop), and tell the coordinator, so the Owner can say whether the soles should stand on the
floor rather than in it (a host floor a few millimetres lower, or an ask of FB).

**N2. Spec section 5.3's depth-range check is missing for `characterkit-painted`.** "The examples' cameras are checked for it
in a test (24-bit depth)." The plan moved the assertion to Task 9 for the runway only. `Camera3D`'s defaults (near 0.1) put the
24-bit step at about 0.02 mm at the walker, far under a millimetre, so nothing is wrong today. Add the assertion to
`painted-scale.test.ts` so a camera change cannot break the tie rule silently.

**N3. `registerFashion` can half-register.** `registered` is set after every hook has run. If one throws (a name taken by a
game that registered first), the fabrics before it stay registered and a second call throws on the first fabric, naming the
wrong thing. Check all names first (fabrics, the finish and the garment kinds, as the swatches and hair styles already are),
then register.

**N4. The demo cast's names.** `DEMO_CAST` names three characters `BEAUTY`, `UGLY` and `BIG`, and the kit's README lists them.
They are the showcase's own, ported faithfully, and nothing in them is a costume or a stereotype by culture; but FB's later
`claude/runway-video` gave the same characters neutral names, and these are a body judged in words. The Owner's call: keep, or
take neutral names as the runway cast did.

**N5. `Model` drifts from both plan and source.** The plan has `pose: string`; the kit has `pose?: string`. The runway
source's `Model` also has `outfit`, which the port dropped (every runway model's outfit is `runway`). Harmless; say so in
`model.ts`, or match the plan.

**N6. The gate's "same sim tick" is not the same frame.** Both sides step the fake clock until the canvas first shows the
figures, then run 33 ms; the stander's idle step depends on how many 17 ms steps that took (S1). Before and after can differ
by an idle step. Note it in the README, or fix it with S1's stand.

## What holds

- **The door.** Only `src/shared/figure-builder/door.ts` (`figure-builder`, `figure-builder/kit`) and `door-view.ts`
  (`figure-builder/view`) import the builder: `door.test.ts` walks `src` and `tests`, and a search of `examples`, `packages`,
  `games` and `tooling` finds no other importer. `scripts/gate.ts` goes through the door. `garments.ts` augments
  `GarmentKinds` with `declare module 'figure-builder'`, which FB's hook machinery asks a fork to do; it imports nothing.
  `contract.test.ts` pins `STAGE_VERSION` 1, `SPRITE_PITCH` and `TIE_BIAS`.
- **Private beta.** Every package that reaches the builder or `@pixi/3d` is private: the root, the kit, `figure-builder`,
  `examples/3d`, `@automata/3d`. The examples runner keeps the kit out of the website's playground. Nothing published changed,
  so no changeset is due and the api-report does not move.
- **CI.** `3d.yml`'s `pull_request` paths include `vendor/FigureBuilder` and `vendor/figure-builder/**` (S9 of the plan audit).
  The private submodule is fetched with `SUBMODULES_TOKEN` in its own step in both 3D jobs. Journeys 120 s, servers 180 s, the
  journeys job 30 minutes; `test:browser:3d` includes the kit at 90 s a test. The gate-sheet case is skipped outside the gate.
- **The wardrobe on FB's hooks (H1, H4, H5).** Registered once per load: the extension's module calls `registerFashion()`, which
  is guarded (`extension.test.ts`, `register.test.ts`). No base pixel moves: the base pair's 32 cells (D1 and D2, 8 directions)
  are the same before and after, and FB's base swatches, hair styles and poses are untouched; names that collide are refused,
  not overwritten. The content is the showcase's: the casts, fabrics, swatches and hair styles are equal field for field to
  `cb4aa9f` (and `8fb0242`'s demo cast), and the garments paint the showcase's cells byte for byte on the pinned FB. H2 and H3
  are unused, as spec call 6 allows, and the door does not export them. The clothes are everyday ones (knits, tees, jeans, a
  gingham dress, coats, jackets); no costume.
- **Placement and depth.** `place.ts` equals FB's `stageFrame` (unit, perspective and orthographic); the GPU frame equals
  `compose` in cases 1, 2, 4, 5, 6 and 9 to the pixel in Chromium and WebKit, and in case 3 to the pixel in Chromium (S3 for
  WebKit). The stage runs in `View3D.onRender`, keeps any callback already there, and puts it back. Nothing in `packages/3d`
  changed.
