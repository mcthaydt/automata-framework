import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Deferred, Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { definePipeline } from './pipeline.ts'
import { runPipeline } from './runner.ts'

// Review round 1, finding 3: two paid runs at once against one project must not both pass the project budget or lose
// a charge. Each run waits in a free stage before its paid one, so without a lock both pass the budget check first.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('the spend ledger lock', () => {
  it('lets exactly one of two concurrent runs charge when only one fits', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pipe-lock-'))
    temps.push(root)
    writeFileSync(join(root, 'pipeline.toml'), '[budget.images]\nproject = 5\nrun = 4\n')
    writeFileSync(join(root, 'pipeline-spend.json'), '{ "images": 3 }\n')
    for (const name of ['a', 'b']) {
      mkdirSync(join(root, name))
      writeFileSync(join(root, name, 'race.toml'), '')
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const latch = yield* Deferred.make<void>()
        const pipeline = definePipeline({
          name: 'race',
          spec: z.object({}),
          stages: [
            {
              id: 'prep',
              outputs: () => ['prep.txt'],
              run: (ctx) =>
                Effect.as(
                  Effect.zipRight(
                    Deferred.await(latch),
                    Effect.sync(() => writeFileSync(join(ctx.dir, 'prep.txt'), 'p')),
                  ),
                  {},
                ),
            },
            {
              id: 'paid',
              cost: { budget: 'images', units: 2 },
              inputs: () => ['prep.txt'],
              run: () => Effect.succeed({}),
            },
          ],
        })
        const open = Effect.zipRight(Effect.sleep('200 millis'), Deferred.succeed(latch, undefined))
        const [a, b] = yield* Effect.all(
          [
            runPipeline(pipeline, { command: 'run', target: join(root, 'a'), paid: true }),
            runPipeline(pipeline, { command: 'run', target: join(root, 'b'), paid: true }),
            open,
          ],
          { concurrency: 'unbounded' },
        )
        return [a, b]
      }).pipe(Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive))),
    )
    expect(results.map((result) => result?.exit).sort()).toEqual([0, 4])
    const refused = results.find((result) => result?.exit === 4)
    expect(refused?.error).toBe(
      `the spend ledger is locked by another run: ${join(root, 'pipeline-spend.lock')} (delete it if no run is going)`,
    )
    expect(JSON.parse(readFileSync(join(root, 'pipeline-spend.json'), 'utf8'))).toEqual({ images: 5 })
  })
})
