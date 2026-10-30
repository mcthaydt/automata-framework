import type { Files } from '@mcthaydt/automata-node'
import { Cause, Effect, Exit, Option, type Scope } from 'effect'
import { budgetRefusal, type Units } from './budget.ts'
import { EXIT } from './exit.ts'
import type { CheckResult, PipelineDef, StageDef, StageServices } from './pipeline.ts'
import { charge, holdLedger, loadProject, type Project, readSpent } from './project.ts'
import {
  contextOf,
  costOf,
  decision,
  hashOf,
  holds,
  isCurrent,
  isFinished,
  loadRunState,
  missingOf,
  now,
  pathsOf,
  type ResultParts,
  type RunState,
  rel,
  resultOf,
  type Stop,
  save,
  stop,
} from './run-state.ts'
import { missingPaths, resolveIn, StageThrew } from './stage-cache.ts'
import type { GateRecord, PipelineResult, StageRecord, StageState } from './state.schema.ts'

// The stage runner (The Last Light's scripts/pipeline/runner.ts at 92e6704, on Effect). Files are the state:
// `.stage.json` and `gates.json` in the target folder. A stage is skipped when its input hash is unchanged and its
// outputs exist; once one runs, every later one does. A gate stops the run (exit 3) until a person approves it.
// Paid stages need --paid and must fit the run and project budgets, checked before anything runs (exit 4).

export const COMMANDS: readonly Command[] = [
  'status',
  'estimate',
  'run',
  'approve',
  'reject',
  'restore',
  'check',
  'adopt',
  'request',
]
export type Command =
  | 'status'
  | 'estimate'
  | 'run'
  | 'approve'
  | 'reject'
  | 'restore'
  | 'check'
  | 'adopt'
  | 'request'

export interface RunOptions {
  readonly command: Command
  /** The spec file, or the folder holding it. */
  readonly target: string
  readonly gate?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly only?: readonly string[] | undefined
  readonly force?: boolean | undefined
  /** Lets paid stages run. */
  readonly paid?: boolean | undefined
  /** Per-run caps below `pipeline.toml`'s (`--budget images=2`). */
  readonly budget?: Units | undefined
  readonly note?: string | undefined
  /** `pipeline.toml`, when it is not at or above the target folder. */
  readonly config?: string | undefined
}

interface Step {
  readonly stage: StageDef
  readonly digest: string | null
}
interface Done {
  readonly exit: PipelineResult['exit']
  readonly parts?: ResultParts
}

const ok = (parts: ResultParts = {}): Done => ({ exit: EXIT.done, parts })
const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
const asStop = (error: string | { readonly message: string }): Stop =>
  stop(EXIT.failed, typeof error === 'string' ? error : error.message)

/** The selection: `--only`, or `--from` to `--to`, in pipeline order. */
const selected = (run: RunState, options: RunOptions): Effect.Effect<readonly StageDef[], Stop> => {
  const stages = run.def.stages
  const ids = stages.map((stage) => stage.id)
  for (const id of [...(options.only ?? []), options.from, options.to])
    if (id !== undefined && !ids.includes(id))
      return Effect.fail(stop(EXIT.failed, `unknown stage '${id}'; stages: ${ids.join(', ')}`))
  if (options.only !== undefined && options.only.length > 0)
    return Effect.succeed(stages.filter((stage) => options.only?.includes(stage.id)))
  const start = options.from === undefined ? 0 : ids.indexOf(options.from)
  const end = options.to === undefined ? ids.length - 1 : ids.indexOf(options.to)
  return Effect.succeed(stages.slice(start, end + 1))
}

/**
 * A gated stage that is not approved, not selected, and before the last selected stage blocks the selection: with
 * --from it is before the first one, and with --only it can sit between two selected stages. Nothing runs past a
 * pending gate. (A selected gated stage is the plan's: it may run again, and the plan stops at it.)
 */
const blockingGate = (run: RunState, selection: readonly StageDef[]): StageDef | undefined => {
  const last = selection.at(-1)
  const end = last === undefined ? 0 : run.def.stages.indexOf(last)
  return run.def.stages.slice(0, end).find((stage) => !selection.includes(stage) && holds(run, stage))
}

