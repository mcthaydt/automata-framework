// The `blockout` pipeline (M6 spec §4.11, M6.11): a level written once as a blockout (rooms, openings, boxes, nav, zones) and generated into
// the scene's `sector-map` and `nav-graph` content. `blockout.pipe.toml` names the spec file and the two generated files. Stages:
//
//   validate   the schema, the expansion, the generated map and graph through their content schemas, and the generic checks; fails closed
//              (exit 1) and writes nothing
//   generate   `sector-map` and `nav-graph` TOML, each stamped with the spec's hash on its first line
//   shots      only with a `[shots]` table: the game's command shoots a grey clay frame for every camera zone, and each is judged legible
//              (BP-D2); the pipeline never starts a server itself
//
// `check` passes when validate is clean and both files are what generate would write now; a stale stamp (the spec moved on) and a hand
// edit (stamp current, body different) are told apart. The `generated` globs in the folder's `pipeline.toml` are what M3.8c's guard reads.
// Free: no stage is paid, none is gated.
import { join } from 'node:path'
import { Files, ProcessRunner } from '@mcthaydt/automata-node'
import type { Blockout } from '@mcthaydt/automata-sector-format/blockout'
import { Effect } from 'effect'
import { z } from 'zod'
import type { Finding } from './blockout.checks.ts'
import {
  type CheckResult,
  definePipeline,
  type PipelineDef,
  type StageContext,
  StageFailed,
} from './pipeline.ts'

export interface BlockoutPipeSpec {
  /** The blockout (JSON), inside the folder. */
  readonly blockout: string
  /** The generated `sector-map` (TOML), relative to the folder: a path the guard protects. */
  readonly map: string
  /** The generated `nav-graph` (TOML), relative to the folder. */
  readonly nav: string
  /** The game's shot command; the stage is skipped, saying so, without it. */
  readonly shots?:
    | {
        /** Program and arguments, run in the folder with the zones as JSON on stdin; it writes each zone's `out` file there. */
        readonly command: readonly string[]
        /** The bounds a shot must meet (defaults: luminance mean 60 to 200, spread 40). */
        readonly legible?: { readonly mean: readonly [number, number]; readonly spread: number } | undefined
      }
    | undefined
}
export const blockoutPipeSpec: z.ZodType<BlockoutPipeSpec> = z.strictObject({
  blockout: z.string().min(1),
  map: z.string().min(1),
  nav: z.string().min(1),
  shots: z
    .strictObject({
      command: z.array(z.string().min(1)).min(1),
      legible: z
        .strictObject({ mean: z.tuple([z.number(), z.number()]), spread: z.number().min(0) })
        .optional(),
    })
    .optional(),
})

const COMMAND = 'automata pipe blockout run'

// Loaded when a stage runs, not at import: the bin runs from source and resolves these packages' TypeScript through the SB-D6 hook, which
// is installed only once a stage starts (as `narrative` does).
const checks = () => import('./blockout.checks.ts')
const generator = () => import('./blockout.generate.ts')
const shooter = () => import('./blockout.shots.ts')
const pngs = () => import('./png.ts')
const format = () => import('@mcthaydt/automata-sector-format/blockout')
type Ctx = StageContext<BlockoutPipeSpec>

const lines = (found: readonly Finding[]): string => found.map((f) => `${f.rule}: ${f.detail}`).join('; ')

/** The spec as text and as a value; a file that is not JSON is a finding at the file, not a crash. */
const load = (ctx: Ctx, stage: string) =>
  Effect.gen(function* () {
    const files = yield* Files
    const text = yield* files.readText(join(ctx.dir, ctx.spec.blockout))
    const value = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) =>
        new StageFailed({
          stage,
          reason: `${ctx.spec.blockout}: ${cause instanceof Error ? cause.message : String(cause)}`,
        }),
    })
    const { validateBlockout } = yield* Effect.promise(checks)
    return { text, value, findings: validateBlockout(value) }
  })

/** A generated file against what generate writes now: current, or stale (the spec moved on) or edited by hand. */
const status = (ctx: Ctx, path: string, fresh: string) =>
  Effect.gen(function* () {
    const { stampOf } = yield* Effect.promise(generator)
    const files = yield* Files
    if (!(yield* files.exists(join(ctx.dir, path))))
      return { ok: false, detail: `${path} is missing (run \`${COMMAND}\`)` }
    const text = yield* files.readText(join(ctx.dir, path))
    if (text === fresh) return { ok: true, detail: `${path} is current` }
    return {
      ok: false,
      detail:
        stampOf(text) === stampOf(fresh)
          ? `${path} differs from what the pipeline writes (edited by hand?)`
          : `${path} is stale: the blockout changed (run \`${COMMAND}\`)`,
    }
  })

