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
| 1 | Shared polish from FloorFifty (seven items and their examples) | 3, plan audit: done 2026-11-11, 41 findings (11 blocking, 17 should fix, 13 tidy; 5 of them from the spec's amendments during the audit), all fixed in the plan, which now matches the spec at `main` `0332302c`. Next is 4, execution | 43% (3 of 7 stages); execution 0 of 21 tasks | [spec](specs/2026-11-11-shared-polish-design.md), [plan](plans/2026-11-11-shared-polish.md), [audit](audits/2026-11-11-shared-polish-plan-audit.md) |
| 2 | The Last Light, the framework's 3D reference game, one scene at a time (the prologue first) | Slice 1: 3, plan audit: done 2026-11-11, 32 findings (9 blocking, 15 should fix, 8 tidy), all fixed in the plan and the survey, which now match the spec and the code at `main` `6a70f9b1` (the spec's amendments `acb0361d`, `864361d4` and `909f6b10` included: the 3D examples go in tasks 19 and 20; a homes table, with interact and the HUD as genre extensions and a carried light in `@automata/systems`; the dressing waits for workstream 4) and the game at `92e6704`. Nothing open: every recorded file the prologue plays crosses (twelve, option B); workstream 1's task 17 is cut on its build branch. Next is 4, execution (22 tasks on three branches). Slices 2 to 4 not started | Slice 1: 43% (3 of 7 stages); execution 7 of 22 tasks (32%; branch 1 of 3, `claude/last-light-framework`, tasks 1 to 9b, started early on the Owner's word to build in parallel) | [spec](specs/2026-11-11-last-light-on-the-framework-design.md), [survey](audits/2026-11-11-last-light-prologue-survey.md), [plan](plans/2026-11-11-last-light-prologue.md), [audit](audits/2026-11-11-last-light-prologue-plan-audit.md) |
| 3 | An editor for every kind of authorable content: the UI editor first, others as gaps are found | Not started: specced with the Owner when we get to it; gaps are logged in the ledger below as they are found | 0% | |
| 4 | The builders' look and figures in the framework (takes over #588, #589, #590, #603, #607) | 2, plan: done 2026-11-11. A survey measured on `main` `6a70f9b1`, planned against `main` `f93a2402` (12 side-by-side sheets with their numbers, the causes of the two dark examples, every work package and figure piece marked, the five drafts read, merged with `main` on trial and checked step by step) and a plan of 17 tasks on five branches. The baked room on `main` draws at 0.29 to 0.50 of the builder's brightness; the fix exists in #590 and sits on #589's code, so #589 lands first. 3, plan audit: done 2026-11-11 at `main` `b80bfc84`, 28 findings (5 blocking, 15 should fix, 8 tidy), all fixed in the plan and the survey; the merge order checked step by step: green but for `main`'s own `knip` fault (the survey's shoot script, moved to `spikes/builders-look/` here) and, until #590, a probe's port that task 2 now fixes by picking `dd8d72bb` with the fix; the whole-pixel letterbox kept and room-visibility dropped (rulings for the Owner to confirm); the coordinator's answers taken in (#588: option A, `lcd-panel` and `retro-crisp` land; three items for workstream 2 taken by the coordinator, with the interfaces it relies on now in the plan; the shoot script's move sent to `main` alone as `71fdfd53`); a figure's cast shadow stays the Owner's. 4, execution: group 1 (`claude/builders-look-room`, tasks 1 to 5) done 2026-11-11 and ready to merge: #589 in whole, the lit room healthy (a browser test that failed on `main` and passes), an empty level reported, the two dark examples repaired, and a fault in the bake's sun found by the street's diagnosis and fixed; all eight scene sheets are 0.84 to 1.01 of the builder's brightness (the street was 0.29 to 0.71). Next is group 2 (`claude/builders-look-figures`, after group 1 merges). Runs ahead of the prologue's dressing task | 43% (3 of 7 stages); execution 5 of 17 tasks (29%) | [spec](specs/2026-11-11-builders-look-and-figures-design.md), [survey](audits/2026-11-11-builders-look-survey.md), [plan](plans/2026-11-11-builders-look.md), [audit](audits/2026-11-11-builders-look-plan-audit.md) |
| 5 | CI on rented Ubicloud runners, matching Ruken's setup | Not started: "for when we get there"; two questions for the Owner before switching on | 0% | [the Owner's brief](briefs/2026-11-11-ci-on-ubicloud.md) |