/**
 * The stages a run would execute, conservatively: once one runs, every later one does too. Stops after a gated stage
 * that runs (its gate opens) and at a gated stage that is not approved.
 */
const plan = (
  run: RunState,
  selection: readonly StageDef[],
  force: boolean,
): Effect.Effect<Step[], Stop, Files> =>
  Effect.gen(function* () {
    const todo: Step[] = []
    let cascade = false
    for (const stage of selection) {
      const digest = yield* hashOf(run, stage)
      const rejected = stage.gate !== undefined && decision(run, stage.gate) === 'rejected'
      if (force || cascade || rejected || !(yield* isCurrent(run, stage, digest))) {
        todo.push({ stage, digest })
        cascade = true
        if (stage.gate !== undefined) break
      } else if (holds(run, stage)) break
    }
    return todo
  })

const producedBy = (run: RunState, stage: StageDef): string[] =>
  [...pathsOf(run, stage, 'outputs'), ...pathsOf(run, stage, 'restorable')].map((path) => rel(run, path))

/** Opens the stage's gate as pending; what to look at is what the stage made. */
const openGate = (run: RunState, stage: StageDef, gate: string): void => {
  run.gates[gate] = { id: gate, stage: stage.id, decision: 'pending', files: producedBy(run, stage) }
}

const recordOf = (
  run: RunState,
  stage: StageDef,
  state: 'done' | 'adopted',
  digest: string | null,
  at: string,
): StageRecord => ({
  id: stage.id,
  state,
  inputHash: digest ?? 'missing',
  outputs: producedBy(run, stage),
  at,
})

const status = (run: RunState): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const stale: string[] = []
    const needsRestore: string[] = []
    for (const stage of run.def.stages) {
      if (run.records[stage.id] === undefined) continue
      if (isFinished(run, stage) && run.records[stage.id]?.inputHash !== (yield* hashOf(run, stage)))
        stale.push(stage.id)
      if ((yield* missingOf(run, stage, 'restorable')).length > 0) needsRestore.push(stage.id)
    }
    return ok({ data: { stale, needsRestore } })
  })

const estimate = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const selection = yield* selected(run, options)
    const blocked = blockingGate(run, selection)
    const todo = blocked === undefined ? yield* plan(run, selection, options.force === true) : []
    const steps = todo.map(({ stage, digest }) => ({
      id: stage.id,
      inputHash: digest ?? 'missing',
      paid: stage.cost !== undefined,
      cost: costOf([stage]),
      ...(stage.gate === undefined ? {} : { gate: stage.gate }),
    }))
    const states = Object.fromEntries(todo.map(({ stage }): [string, StageState] => [stage.id, 'pending']))
    return ok({
      states,
      estimate: costOf(todo.map(({ stage }) => stage)),
      data: { plan: steps, blockedBy: blocked?.gate ?? null },
    })
  })

/**
 * Refuses a run whose paid stages lack --paid or pass a budget, before any stage runs. A run with paid stages holds
 * the spend ledger from here until the run's scope closes, so two runs cannot both spend what is left.
 */
const checkBudgets = (
  run: RunState,
  options: RunOptions,
  paid: readonly StageDef[],
): Effect.Effect<Project, Stop, Files | Scope.Scope> =>
  Effect.gen(function* () {
    if (paid.length > 0 && options.paid !== true)
      return yield* Effect.fail(
        stop(EXIT.refused, `paid stages need --paid: ${paid.map((stage) => stage.id).join(', ')}`),
      )
    const project = yield* Effect.mapError(loadProject(run.dir, options.config), asStop)
    if (paid.length === 0) return project
    // Without a pipeline.toml there is no budget and no ledger: the check below refuses.
    if (project.path !== undefined)
      yield* Effect.mapError(holdLedger(project), (error) => stop(EXIT.refused, error))
    const need = costOf(paid)
    const spent = yield* Effect.mapError(readSpent(project), asStop)
    const refusal = budgetRefusal(need, project.toml, spent, options.budget)
    if (refusal !== undefined) return yield* Effect.fail(stop(EXIT.refused, refusal, { estimate: need }))
    return project
  })

