# Progress: The Last Light, the framework's 3D reference game

The Owner's direction (2026-11-11): the framework and its editors exist to make games like The Last Light easier to
make and to change by hand. FigureBuilder and EnvironmentBuilder were spikes to improve its figures and scenes, to be
replaced by the framework and its suites. The Last Light is remade on the framework with the builders' figures and
scenes, one scene at a time, with FloorFifty's level of finish in everything shared. Films and the fight spike are out.
`automata-plus` is cut: its packages are the framework's extensions.

Stages per workstream: 1 spec, 2 plan, 3 plan audit, 4 execution, 5 implementation audit, 6 fixes, 7 review. Each stage
runs in its own session on its own branch and hands off through committed documents. The refactor's own record stays in
[`../refactor/progress.md`](../refactor/progress.md).

## Workstreams, in order

| # | Workstream | Stage | Progress | Record |
|---|---|---|---|---|
| 1 | Shared polish from FloorFifty (seven items and their examples) | 3, plan audit: done 2026-11-11, 41 findings, all fixed in the plan. 4, execution: all 21 tasks done (task 17 cut), merged as #645 (`2d238cd0`). 5, implementation audit: done 2026-11-12 on `claude/shared-polish-impl-audit`, 18 findings (1 blocking, 9 should fix, 8 tidy): the stale-build check cannot read the server's facts across origins (B1); the words that stay in one language, the font licence missing from a built game, `automata words`' handling of a bad key, Emberwick's plumbing limit and the rest are in the audit, with what ran in Chromium and what did not. Ready for 6, the fixes | 71% (5 of 7 stages done) | [spec](specs/2026-11-11-shared-polish-design.md), [plan](plans/2026-11-11-shared-polish.md), [plan audit](audits/2026-11-11-shared-polish-plan-audit.md), [implementation audit](audits/2026-11-11-shared-polish-implementation-audit.md) |
| 2 | The Last Light, the framework's 3D reference game, one scene at a time (the prologue first) | Slice 1: 3, plan audit: done 2026-11-11, 32 findings (9 blocking, 15 should fix, 8 tidy), all fixed in the plan and the survey, which now match the spec and the code at `main` `6a70f9b1` (the spec's amendments `acb0361d`, `864361d4` and `909f6b10` included: the 3D examples go in tasks 19 and 20; a homes table, with interact and the HUD as genre extensions and a carried light in `@automata/systems`; the dressing waits for workstream 4) and the game at `92e6704`. Nothing open: every recorded file the prologue plays crosses (twelve, option B); workstream 1's task 17 is cut on its build branch. Next is 4, execution (22 tasks on three branches). Slices 2 to 4 not started | Slice 1: 43% (3 of 7 stages); execution 10 of 22 tasks (45%; branch 1 of 3, `claude/last-light-framework`, tasks 1 to 9b, started early on the Owner's word to build in parallel) | [spec](specs/2026-11-11-last-light-on-the-framework-design.md), [survey](audits/2026-11-11-last-light-prologue-survey.md), [plan](plans/2026-11-11-last-light-prologue.md), [audit](audits/2026-11-11-last-light-prologue-plan-audit.md) |
| 3 | An editor for every kind of authorable content: the UI editor first, others as gaps are found | Not started: specced with the Owner when we get to it; gaps are logged in the ledger below as they are found | 0% | |
| 4 | The builders' look and figures in the framework (takes over #588, #589, #590, #603, #607) | 2, plan: done 2026-11-11. A survey measured on `main` `6a70f9b1`, planned against `main` `f93a2402` (12 side-by-side sheets with their numbers, the causes of the two dark examples, every work package and figure piece marked, the five drafts read, merged with `main` on trial and checked step by step) and a plan of 17 tasks on five branches. The baked room on `main` draws at 0.29 to 0.50 of the builder's brightness; the fix exists in #590 and sits on #589's code, so #589 lands first. 3, plan audit: done 2026-11-11 at `main` `b80bfc84`, 28 findings (5 blocking, 15 should fix, 8 tidy), all fixed in the plan and the survey; the merge order checked step by step: green but for `main`'s own `knip` fault (the survey's shoot script, moved to `spikes/builders-look/` here) and, until #590, a probe's port that task 2 now fixes by picking `dd8d72bb` with the fix; the whole-pixel letterbox kept and room-visibility dropped (rulings for the Owner to confirm); the coordinator's answers taken in (#588: option A, `lcd-panel` and `retro-crisp` land; three items for workstream 2 taken by the coordinator, with the interfaces it relies on now in the plan; the shoot script's move sent to `main` alone as `71fdfd53`); a figure's cast shadow stays the Owner's. 4, execution: group 1 (`claude/builders-look-room`, tasks 1 to 5) done 2026-11-11 and ready to merge: #589 in whole, the lit room healthy (a browser test that failed on `main` and passes), an empty level reported, the two dark examples repaired, and a fault in the bake's sun found by the street's diagnosis and fixed; all eight scene sheets are 0.84 to 1.01 of the builder's brightness (the street was 0.29 to 0.71). Group 1 merged to `main` at `a024bc4b`. Group 2 (`claude/builders-look-figures`): task 6 done, #607 merged in (see the sessions table). Group 3 (`claude/builders-look-effects`, tasks 10a to 12 and the lamp kit's task A) done 2026-11-12: the effects, each behind its switch, the LCD panel and the retro grade proved at the old picture sizes with a sheet, the lamp kit widened to the old game's lamps, the whole `pnpm check` and the Chromium suites green; follow-ups below. Runs ahead of the prologue's dressing task | 43% (3 of 7 stages); execution 14 of 19 tasks (74%) | [spec](specs/2026-11-11-builders-look-and-figures-design.md), [survey](audits/2026-11-11-builders-look-survey.md), [plan](plans/2026-11-11-builders-look.md), [audit](audits/2026-11-11-builders-look-plan-audit.md) |
| 5 | CI on rented Ubicloud runners, matching Ruken's setup | Not started: "for when we get there"; two questions for the Owner before switching on | 0% | [the Owner's brief](briefs/2026-11-11-ci-on-ubicloud.md) |
| 6 | The builders move into the framework: FigureBuilder first, then EnvironmentBuilder; the submodule goes | 1, spec: done 2026-11-12. 2, plan: done 2026-11-12 on `claude/builders-fold-plan`, no subagents, no product code: two surveys measured at FigureBuilder `23f889c8` and EnvironmentBuilder `f7c5356` (both cloned read only) and a plan of 28 tasks on three branches (`claude/builders-fold-figures`, 16 tasks; `claude/builders-fold-strict`, 7; `claude/builders-fold-scenes`, 5; one more is conditional), revised the same day for the coordinator's rulings and the Owner's answers. FigureBuilder (7,581 lines in 40 source files; its suite 47 files, 561 tests) goes to a private extension, `extensions/figures` (`@automata/figures`), by a filtered history (243 commits, 1.64 MB, against 20.6 MB unfiltered; dry-run by the plan session) with a checksum manifest; its own suite passes there before any change; then the kit's door, the submodule's removal, the workflows' checkout step (the Owner: "remove the submodule checkout and SUBMODULES_TOKEN from the workflows"), the two fix branches the Owner asked for (`c5-finish-fixes`: five of six commits apply cleanly and move no golden, measured; `turned-face-both-eyes`: moves three goldens, re-recorded only after the Owner sees a before-and-after sheet), the wardrobe branch, and seven conform tasks, each behind the goldens. The second branch turns on the two strict compiler flags folder by folder (1,395 findings at the pin; no casts, no non-null assertions). EnvironmentBuilder (9,184 lines in 70 source files) is already ported: a script checked every provenance row's framework file; what moves is a tiles cross-check, a photo document and the provenance table at `f7c5356`; the survey's first table says what retiring it gives up. **Found by a run:** with its painter at the framework's pin, EnvironmentBuilder's `base` and `scenes` goldens move (27 tests fail), so the spec's rule 1 cannot hold for them. **Open, for the Owner:** A (default, planned: its CPU scene renderer and those two goldens do not come) or B (it comes as a reference tool and they are re-recorded once). The whole `pnpm check` passed on the branch with `main` `c23bc6b3` merged (exit 0, 65 tasks). 3, plan audit: done 2026-11-12 on `claude/builders-fold-plan-audit`, no subagents, no product code; 21 findings (5 blocking, 13 should fix, 3 tidy), each fixed in the plan, the surveys or the spec (two dated amendments). Measured there: the filter on the archived source (`main` pinned to `23f889c8`; on the coordinator's ruling the history starts at the last content cut, `6b6819c`: 126 commits, 1.04 MiB, 0 blobs with the brand, the tip byte-identical); the whole suite with the fix branches and the wardrobe applied on Node 24.21 (52 files, 651 tests; N4 breaks `lighting/sprite.ts` with no conflict, now task 4c step 3b; the turned face fails 5 tests, not 4; one wardrobe pin holds a float's last bit as Node 22 computed it, a stop for the coordinator in task 5); a generic checked reader makes the rasteriser 5.5 times slower and the inline `?? outside(…)` costs nothing; the strict ledger gains the tests' 579 errors; the tiles cross-check reproduces all 112 md5s; every hunk since `6d82a52` read (one to port, the bedroom's `reads`). 4, execution, group 1 (`claude/builders-fold-figures`, **done 2026-11-12**, ready to merge; no pull request is opened, the merge session's): tasks 1 to 5 done (the painter arrives with its history, the kit's door, the submodule and the workflows' step gone, the two fix branches and the wardrobe branch in). **The Owner answered on the turned-face sheet, 2026-11-12: "yes, give me both eyes":** `18d0cec` (`fix(paint): a turned face keeps both eyes`, the builder's own commit, its author) and `0eb1a76` (the re-record: actors 10 + 8 frames, base 1 sheet of 3 texels, sprites 1 md5; the painter's suite 52 files, 654 tests; the kit unit 229 and Chromium 58, no kit cell moved). **Conform, 2026-11-12 (third stage-4 session):** tasks 6 to 8 done (format, lint's safe fixes, the layout move, then the 285 hand-rule findings one rule a commit, the linter now on over the package: `pnpm lint` exit 0, no golden moved, `pnpm check` exit 0, painter 52 files, 705 tests). The one unexplained failure of task 7 is explained and fixed: the package's own script has a 30 s per-test limit and two tests needed 22 s and 19 s alone (32 to 40 s under load), each a timeout, never a wrong value; the three heaviest tests are split. **Task 9 (no file over 600 lines):** six files were over, and `paint()` is one function of 1,306 lines and `class Figure` is 620, so moving whole declarations cannot finish it; five files are split (motion, hair, garments, actor, paint's helpers); the coordinator ruled (option 1) that `Figure` loses a few methods to sibling functions and `paint()` is cut into phase functions last, under the plan's conditions, and the branch does not close until `pnpm style` passes with no exemption. **Fourth stage-4 session, 2026-11-12:** task 9 is done: `pnpm check` had been red at the last handoff (knip, 29 re-exports the splits left; fixed), `class Figure` lost three methods to `figure-stamps.ts` (520 lines), and `paint()` is fourteen phase functions over one context (14 commits, no texel, md5 or hash moved; whole painter suite 705 tests after four of them and at the end; kit unit 229, Chromium 58, `view-check` identical); `pnpm style` covers `extensions/figures/src` with no exemption. Task 10 done: the eight libraries load through strict Zod schemas (a misspelt key fails at load, naming it; `asWritten` hands back the file as written; painter 53 files, 723 tests, kit 229). **Fifth stage-4 session, 2026-11-12:** the cost of `paint()`'s fourteen phase contexts was measured and is nil (the base pair's 8 standing views, 20 repetitions, median ms per call: before the cut D1 2.9 to 3.1, D2 8.7 to 9.3; after D1 2.1, D2 7.4). Task 11 done: the view check is two Vitest browser projects, `browser` (WebGL: the 8 standing views of each base figure, 105 stage cases, determinism) and `webgpu` (the same 105 cases), the same 227 results by name as the old script's, which is deleted (`pnpm --filter @automata/figures test:browser`; under `AF_WEBGPU=software` 227 pass). Task 12 done: the package's README, the stage contract and the actors' guide, the kit's door folder renamed (`src/shared/figures/`), the kit's comments, and the provenance section. **Sixth session (the close), 2026-11-12:** task 13 done: build, API report and index (nothing to update), `changeset status`, the whole `pnpm check` uncached (exit 0, 13m22s) and in a fresh clone (exit 0, 13m41s, no `.gitmodules`, no `vendor/figure-builder`), the painter's browser suite 227 pass and the kit's Chromium and WebGPU projects 58 pass (3 skipped by design), the 3D journeys 16 pass in Chromium (WebKit's instance cannot run here), and five clean runs of the painter's unit suite (53 files, 723 tests each, 3m34s to 3m54s, no failure). The branch adds 3,068 objects, 2.05 MiB on disk over `main`: the plan expected about 2 MB and set a stop at 5 MB. The root `package.json` no longer lists `@pixi/3d` and `pixi.js` (task 4, on purpose). Not run: WebKit, Firefox, arm64, a real GPU. **What remains for workstream 6:** the merge of this branch; `claude/builders-fold-strict` (tasks 21 to 27: the two strict flags folder by folder, and the 37 files' `biome-ignore-all` for non-null assertions come out); `claude/builders-fold-scenes` (EnvironmentBuilder: the tiles cross-check, the photo document, the provenance table; the Owner's A or B still open); the implementation audit; then the painter tasks that wait on this merge (workstream 4's wardrobe tasks: a fuller bob, the face's tone and eyes, the stand, the outline colour) and the `@pixi/3d` beta.3 branch's port of the painter's view. No pull request is opened | 57% (3 of 7 stages); execution: group 1 done, 16 of 28 plan tasks (57%) | [spec](specs/2026-11-12-builders-into-the-framework-design.md), [plan audit](audits/2026-11-12-builders-fold-plan-audit.md), [FigureBuilder survey](audits/2026-11-12-builders-fold-survey/figure-builder.md), [EnvironmentBuilder survey](audits/2026-11-12-builders-fold-survey/environment-builder.md), [plan](plans/2026-11-12-builders-fold.md) |
| 7 | `@pixi/3d` from npmjs.org and the deploy rule lifted (the Owner, 2026-11-12: "yes, move to the public pixi3d package and lift the deploy rule") | Done 2026-11-12 on `claude/pixi-3d-public` (from `claude/pixi-3d-beta-3` `b25ec539`), one session, no subagents: public without a token, beta.3's code byte-identical to the vendored tarball, MIT; the tarballs gone, 8 manifests on the registry, `ship` and the site no longer refuse a build with Pixi 3D (its extras still refused), base-3d public; uncached `pnpm check` exit 0, base-3d web/itch/Ruken prepared, 3D journeys in Chromium pass, no golden moved. Not run: WebKit, Firefox, a real GPU. Open for the Owner: merging `main` (the coordinator's request), which 3D packages to publish, `@pixi/3d` 0.1.0 | 100% (4 of 4 steps) | [audit](audits/2026-11-12-pixi-3d-public/README.md) |

## Workstream 1 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11. The Owner said to begin ("begin with adding in Missing from the framework ... then do A"), so the stages run without waiting; the six calls stay open to correction |
| 2. Plan | Fable 5.2, medium (`session_01HNdX7HfQXxQqDGztKzgibK`) | `claude/shared-polish-plan` | Done 2026-11-11: 20 tasks with a tracking table, 15 calls named in the plan; revised the same day for the Owner's amendments (nothing copied from FloorFifty, no review state, fonts cover every language, `Hosting.openLink`). No product code written and no test run (this stage writes the plan only) |
| 3. Plan audit | `session_01HNdX7MBLx4zWBjBo4a5VCq` | `claude/shared-polish-plan-audit` | Done 2026-11-11: the plan checked against the spec (with the amendments `b119393b`, `df992aaa`, `87b48662` and `134d7fd1` merged in), `AGENTS.md`, the code on `main`, the vendored Ruken packages and FloorFifty at `677d456` (read only); the font's licence and coverage read from Fontsource's npm copies (`github.com` is refused here). 41 findings, all fixed in the plan; the font's reserved name, the site's import map, Credits and the source record settled by the coordinator. No product code changed, no test run (`node_modules` is not installed in the container); `pnpm format` not run for the same reason |
| 4. Execution | `session_01HNdX7JDpgp9VQLyPPYUC81` | `claude/shared-polish-build` | Started 2026-11-11: `node_modules` installed; tasks 1 (the six languages as data), 2 (core's words as six catalogs) 3 (catalogs, placeholders and the source record in tools) and 4 (`automata words`; the live model call is unverified, no key here) done; task 17 cut and task 20 added on the Owner's word; `docs/superpowers` made a record folder for the source-names and plan-ID rules, and the browser boundary check taught to skip JSON |
| 4. Execution, handoff at 90 minutes | `session_01HNdX7JDpgp9VQLyPPYUC81` | `claude/shared-polish-build` | Last commit `e61b179f` (task 4). Resume at task 5. Tasks 1 to 4 are done; the plan's tracking table is current. Read the ledger's rulings in the final summary, and note two things for task 5: `@automata/content/assets` and `/locale` cannot load under plain Node (the bin runs from source), so the `words` step cannot import `fontCoverage` or `catalogCharacters` from them; and each commit's pre-commit hook runs the affected unit tests (5 to 10 minutes) |
| 4. Execution, handoff at 90 minutes | the second session (`automata-framework-f3`) | `claude/shared-polish-build` | Last commit `6c0ccee0` (task 7). Tasks 5, 5b, 6 and 7 done this session (5: `29ccea7f`, 5b: `ceb2a014`, 6: `dd38dc77`, 7: `6c0ccee0`). Resume at task 8 (the photosensitivity warning; its eight words are already written and recorded in task 7). Left: 8, 9, 10, 11, 11b, 12, 13, 14, 15, 16, 18, 19, 20 (task 17 cut). Notes: the pre-commit hook includes uncommitted work in its `turbo --filter=...[HEAD]`, so stash or finish edits in other packages before committing (about 9 minutes when a package under `packages/` changed); `data-initial-focus` is what `Modal` focuses; the ledger of rulings is in the plan under "Execution log and deviations ledger" |
| 4. Execution, third session | `session_01HNdX7JDpgp9VQLyPPYUC81`'s successor, from `9a356651` | `claude/shared-polish-build` | Started 2026-11-11 at task 8: tasks 8 (photosensitivity warning), 9 (interface sounds) and 10 (`create-game`) done; FigureBuilder attached read-only for typecheck. The percentage is now `(3 + done/21) / 7` |
| 4. Execution, handoff at 90 minutes | the third session (from `9a356651`) | `claude/shared-polish-build` | Last commit `3aef5854` (task 10); tasks 8 (`d2e9d7f9`), 9 (`f68d822e`) and 10 (`3aef5854`) done this session. Resume at task 11 (the splash, `@automata/ui-screens`). Left: 11, 11b, 12, 13, 14, 15, 16, 18, 19, 20 (task 17 cut). Notes: task 15 must exercise `passFirstRun`; task 18 documents `STICK_DIRECTIONS`, `Picture` and `PROMPT_COPY` (`pnpm api-index --write` fails on them until then); every commit that touches a package needs `pnpm build`, `pnpm api-report --update` and `pnpm api-index --write` first (the unit gate fails on a stale report); `pnpm check:changesets` needs `git fetch origin main` first; FigureBuilder is copied (not a submodule checkout) into `vendor/FigureBuilder` at `d6e3c9fb` for typecheck and shows nothing in `git status`; the font build and `automata check --only words` were run on a generated game by linking the workspace packages by hand (see task 10's ruling) |
| 4. Execution, fourth session | the fourth session, from `000e4e92` (merged with `main` `abe713d4`) | `claude/shared-polish-build` | Started 2026-11-11 at task 11: tasks 11 (splash, `5a6e7eb9`), 11b (`Hosting.openLink`, `7dc3e29c`) 12 (credits, `618d03a3`) 13 (achievements, `474d2f96`) and 14 (stale-build check, `2d87462f`) done; FigureBuilder attached and placed at `d6e3c9fb` again (a fresh container). The percentage is `(3 + done/21) / 7` |
| 4. Execution, handoff at 90 minutes | the fourth session (from `000e4e92`, `main` `abe713d4` merged) | `claude/shared-polish-build` | Last commit `05c8e036` (task 15, partly). Done this session: 11 `5a6e7eb9`, 11b `7dc3e29c`, 12 `618d03a3`, 13 `474d2f96`, 14 `2d87462f`, and 3 of task 15's 4 examples. Resume at task 15's four leftovers (the plan's ledger lists them: `ui-splash-credits` and the site playground step 4, the examples' fonts, the iPad run), then 16, 18, 19, 20 (task 17 cut). Notes: a commit touching `packages/automata` takes about 9.5 minutes (the hook runs every affected package's unit tests), one touching only an extension about 20 seconds; FigureBuilder is a copy at `d6e3c9fb` in `vendor/FigureBuilder` (not a submodule checkout); no `AUTOMATA_ANTHROPIC_KEY` was in this environment, so the live `automata words` call is still unverified; WebKit is not installed (the iPad project and the Safari-sized journeys cannot run here) |
| 4. Execution, fifth session | the fifth session (`session_01HNdX7HKo5CyAEE1X5WpfB8`), from `8b8e901e` merged with `main` `db54a511` (`d242263b`) | `claude/shared-polish-build` | Started 2026-11-11: the whole `pnpm check` on the merged tree passed (exit 0). Task 15 finished: the playground answers `@automata/ui-screens` and `ui-splash-credits` is in the catalog (`848b33ed`); the language examples draw in the pixel font (`76bfe33c`); `audio-ui-sounds` proven to start a real source on a running AudioContext. `examples-ipad` not run (WebKit not installed). Tasks 16 and 19 are on `claude/shared-polish-emberwick-site` (a second session); this session does 15, 18, then stops, and 20 runs last on the combined branch. Done 2026-11-11 against `main` `a8f2d40a`: task 15 (`848b33ed`, `76bfe33c`, `39bcf8f1`) and task 18 (`f863ad00`, then the commit after it: the `create-game` `check` fix the consumer smoke found, and the record); the whole `pnpm check` exit 0 on the final tree (52 and 61 tasks) |
| 4. Execution, sixth session | the sixth session (`session_01HNdX7HUAsN1bp7XDAKsQGg`), from `11ce6dd9` | `claude/shared-polish-build` | Started 2026-11-11: joined the side branch (`e0b2394e`, whole `pnpm check` exit 0), checked Emberwick's, the examples' and the hot-reload demo's journeys, the site's unit tests and playground suites on the joined tree, then did task 20 (the site pass; the plan's ledger has the findings: the playground's frame starts only when seen, and the copy that said Automata runs no AI). The percentage is now `(3 + 21/21) / 7` |
| 4. Execution, merged | the merge session | `claude/shared-polish-build` | Merged 2026-11-11 as #645 (`2d238cd0`) at `050a7303` after the merge session's own whole `pnpm check`, `pnpm build` and the API report and index checks; no recorded golden or hash moved; no workflow file changed. The sixth session is archived |
| 5. Implementation audit | Opus 5.5, medium (`session_01HNdX7KWeVco5J6isDwvg6H`), no subagents | `claude/shared-polish-impl-audit` | Done 2026-11-12 at `main` `2d238cd0`, no code or test changed: [the audit](audits/2026-11-11-shared-polish-implementation-audit.md). Ran `pnpm check` (exit 0), `pnpm build`, `agent-skills`, `api-report`, `api-index`, the Chromium browser suites, journeys, the site's build and suites and the consumer smoke (results in the audit); WebKit, Firefox, real hosts and the live model call not run |
| 6. Fixes | Sonnet 5.5, high (`session_01HNdX7HQTNnRKaroUir7cbf`, archived at its 90 minutes; then `session_01HNdX7K4hJ42HKM6t8Ez3s5`), no subagents | `claude/shared-polish-fixes` | Started 2026-11-12. Session 1: 10 of 18 findings (B1, S1 to S7, T6, T7). Session 2: S8 and S9 done; T1 ruled to keep the blocked-popup answer honest; the rest and the closing run to come |
| 6. Fixes, merged | the merge session | `claude/shared-polish-fixes` | Merged 2026-11-12 as #654 (`0df11a43`) at `2e371983`: all 18 findings. The merge session's own whole `pnpm check` with the cache off (15,963 unit tests), `pnpm build` and the API report and index checks passed; web `openLink`'s final state checked (a blocked popup answers `opened: false`). Not run anywhere: WebKit, Firefox, real devices and hosts, the live `automata words` call |
| 7. Review | the Owner | | Open. Workstream 1 is built, audited and fixed |
| Merge | One long-lived session (`session_01HNdX7LEALEpFdpPWLXPuy7`) | none of its own | Started 2026-11-11; merged the spec as #608 (`6fa386e9`) |

## Workstream 1: "Done means" (the closing record, the sixth session, `claude/shared-polish-build`)

Every line of the spec's "Done means", with its evidence or its reason. Chromium only: WebKit, Firefox and the iPad projects were not
run (not installed here).

1. **"The four examples run and their journeys pass in Chromium at phone, compact and iPad sizes": done for phone and compact, not for
   iPad.** The examples' config on the joined tree: 106 passed, 2 skipped (`examples` at phone size, `examples-compact`, the runner, the
   hot-reload demo, the UI primitives). All four also run in the site's playground (the playground's own config, 41 passed, and the built
   site in Chromium at desktop size and at 390 x 844 once scrolled to). `examples-ipad` is a WebKit project and was **not run**.
2. **"Emberwick's journeys pass in each of the six languages' menus, and its Ruken manifest carries an achievement": done.** 38 passed
   (phone, compact, iPad-sized Chromium, the dev server's, and the six `emberwick-language-*` projects); the manifest's achievement is held
   by `games/emberwick/tests/unit/ship-config.test.ts` (in `pnpm check`). The WebKit projects were **not run**.
3. **"`automata words` translates ... against a fake model in tests; and `automata check` fails on a missing word, a lost placeholder,
   or a character a font cannot draw": done, with the live call unverified.** `run-words.test.ts` and `cli-words.test.ts` (every missing
   and stale word into every language, `--to`, a key, `--all`, `--mark`, a dropped placeholder asked again once, an unreachable
   translator); `words-step.test.ts` (a missing key, a lost placeholder, a character no font can draw, a language with no font) and
   `pass words` on a generated game in the consumer smoke. **The live model call was not made:** no `AUTOMATA_ANTHROPIC_KEY` exists in this
   environment (checked with `env`), so what the real model returns for a line is unverified.
4. **"`pnpm check` passes; API reports and the index are updated; changesets are written": done.** The whole `pnpm check` on the joined
   tree, exit 0 (52 and 61 tasks, 65 changesets, 0 problems); `pnpm build` (16 tasks); `pnpm api-report` (10 breaks against the base, 0
   undeclared); `pnpm api-index` (1283 exports from 49 entry points, 0 undocumented). The site changes of task 20 need no changeset (the site
   is private). The closing `pnpm check` on the final tree is in the plan's ledger.
5. **"The site shows all of it": done.** The site was built from this branch and checked in Chromium (the plan's ledger lists each
   check): the Examples page lists `core-languages`, `core-first-run`, `audio-ui-sounds` and `ui-splash-credits`, and each runs in the
   playground; the API pages show every new export (59 index rows in five packages) with its doc comment; Docs lists the new Languages guide
   and the changed publish guides; the cheatsheet and the four `llms*.txt` files carry the same; Home and Start say languages (Start and the
   copy about "no AI" were changed in task 20); the header's Editor link opens `/editor/app/` and `/editor` answers 301; `pnpm check:site`
   passes; the site's unit tests (518), the site's whole Chromium suite (505 passed, then the five phone cases added after it, passing) and the
   playground suites (41) pass. Two defects were found and fixed in the task (the playground's frame at phone height, and copy that said
   Automata runs no AI). **Not run:** WebKit, `check:deployed`, `check:launch`, Lighthouse (they need the live site or WebKit).
6. **"Reported, not claimed: WebKit, Firefox and real devices are the Owner's": reported.** Not run, so not claimed: WebKit (the iPad
   projects, `emberwick-phone-webkit`, the site's WebKit project and the playground's), Firefox (the playground's and parity), a real
   desktop build opening a real browser, a real Ruken host (links, achievements, a locale it supplies), a real `ruken publish`, the 3D
   workflow, sound heard through speakers.

**Open for the Owner (not settled):** `games/emberwick/tests/unit/plumbing.test.ts`'s limit moved from 430 to 490 (measured 479) so the
gate could run; the side session's list of what the framework could take over is in the plan's ledger (task 16). The number is left as it is.

**Known and not caused by this work, for the implementation audit:**

- `automata check --only no-eval` fails for a game inside this repository: `FAIL no-eval`, then `ERR_MODULE_NOT_FOUND` (cannot find
  `packages/content/src/features/vite/index`, imported from `packages/content/src/entries/vite.ts`), `automata check: 1 finding`. The step runs a
  plain-Node `vite build` of the game and the content package's vite source entry has an extensionless import Node cannot resolve; it fails the
  same way on `main`. Reproduced on the joined tree, not fixed (it is not a one-line change). A published install (built `dist`) is not affected;
  that was not run.
- The flow's, the boot-failure panel's and the display policy's words are a boot-time snapshot, not live on a language switch.
- The web `openLink` uses `window.open` with a nulled opener rather than `noopener`.
- Two tests in task 5b were not watched failing first.
- In Settings at phone width the "+N more" badge overlaps the last Vibration row's label.
- The live `automata words` call is tested against the fake only.
- The merge commit `e0b2394e` carries the earlier execution session's id in its `Claude-Session` trailer (a slip; not rewritten, since the commit is pushed).
- Task 20's second defect fix was watched failing under the old code for one of its five cases only (the plan's ledger says which).

## Workstream 1, stage 6 (the fixes), `claude/shared-polish-fixes`

Sonnet 5.5 (`session_01HNdX7HQTNnRKaroUir7cbf`), no subagents, from `main` `62a143ce` with the audit merged. One commit per
finding or tight group, test first, each test watched failing. Chromium only (software GL); WebKit, Firefox, real devices and
hosts are not run; no paid API call. **Progress: 18 of 18 findings (100%); stage 6 is done** (B1, S6, S7, S1, S2, S3, T7, S4, S5, T6, S8, S9, T1, T8, T3, T5, T4, T2; S6 counts with B1, T7 with S3, T6 with S4+S5). Stage 6 of 7 is this one, so the workstream is
`(5 + done/18) / 7` of the way: 6 of 7 stages, 86%, with stage 7 (the final review and merge) left.

| Finding | What | State | Commit |
|---|---|---|---|
| B1 + S6 | `/version` answers cross-origin; a failed check is "could not check", never "current"; a cross-origin journey | done (Chromium: net-ui browser suite 103 passed; unit tests in `pnpm check`) | `1961fc59` |
| S7 | Content entries load under plain Node; `no-eval` passes for Emberwick | done (`automata check --only no-eval` on Emberwick: FAIL before, pass after) | `551a11f2` |
| S1 | Flow, display and lost-picture words follow the language in force | done (unit tests; Emberwick journeys at the end) | `076ae045` |
| S2 | The OFL text ships in a built game | done (unit tests; Emberwick built into a temp folder in a test) | `156126ae` |
| S3 + T7 | `automata words` tells a bad key, a rate limit and an outage from a refusal and stops at the first; the key is `AUTOMATA_ANTHROPIC_KEY`, then `ANTHROPIC_API_KEY` | done (against a local stand-in server only; the live call is not made) | `d14076d8` |
| S4 + S5 | `bindWords`, `formatNumber`, `DEFAULT_LOCALES` and one `matchLocale` in the framework; Emberwick measures 469 and its limit is 470 | done (`pnpm check` exit 0 on the tree; see "Open, for the Owner") | `77e57029` |
| S8 | "+N more" never covers a label | done (the framework's Chromium suite 2252 passed; see the commit body) | `13d0f15f` |
| S9 | The photosensitivity warning says the game's own hazards | done (`photosensitivity: { effects }`; Emberwick declares flashing and shaking; the editor-gaps ledger has row 12) | `f5fca953` |
| T1 | `openLink` opens `window.open(url, '_blank')` with the opener nulled in the same turn, so a blocked popup answers `opened: false`; only `https:` addresses reach it; each adapter read | done (corrects `dcf5cc1a`, which put `noopener` in the features and made a block read as opened; unit tests; a real browser's referrer not checked) `82598ff8` |
| T2 | The playground's start-when-seen cases watched failing against a reverted observer | done (all five cases of `playground.e2e.ts` failed with the observer reverted to `rootMargin: '100% 0px'` on the panel, a frame already in the page before the scroll; all five passed with it restored; Chromium, software GL; no source change) | `da9f29fe` |
| T3 | Interface sounds nothing plays | done (a Modal asks for `open` and `close`, the error panel for `error`) | `07aeda0d` |
| T4 | Credit names in the font build's glyph gate: a new `verbatim()` in `@automata/content/schema` (coordinator approved the export); the credits kind marks `name` with it; the build cuts every face to it and names a name a language's faces lack | done (unit tests in content and ui-screens; no game ships a credits file yet, so no font changed) | `468b3c68` |
| T5 | Copy that fails the grandma test: "Make it gentler" heads the warning's switches; Emberwick's splash is "Emberwick, starting" to a screen reader; six languages each, by hand; fonts rebuilt | done (the catalog-parity unit test watched failing on the English change alone; fonts, words sources and example pages rebuilt) | `5a3980b3` |
| T6 | The Languages guide names the import | done with S4 | `77e57029` |
| T7 | `AUTOMATA_ANTHROPIC_KEY` documented and read | done with S3 | _with S3_ |
| T8 | The SDK on the Node-only list | done (`pnpm boundaries`: 0 findings; unit cases for the package and a subpath) | `26cb32d4` |

Stage 6 handoff at 90 minutes (the fixes session, `session_01HNdX7HQTNnRKaroUir7cbf`): last code commit `77e57029`, pushed.
Done: B1+S6, S7, S1, S2, S3+T7, S4+S5, T6. **Resume at S8** (the "+N more" badge), then S9, T1, T2, T3, T4, T5, T8, then the closing
run. Notes for the next session: (1) `ScrollList.svelte`'s badge is `position: sticky` inside the scroll region, so it will
always cover whatever row is at the bottom of the viewport; the fix needs the badge outside the scrolling box (a frame with
the region and the badge as siblings, the frame as the grid item, the same `min-height` reserve on both, and `count()`
run again when the badge toggles, since it shrinks the region), and then a layout-contract rule that no text under
`[data-scroll-region]` intersects `scroll-more`, checked at phone and compact size in the six languages (the Settings fixture
with the Language group); only `ScrollList` and its unit test name `scroll-more`. (2) A commit that touches
`packages/automata` runs the hook for about 9 minutes; the whole `pnpm check` takes about 12 and passes on `77e57029`. (3) The
tools' own copies of `fontCoverage`, `catalogCharacters` and `packageCatalogs` were kept (the audit's "drop them once S7 is
fixed" is not done: `packageCatalogs` is bound to tools' `Files` service, and the pin tests keep the copies equal) and Emberwick's
`ship.config.ts` still writes the six tags out; say if the Owner wants those moved. (4) `sim`'s own root, `replay` and `testing`
entries still have parameter properties plain Node cannot load; content does not reach them. (5) FigureBuilder is a copy at
`d6e3c9fb` in `vendor/FigureBuilder` (container-local, not in `git status`).

Stage 6 handoff at 90 minutes (the second fixes session, Sonnet 5.5, `session_01HNdX7K4hJ42HKM6t8Ez3s5`, from `69887136` merged with
`main` `70df88b2`): last code commit `07aeda0d`, pushed. Done this session: S8 `13d0f15f`, S9 `f5fca953`, T1 `dcf5cc1a`, T8 `26cb32d4`,
T3 `07aeda0d`. **Resume at T5, T4, T2** (the three left; they are small), then the closing run in the prompt's order (merge
`origin/main`, `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, a `patch` changeset for each published package
changed (`@automata/framework`, `@automata/tools`, `@automata/content` if T4 touches it, none yet written this session), the whole
`pnpm check`, then the Chromium suites listed in the prompt, the packed-install smoke, the site's Languages guide and example
for `bindWords`, `matchLocale`, `formatNumber`, `DEFAULT_LOCALES`, and this document). Notes: (1) T5's copy is two places:
core's `first_run_warning_choose` ("Turn down", six languages in `packages/automata/src/app/screens/words/`, then
`automata words --mark --catalog packages/automata/src/app/screens/words`) and Emberwick's `splash_label` ("Splash",
`games/emberwick/messages/ui/<lang>.json`, then `automata words --mark` in the game); changing a catalog character set means the
committed fonts must be rebuilt (`automata-content assets` in `games/emberwick`, and the examples' two page folders, which the
test `packages/content/tests/unit/shared/assets/example-fonts.test.ts` compares; delete the stale hash-named `.woff2`), as S9 did.
(2) T4: the credits content kind (`extensions/ui-screens/src/shared/credits/credits.content.ts`) must add its names to the
characters every language's face keeps, which is in `packages/content/src/shared/assets/build-fonts.ts` (`wordsOf`, `nameCharacters`)
and the words step's check. (3) T2: revert `site/` `Playground.svelte`'s observer on a scratch branch and watch each of the four
playground cases fail; nothing else changes. (4) A commit that touches `packages/automata` runs the hook for about 10 minutes;
it fails on a stale API report (`pnpm build`, `pnpm api-report --update`, `pnpm api-index --write` first) and on stale committed
fonts. The whole `pnpm check` takes about 12 and passed on `f5fca953`'s tree. (5) T1's first version (`dcf5cc1a`) was corrected in
the third session: `noopener` in `window.open`'s features made it answer null always, so a blocked popup read as opened. (6) FigureBuilder is a copy at `d6e3c9fb` in
`vendor/FigureBuilder` (container-local).

Stage 6 closing run (the third fixes session, `session_01HNdX7Kcr4Jtmso7AuMzMqZ`, Sonnet 5.5, from `3e46c8cf` merged with `main`
`382ef1bd`, the FigureBuilder pin kept at main's `23f889c8`): the last code commit is `1044f6b2`. Done this session: T1 corrected
(`82598ff8`: `window.open(url, '_blank')` with the opener nulled in the same turn, so a blocked popup is `opened: false` again),
T5 `5a3980b3`, T4 `468b3c68` (a new additive `verbatim()` in `@automata/content/schema`, the Owner's coordinator approved the
export), T2 `da9f29fe` (all five playground cases failed against the reverted observer, then passed), the release changesets and
guides `b0f31b65`, and two test fixes the Chromium journeys found: `730ececd` (the six-language journey imported game code that
reaches the framework's Svelte source since S4, so the Playwright run stopped at load) and `1044f6b2` (the fake-host journey never
pressed Continue on S9's flashing-lights warning). Each finding's commit is in the table above.

What ran, on the tree of `b0f31b65` unless stated, Chromium only with software GL (`AF_WEBGPU=software`):

- The whole `pnpm check`: exit 0 (lint, typecheck, `boundaries`, `style`, `knip`, 63 unit tasks, `changeset status`, 76 changesets, 0 problems).
- `pnpm build` (16 tasks); `pnpm api-report --update` and `pnpm api-index --write` changed nothing after the T4 commit's own regeneration.
- The framework's browser suite 2252 passed (27 files); `@automata/ui-screens` 550 passed, 1 skipped; `@automata/net-ui` 103 passed;
  `@automata/content` 3 passed.
- Emberwick's journeys in Chromium (phone, compact, iPad with the golden route, the dev server, and the six language projects): all
  passed after the two test fixes above (35 in the first run, of which 3 failed and now pass, and 6 language runs).
- The examples config, Chromium projects (`examples`, `examples-compact`, `runner`, `runner-compact`, `demos`, `ui-primitives`, the
  Chromium matrix cells): 132 passed, 86 skipped by the config. The `examples-ipad` project is WebKit and its 41 cases did not run.
- The site: `pnpm build`, `check:site` (51 pages), unit 518 passed, Chromium e2e 509 passed (one is the audit's expected failure,
  `test.fail`), the playground config in Chromium 41 passed.
- The packed-install smoke (`node tooling/consumer-smoke/src/run.ts --from packs`): passed.

What did not run: WebKit and Firefox anywhere (the examples' `examples-ipad` and the matrix's WebKit and Firefox cells, Emberwick's
WebKit projects, the playground's other engines), real devices, a real Ruken or Tauri host, a real browser's referrer for T1, the
live `automata words` call (no paid API call), `pnpm ci:local`'s 3D suites and journeys (workstream 2's, and unchanged here), and a
second look at `release-checks.yml`'s other steps (`pnpm agent-skills`, `plugin:validate`, `test:dist`).

Follow-ups the audit's list leaves open, recorded here (not fixed in stage 6):

- Tools still carries its own copies of `fontCoverage`, `catalogCharacters` and `packageCatalogs`, kept equal by pin tests.
  `packageCatalogs` is bound to tools' `Files` service (an Effect service for testing without a disk), so it cannot be content's plain
  function without giving content that service; the other two are small and could go to content once tools may import
  `@automata/content/assets` and `/locale` under plain Node. Left on purpose: the cost of the copies is two pin tests.
- `sim`'s root, `replay` and `testing` entries still have parameter properties plain Node cannot load (`--experimental-strip-types`
  refuses them); content does not reach them, so S7 holds. Not fixed here.
- **T1, the referrer.** The page a credits link opens still receives the game's address as its referrer (and starts in the
  game's browsing context group): `noopener` stays out of the features string because it would hide a blocked popup, and
  `noreferrer` would need it. What the referrer then is depends on the shell. A built game's `index.html` (the template, Emberwick,
  the examples) sets no `<meta name="referrer">`, so it is the browser's default (`strict-origin-when-cross-origin` in current
  browsers) or the host's `Referrer-Policy` header; the site sends `strict-origin-when-cross-origin`
  (`site/src/shared/html/security-headers.ts`) and its playground frames `no-referrer`. That is origin-only across origins, which is
  the bar asked for, so nothing is changed here; a game that wants less sets its own policy (a meta tag or a header).
- Emberwick's plumbing is 470 of its limit of 470 (S9's one-line declaration took it from 469); it stays under "Open, for the Owner".

## Workstream 2 sessions (slice 1, the prologue)

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11, and re-set the same day on the Owner's word: The Last Light is the 3D reference game in this repository, MIT, by feature; Ember Hall is cut |
| 2. Plan | Fable 5.2 (`session_01HNdX7KiEkdV6ZYyFkipam4`) | `claude/last-light-prologue-plan` | Done 2026-11-11. The survey: 56 run-time rows marked, the editors table, the game's 76-row editor-gaps ledger read against the suite, 14 tangles in the old code, October's fixtures as the starting point, what names Ember Hall (173 files; 58 files of code and tooling), the sounds and music with their source. The plan: 22 tasks with a tracking table, 13 calls named. A first plan (`43f94569`) was written before the re-set reached the session and is replaced. The game was read at `92e6704`, read only. No product code written and nothing run: `node_modules` is not installed in the container, so no test, no `pnpm check` and no `pnpm format` ran; the counts were measured from the files |
| 3. Plan audit | `session_01HNdX7JSqWtHtS5iTUs3VvD` | `claude/last-light-prologue-plan-audit` | Done 2026-11-11: the plan and survey checked against the spec, `AGENTS.md`, the code on `main` `81ce53a9`, workstream 1's spec and plan (on `main` and `claude/shared-polish-build`) and the game at `92e6704` (cloned read only; its prologue, audio tables and player read, the fixtures compared). 32 findings, all fixed in the plan and the survey (three from the spec's amendments and workstream 4's spec, merged in at `6a70f9b1`); three questions went to the coordinator and were answered (the recorded files: option B, twelve cross; the homes; workstream 1's task 17). A contradiction between the new homes rule and the code (core may not import the extensions interact and the HUD use) went to the coordinator and was settled in the spec at `909f6b10` during the audit. The 3D examples' cut, decided in the spec while the audit ran, is in tasks 19 and 20. No product code changed, no test run (`node_modules` is not installed), `pnpm format` not run for the same reason; FigureBuilder not attached (not needed) |
| 4. Execution, framework branch | Sonnet 5.5 (`session_01HNdX7MnfDC61pDeweL5EBi`), no subagents | `claude/last-light-framework` | In progress 2026-11-11, started before workstream 1 merged on the Owner's word; built on `main` `a024bc4b`. Tasks 1 to 8 done (see the plan's log); session 2 finished the branch: tasks 9 and 9b and the carried light's content file done merged 2026-11-11 as #643 (`b884d8c0`) after the merge session's own whole `pnpm check`; no golden or hash moved; both sessions archived |
| 4. Execution, game branch | Sonnet 5.5, high (`session_01HNdX7MSLba4PLLSBJvMMWj`), no subagents | `claude/last-light-prologue` | Started 2026-11-11 from `main` `b884d8c0`: tasks 10a to 18. Held: task 13 (the dressing; waits for workstream 4's figures and wardrobe branches) and task 14's LCD panel and retro grade (waits for the effects branch) |
| 4. Execution, game branch, sessions 2 and 3 | Sonnet 5.5, high (`session_01HNdX7MbP4BrHngS9BNwUHr`, archived; then `session_01HNdX7KTqL3e3T4tRcLZmei`), no subagents | `claude/last-light-prologue` | Session 2 handed off at `b54fbb1f` (task 14 but for the held parts; journey 1 passes in Chromium). Session 3 started 2026-11-12: the look in play against the old game, the HUD's gaps, credits as content, journey 2, then tasks 16 to 18. Framework gaps the game found, for an addendum: a game-initiated save, ending a run, and the HUD's minimap, marker, leader line and pixel font |

## Workstream 4 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11; the Owner said yes to taking the work over |
| 2. Plan | Fable 5.2 (`session_01HNdX7HoZvLRU1gqFba7bf7`) | `claude/builders-look-plan` | Done 2026-11-11, no subagents. Ran: both builders' own renders (EnvironmentBuilder `f7c5356`, FigureBuilder `23f889c`), the framework's frames on `main` in Chromium on software WebGL, the 3D examples' build, each step of `pnpm check` on `main` and on each draft merged with `main`, trial merges and cherry-picks in scratch worktrees. `main` at `6a70f9b1` failed `style` and `source-names` on documents under `docs/superpowers/` (repaired on `main` at `f93a2402`, re-run there: 0 findings). No product code written; no hash or golden touched. Not run: WebGPU, WebKit, Firefox, the browser suites and journeys. The plan names eleven calls for the coordinator, and one editor gap is logged (painted figures) |
| 3. Plan audit | `session_01HNdX7Lxv5Fs1sjzwS7sm97`, no subagents | `claude/builders-look-plan-audit` | Done 2026-11-11 at `main` `b80bfc84`. FigureBuilder placed at its pin `d6e3c9f` and read at `23f889c` and #29's `856498a`; EnvironmentBuilder read at `f7c5356` (both read only, nothing committed in them). Ran: `pnpm install`; the survey's sheets on `main` and on `main` + #589 + the fix (each within 0.1 of the survey's and the plan's numbers); the plan's lit-room test in Chromium (fails on `main` and on `main` + #589, passes with the fix; it did not typecheck as written, fixed); the merge order on scratch branches with each step of `pnpm check` on each state (green but for `knip`, `main`'s own fault, and the probe's port in the first two states, finding 5); workstream 1's build branch merged with the order (no conflict as text; the lockfile needs `pnpm install`); a revert of the letterbox commits. Not run: WebGPU, WebKit, Firefox, the browser suites and journeys whole, `pnpm build`, `api-report`, `api-index`. 28 findings, all fixed in the plan and the survey; no product code or spec changed |
| 4. Execution, group 1 | Sonnet 5.5 (`session_01HNdX7MDAqNLWC1zfCsH8Hv`), no subagents | `claude/builders-look-room` | Done 2026-11-11 (tasks 1 to 5; no pull request opened, the merge session's). Built against `main` `9938e9c3`. Ran: `pnpm check` on `main` and on each task's state (exit 0, 61/61); the Chromium suites of `@automata/3d` (parity 36 pass, 2 skip), world-kit, character-kit and the 3D journeys (20 pass); the `webgpu` project on SwiftShader (7/7); the 16 sheets re-shot; every 3D example's first frame. Not run: WebGPU on a real GPU, WebKit, Firefox. FigureBuilder at its pin and EnvironmentBuilder at `f7c5356` attached read only, nothing committed from either. No dependency changed; no golden moved |
| 4. Execution, group 2 | Sonnet 5.5 (`session_01HNdX7Ha16NBMNzpSDSamiX`), no subagents | `claude/builders-look-figures` | In progress 2026-11-11 (tasks 6 to 9 and a figure's cast shadow; no pull request opened, the merge session's). Built against `main` `a024bc4b`. Tasks 6 to 8: #607 merged whole; the painted pair's 16 sheets in `after-figures/`; 15 of 22 figures hot against the builder's window, so task 9 runs; the one golden that moves is the runway cells (`ea71e0a3`, ruled before this workstream); `pnpm check` 61/61 on `main` before and on the merge after; the kit's unit 207, Chromium and the `webgpu` project on SwiftShader 55 pass (3 skip: the gate scripts); FigureBuilder at `23f889c`, EnvironmentBuilder at `f7c5356`, both read only. Second session (`session_01HNdX7Ha16NBMNzpSDSamiX` continued by a new Sonnet 5.5 session) built against `main` `a8f2d40a`: the shadow's sheets and the builder's shadow measured, the kit's placement taking a density and a `crisp` choice (the coordinator's ruling, true size as an option, the default unchanged), handed off at 90 minutes with the whole `pnpm check`, the density sheets and task 9 still to do (see the plan's log). Third session (Sonnet 5.5, built against `main` `e6aabd78`, merged in at `243e4b34`): the street's missing shadow was the spike's wiring (feet at 0, pavement at 0.12 = `floorReach`), fixed and measured (street diorama 1357 texels at 0.69 against the builder's 1422 at 0.64); the old game's figure size shot (eight 640 x 360 sheets and a 640 x 480 one in `after-sizes/`: whole pixels 20% short in the gameplay view, true size within 3%) with the kit's true-size browser case; exposure built as `SceneLight.groundLuma` (the coordinator's ruling in place of the readback). Handed off with the exposure re-measure (`reads.json`), the shadow numbers for the other scenes and task 4 (the build, the api reports, the changesets, the whole `pnpm check`, the Chromium suites) still to do |
| 4. Execution, group 2 (figures), session 3 | Sonnet 5.5, high (`session_01HNdX7JER9Yb1gPG5XDv4Sk`), no subagents | `claude/builders-look-figures` | Started 2026-11-11 from `5012314d` after session 2's handoff at 90 minutes (archived). Left: the street's shadow (cause found: the comparison scene stood figures 0.12 m under the pavement; not a framework fault), the sheets at the old game's picture and figure size, exposure by a core ground probe, then the build, the API reports and the whole check |
| 4. Execution, group 2 (figures), session 4 (the close) | Sonnet 5.5 (`session_01HNdX7H9fsKJaBnYDTchEQA`), no subagents | `claude/builders-look-figures` | Done 2026-11-12 (no pull request opened, the merge session's). `main` merged (`d71bafea`); exposure by the builder's own trial (`170ea8fe`), the black slabs found to be wall fixtures' backs (a named difference; task 10a of the effects branch), the interior shadow a named difference with a question for the implementation audit, `reads.json` shot again (24 runs, 11 hot, all read). Ran: the whole `pnpm check` (exit 0, 63/63); Chromium only: 3D 48 pass (2 skip), world-kit 8, character-kit 58 pass (3 skip), 3D journeys 16; no golden moved. Not run: WebKit, Firefox, the e2e of base-3d and the 3D examples, the 2D browser suites. |
| 4. Execution, group 2, merged | the merge session | `claude/builders-look-figures` | Merged 2026-11-12 as #648 (`a8d4e837`) at `5f4cee75` after the merge session's own whole `pnpm check` (uncached), `pnpm build` and the API report and index checks. The `vendor/FigureBuilder` pin moves `d6e3c9fb` to `23f889c8` (FigureBuilder's `main` head). One golden moved, named by `ea71e0a3` (42 runway cells, one golden for every machine). It carried #607 and #603 by ancestry. Not run by the merge session: browser suites, parity, journeys |
| 4. Execution, group 3 (effects) | Sonnet 5.5, high (`session_01HNdX7JSVBzwMw24JzdZGTD`), no subagents | `claude/builders-look-effects` | Started 2026-11-12 from `5f4cee75`. **Done so far (3 of 4 tasks, 2026-11-12):** task 10a (`e5b569b19`: a wall-mounted fixture hides and shows with its wall; the slabs are gone in [`after-effects/base-interior-dressed-zone-640x480.png`](audits/builders-look-survey/after-effects/base-interior-dressed-zone-640x480.png)), task 10 (`f4ac1e19`: #590 and #588 merged), task 11 (`7bc88a9a`: room-visibility left). **Task 12 and task A (the lamp kit) done 2026-11-12 by a second session (the close, no pull request opened, the merge session's):** every pass behind its switch (each switch test shown failing by cutting its behaviour), reduced motion, the LCD panel and the retro grade at 640 x 360 and 640 x 480 with [`look-640x480.png`](audits/builders-look-survey/after-effects/look-640x480.png) (mean luma 54.1 with no effects, 45.9 with the LCD panel, 43.9 with the grade), the recipe a game uses (in the plan, "What workstream 2 relies on"), the lamp kit covering the old game's lamps (`b5643381`), `main` merged twice, the whole `pnpm check` (exit 0, 65 of 65), Chromium on software GL: 3D 48 (2 skip), world-kit 19, character-kit 55 (2 skip), lcd-panel 9, retro-crisp 10, the 3D editor's journeys 16; no golden moved. Not run: WebKit, Firefox, a real GPU, the base-3d and 3D example e2e. The remaining effect work waits for the beta.3 port (follow-ups below) |

## Workstream 1, tasks 16 and 19 (a side branch)

The Owner had tasks 16 and 19 split off the build branch to go faster. One session runs them on
`claude/shared-polish-emberwick-site` (from `e5100b3c`), and the build session folds them in at the merge, then recomputes
the percentage above (this section does not).

| Task | State |
|---|---|
| 16. Emberwick in six languages, with an achievement | Done (Chromium only; WebKit and Firefox not run; the live model call unverified, no key). The rulings are in the plan's "Execution log: tasks 16 and 19" |
| 19. The site's Editor page is cut | Done (Chromium only; WebKit not run; `check:deployed` needs the live site). The rulings are in the plan's "Execution log: tasks 16 and 19" |

## Workstream 3: what the Owner has said so far (2026-11-11)

No UI editor was ever planned: the 2026-10-30 suite spec put "a UI composer" out of scope and the HUD-pieces idea was
cut on 2026-11-08, so every HUD is code today. The Owner wants one. It should let a person change by hand where things
sit on screen, how they look, what they show, and make whole new screens; and it should also be able to change the
screens that come by default, such as the main menu and the splash. Details are settled when the work comes up.
Until then, a HUD screen the port needs (journal, map, inventory, objectives, dialer) is built so that an editor can
take it over later: its layout and words as data, not buried in code.

## Editor gaps ledger

The Owner, 2026-11-11: "every piece of authorable content should have an editor, so UI is just one, we should build out
others when a gap is found". Every stage that meets a kind of content a person would want to change by hand and that
no editor in the suite opens adds a row here; each row becomes suite work (workstream 3). A slice's "prove it edits"
step fails on content with no editor unless its row is here with the Owner's word that it may wait.

| # | Content with no editor | Found by | State |
|---|---|---|---|
| 1 | Screens and HUD: layout, look, what they show, whole new screens, and the default screens (main menu, splash) | The Owner, 2026-11-11 | To be specced |
| 2 | Painted figures: the character kit's characters and outfits (`CharacterDef`, `RUNWAY_CAST`, the ward's outfits to come) are TypeScript data; the Studio opens core's mesh figures only, and no editor imports the kit's painted figures | Workstream 4, stage 2 (plan), 2026-11-11 | To be specced; the prologue's dressing task says it makes its figures in the Studio |
| 3 | The interface-sound map: which cue each name (`press`, `back`, `focus`, `open`, `close`, `error`) plays. `defineGame({ uiSounds })` takes a map or a function, in code; the Audio editor opens the cues, not the name-to-cue map | Workstream 1, task 9, 2026-11-11 | To be specced; task 10 makes the starter map, which a person changes by hand until then |
| 4 | The credits file: `content/credits/credits.toml` (sections, names, roles, links) is authored by hand; no editor in the suite opens it | Workstream 1, task 12, 2026-11-11 | To be specced; a person edits the TOML until then |
| 5 | The achievements declaration: `achievements` in `ship.config.ts` (an id, a title, a description, one goal on a board) is TypeScript a person edits by hand; no editor in the suite opens it | Workstream 1, task 13, 2026-11-11 | To be specced |
| 6 | The font list: `content/fonts.toml` (which fonts draw which languages) is authored by hand; no editor in the suite opens it | Workstream 1, task 5b (logged late, in task 13), 2026-11-11 | To be specced |
| 7 | A game's own interface words: `messages/ui/*.json` (Emberwick's panels' text and its `context.json` notes for translators) are authored by hand; no editor in the suite opens them. The same kind of gap as the credits file's | Workstream 1, task 16 (the side session), 2026-11-11 | To be specced |
| 8 | Interact data: a hotspot's `reach`, `name` and `hide` are scalar fields, which Levels 3D edits when the level's `entityDefs` declares them; its `when` conditions (a list of nested conditions) have no field type in the editor kit, so no editor opens them | Workstream 2, task 1 (`@automata/interact`), 2026-11-11 | To be specced; the data stays an entity of the level with a schema (`hotspotSchema`), so `automata check` names a bad one |
| 9 | Footsteps by floor: the audio file's `steps` table (floor surface → cue). The Audio editor opens a file with it and keeps it through an edit, but offers no rows to change it | Workstream 2, task 7 (`@automata/audio-synth`), 2026-11-11 | To be specced; the table is data with a schema, so a check names a floor whose cue is missing |
| 10 | Peek numbers: `content/peek.toml` (reach, dwell, arc, lean, ease) has a schema and a content kind (`peekContent`, sim content); no editor opens it | Workstream 2, task 4 follow-up (`@automata/systems`), 2026-11-11 | To be specced |
| 11 | Carried-light numbers: `content/carried-light.toml` (radius, start, fill, cap, burn) has a schema and a content kind (`carriedLightContent`, sim content); no editor opens it | Workstream 2, task 4 follow-up (`@automata/systems`), 2026-11-11 | To be specced |
| 12 | The photosensitivity declaration: `photosensitivity: { effects, switches }` in `defineGame` (which hazards the game has, and the settings that turn them down) is TypeScript a person edits by hand; no editor in the suite opens it | Workstream 1, stage 6 (S9), 2026-11-12 | To be specced |

Rows 8 to 11 are the reference game's own (workstream 2); they were rows 3 to 6 on its branch and were renumbered at the join with workstream 1's rows 3 to 7. Row 12 is workstream 1's (stage 6).

## Findings so far (2026-11-11)

- The framework was extracted from The Last Light at its 2026-10-11 commit
  ([extraction map](../archive/superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md)); the game never
  moved onto it. The gaps that remain for the port: the game itself and a converter for its scenes, the horror systems
  (pacing director, crew, grapple, barricade, peek, hiding), the connected facility, faces and acting, the HUD screens
  (journal, map, inventory, objectives, dialer), foley and room acoustics, twelve of its sixteen pipelines, and a
  whole-game playthrough proof. The builders' look and The Last Light's camera are already landing in `@automata/3d`.
- Lifted 2026-11-12: Pixi 3D is public on npm, and a 3D game now publishes to every host a 2D one does
  ([the move](audits/2026-11-12-pixi-3d-public/README.md)). An itch release is the Owner's.
- FloorFifty's shared layer is in `packages/automata` except the seven items of workstream 1.
- `automata-plus`: all 14 packages exist as extensions under the same names; its starter was cut on 2026-11-07.

## Workstream 4: carried to the next branch and the implementation audit (2026-11-12)

- **First task of `claude/builders-look-effects` (plan task 10a):** wall-mounted fixtures take their wall's `occlude` and register with the occluders, test first in `@automata/3d`. The dressed interior's black slabs are the backs of fixtures on the culled near wall; the **reference game needs it** (a cut wall must take its fixtures with it). Evidence: [`after-exposure/README.md`](audits/builders-look-survey/after-exposure/README.md).
- **Question for the implementation audit:** should a lamp-lit room cast a figure's silhouette from its key lamp? The builder casts it along the figure's painted key whenever the time's `shadow` is true, sun or not (the interior: 1223 texels against ours 286; with its shadow off 271); ours casts a silhouette only under a sun that casts and a contact shadow otherwise. Adopting it moves every interior frame with the shadow on. [`after-shadow/README.md`](audits/builders-look-survey/after-shadow/README.md).
- **Named difference:** a hold on the floor under the feet (`SceneLight.groundLuma`) is not the builder's ring round the silhouette in the frame; the interiors' man still reads hot in some views (11 of 24 runs hot, all read). [`after-exposure/README.md`](audits/builders-look-survey/after-exposure/README.md).

### Workstream 4: follow-ups, not built on `claude/builders-look-effects` (2026-11-12)

The effects branch closes with what is built; `claude/pixi-3d-beta-3` moves the framework to `@pixi/3d` 0.1.0-beta.3 (post effects staged before or after
tone mapping, tone mapping's default, unlit colour, samplers), and every effect here is ported there, so no new pass is built on beta.2.

- **The drifting mist** (the old game's; no framework counterpart): a pass, so it waits for the beta.3 port.
- **The day-pane reflections**: the builder's streaks are the `glass` swatch pattern, not a pass; a world-kit albedo tile for glass-pattern swatches (a
  1.44 x 1.86 m tile repeats the stripe), laid as `tileUvs` lays a photo tile. Small and independent of the port; not built.
- **The remaining effect sheets**: the dressed street at night with painted figures; reflections and particles, which need a wet ground and an emitter the
  spike lacks. Shot after the port, so they show the effects as they will ship.
- **The sky and haze difference** (the green veil off the room): ruled the sky's ([`after-room/README.md`](audits/builders-look-survey/after-room/README.md), difference 10).

## Open, for the Owner

- **Emberwick's plumbing limit is 470, not 430: ACCEPTED by the Owner, 2026-11-12 ("Accept 470").** (The audit's S4, stage 6.) The framework now has the pieces any game with
  plain-DOM screens needs (`bindWords`, `formatNumber`, `DEFAULT_LOCALES`, `matchLocale`, exported from
  `@automata/framework`, and used by Emberwick, `@automata/ui-screens` and `@automata/net-ui`), which took the measure from
  479 to **469** lines. 430 was not reachable: what is left is the game's own (the panels' markup, the board submit, the
  game's flow and its scene wiring), and the test's own rule is that a new piece of behaviour is not hidden. The limit is
  469 rounded up to 470, and the plumbing test's comment says why.
- **Two small things stage 6 left as they are** (see "Follow-ups the audit's list leaves open"): `@automata/tools` still carries its own
  copies of `fontCoverage`, `catalogCharacters` and `packageCatalogs` (two pin tests keep them equal), and `sim`'s root, `replay` and
  `testing` entries still have parameter properties plain Node cannot load (content does not reach them). Say if either should move.
- The framework has 122 branches besides `main` from other workstreams; the merge session leaves them alone. Say if
  it should clean them up, and by what rule.

## The Owner's decisions (2026-11-11)

- `automata-website` is retired and out of this work. `automata-plus` is cut. `automata-skills` is kept.
- Records: refactor work in `docs/refactor/`, everything else in `docs/superpowers/`.
- Translations are written new and shipped; no review state or review rounds.
- Nothing is copied from FloorFifty: it is the reference for behaviour only.
- The Last Light's story lines are translated into the six languages, not only the menus.
- `automata words` has an AI translate everything or one line, into one language or all; no CSV, no review state;
  `automata check` catches gaps.
- Achievements are generic: declared host-neutral in the game, mapped by each target (Ruken's manifest today).
- Fonts: a game's font covers every language it ships; no device fallback.
- The clinic work already begun in the framework (#575, #596, #606, #588) is superseded by workstream 2.
- The site's Editor page (`/editor`) is cut; its link goes straight to the editor at `/editor/app/`.
- The port may refactor the game where its code quality is questionable; feature folders at the least.
- **What workstream 2 is:** building into the framework what The Last Light has and it lacks; The Last Light is the 3D
  reference game in `games/`, as Emberwick is the 2D one, not a product shipped from its own repository. Ember Hall
  (`games/base-3d`) is cut. The game content already in the framework's fixtures is therefore where it belongs.
- The Last Light is fully open source like Emberwick: its story, art and music are MIT.
- The Last Light is no longer a source game: the source-names check drops its name. Its ElevenLabs sounds and music
  come across as they are (the Owner paid for them).
- Where a new piece goes: core only if generic for any game; an extension if generic within a genre; otherwise custom
  code in the reference game.
- The 3D examples (`examples/3d`, `examples/3d-story`) are cut with Ember Hall when the prologue plays, and recreated
  from the reference game straight after.
- Old branches: the session's git proxy refuses branch deletion (HTTP 403), so none were cut from here; 18 are safe to
  delete (all their work is on `main`), the rest hold unmerged work.
- Workstream 4 takes over the builders' look and figures work that other coordinators began (the Owner: yes).
- Ubicloud 8-core runners are planned for this repository's CI; until they are live, sessions run the gates themselves.
- #588's LCD panel and retro grade land as opt-in look extensions (only its room-visibility is superseded); the
  letterbox's whole-pixel scale stays in core; a figure's cast shadow on the floor is in scope. The Owner: "proceed".
- The live `automata words` call is verified with the Owner's Anthropic key; how the key reaches a session is being
  settled (it must not be named `ANTHROPIC_API_KEY` in the environment, which the sessions' own runtime would pick up).
- Every branch, documents included, gets the whole `pnpm check` before it merges.
- To go faster (the Owner, 2026-11-11: "Yes"): a session that has just run the whole `pnpm check` on exactly the
  tree it commits may skip the pre-commit hook (`LEFTHOOK=0`), which runs the same unit tests again; and builds run
  in parallel where their packages do not meet. Workstream 1's last tasks are split over two branches
  (`claude/shared-polish-build`: 15, 18, then 20; `claude/shared-polish-emberwick-site`: 16, 19), and workstream 2's
  framework branch starts before workstream 1 lands, leaving its joins to workstream 1 written in its plan's log.
- The reference game's picture size and figure size match the old game's: a picture capped at 640 x 480, figures at
  density 1 in play, the finer density in cutscene close-ups only.
- Order: the shared polish first, then the port. Slice 1's plan session starts when workstream 1 reaches execution.
- 2026-11-12: "I think we overuse the procedural geometry, we need to use actual meshes too." The old game ships 62 mesh
  props (`src/render/models/`, a `.glb` and a pack each) and the framework's 3D package already loads both. The
  reference game draws the old game's mesh where the old game drew one; a world kit generator stands in only where the
  old game had no model. Open, for a spec: meshes beside generated props in the world kit and its editor.
- 2026-11-12: `@pixi/3d` 0.1.0-beta.3 is vendored beside beta.2 with its release notes (`vendor/pixi-3d/`); the upgrade
  runs on `claude/pixi-3d-beta-3` and moves `pixi.js` to 8.23. It changes the picture (tone mapping defaults to none,
  unlit colours drawn as authored, per-texture samplers, post effects staged before or after tone mapping), so no golden
  is re-recorded without the coordinator's answer, and the picture decisions go to the Owner.
- 2026-11-12, on meshes: "we can just use the procedural meshes for blockout so the AI generated prop knows the size,
  positioning, and scaling to replace it." The rule: a generated prop is the blockout and owns the place, turn,
  footprint, height and collider; a mesh replaces it on screen, fitted to it. With no mesh the blockout draws. To spec in
  workstream 4: the `model` a prop names, the fit, the world kit's editor choosing one, and the prop pipeline taking the
  blockout's bounds as its brief.
- 2026-11-12: Emberwick's plumbing limit of 470 is accepted. If the reference game's own panels and board-style calls
  show the same plumbing cost, that is the evidence for a declarative version in the framework, and both games' limits
  come down together.
- 2026-11-12, asked why the wardrobe work needs FigureBuilder's repository, and given the choice of folding
  FigureBuilder's source into the framework or granting push access: "Do 1 and do the same for environment builder."
  Workstream 6. Workstream 4's wardrobe tasks (13 to 16) wait for FigureBuilder's group and then run in the framework.
- 2026-11-12, workstream 6, three answers: (1) "remove the submodule checkout and SUBMODULES_TOKEN from the workflows":
  it goes in the fold's first pull request, quoted there. (2) "bring the figure builder branches in that we missed":
  `claude/c5-finish-fixes` and `claude/turned-face-both-eyes` come in as framework changes after the fold, with the
  wardrobe branch; content branches stay behind. (3) "commit in the note, give gh command to archive both": the
  retirement note is on `claude/optimistic-newton-yszrte` in each builder (FigureBuilder `3caa9ad`, EnvironmentBuilder
  `6983342`); the Owner merges and archives. Still open: EnvironmentBuilder's CPU scene renderer, left behind (the
  default) or brought as a reference tool.
- 2026-11-12, the coordinator's calls made without waiting, each open to the Owner's correction:
  - **The turned-face fix is in the fold branch** (`18d0cec`, re-record `0eb1a76` on
    `claude/builders-fold-figures`): the patch applies only before the conform commits. It moves 18 actor md5s, one
    sprite md5 and one base sheet (three texels). The Owner, 2026-11-12: "yes, give me both eyes"; it stays.
  - **The old game's real play is the reference game's target** (no `?debug`, 1024 x 768). Found against it: Ada turns
    her back when play starts (ours already did; kept); the LCD mesh is 4 px (ours 6 from content; 4 needs a pass on
    screen pixels after the upscale: a framework proposal); the wainscot is DUEL sand and reads teal only under the old
    room's green light, so the room's light and grade are the gap (lit regions about twice as bright in ours); the
    opening's card, first camera and video clip are in scope.
  - **Figures' look:** Ada's variant A (fringe over the brow, the vest open on a shirt, two legs) and the nurse's A (hair
    over the face, the cap low on the brow) are adopted; B to E wait for the Owner. The painter's list (a bob hem as
    wide as the ears, larger eyes, a wider stand, a stoop, hair hanging over the chest, pleats) becomes framework tasks
    once the fold lands.
  - **beta.3 (`claude/pixi-3d-beta-3`, fifth session, 2026-11-12):** the builders fold is merged in (`main` `4a505e86`) and the painter's view is
    ported: `extensions/figures` takes beta.3 and `pixi.js` 8.23.0, its WGSL cell template is beta.3's own with three edits (the texel snap is gone:
    beta.3 samples each texture with its own style), and the cell material fogs in display space as beta.2 fogged an unlit colour. The painter's
    browser suite is 231 of 231 on WebGL and WebGPU (software), byte for byte with the CPU's `compose`, the character kit's three painted WebGPU
    cases pass, no golden moved. Night room with fog, beta.2 against beta.3: painted figures 32.94 to 33.05 luma, 1.23% of pixels differ (the figures
    were 67,300 of 80,084 differing pixels before). The 3D suites, journeys, lcd-panel, retro-crisp and Emberwick's language journeys pass in
    Chromium. What is left before it can merge: the Owner answers the grouped list (recommended answers in the audit) and runs cross-engine parity
    and a real GPU (commands in the audit). One choice for the Owner, not a condition: beta.2 drew three things darker than their content colours
    (unlit and sky fog, lit figures, embers) and the conversion keeps that.
