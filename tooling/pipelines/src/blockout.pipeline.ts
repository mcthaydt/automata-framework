// The `blockout` pipeline (M6 spec §4.11, M6.11): a level written once as a blockout (rooms, openings, boxes, nav, zones) and generated into
// the scene's `sector-map` and `nav-graph` content. `blockout.pipe.toml` names the spec file and the two generated files. Stages:
//
//   validate   the schema, the expansion, the generated map and graph through their content schemas, and the generic checks; fails closed
//              (exit 1) and writes nothing
//   generate   `sector-map` and `nav-graph` TOML, each stamped with the spec's hash on its first line
//
// `check` passes when validate is clean and both files are what generate would write now; a stale stamp (the spec moved on) and a hand
// edit (stamp current, body different) are told apart. The `generated` globs in the folder's `pipeline.toml` are what M3.8c's guard reads.
// Free: no stage is paid, none is gated.
import { join } from 'node:path'
import { Files } from '@mcthaydt/automata-node'
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
}
export const blockoutPipeSpec: z.ZodType<BlockoutPipeSpec> = z.strictObject({
  blockout: z.string().min(1),
  map: z.string().min(1),
  nav: z.string().min(1),
})

const COMMAND = 'automata pipe blockout run'

// Loaded when a stage runs, not at import: the bin runs from source and resolves these packages' TypeScript through the SB-D6 hook, which
// is installed only once a stage starts (as `narrative` does).
const checks = () => import('./blockout.checks.ts')
const generator = () => import('./blockout.generate.ts')
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