const runStages = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> =>
  Effect.scoped(runHeld(run, options))

const runHeld = (
  run: RunState,
  options: RunOptions,
): Effect.Effect<Done, Stop, StageServices | Scope.Scope> =>
  Effect.gen(function* () {
    const selection = yield* selected(run, options)
    const blocked = blockingGate(run, selection)
    if (blocked?.gate !== undefined)
      return yield* Effect.fail(
        stop(
          EXIT.atGate,
          `gate ${blocked.gate} (stage ${blocked.id}) is ${decision(run, blocked.gate) ?? 'not requested'}; ` +
            `a person approves it with \`automata-pipe ${run.def.name} approve ${run.target} ${blocked.gate}\``,
        ),
      )
    const todo = yield* plan(run, selection, options.force === true)
    const project = yield* checkBudgets(
      run,
      options,
      todo.filter(({ stage }) => stage.cost !== undefined).map(({ stage }) => stage),
    )

    const planned = new Set(todo.map(({ stage }) => stage.id))
    const states: Record<string, StageState> = {}
    for (const stage of selection) {
      const current = !planned.has(stage.id) && (yield* isCurrent(run, stage, yield* hashOf(run, stage)))
      states[stage.id] = current ? 'skipped' : 'pending'
    }
    const restorable = new Set(run.def.stages.flatMap((stage) => pathsOf(run, stage, 'restorable')))
    const fail = (stage: StageDef, digest: string | null, why: string, at: string) =>
      Effect.gen(function* () {
        run.records[stage.id] = {
          id: stage.id,
          state: 'failed',
          inputHash: digest ?? 'missing',
          outputs: [],
          at,
          notes: why.slice(0, 500),
        }
        yield* save(run)
        states[stage.id] = 'failed'
        return yield* Effect.fail(stop(EXIT.failed, `${stage.id}: ${why}`, { states }))
      })

    for (const { stage } of todo) {
      const inputs = pathsOf(run, stage, 'inputs')
      const missing = yield* missingPaths(run.dir, inputs)
      if (missing.length > 0) {
        states[stage.id] = 'failed'
        const hint = missing.some((path) => restorable.has(path)) ? ' (run `restore` first)' : ''
        const names = missing.map((path) => rel(run, path)).join(', ')
        return yield* Effect.fail(
          stop(EXIT.failed, `${stage.id}: missing inputs ${names}${hint}`, { states }),
        )
      }
      // Hashed again: an earlier stage of this run may have rewritten the inputs.
      const digest = yield* hashOf(run, stage)
      if (stage.cost !== undefined) {
        // Checked again under the ledger lock, right before the charge.
        const { budget, units } = stage.cost
        const spent = yield* Effect.mapError(readSpent(project), asStop)
        const refusal = budgetRefusal({ [budget]: units }, project.toml, spent, options.budget)
        if (refusal !== undefined) return yield* Effect.fail(stop(EXIT.refused, refusal, { states }))
        yield* Effect.mapError(charge(project, budget, units), asStop)
      }
      // A throw in the stage (in `run` itself, inside its effect, or in `outputs`) is a failed stage, not a crash.
      const attempt = Effect.suspend(() => stage.run(contextOf(run, stage))).pipe(
        Effect.mapError((error) => error.message),
        Effect.flatMap((result) =>
          Effect.map(missingOf(run, stage, 'outputs'), (unwritten) => ({ result, unwritten })),
        ),
        Effect.catchAllDefect((defect) =>
          Effect.fail(defect instanceof StageThrew ? defect.reason : messageOf(defect)),
        ),
      )
      const outcome = yield* Effect.either(attempt)
      const at = yield* now
      if (outcome._tag === 'Left') return yield* fail(stage, digest, outcome.left, at)
      const { result, unwritten } = outcome.right
      if (unwritten.length > 0)
        return yield* fail(stage, digest, `did not write its outputs: ${unwritten.join(', ')}`, at)
      run.records[stage.id] = {
        ...recordOf(run, stage, 'done', digest, at),
        ...(stage.cost === undefined ? {} : { cost: costOf([stage]) }),
        ...(result.notes === undefined ? {} : { notes: result.notes }),
        ...(result.tasks === undefined ? {} : { tasks: { ...result.tasks } }),
      }
      states[stage.id] = 'done'
      if (stage.gate !== undefined) openGate(run, stage, stage.gate)
      yield* save(run)
      if (stage.gate !== undefined) {
        states[stage.id] = 'gated'
        return { exit: EXIT.atGate, parts: { states } }
      }
    }
    // A skipped gated stage that is not approved stops the run there (the plan stopped at it).
    for (const stage of selection) {
      if (stage.gate === undefined || planned.has(stage.id) || !holds(run, stage)) continue
      states[stage.id] = 'gated'
      const why = `gate ${stage.gate} is ${decision(run, stage.gate) ?? 'not requested'}`
      return { exit: EXIT.atGate, parts: { states, error: why } }
    }
    return ok({ states })
  })

