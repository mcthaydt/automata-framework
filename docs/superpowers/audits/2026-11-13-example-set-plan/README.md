# The example set: plan audit (2026-11-13)

Stage 3 for [`../../plans/2026-11-13-one-example-set.md`](../../plans/2026-11-13-one-example-set.md) (40 tasks after
this audit; 39 when audited) and its spec
[`../../specs/2026-11-13-one-example-set-design.md`](../../specs/2026-11-13-one-example-set-design.md). Branch
`claude/example-set-plan-audit`, from `claude/example-set-plan` at `73833f3ef` (the coordinator moved the plan from
`fd5f4ce67` while this audit ran; it was merged in fast-forward and audited as it stands).

Checked against, by command, not by the plan's words:

| Source | Ref |
|---|---|
| `main` | `7b6ce6ace` |
| `claude/last-light-camera` | `d761f87c3` (189 ahead of `main`, 22 behind) |
| `claude/last-light-ada` | `45bef0c2e` (202 ahead, 22 behind) |
| `claude/last-light-prologue` | `8d8202694` |
| `claude/3d-night-regression` | `3a527b9e1` |
| The 3D ship plan, `docs/superpowers/plans/2026-11-12-ship-3d-and-editors.md` | `claude/ship-3d-plan-audit` |
| The editors v2 landing plan, `docs/superpowers/plans/2026-11-12-editors-v2-landing.md` | `claude/editors-v2-landing-plan-audit` (the file is not on `claude/editors-v2-landing`, which is the execution branch, 67 ahead of `main`) |
| The editors stress audit, `docs/superpowers/audits/2026-11-12-last-light-editors-stress.md` | `claude/last-light-editors-stress` |

`pnpm install --frozen-lockfile` ran (exit 0) so that turbo could be asked how it treats a missing package. No product
code changed; no test suite was run; no picture was taken.

## Must fix (all fixed in the plan unless marked)

