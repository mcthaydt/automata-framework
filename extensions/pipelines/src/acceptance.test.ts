import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer, TestContext } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Files, FilesLive, ProcessRunner, ProcessRunnerLive } from './node-seams.ts'
import { definePipeline, type StageDef, StageFailed } from './pipeline.ts'
import { route } from './router.ts'
import { type FakeApi, fakeApi } from './testing/fake-api.ts'

// The M3 spec's PL-a and PL-b (§13), on a fake paid API (testing/fake-api.ts). The pipeline has the character
// pipeline's shape without its art: two paid image stages up to gate G1, a paid model stage up to G3, a free rig.
// The model stage calls the API through ProcessRunner, as the Python stages will.

interface Spec {
  readonly name: string
}

const write = (dir: string, file: string, text: string) =>
  Effect.flatMap(Files, (files) => files.writeText(join(dir, file), text))

/** A paid stage that POSTs to the fake API with fetch and records the task id it answers. */
const fetched = (api: FakeApi, id: string, units: number, input: string, gate?: string): StageDef<Spec> => ({
  id,
  cost: { budget: 'images', units },
  ...(gate === undefined ? {} : { gate }),
  inputs: () => [input],
  outputs: () => [`${id}.txt`],
  run: (ctx) =>
    Effect.gen(function* () {
      const answer = yield* Effect.tryPromise({
        try: () =>
          fetch(`${api.url}/${id}`, { method: 'POST' }).then(
            (response) => response.json() as Promise<{ task: string }>,
          ),
        catch: (cause) => new StageFailed({ stage: id, reason: String(cause) }),
      })
      yield* write(ctx.dir, `${id}.txt`, `${ctx.spec.name} ${answer.task}\n`)
      return { tasks: { [id]: answer.task } }
    }),
})

/** A paid stage that starts Node through ProcessRunner to make its call, as a Python stage would. */
const spawned = (api: FakeApi): StageDef<Spec> => ({
  id: 'model',
  cost: { budget: 'meshyCredits', units: 30 },
  gate: 'G3',
  inputs: () => ['turnaround.txt'],
  outputs: () => ['model.txt'],
  run: (ctx) =>
    Effect.gen(function* () {
      const script =
        'const r = await fetch(process.argv[1], { method: "POST" }); process.stdout.write((await r.json()).task)'
      const out = yield* (yield* ProcessRunner).run(process.execPath, [
        '--input-type=module',
        '-e',
        script,
        `${api.url}/model`,
      ])
      if (out.exitCode !== 0) return yield* new StageFailed({ stage: 'model', reason: out.stderr })
      yield* write(ctx.dir, 'model.txt', `model ${out.stdout}\n`)
      return { tasks: { model: out.stdout } }
    }),
})

const pipelineFor = (api: FakeApi) =>
  definePipeline<Spec>({
    name: 'fake-character',
    spec: z.object({ name: z.string() }).strict(),
    stages: [
      fetched(api, 'look', 1, 'fake-character.toml'),
      fetched(api, 'turnaround', 2, 'look.txt', 'G1'),
      spawned(api),
      {
        id: 'rig',
        inputs: () => ['model.txt'],
        outputs: () => ['rig.txt'],
        run: (ctx) => Effect.as(write(ctx.dir, 'rig.txt', 'rigged\n'), {}),
      },
    ],
  })

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(budgets: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-accept-'))
  temps.push(dir)
  writeFileSync(join(dir, 'pipeline.toml'), budgets)
  writeFileSync(join(dir, 'fake-character.toml'), 'name = "wren"\n')
  return dir
}

const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive, TestContext.TestContext)

/** Runs `test` with a fresh fake API and a `pipe` that routes --json command lines to the pipeline. */
const withApi = (
  test: (
    api: FakeApi,
    pipe: (...argv: string[]) => Effect.Effect<Record<string, unknown>>,
  ) => Effect.Effect<void>,
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const api = yield* fakeApi
        const pipeline = pipelineFor(api)
        const pipe = (...argv: string[]) =>
          Effect.map(route([pipeline.name, ...argv, '--json'], [pipeline]), (out) => {
            const result = JSON.parse(out.stdout) as Record<string, unknown>
            expect(result.exit).toBe(out.exit)
            return result
          }).pipe(Effect.provide(layers))
        yield* test(api, pipe)
      }),
    ),
  )