## Workstream 1 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11. The Owner said to begin ("begin with adding in Missing from the framework ... then do A"), so the stages run without waiting; the six calls stay open to correction |
| 2. Plan | Fable 5.2, medium (`session_01HNdX7HfQXxQqDGztKzgibK`) | `claude/shared-polish-plan` | Done 2026-11-11: 20 tasks with a tracking table, 15 calls named in the plan; revised the same day for the Owner's amendments (nothing copied from FloorFifty, no review state, fonts cover every language, `Hosting.openLink`). No product code written and no test run (this stage writes the plan only) |
| 3. Plan audit | `session_01HNdX7MBLx4zWBjBo4a5VCq` | `claude/shared-polish-plan-audit` | Done 2026-11-11: the plan checked against the spec (with the amendments `b119393b`, `df992aaa`, `87b48662` and `134d7fd1` merged in), `AGENTS.md`, the code on `main`, the vendored Ruken packages and FloorFifty at `677d456` (read only); the font's licence and coverage read from Fontsource's npm copies (`github.com` is refused here). 41 findings, all fixed in the plan; the font's reserved name, the site's import map, Credits and the source record settled by the coordinator. No product code changed, no test run (`node_modules` is not installed in the container); `pnpm format` not run for the same reason |
| Merge | One long-lived session (`session_01HNdX7LEALEpFdpPWLXPuy7`) | none of its own | Started 2026-11-11; merged the spec as #608 (`6fa386e9`) |

## Workstream 2 sessions (slice 1, the prologue)

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11, and re-set the same day on the Owner's word: The Last Light is the 3D reference game in this repository, MIT, by feature; Ember Hall is cut |
| 2. Plan | Fable 5.2 (`session_01HNdX7KiEkdV6ZYyFkipam4`) | `claude/last-light-prologue-plan` | Done 2026-11-11. The survey: 56 run-time rows marked, the editors table, the game's 76-row editor-gaps ledger read against the suite, 14 tangles in the old code, October's fixtures as the starting point, what names Ember Hall (173 files; 58 files of code and tooling), the sounds and music with their source. The plan: 22 tasks with a tracking table, 13 calls named. A first plan (`43f94569`) was written before the re-set reached the session and is replaced. The game was read at `92e6704`, read only. No product code written and nothing run: `node_modules` is not installed in the container, so no test, no `pnpm check` and no `pnpm format` ran; the counts were measured from the files |
| 3. Plan audit | `session_01HNdX7JSqWtHtS5iTUs3VvD` | `claude/last-light-prologue-plan-audit` | Done 2026-11-11: the plan and survey checked against the spec, `AGENTS.md`, the code on `main` `81ce53a9`, workstream 1's spec and plan (on `main` and `claude/shared-polish-build`) and the game at `92e6704` (cloned read only; its prologue, audio tables and player read, the fixtures compared). 32 findings, all fixed in the plan and the survey (three from the spec's amendments and workstream 4's spec, merged in at `6a70f9b1`); three questions went to the coordinator and were answered (the recorded files: option B, twelve cross; the homes; workstream 1's task 17). A contradiction between the new homes rule and the code (core may not import the extensions interact and the HUD use) went to the coordinator and was settled in the spec at `909f6b10` during the audit. The 3D examples' cut, decided in the spec while the audit ran, is in tasks 19 and 20. No product code changed, no test run (`node_modules` is not installed), `pnpm format` not run for the same reason; FigureBuilder not attached (not needed) |
| 4. Execution, framework branch | Sonnet 5.5 (`session_01HNdX7MnfDC61pDeweL5EBi`), no subagents | `claude/last-light-framework` | In progress 2026-11-11, started before workstream 1 merged on the Owner's word; built on `main` `a024bc4b`. Tasks 1 to 7 done (see the plan's log) |