**M1. Nothing makes `scene()` play the place.** F1 writes `scene()` on `main` before Part K, F2 or the level exist, and
no later task gives it a walked character, the cast, the zone's view or `look.toml`. Nothing on `main` or on the
game's branches draws a level's `cast` block at run time: it is read only by the editor
(`packages/editor-3d/src/shared/level-session/af-sector/af-placed.ts:120`, `af-checks.ts:103`) and the furnisher
(`extensions/world-kit/src/features/furnish/context.ts:231`); `git grep "level\.cast\|\.cast ??"` on camera and ada adds
only the editor's `dollhouse/game-scene.ts:41`. Yet C5 (people in each zone, in the browser), O1 ("each in the place"),
E1 ("walk 6 m"), E5 (the porter waves and faces you) and E11 (the porter's round) stand on it. *Fixed:* new task **F5**,
`scene()` plays the place (`claude/example-set-play`, two Sonnet sessions, after F1, F2, K1, L1; before C5 and O1): the
walker as sim files on `@automata/sectors/sim` (as `games/base-3d/src/features/hero/` does), the cast and walker drawn
by `paintedFromFile` with `look.toml`'s defaults, the zone's view, `fieldFor`, the probe. Totals now 40 tasks, 39
sessions (30 Sonnet, 9 Opus).

**M2. The content never reaches an example's page.** `scene()` is to read content "through the content compiler, as a
game does", but `examples/3d/vite.config.ts` has only `examplesRunner`, and the examples on `main` inline their content
"written as compiled" (`examples/3d/world/world-level-room.ts:27-29`). A game gets `virtual:automata/content` from
`automataContent` in its Vite config (`games/base-3d/vite.config.ts`, `games/base-3d/src/testing/sim.ts:4`). F1's Done
means even forbade touching `examples/3d` beyond `package.json`. *Fixed:* F1 adds `automataContent` to
`examples/3d/vite.config.ts` and the set's `vitest.config.ts`, with the copy an editor journey names
(`AF_E2E_CONTENT_ROOT`, as `contentRootOf` in base-3d); E14 does the same for the story's config.

**M3. The set's unit tests would never run in the gate.** F1 named the script `test` (`pnpm --filter
@af-examples/set-3d test`); `pnpm check` runs `turbo run test:unit` (root `package.json`, `test:unit`), and S1 relies on
"this test runs in `pnpm check` from then on". (The old story has the same gap: `examples/3d-story/package.json` has
`test`, no `test:unit`.) *Fixed:* the script is `test:unit`, and F1 adds the package to the `test:unit:3d` and
`test:unit:2d` filter lists as the other 3D packages are.

**M4. Retiring `characterkit-painted` (E5) breaks `pnpm check`.**
`extensions/character-kit/tests/unit/painted/painted-scale.test.ts:16` reads
`examples/3d/characterkit/characterkit-painted.ts` by path for its field size and camera distance; `scripts/gate.ts:40,75`
serves `/characterkit/painted/` from `examples/3d`. *Fixed:* E5 rewrites the test over the set's platform view and F2's
field, and points the gate script at `/scene/scene-people/`, in its commit; the ownership table says so.

**M5. Retiring the wardrobe package (E6) breaks five root scripts.** Root `package.json` names
`@af-examples/wardrobe-3d` in `test:unit:2d`, `test:unit:3d`, `test:browser:2d`, `test:browser:3d` and
`test:browser:affected`. Turbo stops on a filter that names no package, negated or not:

```
$ turbo run test:unit --filter='!@af-examples/nonexistent-zz' --dry=text
  x No package found with name '@af-examples/nonexistent-zz' in workspace     (exit 1)
```

`test:browser:2d` runs on every pull request (`.github/workflows/ci.yml:194`). E15 listed only `style` and
`source-names`, after the fact. *Fixed:* E6 removes the five filters, the `pnpm-workspace.yaml` line, reinstalls for the
lockfile and changes the three `packages/3d` comments that point at the package, in its own commit.

**M6. The catalog would refuse the examples' imports.** `importProblem` (`tooling/examples-runner/src/catalog.ts`)
calls any workspace `@automata/*` package outside `EXTENSION_PACKAGES` "a core package; core is imported through the
umbrella". `@automata/3d`, `figures`, `sectors`, `places`, `nav`, `systems`, `narrative`, `interact` and `hud` are not in
that set (`catalog.ts:88-103`); 3D imports pass today only because `UNPUBLISHED_EXTENSIONS` lists them. The 3D ship plan
has B10 empty that list and adds nothing to `EXTENSION_PACKAGES` (`grep EXTENSION_PACKAGES` in it: no hit). After B10,
`scene-use` (`nav`, `interact`, `hud`), `scene-talk`, `scene-watch` and every `@automata/3d` import fail the catalog.
*Fixed:* F1 adds the nine to `EXTENSION_PACKAGES` (refused still while private, so nothing on `main` changes), with a
fixture test; the Dependencies table tells the ship plan's A5 and B10.

**M7. C2's `pullLever` was the wrong kind, and Part K pointed at two more.** `figure-poses`, `figure-gaits` and
`figure-swatches` are `@automata/3d`'s kinds for the mesh figures
(`packages/3d/src/features/figures/content/figures.content.ts:30,36,73`; `Gait` in `content/gait.schema.ts:76`, `Swatch`
`{ ramp, step }`). A painted figure's stands are the painter's `extensions/figures/src/shared/motion/library/poses.json`
(where `handInPocket` and `handInJacketPocket` are), its gaits the painter's `Gait` (`motion/motion-types.ts`) and its
swatches the painter's `Material` (`{ ramp: number, base, … }`, `body/parts.ts`). A `figure-poses` file would never move
the porter. *Fixed:* `pullLever` is a stand in the painter's `poses.json` (C2, now, test in `motion/stand.test.ts`); C4
no longer writes a `figure-poses` file; Part K's gait and swatch rows say the painter's types and that the mesh kinds
are another type.

**M8. Part K's table would lose Ada's and the nurse's data.** Read on `claude/last-light-ada` `45bef0c2e`:
`Sliders` (`extensions/figures/src/shared/body/genes.ts`) has 22 body keys, not 18 (`hunch`, `bodyAsymmetry`, `bust`,
`seat` were missing), and `HeadShape` 18, not 14 (`eyeSize`, `eyeSpacing`, `eyeTilt`, `asymmetry`); K2's test said
`describeSliders()` has 32 entries, which would fail against 40. The swatch row named four `Material` fields; Ada's and
the nurse's swatches (`old-swatches.ts`) also use `lift`, `flat`, `gloss`, `strands`, `streaks` and `stain`, and the type
has `sheen`, `mix`, `holo`, `see`, `fabric` too. The gait row said "any of its numbers"; the game's old gaits
(`old-gaits.ts`) set the boolean `shuffle` and the legacy `twitch`, `twitchEvery`, `idlePoses`, `idleLoop`. `[paint]`
offered density 1, 2 or auto where the painter's `Density` is 1, 2, 4, 8 or auto, with `maxDensity`. *Fixed:* the table
is the painter's types (with the audit's counts as a check, not the rule); K1's `every-field.toml` test fails on any key
of `Sliders`, `HeadShape`, `Material` or `Gait` it leaves out; a fixture with Ada's and the nurse's field names (made-up
values) round-trips. Everything else in the table matches `cast.ts`: `id`, `name`, `genes`, `skin`, `gait`,
`gaitOverrides`, `hand`, `face` (`camera`, `turn`, `blink`, `drawn`), `hair` physics (`stiff`, `damp`, `trail`,
`bounce`, `sway`, `hang`), `swatches`, `default`, `outfits` with garment rows and their own parameters, and the
painted options of `PLAY_FIGURE` (`crisp`, `density: 2`, `holdSkinHue`, `dimmest: 1`, `grid`). So with the fix K1's kind
expresses both without loss.

**M9. The Owner's sheets are not last (needs a ruling, not changed).** The Owner: "Leave everything I have to do last."
O1 sits after C5 and gates E1, so the Owner is asked mid-plan and every example waits on him. Spec rule 6 asks only
that nothing is shown he has not seen and that recorded pictures wait for his yes; it does not ask the examples to
wait. Two pictures he must see are not in any sheet: Characters' painted stage and inspector on a phone (K3, K4: a new
editor look) and the site's 3D example page (F3's `SceneFrame`, F4). *Options:* (a) as planned, plus a second Owner
sheet at the end for Characters and the site; (b) the audit's lean: one O1 at the very end (place, cast, every
example's frame at its moment, Characters, the site page), the examples built meanwhile with journeys that assert state
and write frames only to `test-results/`, and a small task after his yes that records the pictures. The cost of (b):
if he rejects the station itself, the content and the examples' words are redone (the code of each example is a
`scene()` call and does not change). The coordinator rules.

## Should fix (fixed in the plan unless marked)

**S1. "The joined prologue branch" names no branch.** No branch on `origin` holds both camera and ada:
`claude/last-light-prologue` lacks 11 of camera's commits and 24 of ada's; the night fix `d246fb8f1` is on
`claude/3d-night-regression` only. The plan's six check commands are right: run per branch, camera prints `peekReach`,
`fitFocus`, `dimmest`, `bobOpen` and not `cellPixels`; ada prints `dimmest`, `bobOpen`, `cellPixels` and not
`peekReach` or `fitFocus`; `main` prints none. The commit counts moved (9 and 22 at writing, 11 and 24 now). *Fixed:*
the plan says the commands are the test and the coordinator names the branch; the counts are updated. *For the
coordinator:* name the branch.

**S2. E14 deleted a file a tooling test imports.** `tooling/examples-runner/tests/unit/ports.test.ts:44` imports
`examples/3d-story/tests/e2e/origins.ts`; E14 deleted `tests`. `extensions/systems/README.md:75,85` describes the old
guard story. *Fixed:* `origins.ts` stays; the README's two lines change in E14's commit.

**S3. E15's sweep list was not measured.** Its test would fail on files the list did not name. `git grep` over the 21
ids and the wardrobe outside `examples/3d` and the docs folders finds: `docs/provenance/sources.md:24`,
`examples/README.md`, `extensions/character-kit/scripts/gate.ts`, `tests/fixtures/cameras.ts:58`,
`tests/unit/painted/painted-scale.test.ts`, `extensions/lcd-panel/README.md:70`, `extensions/retro-crisp/README.md:100`,
the root `package.json`, `packages/3d` (`src/entries/figures-kit.ts:2`, `src/testing/golden-outfits.ts:3`,
`golden-recorders.ts:2`, and four test comments), `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`site/tests/unit/playground/runtime/playground-catalog.test.ts:98`, `playground-resources.test.ts:11,18` (a fixture id),
and `spikes/builders-look/shoot.mjs`. `games/base-3d`, `docs/guides/3d.md` and `docs/status.md` name no old id.
*Fixed:* E15 lists them (E5 and E6 take the ones that break a build); `spikes/` is left out with the docs folders.
*For the coordinator:* confirm `spikes/` is history.

**S4. Three example branches would each edit `examples/3d/package.json` and the lockfile.** *Fixed:* E1 adds every kit
the thirteen import, once.

**S5. Three example branches would each write the level file.** E9 (ticket window), E10 (levers) and E12 (key cabinet,
lamp, door) need hotspots in `entityDefs`, which only E7 may write; E4 needs the store room's `dress`. *Fixed:* E7 adds
every hotspot the table names; L2 writes the store room's `dress`.

**S6. W1's photos.** The kit's 38 photos are PNG (128 or 256 px square), recorded as
`source: "polyhaven:<id>"` with `size` in metres (`assets/photos/photos.json`); the plan said `.jpg` and "source URL",
and named no source, so "recorded and real" could not be checked. Checked at the audit on `api.polyhaven.com/info/<id>`
(Poly Haven's assets are all CC0): `gravel_stones` ("Gravel Stones", Amal Kumar, 2 × 2 m), `rocky_gravel` (Dario
Barresi, Dimitrios Savva), `rough_wood` ("Rough Wood", Rob Tuytel, 0.5 × 0.5 m), `weathered_planks` (Dario Barresi,
Dimitrios Savva); none is in `photos.json` yet. *Fixed:* W1 names PNG, the row's shape, and these candidates.

**S7. C2's command.** `@automata/figures` has no `test` script (`test:unit` does it); `items.test.ts` exists already.
*Fixed.*

**S8. C3 called `readsAgainst` with arguments it does not take.** It is `readsAgainst(figures: FigureRead[], declared)`
over a measured frame (`figureReads(frame)`; `extensions/world-kit/src/features/reads/reads-against.ts:35`). *Fixed:* the
check moves to C5, in the browser, on F5's frames.

**S9. S2's find command finds nothing.** `git grep -n "toFixed\|\.0'" packages/editor/src/shared/kit/documents`
prints no line. The writer is `documents/toml/toml-scalar.ts:41-50` ("a float literal stays a float (`356.0` set to 357
is `357.0`)"), which is exactly how `t = 11` → 10.5 → 11 ends as `11.0`. *Fixed.*

**S10. Files this plan shares with other plans had no order.** `catalog.ts` (F1; the ship plan's A5, B10),
`extensions/character-kit/src` (K1, K2; ship B5's written types), `extensions/retro-crisp/src` and
`packages/3d/src/features/look` (F2; ship Part A and B-looks), `site/` (F3, F4; B10's `playground-catalog.ts`, v2 task
7), the world kit's tiles (W1; both game branches change nine world-kit files, the texture pipeline among them).
*Fixed:* a paragraph says who rebases.

**S11. The 3D workflow does not run for the set's own folders.** `.github/workflows/3d.yml` `paths` has
`examples/3d/**`, `packages/**`, `extensions/**` and others, not `examples/set-3d/**` or `examples/3d-story/**`. A pull
request that changes only the place or the cast runs no 3D journey in CI. *Fixed in the plan:* those tasks run the
journeys in the session and say so. *For the coordinator:* adding the two paths is a workflow change, so it is yours.

**S12. `interact` and `hud` are safe to publish, with three conditions** (the coordinator's Q2 ruling). What they
import, from `src`: `interact` `@automata/sim`, `puzzle/sim`, `nav/sim`, `3d/level`, `framework/extension`, `zod`;
`hud` `svelte`, `zod`, `framework`, `puzzle/sim`, `narrative`, `content/schema`. Every one is public today or on B10's
list. The conditions: `interact` exports `./testing/pantry`, which imports `@automata/sectors/sim`
(`src/testing/pantry.ts:29`) while `sectors` is only a devDependency, so the entry joins the workspace-only list (ship
plan, A's step 0a) or `sectors` becomes a peer; `hud`'s `svelte` peer is exact `5.57.1` and becomes a caret range as
B10 does for the others; B10's named assertion that the two are not publishable, and its 26 names, become 28. Nothing
private rides along otherwise; both tsconfigs extend the base with `isolatedDeclarations: true`. *Fixed:* the
Dependencies table carries the three conditions to the ship plan.

**S13. Law 3 asks every engine.** E14's hash was checked in Node and Chromium only. *Fixed:* WebKit and Firefox run
where the session has them, else they are named pending for the parity job.

## Notes

- **Measured claims hold.** The game's branches change 6 files under `tooling` and `examples` (none the catalog), 9 in
  the world kit, 59 and 61 in `character-kit`, 58 and 42 in `packages/3d`. `examples/3d` has 21 example files and 22
  journey files (21 and `colours.ts`). Every file the plan says exists does, but `site/tests/fixtures` (F3 creates it).
- **Q3, what the game's branches already lift.** Into the framework: `density` (with `densityNeeded` and
  `densityChooser`, `extensions/character-kit/src/features/painted/density.ts`), `grid`, `dimmest`, `holdSkinHue`,
  `crisp`, `lit` on `PaintedFigureOptions` (`painted-view.ts`); the camera view's `lensMm`, `focusBounds`, `lead`,
  `peekReach`, `yawDeg`, `rotate` and `fitFocus` (camera); the lcd-panel's screen filter (ada). Not lifted: `fieldFor`
  and `wholeScaleFor` (`games/the-last-light/src/app/field.ts` on both), and reading `look.toml`
  (`games/the-last-light/src/app/look.ts`; `packages/3d/src/features/look/look.schema.ts` on `main` is the look pass's
  settings, another thing). So F2 is needed and must not redo the painted options, and K1's `[paint]` maps onto them.
  F2's `look-file.schema.ts` sits beside `look.schema.ts`; the names should not be confused.
- **Q4, stress rows 2 and 3.** S3's five cases cover all of row 2 (a tap on a prop, lamp or hotspot; a drag with Rooms
  locked; a layer row). Part K covers row 3 (the kind, Characters opening, drawing and editing it, and `editors.toml`'s
  row through S1). The character kind is designed once, in K1, for the station's three and for Ada and the nurse (M8).
- **Q1, Q5 to Q8** as planned: no evidence against. Q8's portrait projects are new; the old journeys are landscape
  only (`examples/3d/playwright.config.ts`).
- **Spec to tasks.** Every capability the spec lists has an example (E1 to E13), the story is E14, rule 1 is the
  recipe's step 4, rule 2 the 40-line budget, rule 3 one `look.toml`, rule 4 E1's layout and every journey's 48 px
  check, rule 5 S1 and S5 (with Q5's three files), rule 6 O1. No task does something the spec does not ask: Part K's
  editor work is the spec's "content the Characters editor opens"; S2 and S3 are rule 5's round-trip.
- **Models.** The look sessions (L1 to L4, C3 to C5, O1) are Opus at medium; the rest Sonnet at high. W1 picks two
  photos, a small look call, but a test holds the tile and the Owner sees it in the place sheets.
- **`seat` is two things**: a body slider (`Sliders.seat`) and a seat pose (`slump`). K1 keeps them apart; the table
  says so.
- **The editors v2 plan's branch.** The brief named `claude/editors-v2-landing`; the plan file is on
  `claude/editors-v2-landing-plan-audit`. Its tasks 2 to 4 and 6 are what this plan says they are.

## What changed in the plan

New task F5; F1 (content compiler, `test:unit`, `EXTENSION_PACKAGES`, Done means, problem wording); the base
paragraph (the joined branch, commit counts); Dependencies (the catalog for A5 and B10, the `interact` and `hud`
conditions); ownership (F5, C2's two registries, E1's dependencies, E7's hotspots, E5's and E6's outside files, the
shared-files paragraph, the workflow paths paragraph); W1 (PNG, source shape, candidates); C2 (a painter stand; the
command); C3 (no `readsAgainst` in Node); C4, C5 (no `figure-poses`; F5; `readsAgainst` on frames); Part K's table and
K1's tests (the painter's types, every field); K2's slider count; the recipe's step 4 and the paragraphs after the
list (E5, E6, E7, E1, E4); E14 (`origins.ts`, the content compiler, the systems README, every engine); E15 (the measured
list, `spikes/`); S2 (the writer's place); totals, critical path, self-check, the tracker text, the log.

## For the tracker

Rows for `docs/superpowers/progress.md`, for the coordinator to copy:

> **Workstream: one example set (3D).** Stage 3 (plan audit, Opus) done 2026-11-13 on `claude/example-set-plan-audit`:
> [audit](audits/2026-11-13-example-set-plan/README.md). 9 must fix (8 fixed in the plan; M9, when the Owner's sheets
> come, needs a ruling), 13 should fix (all fixed; S1, S3, S11 also ask a ruling), notes. Plan now 40 tasks, about 39
> build sessions (30 Sonnet, 9 Opus): F5 added (`scene()` plays the place). Can start now from `main`: F1, F3 (after
> F1), W1 to W3, C2. Next: stage 4, execution.
>
> **Workstream: a character is data (Part K).** Plan audit done with the set's: the kind is the painter's own types
> (every key of `Sliders`, `HeadShape`, `Material` and the painter's `Gait`), checked against Ada's and the nurse's
> definitions on `claude/last-light-ada` `45bef0c2e`: no field lost. Four tasks, 6 sessions, unchanged.
>
> **Asked of the 3D ship plan:** add `@automata/interact` and `@automata/hud` (with `./testing/pantry` kept out of
> `interact`'s published entries, `hud`'s `svelte` peer a caret range, 28 names); know that F1 adds the 3D packages to
> the catalog's `EXTENSION_PACKAGES`, which A5 and B10 rebase on.
>
> **Rulings wanted:** M9 (the Owner's sheets at the end, or before the examples as planned); S1 (which branch is "the
> joined prologue branch"); S11 (add `examples/set-3d/**` and `examples/3d-story/**` to `3d.yml`'s paths, a workflow
> change); S3 (`spikes/` left out of the sweep).
