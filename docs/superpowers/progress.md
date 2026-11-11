# Progress: The Last Light on the framework

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
| 1 | Shared polish from FloorFifty (seven items and their examples) | 2, plan: written 2026-11-11 and revised for the Owner's amendments; next is 3, the plan audit | 29% (2 of 7 stages); execution 0 of 20 tasks | [spec](specs/2026-11-11-shared-polish-design.md), [plan](plans/2026-11-11-shared-polish.md) |
| 2 | The Last Light on the framework, one scene at a time (the prologue first) | 1, spec: drafted 2026-11-11, its six calls open to the Owner. Slice 1's plan session starts when workstream 1 reaches execution | 3% | [spec](specs/2026-11-11-last-light-on-the-framework-design.md) |

## Workstream 1 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11. The Owner said to begin ("begin with adding in Missing from the framework ... then do A"), so the stages run without waiting; the six calls stay open to correction |
| 2. Plan | Fable 5.2, medium (`session_01HNdX7HfQXxQqDGztKzgibK`) | `claude/shared-polish-plan` | Done 2026-11-11: 20 tasks with a tracking table, 15 calls named in the plan; revised the same day for the Owner's amendments (nothing copied from FloorFifty, no review state, fonts cover every language, `Hosting.openLink`). No product code written and no test run (this stage writes the plan only) |
| Merge | One long-lived session (`session_01HNdX7LEALEpFdpPWLXPuy7`) | none of its own | Started 2026-11-11; merged the spec as #608 (`6fa386e9`) |

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
- Order: the shared polish first, then the port. Slice 1's plan session starts when workstream 1 reaches execution.
