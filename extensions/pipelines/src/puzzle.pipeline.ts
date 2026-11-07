// The `puzzle` pipeline (M6 spec §4.5, M6.6b): a scene folder's `puzzle.pipe.toml` names the game's scene module (it
// exports `puzzle`, a `PuzzleScene`, and may export `systems`, a `SystemsScene`). `run` writes the solver's analysis,
// the generated doc and the audit; `check` fails on a validate error, an unsolvable puzzle, a softlock (naming its
// route, P-d), a late hint, a missing key-set and a doc that is stale or edited by hand. Free: no stage is paid. The
// scene module and the solver load when a stage runs (as `systems`, SB-D6).
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PuzzleScene } from '@automata/puzzle/solver'
import { canonicalJson } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import type { Policy, SystemsScene } from '@automata/systems/bots'
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
import { AUDIT, type Audit, findingsOf, renderAudit } from './puzzle-audit.ts'
import { PIPE_POLICIES } from './systems.pipeline.ts'

export interface PuzzlePipeSpec {
  /** The scene module, relative to the scene folder and inside it. */
  readonly scene: string
  /** The files the puzzle is made from (its content, its model), inside the folder: the stage cache's inputs and the doc's stamp. */
  readonly sources?: readonly string[] | undefined
  /** Solve one entry only. */
  readonly entry?: string | undefined
  /** The audit's playtest: seeds per route and policy (default 2) and its policies (default scripted, cautious). */
  readonly seeds?: number | undefined
  readonly policies?: readonly Policy[] | undefined
}
export const puzzlePipeSpec: z.ZodType<PuzzlePipeSpec> = z.strictObject({
  scene: z.string().min(1),
  sources: z.array(z.string().min(1)).optional(),
  entry: z.string().optional(),
  seeds: z.number().int().min(1).optional(),
  policies: z.array(z.enum(PIPE_POLICIES as [Policy, ...Policy[]])).optional(),
})

const ANALYSIS = 'reports/puzzle.json'
const AUDIT_JSON = 'reports/audit.json'
const DOC = 'puzzle.md'
type Ctx = StageContext<PuzzlePipeSpec>

const failing = (stage: string) => (cause: unknown) => new StageFailed({ stage, reason: String(cause) })
const solverTools = (stage: string) =>
  Effect.tryPromise({ try: () => import('@automata/puzzle/solver'), catch: failing(stage) })
const bots = (stage: string) =>
  Effect.tryPromise({ try: () => import('@automata/systems/bots'), catch: failing(stage) })

interface Loaded {
  readonly puzzle: PuzzleScene
  readonly systems: SystemsScene | undefined
}
/** The scene module, with the puzzle's sources hashed as they are now (the doc's stamp, PZ-D4). */
const loadScene = (ctx: Ctx, stage: string) =>
  Effect.gen(function* () {
    const loaded = yield* Effect.tryPromise({
      try: async () =>
        (await import(pathToFileURL(join(ctx.dir, ctx.spec.scene)).href)) as {
          puzzle?: PuzzleScene
          systems?: SystemsScene
        },
      catch: (cause) => new StageFailed({ stage, reason: `the scene module: ${String(cause)}` }),
    })
    if (loaded.puzzle === undefined)
      return yield* new StageFailed({ stage, reason: `${ctx.spec.scene} exports no puzzle` })
    const files = yield* Files
    const sources: { path: string; hash: string }[] = []
    for (const path of ctx.spec.sources ?? loaded.puzzle.sources.map((s) => s.path))
      sources.push({ path, hash: hex64(xxhash64(utf8(yield* files.readText(join(ctx.dir, path))))) })
    return { puzzle: { ...loaded.puzzle, sources }, systems: loaded.systems } satisfies Loaded
  })
const write = (ctx: Ctx, file: string, text: string) =>
  Effect.flatMap(Files, (files) => files.writeText(join(ctx.dir, file), text))
