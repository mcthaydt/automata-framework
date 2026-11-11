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
| 1 | Shared polish from FloorFifty (seven items and their examples) | 2, plan: written 2026-11-11; next is 3, the plan audit | 29% (2 of 7 stages); execution 0 of 18 tasks | [spec](specs/2026-11-11-shared-polish-design.md), [plan](plans/2026-11-11-shared-polish.md) |
| 2 | The Last Light on the framework, one scene at a time (the prologue first) | 1, spec: the coordinator writes it while workstream 1 runs | 0% | |

## Workstream 1 sessions

| Stage | Session | Branch | State |
|---|---|---|---|
| 1. Spec | The coordinator (`session_01HNdX7JDtQV1qVssEcnsxHM`) | `claude/optimistic-newton-yszrte` | Done 2026-11-11. The Owner said to begin ("begin with adding in Missing from the framework ... then do A"), so the stages run without waiting; the six calls stay open to correction |
| 2. Plan | Fable 5.2, medium | `claude/shared-polish-plan` | Done 2026-11-11: 18 tasks with a tracking table, 15 calls named in the plan. No product code written and no test run (this stage writes the plan only). FloorFifty read at `677d456` |
| Merge | One long-lived session | none of its own | Started 2026-11-11 |

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
- FloorFifty's review ledger covers `es-419` only (342 of 364 strings). Its other four languages have no ledger, so
  the plan takes their text and records it unreviewed.
- `automata-plus`: all 14 packages exist as extensions under the same names; its starter was cut on 2026-11-07.

## Open, for the Owner

- Emberwick's font (Pixelify Sans) has no Japanese, Korean or Chinese. The plan lets those menus use the device's fonts
  and adds no font files; the other choice is to ship Noto subsets through `content/fonts.toml` (plan, call 13).
- Three calls the plan made where the code lacked what the spec assumed, for the coordinator and the plan audit to
  check: credits links go to the game's own handler because `Hosting` has no link call (call 11); the stale-build
  check compares the `GameVersion` on a new `GET /version` because the ship step has no build stamp (call 12); the
  warning's switches are passed in by the game because core has no reduced-motion switch (call 5).

- Correct any of workstream 1's six calls (the work proceeds meanwhile).
- Is `mcthaydt/automata-website` retired in favour of the framework's `site/`?
