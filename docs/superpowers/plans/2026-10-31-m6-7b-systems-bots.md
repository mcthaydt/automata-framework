# M6.7b: `systems`, bots, scenarios, fairness and `automata pipe systems` (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.6
  ("Bots, scenarios, fairness"), §4.9, §6, §9, §13 SY-b.
- **Row:** M6.7b in the framework's `docs/02-master-delivery-plan.md`: "`createBot(policy)` drives the sim through
  commands only; `pipe systems playtest`, `fairness` and `sweep` over declared seeds; SY-b". Prerequisites M6.7a
  (automata-plus#24) and M3.8a (the `pipelines` platform, merged). Size M.
- **Branch:** `claude/plus-M6.7b-systems-bots`, stacked on plus#24's branch (`claude/plus-M6-gameplay`); one PR for
  the milestone, merged after plus#24.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `src/game/bots.ts`
  (250 lines), `scripts/pipeline/systems-lib.ts` (548: `play`, `scenario`, `playtest`, `fairness`, `sweep`,
  `claimsCheck`), `scripts/pipeline/systems.ts` (218, the command line), `tests/bots.test.ts` (13) and
  `tests/crew-fairness.test.ts` (9). Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** code written on `claude/plus-M6.7b-systems-bots`; steps 1 to 5 done, step 6 pending.

## Scope

In, under `packages/systems` (build time and tests, Node; nothing here is in a game bundle or the sim entry):
- `createBot(policy, options)`: the `scripted`, `cautious`, `greedy` and `random` policies, answering a `BotView` with
  sim commands only (`puzzle.verb`, `nav.walk-to`, `systems.hide` / `systems.unhide`, and the game's own commands
  through its scene adapter). A bot's choices come from its seed (the sim's `createRng`), never from the sim's RNG.
- `play(scene, options)`: one run of a bot in a real sim, measured the source's way: outcome, deaths with their
  telegraph, the first threat, safe windows, the skeleton of verbs that changed the puzzle, appearances, ambush catches
  and hides.
- `runScenario(scene, scenario)`: a scenario's setup (places, facts, items), its actions as the bot's plan, its
  `expect` checked over its declared seeds 1..N; the probability and its pass (SY-b).
- `claimsCheck`: each puzzle `systemic` is claimed by a scenario that passes.
- `playtest(scene, options)`: every route the scene gives, for each policy and seed.
- `fairness(report, def)`: the source's rows (`cautiousWin`, `firstThreatAfter`, `telegraph`, `maxDeathsPerRun`,
  `safeWindowMargin`, and where the scene sets them `ambushGrace`, `followClear`, `hideRelease`).
- `sweep(scene, tunable, from, to, steps)`: fairness at each value, through the scene's `retune`.
- The `systems` pipeline on M3.8a's platform, so `automata pipe systems run|check <scene folder>` runs the stages
  `scenarios`, `playtest` and `sweep` and checks fairness; registered in `tooling/pipelines`' `REGISTERED`.

Out:
- solver routes: the puzzle solver is M6.6b. Until it lands, a scene's routes are the action lists its adapter gives
  (SB-D1); M6.6b's solver feeds the same `routes` input.
- the emergent search, the traces and the generated systems doc (`systems-render.ts`): not in this row;
- `tests/crew-fairness.test.ts`: it tests the adventure source's ambulance crew (its own `crew.ts`, `facility.ts` and
  the bay and dawn rules), which is that game's code, not the extension's;
- the source's `bots.test.ts` cases for the solver route on the clinic, the trace, the emergent search and the doc
  (listed in Steps with reasons).

## What maps to what