const inputs = (ctx: Ctx) => ['puzzle.pipe.toml', ctx.spec.scene, ...(ctx.spec.sources ?? [])]
const analyseOf = (ctx: Ctx, stage: string, puzzle: PuzzleScene) =>
  Effect.flatMap(solverTools(stage), ({ analyse }) =>
    Effect.try({
      try: () => analyse(puzzle, ctx.spec.entry === undefined ? {} : { entry: ctx.spec.entry }),
      catch: failing(stage),
    }),
  )

export const puzzlePipeline: PipelineDef<PuzzlePipeSpec> = definePipeline<PuzzlePipeSpec>({
  name: 'puzzle',
  spec: puzzlePipeSpec,
  specFile: 'puzzle.pipe.toml',
  stages: [
    {
      id: 'analyse',
      inputs,
      params: (ctx) => ({ entry: ctx.spec.entry ?? null }),
      outputs: () => [ANALYSIS],
      run: (ctx) =>
        Effect.gen(function* () {
          const { validate } = yield* solverTools('analyse')
          const { puzzle } = yield* loadScene(ctx, 'analyse')
          const x = yield* analyseOf(ctx, 'analyse', puzzle)
          const report = {
            findings: validate(puzzle),
            solve: {
              solvable: x.solve.solvable,
              states: x.solve.states,
              capped: x.solve.capped,
              keySets: x.solve.keySets,
            },
            routes: x.routes,
            softlocks: x.softlocks,
            hints: x.hints,
            keys: x.keys.map((k) => ({ lock: k.lock, key: k.key, ok: k.ok, missing: k.missing })),
          }
          yield* write(ctx, ANALYSIS, `${canonicalJson(JSON.parse(JSON.stringify(report)))}\n`)
          return { notes: `${x.routes.length} routes, ${x.softlocks.count} softlocks` }
        }),
    },
    {
      id: 'doc',
      inputs,
      params: (ctx) => ({ entry: ctx.spec.entry ?? null }),
      outputs: () => [DOC],
      run: (ctx) =>
        Effect.gen(function* () {
          const { renderDoc } = yield* solverTools('doc')
          const { puzzle } = yield* loadScene(ctx, 'doc')
          yield* write(ctx, DOC, renderDoc(puzzle, yield* analyseOf(ctx, 'doc', puzzle)))
          return { notes: DOC }
        }),
    },
    {
      id: 'audit',
      inputs,
      params: (ctx) => ({
        entry: ctx.spec.entry ?? null,
        seeds: ctx.spec.seeds ?? 2,
        policies: ctx.spec.policies ?? null,
      }),
      outputs: () => [AUDIT_JSON, AUDIT],
      run: (ctx) =>
        Effect.gen(function* () {
          const { puzzle, systems } = yield* loadScene(ctx, 'audit')
          const x = yield* analyseOf(ctx, 'audit', puzzle)
          const { timing } = yield* solverTools('audit')
          const doc = yield* docStatus(ctx, 'audit', puzzle)
          const audited: Omit<Audit, 'findings'> = {
            scene: puzzle.id,
            sources: puzzle.sources,
            puzzle: {
              routes: x.routes.map((r) => ({
                name: r.name,
                steps: r.solution.steps.length,
                seconds: Math.round(timing(puzzle, r.solution).total * 100) / 100,
              })),
              states: x.softlocks.states,
              softlocks: x.softlocks.count,
              never: x.softlocks.never,
            },
            systems: systems === undefined ? null : yield* auditSystems(ctx, systems),
            files: [doc],
          }
          const audit: Audit = { ...audited, findings: findingsOf({ ...audited, findings: [] }) }
          yield* write(ctx, AUDIT_JSON, `${canonicalJson(JSON.parse(JSON.stringify(audit)))}\n`)
          yield* write(ctx, AUDIT, renderAudit(audit))
          return { notes: `${audit.findings.length} findings` }
        }),
    },
  ],
  check: (ctx) =>
    Effect.gen(function* () {
      const { validate } = yield* solverTools('check')
      const { puzzle } = yield* loadScene(ctx, 'check')
      const x = yield* analyseOf(ctx, 'check', puzzle)
      const errors = validate(puzzle).filter((f) => f.level === 'error')
      const first = x.softlocks.softlocks[0]
      const results: CheckResult[] = [
        {
          id: 'validate',
          ok: errors.length === 0,
          detail:
            errors.length === 0
              ? 'no errors'
              : errors.map((e) => `${e.rule} ${e.id}: ${e.detail}`).join('; '),
        },
        {
          id: 'solvable',
          ok: x.solve.solvable,
          detail: x.solve.solvable ? `${x.routes.length} routes` : 'no solution',
        },
        {
          id: 'softlocks',
          ok: x.softlocks.count === 0,
          detail:
            x.softlocks.count === 0
              ? `none in ${x.softlocks.states} states`
              : `${x.softlocks.count} softlock${x.softlocks.count === 1 ? '' : 's'} in ${x.softlocks.states} states: ${first?.entry}: ${first?.trail.join(' > ')}`,
        },
        {
          id: 'hints',
          ok: x.hints.every((h) => h.ok),
          detail: x.hints.flatMap((h) => h.failures).join('; ') || 'every lethal rule hinted before its risk',
        },
        {
          id: 'keys',
          ok: x.keys.every((k) => k.ok),
          detail:
            x.keys
              .filter((k) => !k.ok)
              .map((k) => `${k.lock}: ${k.key} missing ${k.missing.join(', ')}`)
              .join('; ') || `${x.keys.length} key-sets found`,
        },
      ]
      const doc = yield* docStatus(ctx, 'check', puzzle)
      results.push({ id: 'doc', ok: doc.ok, detail: doc.detail })
      return results
    }),
})

