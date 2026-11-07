// The `systems` pipeline (M6 spec §4.6, M6.7b): a scene folder's `systems.pipe.toml` names the game's scene module
// (it exports `scene`, a `SystemsScene`). `run` plays the scene's scenarios, its routes and, with a `[sweep]` table, a
// sweep, and writes each report as canonical JSON; `check` rates the reports by the scene's fairness and claims
// (SB-D3: the source's `systems playtest|fairness|sweep` are these stages and this check). Free: no stage is paid.
// The bots load when a stage runs, not when the registry does (SB-D6): the bins run on Node's type stripping, which
// does not resolve the extension's extensionless sources, and a scene module is the game's TypeScript.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { canonicalJson } from '@automata/sim'
import type { Playtest, Policy, ScenarioResult, SystemsScene } from '@automata/systems/bots'
import { Effect } from 'effect'
import { z } from 'zod'
import { Files } from './node-seams.ts'
import {
  type CheckResult,
  definePipeline,
  type PipelineDef,
  type StageContext,
  StageFailed,
} from './pipeline.ts'

export interface SystemsPipeSpec {
  /** The scene module, relative to the scene folder and inside it (the platform's path policy). */
  readonly scene: string
  /** Seeds per route and policy (default 2). */
  readonly seeds?: number | undefined
  readonly policies?: readonly Policy[] | undefined
  /** Seconds a route's run may take (default 120). */
  readonly limit?: number | undefined
  readonly sweep?:
    | { readonly tunable: string; readonly from: number; readonly to: number; readonly steps: number }
    | undefined
}
/** The bots' policies (`POLICIES` in `@automata/systems/bots`; a test keeps the two equal). */
export const PIPE_POLICIES: readonly Policy[] = ['scripted', 'cautious', 'random', 'greedy']
export const systemsPipeSpec: z.ZodType<SystemsPipeSpec> = z.strictObject({
  scene: z.string().min(1),
  seeds: z.number().int().min(1).optional(),
  policies: z.array(z.enum(PIPE_POLICIES as [Policy, ...Policy[]])).optional(),
  limit: z.number().positive().optional(),
  sweep: z
    .strictObject({ tunable: z.string(), from: z.number(), to: z.number(), steps: z.number().int().min(1) })
    .optional(),
})

const SCENARIOS = 'reports/scenarios.json'
const PLAYTEST = 'reports/playtest.json'
const SWEEP = 'reports/sweep.json'

type Ctx = StageContext<SystemsPipeSpec>
const modulePath = (ctx: Ctx): string => join(ctx.dir, ctx.spec.scene)

const bots = (stage: string) =>
  Effect.tryPromise({
    try: () => import('@automata/systems/bots'),
    catch: (cause) => new StageFailed({ stage, reason: `the systems bots: ${String(cause)}` }),
  })
const loadScene = (ctx: Ctx, stage: string) =>
  Effect.tryPromise({
    try: async () => {
      const loaded = (await import(pathToFileURL(modulePath(ctx)).href)) as { scene?: SystemsScene }
      if (loaded.scene === undefined) throw new Error(`${ctx.spec.scene} exports no scene`)
      return loaded.scene
    },
    catch: (cause) => new StageFailed({ stage, reason: `the scene module: ${String(cause)}` }),
  })
const work = <A>(stage: string, f: () => Promise<A>) =>
  Effect.tryPromise({ try: f, catch: (cause) => new StageFailed({ stage, reason: String(cause) }) })
const write = (ctx: Ctx, file: string, value: unknown) =>
  Effect.flatMap(Files, (files) => files.writeText(join(ctx.dir, file), `${canonicalJson(value)}\n`))
const options = (ctx: Ctx) => ({
  ...(ctx.spec.seeds === undefined ? {} : { seeds: ctx.spec.seeds }),
  ...(ctx.spec.policies === undefined ? {} : { policies: ctx.spec.policies }),
  ...(ctx.spec.limit === undefined ? {} : { limit: ctx.spec.limit }),
})
const inputs = (ctx: Ctx) => ['systems.pipe.toml', ctx.spec.scene]

