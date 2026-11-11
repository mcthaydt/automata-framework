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
| 2 | The Last Light, the framework's 3D reference game, one scene at a time (the prologue first) | Slice 1: 2, plan: done 2026-11-11, revised the same day for the re-set spec (a survey of the prologue against the framework, the spec's slice 1 row corrected, and a plan of 22 tasks, all in this repository, on three branches: 10 framework additions, 10 for the game at `games/the-last-light`, 2 that remove Ember Hall; planned against the spec at `3c0a624f`). Next is 3, plan audit. Slices 2 to 4 not started | Slice 1: 29% (2 of 7 stages); execution 0 of 22 tasks | [spec](specs/2026-11-11-last-light-on-the-framework-design.md), [survey](audits/2026-11-11-last-light-prologue-survey.md), [plan](plans/2026-11-11-last-light-prologue.md) |
| 3 | A UI editor in the suite | Not started: the Owner will address it when we get to it; its spec is written with the Owner then | 0% | |
| 4 | The builders' look and figures in the framework (takes over #588, #589, #590, #603, #607) | 2, plan: done 2026-11-11. A survey measured on `main` `6a70f9b1` (12 side-by-side sheets with their numbers, the causes of the two dark examples, every work package and figure piece marked, the five drafts read, merged with `main` on trial and checked step by step) and a plan of 17 tasks on five branches. The baked room on `main` draws at 0.29 to 0.50 of the builder's brightness; the fix exists in #590 and sits on #589's code, so #589 lands first. Next is 3, plan audit. Runs ahead of the prologue's dressing task | 29% (2 of 7 stages); execution 0 of 17 tasks | [spec](specs/2026-11-11-builders-look-and-figures-design.md), [survey](audits/2026-11-11-builders-look-survey.md), [plan](plans/2026-11-11-builders-look.md) |

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
| 3. Plan audit | Not started | | |

## Workstream 4 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11; the Owner said yes to taking the work over |
| 2. Plan | Fable 5.2 (`session_01HNdX7HoZvLRU1gqFba7bf7`) | `claude/builders-look-plan` | Done 2026-11-11, no subagents. Ran: both builders' own renders (EnvironmentBuilder `f7c5356`, FigureBuilder `23f889c`), the framework's frames on `main` in Chromium on software WebGL, the 3D examples' build, each step of `pnpm check` on `main` and on each draft merged with `main`, trial merges and cherry-picks in scratch worktrees. `main` itself fails `style` and `source-names` on documents under `docs/superpowers/` (not this workstream's). No product code written; no hash or golden touched. Not run: WebGPU, WebKit, Firefox, the browser suites and journeys. The plan names ten calls for the coordinator |
| 3. Plan audit | Not started | | |

## Workstream 3: what the Owner has said so far (2026-11-11)

No UI editor was ever planned: the 2026-10-30 suite spec put "a UI composer" out of scope and the HUD-pieces idea was
cut on 2026-11-08, so every HUD is code today. The Owner wants one. It should let a person change by hand where things
sit on screen, how they look, what they show, and make whole new screens; and it should also be able to change the
screens that come by default, such as the main menu and the splash. Details are settled when the work comes up.
Until then, a HUD screen the port needs (journal, map, inventory, objectives, dialer) is built so that an editor can
take it over later: its layout and words as data, not buried in code.

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
- Order: the shared polish first, then the port. Slice 1's plan session starts when workstream 1 reaches execution.