/** The doc against what the doc stage makes now: current, or stale (its sources moved) or edited by hand. */
const docStatus = (ctx: Ctx, stage: string, puzzle: PuzzleScene) =>
  Effect.gen(function* () {
    const { renderDoc } = yield* solverTools(stage)
    const files = yield* Files
    const path = join(ctx.dir, DOC)
    if (!(yield* files.exists(path))) return { path: DOC, ok: false, detail: 'is missing' }
    const fresh = renderDoc(puzzle, yield* analyseOf(ctx, stage, puzzle))
    const text = yield* files.readText(path)
    if (text === fresh) return { path: DOC, ok: true, detail: 'current' }
    const stamp = fresh.split('\n')[1]
    return {
      path: DOC,
      ok: false,
      detail:
        text.split('\n')[1] === stamp
          ? 'differs from what the pipeline writes (edited by hand?)'
          : 'is stale: its sources changed',
    }
  })

/** The systems part of the audit: the playtest, its scenarios and fairness. */
const auditSystems = (ctx: Ctx, systems: SystemsScene) =>
  Effect.gen(function* () {
    const { fairness, playtest } = yield* bots('audit')
    const options = {
      seeds: ctx.spec.seeds ?? 2,
      policies: ctx.spec.policies ?? (['scripted', 'cautious'] as const),
    }
    const report = yield* Effect.tryPromise({
      try: () => playtest(systems, options),
      catch: failing('audit'),
    })
    return {
      policies: [...options.policies],
      seeds: options.seeds,
      scenarios: report.scenarios.map((s) => ({
        id: s.id,
        ok: s.ok,
        detail: `${s.successes}/${s.seeds} within ${s.within} s`,
      })),
      fairness: fairness(report, systems.def.fairness, systems.def),
      runs: report.runs.map((r) => ({
        route: r.route,
        policy: r.policy,
        seed: r.seed,
        outcome: r.outcome,
        time: r.time,
        deaths: r.deaths.length,
        firstThreat: r.firstThreat,
        cause: r.cause ?? null,
      })),
    }
  })