export const blockoutPipeline: PipelineDef<BlockoutPipeSpec> = definePipeline<BlockoutPipeSpec>({
  name: 'blockout',
  spec: blockoutPipeSpec,
  specFile: 'blockout.pipe.toml',
  stages: [
    {
      id: 'validate',
      inputs: (ctx) => ['blockout.pipe.toml', ctx.spec.blockout],
      outputs: () => ['validate.json'],
      run: (ctx) =>
        Effect.gen(function* () {
          const { findings } = yield* load(ctx, 'validate')
          if (findings.length > 0)
            return yield* new StageFailed({ stage: 'validate', reason: lines(findings) })
          const files = yield* Files
          yield* files.writeText(join(ctx.dir, 'validate.json'), `${JSON.stringify({ findings }, null, 2)}\n`)
          return { notes: 'sound' }
        }),
    },
    {
      id: 'generate',
      inputs: (ctx) => ['blockout.pipe.toml', ctx.spec.blockout],
      outputs: (ctx) => [ctx.spec.map, ctx.spec.nav],
      run: (ctx) =>
        Effect.gen(function* () {
          const { text, value, findings } = yield* load(ctx, 'generate')
          if (findings.length > 0)
            return yield* new StageFailed({ stage: 'generate', reason: lines(findings) })
          const { generateContent } = yield* Effect.promise(generator)
          const { map, nav } = generateContent(value as Blockout, text)
          const files = yield* Files
          yield* files.writeText(join(ctx.dir, ctx.spec.map), map)
          yield* files.writeText(join(ctx.dir, ctx.spec.nav), nav)
          return { notes: `${ctx.spec.map}, ${ctx.spec.nav}` }
        }),
    },
    {
      id: 'shots',
      inputs: (ctx) => ['blockout.pipe.toml', ctx.spec.blockout, ctx.spec.map, ctx.spec.nav],
      outputs: () => ['shots.json'],
      run: (ctx) =>
        Effect.gen(function* () {
          const files = yield* Files
          const shots = ctx.spec.shots
          if (shots === undefined) {
            yield* files.writeText(join(ctx.dir, 'shots.json'), `${JSON.stringify({ configured: false })}\n`)
            return { notes: 'no [shots] in blockout.pipe.toml' }
          }
          const { value, findings } = yield* load(ctx, 'shots')
          if (findings.length > 0) return yield* new StageFailed({ stage: 'shots', reason: lines(findings) })
          const { expand } = yield* Effect.promise(format)
          const { standingPoints, luminanceStats, judge, DEFAULT_LEGIBLE } = yield* Effect.promise(shooter)
          const { decodePng } = yield* Effect.promise(pngs)
          const blockout = value as Blockout
          const { points, skipped } = standingPoints(blockout, expand(blockout))
          const jobs = points.map((p) => ({
            ...p,
            out: `grey-${p.zone.replace(/[^A-Za-z0-9_.-]/g, '_')}.png`,
          }))
          const runner = yield* ProcessRunner
          const [program, ...args] = shots.command as [string, ...string[]]
          const ran = yield* runner
            .run(program, args, {
              cwd: ctx.dir,
              stdin: new TextEncoder().encode(
                JSON.stringify({ scene: blockout.scene, dir: ctx.dir, zones: jobs }),
              ),
            })
            .pipe(
              Effect.mapError(
                (cause) => new StageFailed({ stage: 'shots', reason: `${program}: ${String(cause)}` }),
              ),
            )
          if (ran.exitCode !== 0)
            return yield* new StageFailed({
              stage: 'shots',
              reason: `${program} exited with ${ran.exitCode}: ${(ran.stderr || ran.stdout).trim().slice(-400)}`,
            })
          const legible = shots.legible ?? DEFAULT_LEGIBLE
          const results: { zone: string; file: string; mean: number; spread: number; legible: boolean }[] = []
          for (const job of jobs) {
            if (!(yield* files.exists(join(ctx.dir, job.out))))
              return yield* new StageFailed({
                stage: 'shots',
                reason: `the command left no ${job.out} for zone ${job.zone}`,
              })
            const bytes = yield* files.readBytes(join(ctx.dir, job.out))
            const image = yield* Effect.try({
              try: () => decodePng(bytes),
              catch: (cause) =>
                new StageFailed({
                  stage: 'shots',
                  reason: `${job.out}: ${cause instanceof Error ? cause.message : String(cause)}`,
                }),
            })
            const stats = luminanceStats(image)
            results.push({ zone: job.zone, file: job.out, ...stats, legible: judge(stats, legible) })
          }
          yield* files.writeText(
            join(ctx.dir, 'shots.json'),
            `${JSON.stringify({ shots: results, skipped }, null, 2)}\n`,
          )
          const bad = results.filter((r) => !r.legible).map((r) => r.zone)
          if (bad.length > 0)
            return yield* new StageFailed({
              stage: 'shots',
              reason: `grey shots not legible: ${bad.join(', ')} (luminance mean ${legible.mean[0]} to ${legible.mean[1]}, 10th to 90th percentile spread at least ${legible.spread})`,
            })
          return {
            notes: `${results.length} zones${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`,
          }
        }),
    },
  ],
  check: (ctx) =>
    Effect.gen(function* () {
      const { text, value, findings } = yield* load(ctx, 'check')
      const results: CheckResult[] = [
        {
          id: 'validate',
          ok: findings.length === 0,
          detail: findings.length === 0 ? 'the blockout is sound' : lines(findings),
        },
      ]
      if (findings.length > 0) {
        for (const id of ['map', 'nav'])
          results.push({ id, ok: false, detail: 'not checked: the blockout does not validate' })
        return results
      }
      const { generateContent } = yield* Effect.promise(generator)
      const fresh = generateContent(value as Blockout, text)
      for (const [id, path, expected] of [
        ['map', ctx.spec.map, fresh.map],
        ['nav', ctx.spec.nav, fresh.nav],
      ] as const)
        results.push({ id, ...(yield* status(ctx, path, expected)) })
      return results
    }),
})
