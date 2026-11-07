import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer, TestClock, TestContext } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { definePipeline, type PipelineDef } from './pipeline.ts'
import { type RunOptions, runPipeline } from './runner.ts'
import type { GateRecord, PipelineResult, StageRecord } from './state.schema.ts'
import { toyPipeline } from './testing/toy.ts'

// The Last Light's runner tests (tests/pipeline-runner.test.ts at 92e6704), in-process on the toy pipeline instead
// of a vite-node subprocess. Each test gets its own folder, which is also the project root (it holds pipeline.toml).

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const PIPELINE_TOML = '[budget.images]\nproject = 10\nrun = 4\n'

function toyFolder(spec = 'param = 1\n'): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-toy-'))
  temps.push(dir)
  writeFileSync(join(dir, 'src.txt'), 'source\n')
  writeFileSync(join(dir, 'toy.toml'), spec)
  writeFileSync(join(dir, 'pipeline.toml'), PIPELINE_TOML)
  return dir
}

const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive, TestContext.TestContext)
const exec = <A>(effect: Effect.Effect<A, never, never>) => Effect.runPromise(effect)

let dir = ''
const pipe = async (
  command: RunOptions['command'],
  options: Omit<RunOptions, 'command' | 'target'> = {},
  def: PipelineDef = toyPipeline(),
): Promise<PipelineResult> => {
  const result = await exec(
    runPipeline(def, { command, target: dir, ...options }).pipe(Effect.provide(layers)),
  )
  // Exactly what --json prints must round-trip: plain data only.
  expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  return result
}
const state = (result: PipelineResult, id: string) => result.stages.find((row) => row.id === id)?.state
const records = () =>
  JSON.parse(readFileSync(join(dir, '.stage.json'), 'utf8')) as Record<string, StageRecord>
const gates = () => JSON.parse(readFileSync(join(dir, 'gates.json'), 'utf8')) as Record<string, GateRecord>
const toGate = () => {
  dir = toyFolder()
  return pipe('run')
}
const pastGate = async () => {
  await toGate()
  expect((await pipe('approve', { gate: 'T1', note: 'fine' })).exit).toBe(0)
}