## Workstream 4 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11; the Owner said yes to taking the work over |
| 2. Plan | Fable 5.2 (`session_01HNdX7HoZvLRU1gqFba7bf7`) | `claude/builders-look-plan` | Done 2026-11-11, no subagents. Ran: both builders' own renders (EnvironmentBuilder `f7c5356`, FigureBuilder `23f889c`), the framework's frames on `main` in Chromium on software WebGL, the 3D examples' build, each step of `pnpm check` on `main` and on each draft merged with `main`, trial merges and cherry-picks in scratch worktrees. `main` at `6a70f9b1` failed `style` and `source-names` on documents under `docs/superpowers/` (repaired on `main` at `f93a2402`, re-run there: 0 findings). No product code written; no hash or golden touched. Not run: WebGPU, WebKit, Firefox, the browser suites and journeys. The plan names eleven calls for the coordinator, and one editor gap is logged (painted figures) |
| 3. Plan audit | `session_01HNdX7Lxv5Fs1sjzwS7sm97`, no subagents | `claude/builders-look-plan-audit` | Done 2026-11-11 at `main` `b80bfc84`. FigureBuilder placed at its pin `d6e3c9f` and read at `23f889c` and #29's `856498a`; EnvironmentBuilder read at `f7c5356` (both read only, nothing committed in them). Ran: `pnpm install`; the survey's sheets on `main` and on `main` + #589 + the fix (each within 0.1 of the survey's and the plan's numbers); the plan's lit-room test in Chromium (fails on `main` and on `main` + #589, passes with the fix; it did not typecheck as written, fixed); the merge order on scratch branches with each step of `pnpm check` on each state (green but for `knip`, `main`'s own fault, and the probe's port in the first two states, finding 5); workstream 1's build branch merged with the order (no conflict as text; the lockfile needs `pnpm install`); a revert of the letterbox commits. Not run: WebGPU, WebKit, Firefox, the browser suites and journeys whole, `pnpm build`, `api-report`, `api-index`. 28 findings, all fixed in the plan and the survey; no product code or spec changed |
| 4. Execution, group 1 | Sonnet 5.5 (`session_01HNdX7MDAqNLWC1zfCsH8Hv`), no subagents | `claude/builders-look-room` | Done 2026-11-11 (tasks 1 to 5; no pull request opened, the merge session's). Built against `main` `9938e9c3`. Ran: `pnpm check` on `main` and on each task's state (exit 0, 61/61); the Chromium suites of `@automata/3d` (parity 36 pass, 2 skip), world-kit, character-kit and the 3D journeys (20 pass); the `webgpu` project on SwiftShader (7/7); the 16 sheets re-shot; every 3D example's first frame. Not run: WebGPU on a real GPU, WebKit, Firefox. FigureBuilder at its pin and EnvironmentBuilder at `f7c5356` attached read only, nothing committed from either. No dependency changed; no golden moved |

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
| 3 | Interact data: a hotspot's `reach`, `name` and `hide` are scalar fields, which Levels 3D edits when the level's `entityDefs` declares them; its `when` conditions (a list of nested conditions) have no field type in the editor kit, so no editor opens them | Workstream 2, task 1 (`@automata/interact`), 2026-11-11 | To be specced; the data stays an entity of the level with a schema (`hotspotSchema`), so `automata check` names a bad one |
| 4 | Footsteps by floor: the audio file's `steps` table (floor surface → cue). The Audio editor opens a file with it and keeps it through an edit, but offers no rows to change it | Workstream 2, task 7 (`@automata/audio-synth`), 2026-11-11 | To be specced; the table is data with a schema, so a check names a floor whose cue is missing |

## Findings so far (2026-11-11)

- The framework was extracted from The Last Light at its 2026-10-11 commit
  ([extraction map](../archive/superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md)); the game never
  moved onto it. The gaps that remain for the port: the game itself and a converter for its scenes, the horror systems
  (pacing director, crew, grapple, barricade, peek, hiding), the connected facility, faces and acting, the HUD screens
  (journal, map, inventory, objectives, dialer), foley and room acoustics, twelve of its sixteen pipelines, and a
  whole-game playthrough proof. The builders' look and The Last Light's camera are already landing in `@automata/3d`.
- The framework refuses to publish a 3D game to a public host while Pixi 3D is in beta. Private builds are allowed, so
  the port is not blocked; an itch release is, and that is the Owner's.
- FloorFifty's shared layer is in `packages/automata` except the seven items of workstream 1.
- `automata-plus`: all 14 packages exist as extensions under the same names; its starter was cut on 2026-11-07.

## Open, for the Owner

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
- Order: the shared polish first, then the port. Slice 1's plan session starts when workstream 1 reaches execution.
