# M6.6b: `puzzle`, the solver and `automata pipe puzzle` (TDD plan)

- **Spec:** the framework's M6 spec (`docs/superpowers/specs/2026-10-16-m6-gameplay-extensions-design.md`): §4.5
  ("Solver and tools"), §4.9, §6, §9, §13 P-c (solver) and P-d (softlock).
- **Row:** M6.6b in the framework's `docs/02-master-delivery-plan.md`: "The solver, softlock search, hints, matrix,
  doc, audit and validate, run as `automata pipe puzzle` on M3.8's platform; P-c (solver), P-d (softlock)".
  Prerequisites M6.6a (plus#22, merged) and M3.8a (merged). Size L. The route-test generator is M6.6c.
- **Branch:** `claude/plus-M6.6b-puzzle-solver`, from main; one PR for the milestone.
- **Source (read-only):** the adventure source at `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`:
  `src/game/puzzle-solver.ts` (386 lines), `scripts/pipeline/puzzle-lib.ts` (462), `scripts/pipeline/puzzle.ts`
  (235, the command line), the clinic's `src/scenes/clinic/puzzle-model.ts` (68), and the tests
  `tests/puzzle-solver.test.ts` (8), `puzzle-pipeline.test.ts` (7), `puzzle-audit.test.ts` (7) and
  `clinic-puzzle.test.ts` (3). Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted.

## Scope

In, under `packages/puzzle` (build time and tests, Node; nothing here is in a game bundle or the sim entry):
- `createSolver(def, model)`: the source's search over facts, items (a multiset) and systemic set-ups, the verbs as a
  player makes them (a hotspot with an item or a bare hand, a floor use, a combine, a code), resolved by the
  interpreter's own rule (puzzle's `match`, so the solver and the sim never disagree); the shortest solution by
  seconds, the alternatives (each step of the shortest banned in turn), the distinct key-sets, the declared key checks
  (`keys`), and the state cap;
- the softlock search (reachable states with no way to the goal), the lethal-hint check (every lethal rule hinted
  before its risk, on every route), the item × hotspot matrix, the route budget (action seconds plus walking);
- `validate(scene)`: the source's static checks (duplicate ids, missing lines, unknown hotspots, items and facts,
  hidden actions, a model naming unknown actions) as findings;
- `analyse`, `routesOf`, `lockGraph` and the generated doc (`renderDoc`), stamped with its sources' XXH64 hashes;
- the `PuzzleScene` adapter a game writes (its def, its solver model, its hotspots and spawn, its line keys, a walk
  measure, its source files).

In, under `tooling/pipelines`: the `puzzle` pipeline on M3.8a's platform: a scene folder's `puzzle.pipe.toml` names
the scene module; stages `analyse` (writes `reports/puzzle.json`), `doc` (writes `puzzle.md`, generated) and `audit`
(writes `reports/audit.json` and `audit.md`, joining the puzzle with the systems playtest when the scene module also
exports a `SystemsScene`); `check` fails on a validate error, an unsolvable puzzle, a softlock (naming the locking
route, P-d), a late hint, a failed key check and a stale doc. Registered beside `systems`.

Out:
- the route-test generator, the 16 routes and the staleness check of generated tests (M6.6c);
- `puzzle help` (the scene's `help.ts`: three hints per puzzle, three clues per deduction): the row names `hints`,
  which is the lethal-hint check; help is a narrative concern (M6.8);
- the MCP tools of the source's puzzle pipeline: M3.8b's generic pipeline tools serve the `puzzle` pipeline;
- the bin's TypeScript resolve hook (SB-D6, M6.7b's follow-up): this pipeline loads its scene module the same lazy
  way, and a CLI run waits on that follow-up.

## What maps to what

