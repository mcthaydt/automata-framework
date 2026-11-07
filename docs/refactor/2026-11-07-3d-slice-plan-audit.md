# 3D slice plan audit (stage 3)

- **Date:** 2026-11-07. **Stage:** 3 of 6 of the 3D slice (plan audit, Opus medium), with the superpowers plugin
  (`superpowers:writing-plans`' self-review checklist: spec coverage, step scan, type consistency, Review Focus,
  proportion). Native, no subagents.
- **Audited:** the [spec](2026-11-07-3d-slice-spec.md) and the [plan](2026-11-07-3d-slice-plan.md) at #444's head
  (`64c27c91`), against the checkout at that commit, FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52` (both still
  their `main` heads today), the [3D audit](2026-11-07-3d-slice-audit.md) (#442) and the Owner's decisions in project
  memory. Every finding below was checked by a command or a file read; none rests on the plan's own word.
- **Result:** 26 findings, all fixed in place in the spec and the plan. The earlier paused audit's 21 findings: 17 were
  fully fixed by the rewrite, 4 only in part (3, 4, 5, 17), finished here as P1, P2, P12 and P10. The shape stays: 4
  parts, 20 phases, 53 tasks. Still open, and the Owner's: DUEL's author and licence (D8).
- **Accepted** under "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals"
  (Owner, 2026-10-31).

## Findings and fixes

| # | What was wrong (evidence) | Fix (where) |
|---|---|---|
| P1 | The move map broke its own `--features` rule. Today `views/` imports `light/` (4), `model/` imports `views/`, `figure/` imports `light/`, `model/` and `views/`, `camera/camera-driver.ts` imports `views/pose-3d`, `occluders/` imports `camera/` (9) and `sim/`, and `renderer/` imports camera, light, occluders and models. With views in `renderer/`, light and occluders in `look/`, and the figure view in `figures/`, task 2.2's `--features` run fails on all of them. `drawWorld` (7.2) and `updatePieces` (7.4) in `features/renderer/` would import `world/` and `stage/`. | `shared/render/{views,model,light}`; occluders under `features/camera/occluders/`; `look/` holds only the passes; `create-renderer`, `world-view` and `update-pieces` in `app/`; a Global Constraint on the rule (spec 7, 15.18; plan 2.1, 7.2, 7.4) |
| P2 | The map left files out: `render-pixi3d/src/{index,camera-view,no-eval,render3d.extension}.ts`, `{css,env}.d.ts`, `bundle/testing`, `model/testing`, `occluders/testing`; `figures/src/index.ts`; `sector-format/src/index.ts`; `figures/src/testing/{__goldens__,fixtures}`. Task 6.5 named `content/garment.schema.ts`, which lives in `figure/`. | Rows for each (entries, type declarations, test data to `tests/fixtures/`); 6.5's paths (plan 2.1, 6.5) |
| P3 | `--keep-qualifier` takes a test file's path (`move-tests.ts` line 314), not a qualifier: `--keep-qualifier parity` and `layout` do nothing. The mover's `dom` row sends a DOM test to `unit/` with the jsdom directive, so `tests/dom/` (spec 10.2; tasks 15.1, 16.1, 17.2, 18.1) never exists, and `packages/editor` has none. | `--browser-folders --feature-folders`; editor-3d tests as `packages/editor`'s, `tests/{unit,browser/{layout,canvas,journeys},e2e}` (spec 10.2; plan 2.2, 14.1, 15.1, 16.1, 17.2, 18.1) |
| P4 | The goldens task 4.2 re-records are `testing/__goldens__/figurebuilder-{dress,actions,motion}.json`, read by `golden-checks.ts`, `motion-goldens.ts`, `actions.test.ts` and `hair-spring.test.ts`; there is also `testing/figurebuilder-hand-on-hip.ts`. Source names in paths, which `source-names` never reads. The plan gave no `GOLDENS` path. | Move and rename to `tests/fixtures/goldens/{dress,actions,motion}.json` and `hand-on-hip.ts`; `source-names` reads paths too (plan 4.2, 10.1) |
| P5 | Phase 6 claimed "Wick unchanged" while porting `fat`. AF already has `fat` (default 0.4, Wick 0.3); FigureBuilder's newer `fat` swells the limbs, the neck and the jaw, with each multiplier 1 only at fat 0 (`body/genes.ts` lines 96 to 101). Taking it moves Wick. FigureBuilder's `asymmetry` is the plan's `faceAsymmetry`; its new genes default to 0.5 (eyes, bust, seat) and 0. | Re-record the figure goldens once, in a named commit with images; tests for "fat 0 changes nothing" and "each new gene at its default is a no-op"; the natural stand is the stand of a figure that names none (spec 8.2, 15.16; plan 6.2) |
| P6 | The "classic set" is 15 kinds (`Classic` in `figure/garment.schema.ts`: top, waistcoat, trousers, legs, shoes, skirt, apron, coat, belt, cape, gloves, hair, cap, eyes, mark), not 4. Wick also wears `top`. Task 6.4's test expected `['cap', 'cape', 'shoes', 'trousers']`. | The 15 names (spec 8.2; plan 6.4) |
| P7 | Task 6.3's `Ease` dropped the CSS cubic-bezier tuple that `clip.schema.ts` accepts and today's clips use, and made `ease` required (AF's is optional, linear by default). EnvironmentBuilder's keys are `{ t, v, ease? }`, and AF's clip keys are `{ t, pose, ease? }`. | `Ease` keeps the tuple; `ease?`; `v` reads as `value`; clip keys compile to `Key<Pose>`; a test (spec 8.3; plan 6.3) |
| P8 | Task 7.1's test converted `builderMap('apartment-small')`, but `maps.json` holds `bedroom`, `neonBar`, `streetNight`, `forestClearing` and `signs` (apartment and block are generated, `apartment@1`, `block@1`). | `'bedroom'` (plan 7.1) |
| P9 | `Problem` was used by 7.1, 7.2 and 9.2 and defined by no task. Its tests read `where`, `code` and `name`; content's `Problem` is `{ path, code, message }`. | `LevelProblem extends Problem { where; name? }` in `shared/level/problem.ts` (spec 9; plan 7.1, 7.2, 9.2) |
| P10 | Task 1.5 extended `findClipped` to bar buttons, but `findClipped` measures a node's own vertical overflow (`scrollHeight > clientHeight`). A button its bar's `overflow: hidden` cuts across (the Studio's "Pu") passes it, so the plan's own failing test would never fail for the right reason. A plain `elementFromPoint` check would fail every open modal dialog. | `findCutByBar` (box past a clipping ancestor that is not a scroll region); `findCovered` with `findCoveredCorners`' exceptions (a modal dialog, a risen ErrorPanel); a test for the dialog (plan 1.5) |
| P11 | The regeneration rule was stale: `agent-skills` has no `--write` and there is no `pnpm cheatsheet`; AGENTS.md says `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`. The changeset list named `create-game` (a command of `@automata/tools`, not a package; naming it fails `check-changesets`) and left out `@automata/sim` (in the `fixed` group). | Global Constraints, tasks 1.5, 3.1, 5.1, 12.2, 13.2, spec 15.15 |
| P12 | Task 2.1's importer list still missed `.gitleaks.toml`, `.vscode/settings.json`, `site/tests/unit/playground/runtime/playground-{catalog,resources}.test.ts`, `tooling/repo-hygiene/tests/unit/secret-scan.test.ts` and the `!` filters of `test:unit:2d`, `test:browser:2d` and `test:browser:affected`; it said `knip.json` (the file is `knip.jsonc`). AGENTS.md has no `render-pixi3d` rules to rewrite; its 3D lines are rule 5 ("keeps Effect until the 3D phase"), the base-3d role-files line and the "2D gate" line. | The list, with a `git grep` that must come back empty; the AGENTS.md lines go to the tasks that make them true (1.1, 3.1, 11.1) |
| P13 | Task 1.3 created `error-panel.dom.test.ts`; `ErrorPanel.dom.test.ts` already exists. | Add the case to it (plan 1.3) |
| P14 | Task 15.1 changed `samplePorts` to `(extra?: SampleFile[])`; it is `samplePorts(files: Record<string, string>)` today, and `openSuitePorts` lives in `features/suite/shell/open-suite-ports.ts`. | No signature change; `{ ...SAMPLE_GAME, ...SAMPLE_3D }` (plan 15.1) |
| P15 | Task 15.2 deleted `packages/editor/src/app/editor-2d/`, but the suite's Levels editor imports its `profiles.ts`, `testing/level-2d/journey-editor.ts` its `DocumentScreen.svelte`, and 43 files its `boot.ts` or `main.css`. "Same counts" could not hold. | Delete only the standalone page (`index.html`, `main.ts`, the `dist/2d` build, `packedEditor('2d')`); rename the rest `app/level-2d/`; counts per file (plan 15.2) |
| P16 | Task 14.1's map covered about half of editor-3d's `src/`: no row for the 25 non-controller `app/*.ts` files, `app/document`, `app/home`, `ui/walk`, `view/{mesh,materials,plan,walk}`, `journeys/`, `main.css`. It sent `ui/suite/*` (Levels 3D's inspector, regions, status and suite editor) to `app/suite/` and `model/` to `features/levels-3d/model/`, while spec 10.2 and task 16.2 use `shared/edit/`. `entities/` had no home in the spec's list. | A full table, every file once; `model/` → `shared/edit/`, `entities/` → `things/` (spec 10.2; plan 14.1) |
| P17 | Task 18.2 wrote a second real-command harness. The 2D slice's `packages/editor/tests/e2e/harness/` (`run-editor.ts`, `run-game.ts`, `temp-game.ts`, `fixtures.ts`) already copies a game, starts the real command and the game on their own ports and stops only what it started. | Teach it `BASE_3D`; the 3D journeys live in `packages/editor/tests/e2e/journeys/` (spec 10.4; plan 18.2) |
| P18 | Task 13.3: the probe's projects are in `tooling/frame-budget/src/playwright-run.ts`, not `playwright.config.ts`; `budget.json` rows are `{ workMsP95, intervalMsP95 }`; and `budget:frame` fails closed when a budgeted project has no hardware result. | The rows in that shape as targets; the check stays red for 3D until the Owner's GPU run, said in the PR, never loosened (plan 13.3) |
| P19 | The look's target was "320 × 180 at 16:9" with nothing for a phone in portrait (the phone-first rule), and nothing rebuilt it on a resize or a context loss. | Short side 180, long side from the stage (`targetSize`); a browser test for context loss (spec 6, 15.3; plan 8.2) |
| P20 | Task 12.2 assumed a template list and a `--template` option; `automata create-game` has one template today. | `--template 2d|3d`, 2d by default, with a test that the default is unchanged (plan 12.2) |
| P21 | Task 15.3 cut Ask but left `ask` in `af-editors/1`'s `modes` enum (`editors.schema.ts`). | `modes` is `edit` only; every committed list says `["edit"]` (plan 15.3) |
| P22 | Copy (drunk grandma): "Furnish as" read as a riddle; the place-a-prop tool "Furniture and things" collided with "Thing" (a game's thing types); "Time of day (Morning, Dusk, Night…)" named a time that does not exist (the libraries hold day, golden, dusk, night, lampLit and bar, ids no one should read); "This game has nothing to edit yet." did not say what to do; the 3D template refusal did not say what to do instead; the new sliders had no end words. | "Fill with furniture" (Undo "Undo fill with furniture"); the tool is "Furniture"; each time of day carries a `label` (Day, Golden hour, Dusk, Night, Lamplight, Bar light); "Add a level" in sight; "For now, make a 2D game: leave out --template."; a row of end words for every new slider (spec 6, 10.3, 11, 15.17; plan 6.3, 12.2, 16.1, 16.2, 17.2) |
| P23 | `findSourceNames` was redefined as `(files, options): Finding[]`; today it is `findSourceNames(root): string[]` with its own finding format, and `source-names-cli.ts` calls it. | Keep it; add `options.code` and path checks (plan 10.1) |
| P24 | Task 6.1's `checkSources` had no CLI, and 10.2 turned on a `--complete` flag that nothing parsed. | `sources-md-cli.ts`, root `sources-md`, chained into `source-names` (plan 6.1) |
| P25 | EnvironmentBuilder's `lib/geometry.ts` was a source of task 7.2 with no AF file. | `shared/math/geometry.ts` (plan 7.2) |
| P26 | Task 19.1 named no route folder and not the scan it relies on: the site is SvelteKit (`site/src/routes/`) and the scan is `site/scripts/scan-closed-beta.ts`. Task 5.3 left out `content/swatch-colours.ts`, where a swatch becomes a colour today. | Both named (plan 5.3, 19.1) |

## The 21 earlier findings, re-checked

| # | Status |
|---|---|
| 1 | Fixed: task 1.1 changes `ci.yml` line 113 (`pnpm test:unit:2d`), confirmed there |
| 2 | Fixed: task 1.2's three jobs; `paths` keeps every entry (confirmed against `3d.yml` lines 18 to 26) |
| 3 | Partly: the camera sim and render views were placed; the map's remaining gaps are P2 |
| 4 | Partly: `shared/` and `app/` were named, but the real import graph still broke the rule (P1) |
| 5 | Partly: most importers were added; P12 has the rest |
| 6 | Fixed: `fakeClock` public in task 3.1; 4 sources and 5 tests import `effect` (confirmed) |
| 7 | Fixed: streetwear moves in task 6.5 after the registries; examples/3d gains a unit runner. The classic set's size is P6 |
| 8 | Fixed: the base pair is a fixture; the registries' sources are right |
| 9 | Fixed: one `time-of-day` kind; both libraries hold the six names (confirmed) |
| 10 | Fixed: spec 9's field table |
| 11 | Fixed: the checks and every script have a home |
| 12 | Fixed: the box room and `sector-mesh.ts` are named; `ROOM_VIEWS` is in `room.ts` (confirmed) |
| 13 | Fixed: `automata textures` in `-tools`, depending only on `-content` |
| 14 | Fixed: the entry-graph test |
| 15 | Fixed in part by the rewrite; the file and the budget's shape are P18 |
| 16 | Fixed: DUEL's credit left to the Owner; `duel.txt`; the extra Endesga files |
| 17 | Partly: the bar regions were named, but `findClipped` cannot see the cut (P10) |
| 18 | Fixed: base-3d keeps `--game` and adds `--features` |
| 19 | Fixed: each of the three inconsistencies |
| 20 | Fixed: the named breaks |
| 21 | Fixed: task 20.1's `fixed` group |

The earlier audit's unchecked items: the editor-3d move map (P16), the site paths (P26), Paraglide's `compileInFolder`
(line 89, as task 1.7 says; the design holds), the 2D editor counts (P15) and the copy table (P22).

## Self-review checklist (writing-plans)

1. **Spec coverage:** every spec section maps to a task (the plan's own list, re-checked); the new spec lines (render
   in `shared/`, the target's size, `LevelProblem`, the time labels, the fat re-record) each have a task step.
2. **Step scan:** steps that could not be carried out as written (P3, P8, P10, P13, P14, P15, P17, P18, P20) now name a
   real command, file or signature.
3. **Type consistency:** `Ease`, `Key`, `LevelProblem`, `samplePorts`, `findSourceNames`, `checkSources`, `targetSize`
   and `Look.pixel` are each defined once and used by those names.
4. **Review Focus:** the five lines stand; P19's context loss and portrait target are tested in task 8.2 rather than
   added as a sixth line.
5. **Proportion:** the plan grew by the tables P1 and P16 needed (file lists, no code bodies).
