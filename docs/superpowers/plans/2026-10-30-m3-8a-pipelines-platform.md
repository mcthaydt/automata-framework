# M3.8a: `pipelines` platform part 1 (router, runner, stage cache, budgets, gates), TDD plan

- **Spec:** the framework's M3 spec (`docs/superpowers/specs/2026-10-16-m3-25d-pipelines-design.md`) §4.8 (the
  platform: `PipelineExit`, `PipelineDef`, `StageDef`, `definePipeline`, router, stage cache, budgets, gates, the
  Effect rule), §5 (the pipeline run flow), §6 (the budget, paid-call and `approve` rows), §13 PL-a and PL-b. The
  revised M3 spec (`2026-10-18-m3-3d-characters-design.md`) §4.6 leaves the platform unchanged.
- **Row:** M3.8a in the framework's `docs/02-master-delivery-plan.md`: "`pipelines` platform (Plus) part 1: router,
  runner, stage cache, budgets, gates."
- **Branch:** `claude/plus-M3.8a-pipelines-platform`.
- **Sources (read only):** The Last Light (`PixiJS3D_Experiment_001`) at
  `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `scripts/pipe.mjs` (158 lines; the router, its commands and exit
  codes), `scripts/pipeline/runner.ts` (533; the TypeScript runner), `scripts/pipeline/contracts.ts` (117; the JSON
  result, stage and gate records, the config), `scripts/pipeline/_toy.ts` (the toy pipeline the runner tests drive),
  `pipeline.config.json` (budgets, generated, locked), `tests/pipeline-runner.test.ts` (248) and
  `tests/pipeline.test.ts` (185). The generic behaviour is ported as behaviour specs; nothing is copied unchanged
  (the source is synchronous `node:fs` with sha256, this is Effect on `Files` with XXH64).
- **Status:** implemented and checked locally (`pnpm check` green); Plus CI on the Mac pending; Owner review of D1 to D7
  pending.

## Scope

In: `tooling/pipelines`, the workspace package `@mcthaydt/automata-pipelines` (private, 0.0.0,
`SEE LICENSE IN LICENSE`): `definePipeline`, `PipelineDef`, `StageDef`, the runner (the commands `status`,
`estimate`, `run`, `approve`, `reject`, `restore`, `check`, `adopt`, `request`), the XXH64 stage cache, the
`pipeline.toml` schema and the budgets, gates, exit codes 0 to 4, and the bin `automata-pipe`
(`automata-pipe <pipeline> <command> <target> [gate] [--json]`). PL-a and PL-b on a fake `node:http` server.

Out (later rows): the MCP server, `pipeline_request_review`, elicitation and the audit log (M3.8b); the rule that
refuses `approve` and `reject` from an agent (M3.8b; here they are the people's router commands); the guard, its
validators and the `PreToolUse` hook (M3.8c; the `generated` and `locked` tables of `pipeline.toml` are parsed here
and enforced there); the character and props pipelines (M3.9). The framework's `automata pipe` subcommand is not in
this repository: the framework CLI delegates to this bin later (its own row), so the bin is the router's one entry.

## Files

- `pnpm-workspace.yaml`: `tooling/*` joins the workspace. Root `tsconfig.json` and `vitest.config.ts` exclude
  `tooling/pipelines`, which typechecks and tests itself through `pnpm -r` (no double run).
- `tooling/pipelines/package.json` (`bin.automata-pipe: ./src/cli.ts`; `effect` 3.22.2, `zod` 4.6.6 and `smol-toml`
  1.9.0, the TOML parser core's `content` and `ship` already pin; core under `peerDependencies` and
  `devDependencies` only), `tsconfig.json`, `vitest.config.ts`.
- `src/exit.ts`: `PipelineExit`, `EXIT`.
- `src/pipeline.ts`: `PipelineDef`, `StageDef`, `StageContext`, `StageResult`, `StageFailed`, `StageError`,
  `definePipeline` (refuses duplicate stage ids, duplicate gates and a cost that is not a positive integer).
- `src/state.schema.ts`: `.stage.json`, `gates.json` and `pipeline-spend.json` (Zod, strict), `PipelineResult` (the
  `--json` object).
- `src/pipeline-toml.schema.ts`: `pipelineTomlSchema` (`[budget.<key>] project, run`; `generated`; `[locked]`).
- `src/stage-cache.ts`: `inputHash`, `outputsMissing`.
- `src/budget.ts`: `budgetRefusal(need, caps, spent)`, `parseBudgetOption`.
- `src/project.ts`: finds `pipeline.toml` (walking up from the target, or `--config`), loads it, reads and charges
  the spend ledger.
- `src/run-state.ts`: one command's view of a target (spec, `.stage.json`, `gates.json`), the cache checks, the result.
- `src/runner.ts`: `runPipeline(def, options)`, the commands, `COMMANDS`.
- `src/router.ts`: `parseArgs`, `route(argv, registry)`; `src/cli.ts` (the bin); `src/index.ts`.
- `src/testing/fake-api.ts`: the fake paid API (a `node:http` server on port 0, counting requests), `src/testing/toy.ts`
  (the toy pipeline, the source's `_toy.ts` made generic).
- Tests: `src/pipeline.test.ts`, `src/pipeline-toml.schema.test.ts`, `src/stage-cache.test.ts`, `src/budget.test.ts`,
  `src/runner.test.ts`, `src/router.test.ts`, `src/cli.test.ts`, `src/acceptance.test.ts` (PL-a, PL-b).

## Interfaces

```ts
export type PipelineExit = 0 | 1 | 2 | 3 | 4 // done · failed · not implemented · at a gate · refused
export const EXIT: { done: 0; failed: 1; notImplemented: 2; atGate: 3; refused: 4 }
export type BudgetKey = string                // a key of pipeline.toml's [budget]: images, meshyCredits, visionCalls
export interface StageContext<Spec> { dir: string; specPath: string; spec: Spec; tasks: Readonly<Record<string, string>> }
export interface StageResult { notes?: string; tasks?: Record<string, string> }
export type StageError = StageFailed | FileError | ProcessError
export interface StageDef<Spec = unknown> {
  readonly id: string
  readonly cost?: { readonly budget: BudgetKey; readonly units: number } // paid stages only
  readonly gate?: string                                                  // stops the run until a person approves
  inputs?(ctx): readonly string[]       // relative to the target folder, or absolute; folders count as their files
  outputs?(ctx): readonly string[]      // must exist for the stage to count as done
  restorable?(ctx): readonly string[]   // outside Git, brought back by restore; never re-runs the stage
  params?(ctx): unknown                 // hashed with the inputs (canonical JSON)
  run(ctx): Effect.Effect<StageResult, StageError, Files | ProcessRunner>
  restore?(ctx): Effect.Effect<void, StageError, Files | ProcessRunner> // re-downloads from ctx.tasks, free
}
export interface PipelineDef<Spec = unknown> {
  readonly name: string; readonly spec: z.ZodType<Spec>; readonly specFile?: string; readonly stages: readonly StageDef<Spec>[]
  check?(ctx): Effect.Effect<readonly CheckResult[], StageError, Files | ProcessRunner>
}
export function definePipeline<Spec>(def: PipelineDef<Spec>): PipelineDef<Spec>
export function runPipeline(def, options: RunOptions): Effect.Effect<PipelineResult, never, Files | ProcessRunner>
export function route(argv: readonly string[], registry: Registry): Effect.Effect<RouterOutput, never, Files | ProcessRunner>
// RouterOutput { exit: PipelineExit; stdout: string; stderr: string }; with --json, stdout is one JSON line
```

Stage members are methods, so a `PipelineDef<CharacterSpec>` is a `PipelineDef` in the router's registry.

Runner semantics (the source's, except where D-rows below say otherwise):

1. The target is the spec file, or a folder holding `specFile` (default `<name>.toml`; `.json` also parses). Every
   command first parses it with `def.spec`; a missing or invalid spec is exit 1 and writes nothing.
2. State is files in the target folder: `.stage.json` (stage id → `{ id, state, inputHash, outputs, at, cost?,
   notes?, tasks? }`) and `gates.json` (gate → `{ id, stage, decision, files, summary?, note?, requestedAt?,
   decidedAt?, by? }`). Times come from Effect's `Clock`.
3. **Cache:** a stage is current when its record is `done` or `adopted`, its input hash is unchanged and its outputs
   exist. The hash is XXH64 (`@mcthaydt/automata-sim/hash`) over each input file's path and content hash plus the
   canonical JSON of its params; a missing required input makes it unrunnable ("missing inputs", exit 1, with a
   `restore` hint when the input is a restorable output).
4. **Plan:** stages of the selection (`--from`, `--to`, `--only`) in order; once one re-runs (stale, `--force`, or
   its gate rejected), every later one does. The plan stops after a gated stage that runs, and at a gated stage that
   is not approved. A gate before the selection that is not approved blocks it (exit 3), even with `--from`.
5. **Budgets:** the plan's paid stages need `--paid`; their units are summed per key and checked before anything runs
   against the run cap (`pipeline.toml`'s `run`, lowered by `--budget key=N`) and the project cap (`project` minus
   the ledger). A paid key with no budget, or any cap passed, is exit 4 with the estimate, and nothing runs.
6. **Gates:** a gated stage that finishes opens its gate `pending` (the review files are its outputs) and the run
   exits 3. `approve` and `reject` record the decision (`by: 'owner'`, `--note`); a rejected gate's stage runs again
   on the next `run`, which opens the gate again. `request` records that a pending gate was put to a person
   (`requestedAt`, `--note` as the summary) and decides nothing.
7. `estimate` prints the plan (id, input hash, paid, cost, gate) and the summed cost; `status` adds the stale and
   needs-restore stages; `adopt` marks stages whose outputs exist as adopted without running them (gates open
   pending); `restore` calls `restore` on each recorded stage that has one (exit 2 when none do); `check` runs
   `def.check` and checks every done stage's recorded outputs.
8. A stage that fails (its effect fails) is recorded `failed` and the run exits 1 with its message.

Router: `automata-pipe <pipeline> <command> <target> [gate] [options] [--json]`, options `--from S`, `--to S`,
`--only S[,S]`, `--force`, `--paid`, `--budget k=N[,k=N]`, `--note "…"`, `--config path`. Unknown pipeline, command or
option: exit 1. A reserved pipeline that is not built yet (`character`, `props` until M3.9): exit 2. `--help` (or no
arguments) lists the pipelines and commands, exit 0. It never prompts (stdin is never read). With `--json` stdout is
exactly one JSON object, the result, whatever the exit; human lines go to stderr.

## Decisions for the Owner's review (defaults in effect; each can be vetoed)

- **D1, every gate holds.** The source lets a gate pass on its own when no paid stage follows it. The spec's gates
  stop the run until a person approves, and X-a has the Owner approving G6 (install, the last stage), so every gate
  holds here.
- **D2, the project budget has a ledger.** The source checks only the run budget. The spec checks both, so the runner
  keeps `pipeline-spend.json` beside `pipeline.toml` (budget key → units). A paid stage's units are charged before
  the stage runs, so a call that fails after the provider charged still counts (fail closed). The game commits it.
- **D3, paid stages need `--paid`** (the source's G-3), so a plain `run` never spends; M3.8b's MCP tool passes it after
  an estimate.
- **D4, `PipelineDef.specFile`** (default `<name>.toml`), and `StageDef` declares `inputs`, `outputs`, `restorable`,
  `params` and `restore` beside the spec's `id`, `cost`, `gate` and `run`: the spec says each stage declares its
  inputs and outputs, and the cache and `restore` need them. `cost` stays the spec's one budget key per stage.
- **D5, a paid key with no budget in `pipeline.toml` is refused** (exit 4), as the source does.
- **D6, imports keep the `.ts` suffix.** Node runs the bin from source (as it runs `tooling/core/cli.ts`), and Node's
  type stripping does not resolve extensionless imports; the package sets `allowImportingTsExtensions` and
  `erasableSyntaxOnly`.
- **D7, binary inputs (a request to core).** `Files` reads text only, so an input is hashed from its UTF-8 decoding,
  and two binary files that differ only in invalid UTF-8 bytes would hash the same. Text inputs are exact. Before
  M3.9's image stages, core's `Files` needs `readBytes` (a framework request); the stage cache then hashes bytes.

## Ported and dropped source cases

From `tests/pipeline-runner.test.ts` (the toy pipeline, run in-process instead of as a subprocess):

| Source case | Here |
|---|---|
| stops at a gate with exit 3 and a pending gate record | ported (`runner.test.ts`); the hash is 16 hex digits (XXH64) |
| skips unchanged stages, re-runs on a change, and redoes with `--force` | ported |
| re-runs when a parameter changes (the gate returns to pending) | ported |
| blocks everything downstream of a pending gate, even with `--from` | ported |
| continues after the owner approves, then skips everything (spent, tasks) | ported |
| re-runs a rejected gate's stage and asks again; unknown gate exit 1; a changed mind | ported |
| refuses paid stages without `--paid`, and over budget (exit 4), spending nothing | ported; PL-a extends it |
| estimates the stages a run would execute, with their input hashes | ported |
| fails a stage that writes outside its declared outputs (path policy G-9) | **dropped**: `Files` has no stat or mtime to snapshot with; whether the guard (M3.8c) takes the rule is its row's decision |
| records a failing stage and exits 1 | ported |
| adopts existing outputs without running anything | ported, and asserted on the fake server (no request) |
| reports status and runs its checks; `restore` without one is exit 2 | ported |
| does not require an output the stage now declares optional | **dropped**: no `optional` outputs (no consumer yet) |
| CLI: lists every pipeline and its commands | ported generically (`--help` lists the registry) |
| CLI: prints the character status as one JSON object | **dropped** (game-specific; M3.9); the one-object rule is ported on the toy |
| CLI: knows the clinic baseline | **dropped** (game-specific) |
| CLI: exits 2 for pipelines that do not exist yet | ported (`character`, `props`) |
| CLI: routes with the target and gate in place; finds the folder of a pending gate | routing ported; finding the gate's folder by walking the repository **dropped**: the target is required |
| the Porter adopts with the network blocked | **dropped** (game-specific; adopt's "no request" is asserted on the fake server) |

From `tests/pipeline.test.ts` (props, reference, UI and scene pipelines): only two generic behaviours are ported, "a
spec that does not parse fails every command and writes nothing" and "an estimate covers the next run only: nothing
while a gate is pending, then the stages up to the next gate". The rest (props crops, reference variants, UI
directions, scene visibility and scaffold) is game-specific and **dropped**.

Dropped router features: `--list` (its repository walk), `--no-vision`, the passthrough `export` and `import`
pipelines, toy `_name` pipelines, Python routing (`lang: 'py'`; M3.9 runs Python stages through `ProcessRunner`).

## Tests, written first

1. **Definition** (`pipeline.test.ts`): `definePipeline` returns the def; refuses a duplicate stage id, a duplicate
   gate and a cost of 0, -1 or 1.5.
2. **`pipeline.toml`** (`pipeline-toml.schema.test.ts`): a full file parses (budgets, generated, locked); defaults
   for a missing `generated` and `locked`; refuses an unknown top-level key, a negative or fractional budget, a run
   cap above the project cap.
3. **Cache** (`stage-cache.test.ts`, on `FilesLive` in a temp folder): the hash is 16 hex digits and stable; changes
   with an input's content, an input's name and the params (key order does not matter); a folder input counts its
   files; a missing required input gives `null`; equals XXH64 of the documented string.
4. **Budgets** (`budget.test.ts`): within both caps passes; one unit over the run cap, or over the project cap after
   the ledger, refuses naming the key and both numbers; a key with no budget refuses; `--budget` lowers but never
   raises a cap; a bad `--budget` part is an error.
5. **Runner** (`runner.test.ts`, the toy pipeline, `TestClock`): every ported case above, plus `request`, the
   invalid spec, the estimate-covers-the-next-run case, and `restore` calling a stage's `restore` with its recorded
   tasks.
6. **Router** (`router.test.ts`): `--json` prints one JSON line on every path (done, gate, failure, unknown pipeline,
   not implemented, bad option); exit codes 0 to 4; target as a folder or as the spec file; the gate positional for
   `approve`; `--help`.
7. **Bin** (`cli.test.ts`): `node src/cli.ts` with stdin closed: `--help` exit 0; a reserved pipeline exit 2 with one
   JSON object.
8. **PL-a, PL-b** (`acceptance.test.ts`, the fake server): PL-a: `estimate` prints each stage's cost and the total;
   `run` with the run budget one unit short exits 4 with zero requests on the server, and again with the project
   budget one unit short of the ledger plus the need. PL-b: the run stops at the first gate after one paid call;
   after `approve`, the next run skips the cached stages and makes only the next paid call (through `ProcessRunner`
   running Node's `fetch`), stops at the next gate; a run while that gate is pending, and the run after its
   approval, make no further calls.

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, the root tooling tests with F1, and every package's unit
tests through `pnpm -r`). No browser project: nothing here renders. Pending: the Plus CI run on the Mac.

## As built (deviations)

- `pnpm-workspace.yaml` lists `tooling/*`; `tooling/boundary`, `ci` and `core` have no `package.json`, so the
  workspace gains only `tooling/pipelines`. The root `tsconfig.json` excludes `tooling/pipelines` and the root
  `vitest.config.ts` excludes `tooling/pipelines/**` (root tests stay 157, the package's 74 run once through `pnpm -r`).
- The F1 test and the manifest rules scan `packages/` only. The package follows both by hand (core under
  `peerDependencies` and `devDependencies`; imports `@mcthaydt/automata-node` and `@mcthaydt/automata-sim/hash`, both
  public entries; `manifestProblems` returns nothing for its manifest). Extending both scans to `tooling/*` packages
  is a follow-up for review, not done here.
- Zod runs an object refinement even when a field already failed, so the "run above project" rule only compares two
  valid caps (one issue per mistake).
- A spec file ending `.json` is parsed as JSON, anything else as TOML.
- `check` reads the outputs a stage recorded, minus the ones the stage now declares restorable.
- A stage with nothing declared to produce is never adopted (the source adopted a stage with no outputs).
- The bin registers no pipeline yet: `character` and `props` are `PLANNED` (exit 2) until M3.9 registers them.

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | this file, committed alone |
| 2026-10-30 | Definition (test 1) | 8 cases red (`definePipeline is not a function`), then green |
| 2026-10-30 | `pipeline.toml` (test 2) | 6 red against an empty module; then 1 failure: a negative project cap also tripped the run-above-project refinement (two issues); the refinement now compares valid caps only and the test asserts each message; 6 of 6 |
| 2026-10-30 | Cache (test 3) | 6 red (`inputHash is not a function`), then green |
| 2026-10-30 | Budgets (test 4) | 13 red, then green |
| 2026-10-30 | Runner (test 5) | 21 red (`runPipeline is not a function`); then 1 failure in the test itself (`fail` is not a hashed param, so the ledger case forces the stage); 21 of 21 |
| 2026-10-30 | Router (test 6) | 14 red (`route is not a function`), then green |
| 2026-10-30 | Bin (test 7) | 3 red against an empty `cli.ts`, then green; Node runs `src/cli.ts` with no warning on stderr |
| 2026-10-30 | PL-a, PL-b (test 8) | written after the runner, so their failure was shown by mutation: with the budget refusal disabled both PL-a cases fail (requests reach the fake server); with the cache disabled PL-b fails; restored, 3 of 3 |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint (81 files), typecheck (root, physics, pipelines), boundaries 19 files 0 findings, root 157 tests (F1 included), pipelines 74, physics 71 |
| 2026-10-30 | Integration | The F1 boundary test now scans each `tooling/*` workspace package (a folder with its own package.json) as well as `packages/`, test-first (the new case was red); `tooling/pipelines` passes it. The manifest rules still read `packages/*` only (follow-up) |
