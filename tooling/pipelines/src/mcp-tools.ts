import { realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { Files } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import { z } from 'zod'
import type { Units } from './budget.ts'
import { type EstimatedPlan, type EstimateTokens, TOKEN_TTL_MS } from './estimate-token.ts'
import { EXIT, type PipelineExit } from './exit.ts'
import type { PipelineDef, StageServices } from './pipeline.ts'
import { loadProject, readSpent } from './project.ts'
import { type Answer, type Asker, requestReview } from './review.ts'
import { type RunOptions, runPipeline } from './runner.ts'
import type { PipelineResult } from './state.schema.ts'

// The pipelines MCP server's tools (The Last Light's scripts/mcp/tools.ts and contracts.ts at 92e6704, the platform
// tools only): each validates its input with Zod and runs one runner command in-process (plan D2). There is no tool
// that approves or rejects: pipeline_request_review asks the person. The server (mcp-server.ts) lists them, calls
// them and writes the audit line.

export type ToolName =
  | 'pipeline_list'
  | 'pipeline_status'
  | 'pipeline_estimate'
  | 'pipeline_run'
  | 'pipeline_check'
  | 'pipeline_request_review'
  | 'pipeline_review_status'

export const TOOL_NAMES: readonly ToolName[] = [
  'pipeline_list',
  'pipeline_status',
  'pipeline_estimate',
  'pipeline_run',
  'pipeline_check',
  'pipeline_request_review',
  'pipeline_review_status',
]

/** What every tool can reach. */
export interface ToolContext {
  /** The project root: every target stays inside it. */
  readonly root: string
  /** The root with its symbolic links resolved. */
  readonly realRoot: string
  readonly pipelines: readonly PipelineDef[]
  readonly planned: readonly string[]
  readonly tokens: EstimateTokens
  readonly asker: Asker
}

export interface Tool {
  readonly name: ToolName
  readonly description: string
  readonly input: z.ZodObject
  readonly handle: (
    ctx: ToolContext,
    input: Record<string, unknown>,
  ) => Effect.Effect<Answer, never, StageServices>
}

/** A refusal or failure before the runner answers: the same shape as a result's failure fields. */
export const refusal = (exit: PipelineExit, error: string): Answer => ({
  exit,
  data: { ok: false, exit, error },
  summary: error,
})

/** A runner result as a tool's answer: the target shown as the tool was given it, relative to the root. */
const answerOf = (result: PipelineResult, rel: string, extra: Record<string, unknown> = {}): Answer => ({
  exit: result.exit,
  data: { ...result, target: rel, ...extra },
  summary: `${result.pipeline} ${result.command} ${rel}: exit ${result.exit}${
    result.error === undefined ? '' : `: ${result.error}`
  }`,
})

interface Located {
  readonly def: PipelineDef
  readonly abs: string
  readonly rel: string
}

/** Whether `path` is `root` or below it. `..` or `../…` leaves the root; a name like `..toy` does not. */
const within = (root: string, path: string): boolean => {
  const rel = relative(root, path)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/** The registered pipeline and the target inside the root, or the refusal. */
const locate = (ctx: ToolContext, pipeline: string, target: string): Effect.Effect<Located, Answer, Files> =>
  Effect.gen(function* () {
    const def = ctx.pipelines.find((candidate) => candidate.name === pipeline)
    if (def === undefined)
      return yield* Effect.fail(refusal(EXIT.notImplemented, `${pipeline}: not implemented`))
    const outside = refusal(EXIT.refused, `refused: target ${target} is outside the project`)
    const abs = resolve(ctx.root, target)
    if (!within(ctx.root, abs)) return yield* Effect.fail(outside)
    if (!(yield* (yield* Files).exists(abs)))
      return yield* Effect.fail(refusal(EXIT.failed, `target ${target} does not exist`))
    // The lexical check above is not enough: a symbolic link inside the root can point outside it. Core's `Files` has
    // no realpath, so `node:fs` resolves both (the root's once, when the server starts).
    if (!within(ctx.realRoot, realpathSync(abs))) return yield* Effect.fail(outside)
    return { def, abs, rel: relative(ctx.root, abs).split(sep).join('/') }
  })

/** Runs a tool body that needs a located target; a refusal from `locate` is the answer. */
const withTarget = (
  ctx: ToolContext,
  input: Record<string, unknown>,
  body: (located: Located) => Effect.Effect<Answer, never, StageServices>,
): Effect.Effect<Answer, never, StageServices> =>
  Effect.flatMap(Effect.either(locate(ctx, input.pipeline as string, input.target as string)), (located) =>
    located._tag === 'Left' ? Effect.succeed(located.left) : body(located.right),
  )

const selectionOf = (input: Record<string, unknown>): Pick<RunOptions, 'from' | 'to' | 'only' | 'force'> => ({
  from: input.from as string | undefined,
  to: input.to as string | undefined,
  only: input.only as string[] | undefined,
  force: input.force as boolean | undefined,
})

interface PlanRow {
  readonly id: string
  readonly inputHash: string
  readonly paid: boolean
}
const planOf = (result: PipelineResult): readonly PlanRow[] =>
  (result.data as { plan?: PlanRow[] } | undefined)?.plan ?? []

const estimatedPlan = (pipeline: string, rel: string, rows: readonly PlanRow[]): EstimatedPlan => ({
  pipeline,
  target: rel,
  stages: rows.map((row) => row.id),
  inputHashes: rows.map((row) => row.inputHash),
})

/** The project's spend ledger now (empty when there is none or it cannot be read: the runner reports that). */
const ledger = (abs: string): Effect.Effect<Units, never, Files> =>
  Effect.orElseSucceed(
    Effect.flatMap(loadProject(abs), (project) => readSpent(project)),
    () => ({}),
  )

/** What the ledger grew by: the call's cost (plan D6). */
const grown = (before: Units, after: Units): Units => {
  const cost: Record<string, number> = {}
  for (const [key, units] of Object.entries(after)) {
    const delta = units - (before[key] ?? 0)
    if (delta > 0) cost[key] = delta
  }
  return cost
}

/** One gate's record from the target's status. */
const gateStatus = (located: Located, gate: string): Effect.Effect<Answer, never, StageServices> =>
  Effect.map(runPipeline(located.def, { command: 'status', target: located.abs }), (status) => {
    if (status.exit !== EXIT.done) return refusal(status.exit, status.error ?? `exit ${status.exit}`)
    const record = status.gates.find((candidate) => candidate.id === gate)
    if (record === undefined) return refusal(EXIT.failed, `no gate '${gate}' for this target`)
    return { exit: EXIT.done, data: record, summary: `${gate}: ${record.decision}` }
  })

/** The tools, for the pipeline names the server serves (registered and planned). */
export function toolsFor(names: readonly string[]): readonly Tool[] {
  const pipeline = names.length === 0 ? z.never() : z.enum(names as [string, ...string[]])
  const target = z
    .string()
    .min(1)
    .describe('the target folder (or its spec file), relative to the project root')
  const selection = {
    from: z.string().min(1).optional().describe('the first stage'),
    to: z.string().min(1).optional().describe('the last stage'),
    only: z.array(z.string().min(1)).optional().describe('only these stages'),
    force: z.boolean().optional().describe('run the stages again even if unchanged'),
  }
  const gate = z.string().min(1).describe('the gate, as the status lists it')
  const simple = (command: 'status' | 'check') => (ctx: ToolContext, input: Record<string, unknown>) =>
    withTarget(ctx, input, (located) =>
      Effect.map(runPipeline(located.def, { command, target: located.abs }), (result) =>
        answerOf(result, located.rel),
      ),
    )

  return [
    {
      name: 'pipeline_list',
      description:
        'The pipelines this project has, their stages (gates and paid budget keys), and the planned ones.',
      input: z.object({}).strict(),
      handle: (ctx) =>
        Effect.succeed({
          exit: EXIT.done,
          data: {
            pipelines: ctx.pipelines.map((def) => ({
              name: def.name,
              stages: def.stages.map((stage) => ({
                id: stage.id,
                ...(stage.gate === undefined ? {} : { gate: stage.gate }),
                ...(stage.cost === undefined ? {} : { cost: stage.cost }),
              })),
            })),
            planned: ctx.planned.filter((name) => !ctx.pipelines.some((def) => def.name === name)),
          },
          summary: `${ctx.pipelines.length} pipelines`,
        }),
    },
    {
      name: 'pipeline_status',
      description: "A target's stage states, gates and spend, and its stale and needs-restore stages.",
      input: z.object({ pipeline, target }).strict(),
      handle: simple('status'),
    },
    {
      name: 'pipeline_estimate',
      description:
        'What the next run would execute and cost (units per budget key), and the token pipeline_run needs for paid ' +
        `stages: valid ${TOKEN_TTL_MS / 60_000} minutes, for the same stages and inputs.`,
      input: z.object({ pipeline, target, ...selection }).strict(),
      handle: (ctx, input) =>
        withTarget(ctx, input, (located) =>
          Effect.gen(function* () {
            const result = yield* runPipeline(located.def, {
              command: 'estimate',
              target: located.abs,
              ...selectionOf(input),
            })
            if (result.exit !== EXIT.done) return answerOf(result, located.rel)
            const token = yield* ctx.tokens.issue(
              estimatedPlan(located.def.name, located.rel, planOf(result)),
            )
            return answerOf(result, located.rel, { token, expiresInMinutes: TOKEN_TTL_MS / 60_000 })
          }),
        ),
    },
    {
      name: 'pipeline_run',
      description:
        'Runs the stages up to the next gate. Paid stages need the token of a matching pipeline_estimate and must fit ' +
        "the project's run and project budgets.",
      input: z.object({ pipeline, target, token: z.string().min(1).optional(), ...selection }).strict(),
      handle: (ctx, input) =>
        withTarget(ctx, input, (located) =>
          Effect.gen(function* () {
            const selected = selectionOf(input)
            const estimate = yield* runPipeline(located.def, {
              command: 'estimate',
              target: located.abs,
              ...selected,
            })
            if (estimate.exit !== EXIT.done) return answerOf(estimate, located.rel)
            const rows = planOf(estimate)
            const paid = rows.filter((row) => row.paid).map((row) => row.id)
            if (paid.length > 0) {
              const plan = estimatedPlan(located.def.name, located.rel, rows)
              const why = yield* ctx.tokens.refusal(input.token as string | undefined, plan, paid)
              if (why !== undefined) return refusal(EXIT.refused, why)
            }
            const before = yield* ledger(located.abs)
            // The runner plans again; given the checked plan, it refuses a run whose stages or paid inputs differ.
            const result = yield* runPipeline(located.def, {
              command: 'run',
              target: located.abs,
              ...selected,
              paid: paid.length > 0,
              ...(paid.length > 0 ? { plan: rows.map(({ id, inputHash }) => ({ id, inputHash })) } : {}),
            })
            const cost = grown(before, yield* ledger(located.abs))
            return { ...answerOf(result, located.rel), ...(Object.keys(cost).length > 0 ? { cost } : {}) }
          }),
        ),
    },
    {
      name: 'pipeline_check',
      description: "The pipeline's own checks for a target, and every finished stage's recorded outputs.",
      input: z.object({ pipeline, target }).strict(),
      handle: simple('check'),
    },
    {
      name: 'pipeline_request_review',
      description:
        'Puts a pending gate to the person. When the client supports elicitation the person answers in a form and ' +
        'their decision is recorded; otherwise the answer names the command the person runs. No tool approves.',
      input: z.object({ pipeline, target, gate }).strict(),
      handle: (ctx, input) =>
        withTarget(ctx, input, (located) =>
          requestReview(located.def, located, input.gate as string, ctx.asker),
        ),
    },
    {
      name: 'pipeline_review_status',
      description: "A gate's record: pending, or the person's decision with its time and note.",
      input: z.object({ pipeline, target, gate }).strict(),
      handle: (ctx, input) => withTarget(ctx, input, (located) => gateStatus(located, input.gate as string)),
    },
  ]
}