const readJson = <A>(ctx: Ctx, file: string) =>
  Effect.flatMap(Files, (files) =>
    Effect.flatMap(files.exists(join(ctx.dir, file)), (there) =>
      there
        ? Effect.map(files.readText(join(ctx.dir, file)), (text) => JSON.parse(text) as A)
        : Effect.succeed(undefined),
    ),
  )

export const systemsPipeline: PipelineDef<SystemsPipeSpec> = definePipeline<SystemsPipeSpec>({
  name: 'systems',
  spec: systemsPipeSpec,
  specFile: 'systems.pipe.toml',
  stages: [
    {
      id: 'scenarios',
      inputs,
      outputs: () => [SCENARIOS],
      run: (ctx) =>
        Effect.gen(function* () {
          const { runScenario } = yield* bots('scenarios')
          const scene = yield* loadScene(ctx, 'scenarios')
          const results = yield* work('scenarios', async () => {
            const out: ScenarioResult[] = []
            for (const s of scene.def.scenarios) out.push(await runScenario(scene, s))
            return out
          })
          yield* write(ctx, SCENARIOS, results)
          return { notes: `${results.filter((r) => r.ok).length}/${results.length} scenarios pass` }
        }),
    },
    {
      id: 'playtest',
      inputs,
      params: options,
      outputs: () => [PLAYTEST],
      run: (ctx) =>
        Effect.gen(function* () {
          const { playtest } = yield* bots('playtest')
          const scene = yield* loadScene(ctx, 'playtest')
          const report = yield* work('playtest', () => playtest(scene, { ...options(ctx), scenarios: false }))
          yield* write(ctx, PLAYTEST, report.runs)
          return {
            notes: `${report.runs.filter((r) => r.outcome === 'win').length}/${report.runs.length} runs won`,
          }
        }),
    },
    {
      id: 'sweep',
      inputs,
      params: (ctx) => ({ ...options(ctx), sweep: ctx.spec.sweep ?? null }),
      outputs: (ctx) => (ctx.spec.sweep === undefined ? [] : [SWEEP]),
      run: (ctx) =>
        Effect.gen(function* () {
          const s = ctx.spec.sweep
          if (s === undefined) return { notes: 'no [sweep] in the spec' }
          const { sweep } = yield* bots('sweep')
          const scene = yield* loadScene(ctx, 'sweep')
          const result = yield* work('sweep', () =>
            sweep(scene, s.tunable, s.from, s.to, s.steps, options(ctx)),
          )
          yield* write(ctx, SWEEP, result)
          return { notes: `${result.rows.filter((r) => r.ok).length}/${result.rows.length} values fair` }
        }),
    },
  ],
  check: (ctx) =>
    Effect.gen(function* () {
      const { claimsCheck, fairness } = yield* bots('check')
      const scene = yield* loadScene(ctx, 'check')
      const scenarios = (yield* readJson<ScenarioResult[]>(ctx, SCENARIOS)) ?? []
      const runs = (yield* readJson<Playtest['runs']>(ctx, PLAYTEST)) ?? []
      const results: CheckResult[] = []
      for (const s of scenarios)
        results.push({
          id: `scenario:${s.id}`,
          ok: s.ok,
          detail: `${s.successes}/${s.seeds} within ${s.within} s (expected ${s.expected})`,
        })
      for (const c of claimsCheck(scene, scenarios)) results.push(c)
      for (const row of fairness({ runs, scenarios }, scene.def.fairness, scene.def))
        results.push({
          id: `fairness:${row.id}`,
          ok: row.ok,
          detail: `${row.label}: ${row.value === null ? 'not measured' : row.value} ${row.comparison} ${row.threshold} (${row.detail})`,
        })
      return results
    }),
})