const gateFor = (run: RunState, options: RunOptions): Effect.Effect<GateRecord, Stop> => {
  if (options.gate === undefined) return Effect.fail(stop(EXIT.failed, `${options.command} needs a gate`))
  const record = run.gates[options.gate]
  return record === undefined
    ? Effect.fail(stop(EXIT.failed, `no gate '${options.gate}' for this target`))
    : Effect.succeed(record)
}

/** approve / reject: a person's decision. Only records: a rejected gate's stage runs again on the next `run`. */
const decide = (
  run: RunState,
  options: RunOptions,
  verdict: 'approved' | 'rejected',
): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const record = yield* gateFor(run, options)
    const decided: GateRecord = {
      ...record,
      decision: verdict,
      decidedAt: yield* now,
      by: 'owner',
      ...(options.note === undefined ? {} : { note: options.note }),
    }
    run.gates[record.id] = decided
    yield* save(run)
    return ok({ gates: [decided] })
  })

/** Marks a pending gate as put to a person, with `--note` as the summary. Decides nothing. */
const request = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const record = yield* gateFor(run, options)
    const requested: GateRecord = {
      ...record,
      requestedAt: yield* now,
      ...(options.note === undefined ? {} : { summary: options.note }),
    }
    run.gates[record.id] = requested
    yield* save(run)
    return ok({ gates: [requested] })
  })

/** Marks stages whose outputs all exist as adopted, without running anything (no network, no spend). */
const adopt = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const states: Record<string, StageState> = {}
    const at = yield* now
    for (const stage of yield* selected(run, options)) {
      const produced = [...pathsOf(run, stage, 'outputs'), ...pathsOf(run, stage, 'restorable')]
      if (isFinished(run, stage) || produced.length === 0) continue
      if ((yield* missingPaths(run.dir, produced)).length > 0) continue
      run.records[stage.id] = recordOf(run, stage, 'adopted', yield* hashOf(run, stage), at)
      states[stage.id] = 'adopted'
      if (stage.gate !== undefined && run.gates[stage.gate] === undefined) openGate(run, stage, stage.gate)
    }
    yield* save(run)
    return ok({ states })
  })

/** Brings back each finished stage's missing restorable outputs from its recorded task ids, without paying. */
const restore = (run: RunState): Effect.Effect<Done, Stop, StageServices> =>
  Effect.gen(function* () {
    if (!run.def.stages.some((stage) => stage.restore !== undefined))
      return yield* Effect.fail(stop(EXIT.notImplemented, `${run.def.name} has no restore`))
    const restored: string[] = []
    for (const stage of run.def.stages) {
      if (stage.restore === undefined || !isFinished(run, stage)) continue
      if ((yield* missingOf(run, stage, 'restorable')).length === 0) continue
      yield* Effect.mapError(stage.restore(contextOf(run, stage)), (error) =>
        stop(EXIT.failed, `${stage.id}: ${error.message}`),
      )
      restored.push(stage.id)
    }
    return ok({ data: { restored } })
  })

