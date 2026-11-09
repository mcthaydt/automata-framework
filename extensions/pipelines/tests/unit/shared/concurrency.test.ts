import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Deferred, Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { gateFileSchema } from '#src/shared/gates-file.ts'
import { FilesLive } from '#src/shared/node/files.ts'
import { ProcessRunnerLive } from '#src/shared/node/process.ts'
import { definePipeline } from '#src/shared/pipeline.ts'
import { type RunOptions, runPipeline } from '#src/shared/runner.ts'
import type { GateRecord } from '#src/shared/state.schema.ts'
import { toyPipeline } from '#src/testing/toy.ts'

// A decision lands only on what the person was asked about, one command at a time changes a target,
// and a paid run spends only on the plan its estimate token covered.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function toyFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-cas-'))
  temps.push(dir)
  writeFileSync(join(dir, 'src.txt'), 'source\n')
  writeFileSync(join(dir, 'toy.toml'), 'param = 1\n')
  writeFileSync(join(dir, 'pipeline.toml'), '[budget.images]\nproject = 10\nrun = 4\n')
  return dir
}

const live = Layer.merge(FilesLive, ProcessRunnerLive)
const pipe = (
  dir: string,
  command: RunOptions['command'],
  options: Omit<RunOptions, 'command' | 'target'> = {},
) =>
  Effect.runPromise(
    runPipeline(toyPipeline(), { command, target: dir, ...options }).pipe(Effect.provide(live)),
  )
const gates = (dir: string): Record<string, GateRecord> =>
  gateFileSchema.parse(JSON.parse(readFileSync(join(dir, 'gates.json'), 'utf8')))

describe('a decision is compared with what was asked', () => {
  it('refuses an approval when the stage ran again after the request, and takes one that matches', async () => {
    const dir = toyFolder()
    await pipe(dir, 'run')
    const asked = await pipe(dir, 'request', { gate: 'T1', note: 'review two.txt' })
    expect(asked.data).toEqual({
      stage: { inputHash: expect.stringMatching(/^[0-9a-f]{16}$/), at: expect.any(String) },
    })
    const stage = (asked.data as { stage: { inputHash: string; at: string } }).stage
    const expected = { requestedAt: asked.gates[0]?.requestedAt as string, ...stage }

    expect((await pipe(dir, 'run', { only: ['two'], force: true })).exit).toBe(3)
    const stale = await pipe(dir, 'approve', { gate: 'T1', expect: expected })
    expect([stale.exit, stale.error]).toEqual([4, 'gate T1 changed while it was asked; ask again'])
    expect(gates(dir).T1?.decision).toBe('pending')

    const again = await pipe(dir, 'request', { gate: 'T1' })
    const fresh = {
      requestedAt: again.gates[0]?.requestedAt as string,
      ...(again.data as { stage: { inputHash: string; at: string } }).stage,
    }
    expect((await pipe(dir, 'approve', { gate: 'T1', expect: fresh })).exit).toBe(0)
    expect(gates(dir).T1?.decision).toBe('approved')
  })
})

describe('one command at a time changes a target', () => {
  it("refuses a decision while a run holds the target, so the run's save cannot overwrite it", async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipe-busy-'))
    temps.push(dir)
    writeFileSync(join(dir, 'busy.toml'), '')
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const latch = yield* Deferred.make<void>()
        const started = yield* Deferred.make<void>()
        const def = definePipeline({
          name: 'busy',
          spec: z.object({}),
          stages: [
            {
              id: 'a',
              gate: 'A',
              outputs: () => ['a.txt'],
              run: (ctx) =>
                Effect.as(
                  Effect.sync(() => writeFileSync(join(ctx.dir, 'a.txt'), 'a')),
                  {},
                ),
            },
            {
              id: 'b',
              gate: 'B',
              outputs: () => ['b.txt'],
              run: (ctx) =>
                Effect.as(
                  Effect.zipRight(
                    Effect.zipRight(Deferred.succeed(started, undefined), Deferred.await(latch)),
                    Effect.sync(() => writeFileSync(join(ctx.dir, 'b.txt'), 'b')),
                  ),
                  {},
                ),
            },
          ],
        })
        const run = (options: RunOptions) => runPipeline(def, options)
        expect((yield* run({ command: 'run', target: dir })).exit).toBe(3)
        expect((yield* run({ command: 'approve', target: dir, gate: 'A' })).exit).toBe(0)
        const long = yield* Effect.fork(run({ command: 'run', target: dir }))
        yield* Deferred.await(started)
        const reject = yield* run({ command: 'reject', target: dir, gate: 'A' })
        yield* Deferred.succeed(latch, undefined)
        return { reject, long: yield* Effect.flatMap(long.await, (exit) => exit) }
      }).pipe(Effect.provide(live)),
    )
    expect([results.reject.exit, results.reject.error]).toEqual([
      4,
      `the target is busy with another command: ${join(dir, '.pipeline.lock')} (delete it if no command is going)`,
    ])
    expect(results.long.exit).toBe(3)
    expect(gates(dir).A?.decision).toBe('approved')
    expect(existsSync(join(dir, '.pipeline.lock'))).toBe(false)
  })
})

describe('a run held to its estimated plan', () => {
  const planOf = (result: { data?: unknown }) =>
    ((result.data as { plan: { id: string; inputHash: string }[] }).plan ?? []).map(({ id, inputHash }) => ({
      id,
      inputHash,
    }))

  it('refuses with exit 4 when the stages it would run are not the estimated ones', async () => {
    const dir = toyFolder()
    await pipe(dir, 'run')
    await pipe(dir, 'approve', { gate: 'T1' })
    const plan = planOf(await pipe(dir, 'estimate'))
    expect(plan.map((row) => row.id)).toEqual(['three', 'paid'])
    const run = await pipe(dir, 'run', { paid: true, plan: plan.slice(1) })
    expect([run.exit, run.error]).toEqual([
      4,
      'the plan changed since the estimate: it would run three, paid; the estimate covered paid; estimate again',
    ])
    expect(existsSync(join(dir, 'three.txt'))).toBe(false)
  })

  it("refuses before the charge when a paid stage's inputs differ from the estimate's", async () => {
    const dir = toyFolder()
    await pipe(dir, 'run')
    await pipe(dir, 'approve', { gate: 'T1' })
    await pipe(dir, 'run', { to: 'three' })
    const plan = planOf(await pipe(dir, 'estimate'))
    expect(plan).toEqual([{ id: 'paid', inputHash: expect.stringMatching(/^[0-9a-f]{16}$/) }])
    writeFileSync(join(dir, 'three.txt'), 'edited after the estimate\n')
    const run = await pipe(dir, 'run', { paid: true, plan })
    expect([run.exit, run.error]).toEqual([4, 'paid: its inputs changed since the estimate; estimate again'])
    expect(existsSync(join(dir, 'pipeline-spend.json'))).toBe(false)
    expect(existsSync(join(dir, 'paid.txt'))).toBe(false)
  })
})