describe('PL-a: budgets refuse before any call', () => {
  it('estimate prints the stage costs; a run one unit short of the run budget exits 4 with no request', () =>
    withApi((api, pipe) =>
      Effect.gen(function* () {
        const dir = project('[budget.images]\nproject = 60\nrun = 2\n')
        const estimate = yield* pipe('estimate', dir)
        expect(estimate).toMatchObject({ exit: 0, estimate: { images: 3 } })
        expect((estimate.data as { plan: unknown[] }).plan).toEqual([
          { id: 'look', inputHash: expect.stringMatching(/^[0-9a-f]{16}$/), paid: true, cost: { images: 1 } },
          { id: 'turnaround', inputHash: 'missing', paid: true, cost: { images: 2 }, gate: 'G1' },
        ])
        const run = yield* pipe('run', dir, '--paid')
        expect(run).toMatchObject({
          ok: false,
          exit: 4,
          estimate: { images: 3 },
          error: 'over budget: this run needs 3 images, the run budget is 2',
        })
        expect(api.requests()).toEqual([])
        for (const file of ['look.txt', '.stage.json', 'pipeline-spend.json'])
          expect(existsSync(join(dir, file))).toBe(false)
      }),
    ))

  it('a run one unit short of what is left of the project budget exits 4 with no request', () =>
    withApi((api, pipe) =>
      Effect.gen(function* () {
        const dir = project('[budget.images]\nproject = 5\nrun = 3\n')
        writeFileSync(join(dir, 'pipeline-spend.json'), '{ "images": 3 }\n')
        expect(yield* pipe('run', dir, '--paid')).toMatchObject({
          exit: 4,
          error: 'over budget: this run needs 3 images, the project has 2 of 5 left',
        })
        expect(api.requests()).toEqual([])
        // One unit more of project budget and the same run calls the API (the server is listening).
        writeFileSync(join(dir, 'pipeline.toml'), '[budget.images]\nproject = 6\nrun = 3\n')
        expect((yield* pipe('run', dir, '--paid')).exit).toBe(3)
        expect(api.requests()).toEqual(['POST /look', 'POST /turnaround'])
        expect(JSON.parse(readFileSync(join(dir, 'pipeline-spend.json'), 'utf8'))).toEqual({ images: 6 })
      }),
    ))
})

describe('PL-b: a run stopped at a gate resumes past every cached stage', () => {
  it('calls the API once per paid stage across the gates', () =>
    withApi((api, pipe) =>
      Effect.gen(function* () {
        const dir = project(
          '[budget.images]\nproject = 60\nrun = 16\n[budget.meshyCredits]\nproject = 900\nrun = 520\n',
        )
        const states = (result: Record<string, unknown>) =>
          (result.stages as { id: string; state: string }[]).map((row) => `${row.id}:${row.state}`)

        const first = yield* pipe('run', dir, '--paid')
        expect([first.exit, states(first)]).toEqual([
          3,
          ['look:done', 'turnaround:gated', 'model:pending', 'rig:pending'],
        ])
        expect(api.requests()).toEqual(['POST /look', 'POST /turnaround'])

        expect((yield* pipe('approve', dir, 'G1')).exit).toBe(0)
        const second = yield* pipe('run', dir, '--paid')
        expect([second.exit, states(second)]).toEqual([
          3,
          ['look:skipped', 'turnaround:skipped', 'model:gated', 'rig:pending'],
        ])
        expect(api.requests()).toEqual(['POST /look', 'POST /turnaround', 'POST /model'])
        expect(readFileSync(join(dir, 'model.txt'), 'utf8')).toBe('model task-3\n')

        // Stopped at G3: running again calls nothing and stays there.
        const held = yield* pipe('run', dir, '--paid')
        expect([held.exit, held.error]).toEqual([3, 'gate G3 is pending'])
        expect(yield* pipe('estimate', dir)).toMatchObject({
          estimate: {},
          data: { plan: [], blockedBy: null },
        })

        expect((yield* pipe('approve', dir, 'G3')).exit).toBe(0)
        const last = yield* pipe('run', dir, '--paid')
        expect([last.exit, states(last)]).toEqual([
          0,
          ['look:skipped', 'turnaround:skipped', 'model:skipped', 'rig:done'],
        ])
        expect(api.requests()).toHaveLength(3)
        expect(last.spent).toEqual({ images: 3, meshyCredits: 30 })
        expect(JSON.parse(readFileSync(join(dir, '.stage.json'), 'utf8')).model.tasks).toEqual({
          model: 'task-3',
        })
      }),
    ))
})