/** The pipeline's own checks, then every finished stage's recorded outputs (restorable ones live outside Git). */
const check = (run: RunState): Effect.Effect<Done, Stop, StageServices> =>
  Effect.gen(function* () {
    const checks: CheckResult[] =
      run.def.check === undefined ? [] : [...(yield* Effect.mapError(run.def.check(contextOf(run)), asStop))]
    for (const stage of run.def.stages) {
      const record = run.records[stage.id]
      if (record === undefined || !isFinished(run, stage)) continue
      const exempt = new Set(pathsOf(run, stage, 'restorable'))
      const recorded = record.outputs
        .map((path) => resolveIn(run.dir, path))
        .filter((path) => !exempt.has(path))
      const missing = (yield* missingPaths(run.dir, recorded)).map((path) => rel(run, path))
      const detail = missing.length > 0 ? `missing ${missing.join(', ')}` : 'present'
      checks.push({ id: `outputs:${stage.id}`, ok: missing.length === 0, detail })
    }
    const failed = checks.filter((found) => !found.ok).map((found) => found.id)
    if (failed.length === 0) return ok({ data: { checks } })
    return { exit: EXIT.failed, parts: { data: { checks }, error: `failed: ${failed.join(', ')}` } }
  })

/** Every stage's declared paths, checked once (they must stay inside the target folder); a throw is a defect. */
const checkPaths = (run: RunState): Effect.Effect<void> =>
  Effect.sync(() => {
    for (const stage of run.def.stages)
      for (const kind of ['inputs', 'outputs', 'restorable'] as const) pathsOf(run, stage, kind)
  })

const execute = (state: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> => {
  const recordsOnly = ['approve', 'reject', 'request'].includes(options.command)
  return recordsOnly ? dispatch(state, options) : Effect.zipRight(checkPaths(state), dispatch(state, options))
}

const dispatch = (state: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> => {
  switch (options.command) {
    case 'status':
      return status(state)
    case 'estimate':
      return estimate(state, options)
    case 'run':
      return runStages(state, options)
    case 'approve':
      return decide(state, options, 'approved')
    case 'reject':
      return decide(state, options, 'rejected')
    case 'request':
      return request(state, options)
    case 'adopt':
      return adopt(state, options)
    case 'restore':
      return restore(state)
    case 'check':
      return check(state)
  }
}

/** Runs one command on one target and returns its result. It never fails: every problem is an exit code. */
export const runPipeline = (
  def: PipelineDef,
  options: RunOptions,
): Effect.Effect<PipelineResult, never, StageServices> =>
  Effect.gen(function* () {
    const { command, target } = options
    const loaded = yield* Effect.either(
      Effect.catchAllDefect(loadRunState(def, target), (defect) =>
        Effect.fail(stop(EXIT.failed, messageOf(defect))),
      ),
    )
    if (loaded._tag === 'Left')
      return resultOf(def, undefined, command, target, loaded.left.exit, { error: loaded.left.error })
    const state = loaded.right
    const outcome = yield* Effect.exit(execute(state, options))
    if (Exit.isSuccess(outcome))
      return resultOf(def, state, command, target, outcome.value.exit, outcome.value.parts)
    const failure = Cause.failureOption(outcome.cause)
    if (Option.isSome(failure)) {
      const { exit, error, estimate: need, states } = failure.value
      return resultOf(def, state, command, target, exit, { error, estimate: need, states })
    }
    // A defect: a stage method threw outside its run (paths, params), or a bug. Exit 1, never a crash; a stage that
    // threw during `run` is recorded as failed.
    const defect = Cause.squash(outcome.cause)
    if (defect instanceof StageThrew && command === 'run') {
      state.records[defect.stage] = {
        id: defect.stage,
        state: 'failed',
        inputHash: 'missing',
        outputs: [],
        at: yield* now,
        notes: defect.reason.slice(0, 500),
      }
      yield* Effect.either(save(state))
      const states = { [defect.stage]: 'failed' as const }
      return resultOf(def, state, command, target, EXIT.failed, { error: defect.message, states })
    }
    return resultOf(def, state, command, target, EXIT.failed, { error: messageOf(defect) })
  })
