import { join } from 'node:path'
import { Effect } from 'effect'
import { z } from 'zod'
import { Files } from '../shared/node/files.ts'
import {
  definePipeline,
  type PipelineDef,
  type StageContext,
  type StageDef,
  StageFailed,
} from '../shared/pipeline.ts'

// The toy pipeline the runner tests drive, on Effect.
// Stages: one (src.txt → one.txt), two (→ two.txt, gate T1), three (→ three.txt), paid (→ paid.txt, one image,
// recording a task id; paid.txt is restorable from that id). toy.toml: `param` is hashed into every stage;
// `fail = "<stage>"` makes that stage fail.

export interface ToySpec {
  readonly param?: number | undefined
  readonly fail?: string | undefined
}

const toySpecSchema: z.ZodType<ToySpec> = z
  .object({ param: z.number().optional(), fail: z.string().optional() })
  .strict()

const copy = (id: string, from: string, to: string, gate?: string): StageDef<ToySpec> => ({
  id,
  ...(gate === undefined ? {} : { gate }),
  inputs: () => [from],
  outputs: () => [to],
  params: (ctx) => ({ param: ctx.spec.param ?? 0 }),
  run: (ctx) =>
    Effect.gen(function* () {
      if (ctx.spec.fail === id) return yield* new StageFailed({ stage: id, reason: `${id} was told to fail` })
      const files = yield* Files
      const text = yield* files.readText(join(ctx.dir, from))
      yield* files.writeText(join(ctx.dir, to), `${text}${id} ${ctx.spec.param ?? 0}\n`)
      return {}
    }),
})

/** The toy, with an optional effect the paid stage runs first (the acceptance tests' fake API call). */
export function toyPipeline(
  paidCall: (ctx: StageContext<ToySpec>) => Effect.Effect<void> = () => Effect.void,
): PipelineDef<ToySpec> {
  return definePipeline<ToySpec>({
    name: 'toy',
    spec: toySpecSchema,
    stages: [
      copy('one', 'src.txt', 'one.txt'),
      copy('two', 'one.txt', 'two.txt', 'T1'),
      copy('three', 'two.txt', 'three.txt'),
      {
        id: 'paid',
        cost: { budget: 'images', units: 1 },
        inputs: () => ['three.txt'],
        // Kept outside Git, as a paid download is: `restore` brings it back from the task id without paying.
        restorable: () => ['paid.txt'],
        params: (ctx) => ({ param: ctx.spec.param ?? 0 }),
        run: (ctx) =>
          Effect.gen(function* () {
            if (ctx.spec.fail === 'paid')
              return yield* new StageFailed({ stage: 'paid', reason: 'paid was told to fail' })
            yield* paidCall(ctx)
            yield* (yield* Files).writeText(join(ctx.dir, 'paid.txt'), 'paid\n')
            return { tasks: { image: 'toy-task-1' } }
          }),
        restore: (ctx) =>
          Effect.flatMap(Files, (files) =>
            files.writeText(join(ctx.dir, 'paid.txt'), `restored from ${ctx.tasks.image}\n`),
          ),
      },
    ],
    check: (ctx) =>
      Effect.succeed([{ id: 'toy:spec', ok: ctx.spec.param !== undefined, detail: 'toy.toml has a param' }]),
  })
}