| Adventure source | Here |
|---|---|
| `Command` (`{ x, z, interact, … }`: the source game's input) | sim commands: `nav.walk-to` for a walk, `puzzle.verb` for a hotspot, item, combine or code, `systems.hide` for a hiding place, the adapter's own commands for the rest (a light) |
| `BotView` (the world, Ada's pose, the NPCs, hotspots) | `BotView` read from the sim by the scene adapter: the player's point, `systems.state` agents with their positions, puzzle's hotspots and state, nav's doors |
| `mulberry32(seed)` | `createRng(seed)` from `@mcthaydt/automata-sim` |
| `loadScene(target)` (a scene package's systems, rules, puzzle, routes) | `SystemsScene`, the adapter a game writes: `create()` (a sim with the game's plugins), `load(sim, setup)`, `view(sim)`, `routes`, `retune`, tactics |
| `retune(name, value)` exported by a scene's `rules.ts` | `SystemsScene.retune(def, name, value)`, returning the def with the tunable applied (AF's agents read speeds from content, so a game maps a tunable onto its fields) |
| `scripts/pipeline/systems.ts` commands | the `systems` pipeline's stages and its `check` |

## Interfaces

Consumed: `createSim`, `createRng`, `Sim` (`@mcthaydt/automata-sim`); `createSystems`, `SystemsDef`, `Scenario`,
`Fairness`, `SystemsState`, `SystemsPursuit`, the systems events (`systems/sim`, M6.7a); `VerbCommand`, `PuzzleState`,
`PuzzleDef` (`puzzle/sim`); `WalkTo`, `NavDoors` (`nav/sim`); `definePipeline`, `StageDef`, `CheckResult`
(`@mcthaydt/automata-pipelines`, `tooling/pipelines`).

Produced (in `@mcthaydt/automata-systems`' new `./bots` entry, Node only):

```ts
export type Policy = 'scripted' | 'cautious' | 'random' | 'greedy'
export interface PlanStep { readonly action: string; readonly at: string; readonly held?: string; readonly pair?: readonly [string, string]; readonly code?: string; readonly point?: Point; readonly wait?: number }
export interface BotView { time: number; player: Point; walking: boolean; agents: readonly { id: string; x: number; z: number; mode: string }[]; hotspots: Readonly<Record<string, Point>>; items: readonly string[]; facts: Readonly<Record<string, Value>> }
export interface Bot { readonly policy: Policy; next(view: BotView): readonly Order[]; readonly issued: string[]; done(): boolean; restart(): void }
export function createBot(policy: Policy, options: BotOptions): Bot
export interface SystemsScene { id: string; def: SystemsDef; puzzle: PuzzleDef; routes: readonly Route[]; create(): Promise<Sim>; load(sim: Sim, setup: Setup): void; view(sim: Sim): BotView; retune?(def: SystemsDef, name: string, value: number): SystemsDef; tactics?: Tactics }
export function play(scene: SystemsScene, options: PlayOptions): Promise<RunResult>
export function runScenario(scene: SystemsScene, scenario: Scenario, seeds?: number): Promise<ScenarioResult>
export function claimsCheck(scene: SystemsScene, results: readonly ScenarioResult[]): CheckResult[]
export function playtest(scene: SystemsScene, options?: PlaytestOptions): Promise<Playtest>
export function fairness(report: FairnessInput, f: Fairness, def?: SystemsDef): FairnessRow[]
export function sweep(scene: SystemsScene, tunable: string, from: number, to: number, steps: number, options?: PlaytestOptions): Promise<Sweep>
export const systemsPipeline: PipelineDef<SystemsPipeSpec>   // spec file `systems.pipe.toml`: { scene = "./scene.ts", seeds, policies, [sweep] }
```

- **Time.** A run steps the sim at its `tickHz`; seconds are steps over `tickHz`, so every measure is exact and the same
  in every run (SY-b).
- **Outputs.** `scenarios` writes `reports/scenarios.json`, `playtest` `reports/playtest.json`, `sweep`
  `reports/sweep-<tunable>.json` (when the spec has a `[sweep]` table). `check` reads them and reports each fairness
  row and each claim as a `CheckResult`. Reports are canonical JSON, so a rerun with the same inputs writes the same
  bytes.

## Files

Create, under `packages/systems/`:
- `src/bots/bot.ts` (the four policies), `src/bots/view.ts` (`BotView`, the order helpers), `src/bots/play.ts` (one
  run and its measures), `src/bots/scenario.ts` (`runScenario`, `claimsCheck`), `src/bots/playtest.ts` (`playtest`,
  `sweep`), `src/bots/fairness.ts`, `src/bots/index.ts` (the `./bots` entry). Each under 600 lines.
- `src/pipeline/systems-pipe.schema.ts` (the spec file), `src/pipeline/systems.pipeline.ts`.
- `src/testing/ward-scene.ts`: a `SystemsScene` for the tests, on M6.7a's ward game (the clinic map, a toy puzzle with
  two systemics, the watchman, two routes).
- Tests: `bot.test.ts`, `fairness.test.ts`, `scenario.test.ts`, `playtest.test.ts`, `systems.pipeline.test.ts`.

Modify: `packages/systems/package.json` (the `./bots` entry; `@mcthaydt/automata-pipelines` as a dev dependency),
`tooling/pipelines/src/registry.ts` (register `systemsPipeline`), `tooling/pipelines/package.json`, `pnpm-lock.yaml`.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. Bots, the source's three unit cases, re-pointed:
   - bots answer with sim commands only (a walk is `nav.walk-to`, a hotspot `puzzle.verb`), and type the code at the
     keypad hotspot;
   - the scripted bot holds up the light near an awake agent (the adapter's light command), and the cautious bot also
     stands still while hunted;
   - a bot's choices come from its seed, not the sim (two bots with one seed issue the same verbs on different sims).
   Fails: no `createBot`.
   - [x] 1
2. Fairness maths, the source's four synthetic cases: the pursuit rows over runs and scenarios where the scene sets
   them; a fair report passes; each miss is reported with its number; no threats and no catches are not misses.
   Fails: no `fairness`.
   - [x] 2
3. Scenarios on the ward scene: a scenario's setup is applied (places, facts, items); its actions are the plan; its
   probability over its declared seeds; SY-b (the same result, times and deaths in two runs); `claimsCheck` (each
   systemic claimed by a passing scenario, the source's "every puzzle Systemic is claimed" case). Fails: no
   `runScenario`.
   - [x] 3
4. Playtest and sweep on the ward scene: the scripted bot wins both routes with the watchman on over 3 seeds (the
   source's clinic case, on the ward scene's routes, SB-D1); a run's measures (first threat, telegraph, deaths, the
   skeleton) are exact; `sweep` over a tunable gives a row per value through `retune`, and a scene without `retune`
   cannot be swept (the source's error). Fails: no `playtest`.
   - [x] 4
5. The pipeline: `systems.pipe.toml` parses (an unknown policy and a sweep with fewer than one step fail at their
   path); `run` writes the three reports; a second `run` with the same inputs is cached; `check` reports every fairness
   row and claim, and fails a missed row with its number. Through the platform's router on a temporary target folder.
   Fails: no pipeline.
   - [x] 5
6. Gates, provenance row in the framework, ready line.
   - [ ] 6

Source tests not ported: `bots.test.ts` "a trace renders the run", "a solver route as verbs", "random and greedy bots:
winning skeletons…" and "the generated doc…" (the trace, the emergent search and the doc are out of this row); "the
scripted bot wins the clinic on a solver route" becomes step 4's ward-scene case until M6.6b's solver and the clinic's
hooks exist; `crew-fairness.test.ts` (the source game's crew).

## Gates

- `pnpm exec biome check --write <changed>`, Plus `pnpm check` (lint, typecheck, boundaries, unit).
- `pnpm --filter @mcthaydt/automata-systems test:parity` (M6.7a's golden must not move: nothing here is in the sim).
- No changeset (private).

## Decisions for the Owner's veto

- **SB-D1:** until M6.6b's solver lands, a scene's playtest routes are the action lists its adapter gives; the solver
  feeds the same input later, so this row does not wait for M6.6b.
- **SB-D2:** a game plugs in through a `SystemsScene` adapter (its sim, its setup, its view, its routes, its retune):
  the bots and the pipeline never import a game.
- **SB-D3:** the pipeline's commands are the platform's (`run`, `check`, `status`); `playtest`, `fairness` and `sweep`
  are its stages and its check, so `automata pipe systems run <scene> --from playtest --to playtest` is the source's
  `systems playtest`.
- **SB-D4:** `sweep` retunes through `SystemsScene.retune(def, name, value)`, since AF's converted content holds the
  speeds and radii a tunable produced, not the tunable's formula.
- **SB-D5:** the bots live in a Node-only `./bots` entry of `systems`, not a new package.

## Execution log

- 2026-10-31: plan written from the M6 spec, plus#24 (M6.7a as built) and the adventure source at `92e6704`.
- 2026-10-31, code (on plus#24's branch):
  - Red first: bots (`./index` missing), fairness (`fairness is not a function`), playtest and sweep (`playtest is not
    a function`), the pipeline (`./systems.pipeline.ts` missing). The scenario tests were written before
    `play` and `runScenario` but not run red before them (a slip; they then passed on the first run).
  - Source tests: `bots.test.ts`'s 3 bot cases and 4 fairness cases ported; its "every puzzle Systemic is claimed"
    case is `scenario.test.ts`'s claim check; "the scripted bot wins … over 3 seeds" runs on the ward scene's route
    (SB-D1). Not ported, as planned: the trace, the emergent search, the doc, and `crew-fairness.test.ts`.
  - Gates: Plus `pnpm check` exit 0 (boundaries 97 files, 0 findings; systems 59, pipelines 144 unit tests);
    systems `test:parity` 3 passed, M6.7a's golden unchanged (the ward game's run extras are opt-in).
  - Deviations (for veto with SB-D1 to SB-D5):
    - **The pipeline lives in `tooling/pipelines/src/systems.pipeline.ts`**, beside the registry, not in
      `packages/systems/src/pipeline/`: the platform is tooling, and the package keeps no tooling or core-node
      dependency. `tooling/pipelines` depends on `@mcthaydt/automata-systems`.
    - **SB-D6:** the pipeline imports the bots when a stage runs, not when the registry loads, so the bins (run on
      Node's type stripping, which does not resolve the extension's extensionless sources) still start. A run of
      `automata pipe systems` from the bin needs TypeScript resolution for the extension and the game's scene module
      (the converters' `.ts` resolve hook, or a built Plus); the platform reports a module that cannot load as a failed
      stage. The tests run the pipeline through the router under Vitest. `PIPE_POLICIES` repeats the bots' list for
      the spec schema, and a test keeps the two equal.
    - The scene module must be inside the scene folder (the platform's path policy refuses absolute and `..` paths).
    - A run's condition is checked by `createWatch` (`systems/sim`), a plugin a run adds in `cleanup`, so a scenario
      asks the systems' own probes, derived facts included.
    - A catch reloads the last `puzzle.checkpoint` snapshot (or the start); the catching agent is the nearest agent in
      a threat mode, since `systems.caught` names a cause, not an agent.
    - The safe-window margin is not measured (no scene adapter times a window yet); its row says so and passes, as
      the source's did for the clinic.
    - The ward game gained opt-in run extras (a puzzle, a walking player, extra plugins); its defaults are unchanged.
    - `tooling/pipelines`' `mcp-cli.test.ts` pinned an empty registry; it now expects `systems`.