| Adventure source | Here |
|---|---|
| `src/game/puzzle-solver.ts` | `packages/puzzle/src/solver/solver.ts`, `softlocks.ts`, `matrix.ts` (each under 600 lines) |
| the solver's own `match` (it re-implements the interpreter's rule) | puzzle's `match` and `holds` from `./sim`, with `held` and `code` as virtual facts through a `Reader` |
| `PuzzleScene` (`loadScene` from a scene package) | the `PuzzleScene` adapter a game writes |
| `walk(from, to)` (nav over the level, every door open) | the adapter's `walk`, which a game builds from nav's `route` |
| `stamp` (sha256 of each source) | XXH64 (`@mcthaydt/automata-sim/hash`) of each source, as the spec asks |
| `docs/design/<id>-puzzle.md` | `puzzle.md` in the scene folder (the platform's outputs stay inside the target) |
| `npm run pipe -- puzzle <command>` | `automata pipe puzzle run|check <scene folder>` |
| `CLINIC_MODEL` | `src/testing/clinic-model.ts`, ported by hand (its calls are TypeScript), recorded in provenance |

## Interfaces

Produced (`@mcthaydt/automata-puzzle/solver`, Node only):

```ts
export interface State { facts: Record<string, Value>; items: string[]; seen: string[] }
export interface Step { action: string; at: string; held?: string; pair?: [string, string]; code?: string; systemic?: boolean }
export interface PuzzleModel { /* the source's: facts, calls, effects, require, after, available, systemic, seconds, pure, cap, keys */ }
export interface Solution { entry: string; steps: Step[]; seconds: number }
export interface SolveResult { solvable: boolean; states: number; capped: boolean; shortest: Solution | null; alternatives: { banned: string; solution: Solution | null }[]; keySets: string[][] }
export function createSolver(def: PuzzleDef, model?: PuzzleModel): Solver   // solve, softlocks, keys, hints, reachable
export function matrix(def: PuzzleDef): Matrix
export function budget(solution: Solution, walk: Walk, speed?: number, keypad?: string): number
export interface PuzzleScene { id: string; def: PuzzleDef; model: PuzzleModel; hotspots: Readonly<Record<string, Point>>; spawn: Point; lines: readonly string[]; walk: Walk; sources: readonly { path: string; hash: string }[] }
export function validate(scene: PuzzleScene): Finding[]
export function analyse(scene: PuzzleScene, options?: { entry?: string; softlocks?: boolean }): Analysis
export function routesOf(result: SolveResult): Route[]
export function lockGraph(scene: PuzzleScene, routes: readonly Route[]): LockGraph
export function renderDoc(scene: PuzzleScene, analysis: Analysis): string
```

`tooling/pipelines`: `puzzlePipeline: PipelineDef<PuzzlePipeSpec>` (spec file `puzzle.pipe.toml`: `scene`, optional
`entry`), and `auditPuzzle(scene, analysis, systems?)` for the audit stage.

## Files

Create, under `packages/puzzle/`: `src/solver/{solver,softlocks,matrix,budget,validate,analyse,lock-graph,doc,scene,index}.ts`,
`src/testing/clinic-model.ts`, and the tests `solver.test.ts`, `softlocks.test.ts`, `validate.test.ts`,
`analyse.test.ts`, `doc.test.ts`, `clinic-solver.test.ts`.
Create, under `tooling/pipelines/src/`: `puzzle.pipeline.ts`, `puzzle-audit.ts`, `puzzle.pipeline.test.ts`,
`puzzle-audit.test.ts`.
Modify: `packages/puzzle/package.json` (the `./solver` entry), `tooling/pipelines/src/registry.ts`,
`tooling/pipelines/package.json`, `tooling/pipelines/src/mcp-cli.test.ts` (the registry it pins), `pnpm-lock.yaml`.

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. The solver on toy puzzles (the source's five toy cases): a softlock (the only key used up in the wrong lock); both
   keys to one lock and that neither alone is necessary; a lethal rule hinted after its risk; walking time at 3 m/s
   added to the action seconds; the item × hotspot matrix. Plus: the solver picks the action the interpreter picks
   (the first in content order) for the same state and verb. Fails: no `createSolver`.
   - [ ] 1
2. The clinic (P-c, the source's three clinic cases on the converted clinic and the ported model): solvable with
   every key to the code and the water; no softlocks, and every lethal rule hinted before its risk; within the design
   budget. Fails: no clinic model.
   - [ ] 2
3. `validate` (the source's two cases and `clinic-puzzle.test.ts`'s three, on the converted scenes): a sound puzzle
   passes; duplicate ids, missing lines, unknown hotspots, items and facts and hidden actions are each found; the
   clinic's ids are unique, its lines and hotspots exist, and its goal, systemics and lethal entries name real
   actions. Fails: no `validate`.
   - [ ] 3
4. `analyse`, the lock graph and the doc (the source's two cases): the lock graph from the routes; the same doc every
   time, stamped with its sources' hashes, with every section. Fails: no `renderDoc`.
   - [ ] 4
5. The pipeline and the audit: `puzzle.pipe.toml` parses; `run` writes the report, the doc and the audit, and a second
   run is cached; `check` passes the clinic; a puzzle with a softlock fails `check` naming the locking route (P-d); a
   doc edited by hand fails `check` as stale. The audit: the source's generic cases (the earliest first threat on each
   route; fairness misses, early threats, routes a bot never wins and where the deaths are; dead actions, softlocks
   and failing scenarios listed first; a scene with no systems has only puzzle findings; a stamped report with every
   section). Fails: no pipeline.
   - [ ] 5
6. Gates, provenance rows in the framework (with M6.7b's held row), ready line.
   - [ ] 6

Source tests not ported: `puzzle-pipeline.test.ts`'s `npcPolicy` cases and "one simulation test per route" (the route
tests, M6.6c); `puzzle-audit.test.ts`'s "a file with the same values in another shape is a note" and "objective
guidance evidence" (the source's generated-file and objective tooling, which AF does not have); `puzzle-help.test.ts`
(help, M6.8); `puzzle-mcp.test.ts` (M3.8b's generic tools).

## Gates

- `pnpm exec biome check --write <changed>`, Plus `pnpm check` (lint, typecheck, boundaries, unit).
- `pnpm --filter @mcthaydt/automata-puzzle test:parity` (the golden `cd73a8d0b545c212` must not move: nothing here is
  in the sim).
- No changeset (private).

## Decisions for the Owner's veto

- **PZ-D1:** the solver resolves a verb with puzzle's own `match` (the interpreter's rule), not a second copy, so the
  solver and the sim cannot disagree on which action a verb takes.
- **PZ-D2:** a game plugs in through a `PuzzleScene` adapter (def, model, hotspots, spawn, line keys, walk, sources);
  the solver and the pipeline never import a game.
- **PZ-D3:** the audit lives in the pipeline (tooling), since it joins `puzzle` and `systems`, and `systems` already
  depends on `puzzle`.
- **PZ-D4:** the generated doc is `puzzle.md` in the scene folder, stamped with XXH64 hashes of its sources (the spec's
  hash), since the platform keeps outputs inside the target folder.
- **PZ-D5:** the solver lives in a Node-only `./solver` entry of `puzzle`, not a new package.
- **PZ-D6:** the clinic's solver model is ported by hand as a test fixture (its calls are TypeScript, not data).

## Follow-ups

- The bin's TypeScript resolve hook (M6.7b's SB-D6), so `automata pipe puzzle` and `automata pipe systems` run from the
  command line.
- M6.6c: the route-test generator, which takes this row's routes.

## Execution log

- 2026-10-31: plan written from the M6 spec, plus#22 (puzzle as built), plus#25 (M6.7b) and the adventure source at
  `92e6704`.