describe('the stage runner', () => {
  it('stops at a gate with exit 3 and a pending gate record', async () => {
    const result = await toGate()
    expect(result).toMatchObject({ ok: true, exit: 3, command: 'run', pipeline: 'toy' })
    expect([state(result, 'one'), state(result, 'two'), state(result, 'three')]).toEqual([
      'done',
      'gated',
      'pending',
    ])
    expect(gates().T1).toEqual({ id: 'T1', stage: 'two', decision: 'pending', files: ['two.txt'] })
    expect(existsSync(join(dir, 'three.txt'))).toBe(false)
    expect(records().one).toEqual({
      id: 'one',
      state: 'done',
      inputHash: expect.stringMatching(/^[0-9a-f]{16}$/),
      outputs: ['one.txt'],
      at: '1970-01-01T00:00:00.000Z',
    })
  })

  it('skips unchanged stages, re-runs on a change, and redoes with --force', async () => {
    await toGate()
    const before = statSync(join(dir, 'one.txt')).mtimeMs
    const again = await pipe('run')
    expect([again.exit, state(again, 'one'), state(again, 'two')]).toEqual([3, 'skipped', 'gated'])
    expect(statSync(join(dir, 'one.txt')).mtimeMs).toBe(before)
    expect(state(await pipe('run', { only: ['one'], force: true }), 'one')).toBe('done')
    writeFileSync(join(dir, 'src.txt'), 'changed\n')
    const changed = await pipe('run')
    expect([changed.exit, state(changed, 'one'), state(changed, 'two')]).toEqual([3, 'done', 'gated'])
    expect(readFileSync(join(dir, 'two.txt'), 'utf8')).toContain('changed')
  })

  it('re-runs when a parameter changes, and asks at the gate again', async () => {
    await pastGate()
    writeFileSync(join(dir, 'toy.toml'), 'param = 2\n')
    const result = await pipe('run')
    expect([result.exit, state(result, 'one'), state(result, 'two')]).toEqual([3, 'done', 'gated'])
    expect(gates().T1?.decision).toBe('pending')
  })

  it('blocks everything downstream of a pending gate, even with --from', async () => {
    await toGate()
    const result = await pipe('run', { from: 'three', paid: true })
    expect(result.exit).toBe(3)
    expect(result.error).toMatch(/T1/)
    expect(existsSync(join(dir, 'three.txt'))).toBe(false)
  })

  it('continues after a person approves, then skips everything', async () => {
    await pastGate()
    expect(gates().T1).toMatchObject({ decision: 'approved', by: 'owner', note: 'fine' })
    const result = await pipe('run', { paid: true })
    expect([result.exit, state(result, 'two'), state(result, 'three'), state(result, 'paid')]).toEqual([
      0,
      'skipped',
      'done',
      'done',
    ])
    expect(result.spent).toEqual({ images: 1 })
    expect(records().paid).toMatchObject({
      state: 'done',
      cost: { images: 1 },
      tasks: { image: 'toy-task-1' },
    })
    const again = await pipe('run', { paid: true })
    expect([again.exit, ...again.stages.map((row) => row.state)]).toEqual([
      0,
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ])
  })

  it("re-runs a rejected gate's stage and asks again", async () => {
    await toGate()
    expect((await pipe('reject', { gate: 'T1', note: 'redo' })).gates[0]?.decision).toBe('rejected')
    const result = await pipe('run')
    expect([result.exit, state(result, 'one'), state(result, 'two')]).toEqual([3, 'skipped', 'gated'])
    expect(gates().T1?.decision).toBe('pending')
    expect(await pipe('approve', { gate: 'T9' })).toMatchObject({
      exit: 1,
      error: "no gate 'T9' for this target",
    })
    expect((await pipe('approve')).error).toBe('approve needs a gate')
    // A person may change their mind: recording only, nothing runs.
    expect((await pipe('approve', { gate: 'T1' })).gates[0]?.decision).toBe('approved')
    expect((await pipe('reject', { gate: 'T1' })).gates[0]?.decision).toBe('rejected')
  })

  it('takes the decision time from the clock', async () => {
    dir = toyFolder()
    const at = Date.parse('2026-10-30T12:00:00.000Z')
    const decided = await exec(
      Effect.gen(function* () {
        yield* runPipeline(toyPipeline(), { command: 'run', target: dir })
        yield* TestClock.setTime(at)
        return yield* runPipeline(toyPipeline(), { command: 'approve', target: dir, gate: 'T1' })
      }).pipe(Effect.provide(layers)),
    )
    expect(decided.gates[0]?.decidedAt).toBe('2026-10-30T12:00:00.000Z')
  })

  it('refuses paid stages without --paid, and over budget (exit 4), spending nothing', async () => {
    await pastGate()
    const unpaid = await pipe('run')
    expect([unpaid.exit, unpaid.ok]).toEqual([4, false])
    expect(unpaid.error).toBe('paid stages need --paid: paid')
    const over = await pipe('run', { paid: true, budget: { images: 0 } })
    expect(over).toMatchObject({ exit: 4, estimate: { images: 1 } })
    expect(over.error).toBe('over budget: this run needs 1 images, the run budget is 0')
    expect(existsSync(join(dir, 'three.txt'))).toBe(false)
    expect(existsSync(join(dir, 'paid.txt'))).toBe(false)
    expect(existsSync(join(dir, 'pipeline-spend.json'))).toBe(false)
  })

  it('charges the project ledger before a paid stage runs', async () => {
    await pastGate()
    await pipe('run', { paid: true })
    expect(JSON.parse(readFileSync(join(dir, 'pipeline-spend.json'), 'utf8'))).toEqual({ images: 1 })
    // `fail` is not a hashed param, so the stage is forced.
    writeFileSync(join(dir, 'toy.toml'), 'param = 1\nfail = "paid"\n')
    expect((await pipe('run', { paid: true, only: ['paid'], force: true })).exit).toBe(1)
    // The failed call may have been charged by the provider, so it counts.
    expect(JSON.parse(readFileSync(join(dir, 'pipeline-spend.json'), 'utf8'))).toEqual({ images: 2 })
  })

  it('estimates the stages a run would execute, with their input hashes', async () => {
    await pastGate()
    const result = await pipe('estimate')
    expect(result).toMatchObject({ exit: 0, estimate: { images: 1 } })
    const plan = (result.data as { plan: { id: string; inputHash: string; paid: boolean }[] }).plan
    expect(plan.map((step) => [step.id, step.paid])).toEqual([
      ['three', false],
      ['paid', true],
    ])
    expect(plan[0]?.inputHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('estimates the next run only: up to a gate, nothing while it is pending, then on to the end', async () => {
    dir = toyFolder()
    const fresh = await pipe('estimate')
    expect((fresh.data as { plan: { id: string }[] }).plan.map((step) => step.id)).toEqual(['one', 'two'])
    expect(fresh.estimate).toEqual({})
    await pipe('run')
    const held = await pipe('estimate')
    expect([held.estimate, held.data]).toEqual([{}, { plan: [], blockedBy: null }])
    await pipe('approve', { gate: 'T1' })
    expect((await pipe('estimate')).estimate).toEqual({ images: 1 })
  })

  it('records a failing stage and exits 1', async () => {
    dir = toyFolder('param = 1\nfail = "one"\n')
    const result = await pipe('run')
    expect([result.exit, result.ok, state(result, 'one')]).toEqual([1, false, 'failed'])
    expect(result.error).toBe('one: one was told to fail')
    expect(records().one).toMatchObject({ state: 'failed', notes: 'one was told to fail' })
  })

  it('refuses an unknown stage in the selection', async () => {
    dir = toyFolder()
    expect(await pipe('run', { only: ['nine'] })).toMatchObject({
      exit: 1,
      error: "unknown stage 'nine'; stages: one, two, three, paid",
    })
  })

  it('adopts existing outputs without running anything', async () => {
    dir = toyFolder()
    for (const name of ['one', 'two']) writeFileSync(join(dir, `${name}.txt`), `made by hand ${name}\n`)
    const result = await pipe('adopt')
    expect([result.exit, state(result, 'one'), state(result, 'two'), state(result, 'three')]).toEqual([
      0,
      'adopted',
      'adopted',
      'pending',
    ])
    expect(readFileSync(join(dir, 'one.txt'), 'utf8')).toBe('made by hand one\n')
    expect(gates().T1?.decision).toBe('pending')
    expect((await pipe('run')).exit).toBe(3)
  })

  it('reports status and runs its checks', async () => {
    await toGate()
    const status = await pipe('status')
    expect([status.exit, state(status, 'two')]).toEqual([0, 'done'])
    expect(status.data).toEqual({ stale: [], needsRestore: [] })
    writeFileSync(join(dir, 'src.txt'), 'changed\n')
    expect((await pipe('status')).data).toEqual({ stale: ['one'], needsRestore: [] })
    const check = await pipe('check')
    expect(check.exit).toBe(0)
    expect((check.data as { checks: { id: string }[] }).checks.map((found) => found.id)).toEqual([
      'toy:spec',
      'outputs:one',
      'outputs:two',
    ])
    rmSync(join(dir, 'one.txt'))
    expect(await pipe('check')).toMatchObject({ exit: 1, error: 'failed: outputs:one' })
  })

  it('records that a pending gate was put to a person, deciding nothing', async () => {
    await toGate()
    const result = await pipe('request', { gate: 'T1', note: 'look at two' })
    expect(result.exit).toBe(0)
    expect(gates().T1).toEqual({
      id: 'T1',
      stage: 'two',
      decision: 'pending',
      files: ['two.txt'],
      requestedAt: '1970-01-01T00:00:00.000Z',
      summary: 'look at two',
    })
  })

  it('restores restorable outputs from the recorded task ids without paying again', async () => {
    await pastGate()
    await pipe('run', { paid: true })
    rmSync(join(dir, 'paid.txt'))
    expect((await pipe('status')).data).toEqual({ stale: [], needsRestore: ['paid'] })
    // A missing restorable output does not re-run its stage.
    expect(state(await pipe('run', { paid: true }), 'paid')).toBe('skipped')
    expect(await pipe('restore')).toMatchObject({ exit: 0, data: { restored: ['paid'] } })
    expect(readFileSync(join(dir, 'paid.txt'), 'utf8')).toBe('restored from toy-task-1\n')
    expect(JSON.parse(readFileSync(join(dir, 'pipeline-spend.json'), 'utf8'))).toEqual({ images: 1 })
  })

  it('exits 2 for restore when no stage can restore', async () => {
    dir = toyFolder()
    const plain = definePipeline({
      name: 'toy',
      spec: z.object({ param: z.number() }),
      stages: [{ id: 'one', outputs: () => ['one.txt'], run: () => Effect.succeed({}) }],
    })
    expect(await pipe('restore', {}, plain)).toMatchObject({ exit: 2, error: 'toy has no restore' })
  })

  it('names restore when a missing input is a restorable output', async () => {
    dir = toyFolder()
    const chain = definePipeline({
      name: 'toy',
      spec: z.object({ param: z.number() }),
      stages: [
        {
          id: 'fetch',
          restorable: () => ['a.bin'],
          run: (ctx) =>
            Effect.as(
              Effect.sync(() => writeFileSync(join(ctx.dir, 'a.bin'), 'a')),
              {},
            ),
        },
        { id: 'use', inputs: () => ['a.bin'], outputs: () => ['b.txt'], run: () => Effect.succeed({}) },
      ],
    })
    expect(state(await pipe('run', { only: ['fetch'] }, chain), 'fetch')).toBe('done')
    rmSync(join(dir, 'a.bin'))
    expect(await pipe('run', {}, chain)).toMatchObject({
      exit: 1,
      error: 'use: missing inputs a.bin (run `restore` first)',
    })
  })

  it('fails every command on a spec that does not parse, and writes nothing', async () => {
    dir = toyFolder('param = "one"\n')
    for (const command of ['run', 'estimate', 'status'] as const)
      expect(await pipe(command)).toMatchObject({
        exit: 1,
        error: expect.stringMatching(/^toy\.toml: param: Invalid input: expected number/),
      })
    rmSync(join(dir, 'toy.toml'))
    expect((await pipe('run')).error).toMatch(/^toy\.toml: /)
    expect(existsSync(join(dir, '.stage.json'))).toBe(false)
  })

  it('refuses paid stages when no pipeline.toml is found (fail closed)', async () => {
    await pastGate()
    rmSync(join(dir, 'pipeline.toml'))
    expect(await pipe('run', { paid: true })).toMatchObject({
      exit: 4,
      error: 'no budget for images: set [budget.images] in pipeline.toml',
    })
  })

  // Review round 1, finding 1: --only must not step over a pending gate in the middle of the selection.
  it('stops at a held gate between selected stages, even when that stage is not selected', async () => {
    dir = toyFolder()
    const write = (name: string) => (ctx: { dir: string }) =>
      Effect.as(
        Effect.sync(() => writeFileSync(join(ctx.dir, name), name)),
        {},
      )
    const gapped = definePipeline({
      name: 'toy',
      spec: z.object({ param: z.number() }),
      stages: [
        { id: 'a', outputs: () => ['a.txt'], run: write('a.txt') },
        { id: 'b', gate: 'G1', inputs: () => ['a.txt'], outputs: () => ['b.txt'], run: write('b.txt') },
        { id: 'c', cost: { budget: 'images', units: 1 }, outputs: () => ['c.txt'], run: write('c.txt') },
      ],
    })
    expect((await pipe('run', {}, gapped)).exit).toBe(3)
    const skipped = await pipe('run', { only: ['a', 'c'], paid: true, force: true }, gapped)
    expect(skipped.exit).toBe(3)
    expect(skipped.error).toMatch(/^gate G1 \(stage b\) is pending/)
    expect(existsSync(join(dir, 'c.txt'))).toBe(false)
    expect(existsSync(join(dir, 'pipeline-spend.json'))).toBe(false)
  })

  // Review round 1, finding 4: stage paths stay inside the target folder (M3.9 builds them from spec values).
  it.each([
    ['inputs', '../outside.txt'],
    ['inputs', '/etc/hostname'],
    ['outputs', 'sub/../../escape.txt'],
  ] as const)('refuses %s path %j outside the target folder', async (kind, path) => {
    dir = toyFolder()
    const escaping = definePipeline({
      name: 'toy',
      spec: z.object({ param: z.number() }),
      stages: [{ id: 'one', [kind]: () => [path], run: () => Effect.succeed({}) }],
    })
    for (const command of ['run', 'estimate'] as const)
      expect(await pipe(command, {}, escaping)).toMatchObject({
        exit: 1,
        error: `one: ${kind} path '${path}' is outside the target folder`,
      })
  })
})
