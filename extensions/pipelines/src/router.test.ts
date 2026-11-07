import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer, TestContext } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { definePipeline } from './pipeline.ts'
import { type RouterOutput, route } from './router.ts'
import { toyPipeline } from './testing/toy.ts'

// The Last Light's `scripts/pipe.mjs` tests (tests/pipeline-runner.test.ts, "the pipe CLI", at 92e6704), made
// generic: the registry holds the toy, and `character` and `props` are planned (M3.9), so they exit 2.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function toyFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-router-'))
  temps.push(dir)
  writeFileSync(join(dir, 'src.txt'), 'source\n')
  writeFileSync(join(dir, 'toy.toml'), 'param = 1\n')
  writeFileSync(join(dir, 'pipeline.toml'), '[budget.images]\nproject = 10\nrun = 4\n')
  return dir
}

const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive, TestContext.TestContext)
const cli = (...argv: string[]): Promise<RouterOutput> =>
  Effect.runPromise(route(argv, [toyPipeline()]).pipe(Effect.provide(layers)))

/** Runs with --json and checks the rule: stdout is exactly one JSON object, whose exit is the exit code. */
const json = async (...argv: string[]): Promise<Record<string, unknown>> => {
  const out = await cli(...argv, '--json')
  const lines = out.stdout.trimEnd().split('\n')
  expect(lines, `stdout must be one JSON object; stderr: ${out.stderr}`).toHaveLength(1)
  const result = JSON.parse(lines[0] as string) as Record<string, unknown>
  expect(result.exit).toBe(out.exit)
  return result
}

describe('the router', () => {
  it('lists every pipeline and the commands', async () => {
    for (const argv of [[], ['--help'], ['-h'], ['help']]) {
      const out = await cli(...argv)
      expect(out.exit).toBe(0)
      expect(out.stdout).toMatch(/^usage: automata-pipe <pipeline> <command> <target> \[gate\]/)
      expect(out.stdout).toMatch(/^ {2}toy {7}one, two \(gate T1\), three, paid \(images\)$/m)
      expect(out.stdout).toMatch(/^ {2}character {1}not implemented yet$/m)
      expect(out.stdout).toContain(
        'status · estimate · run · approve · reject · restore · check · adopt · request',
      )
    }
  })

  it('runs a command on a target folder and prints one JSON object', async () => {
    const dir = toyFolder()
    expect(await json('toy', 'run', dir)).toMatchObject({
      ok: true,
      exit: 3,
      pipeline: 'toy',
      command: 'run',
    })
    expect(await json('toy', 'status', join(dir, 'toy.toml'))).toMatchObject({ ok: true, exit: 0 })
  })

  it('takes the gate after the target, and options in either form', async () => {
    const dir = toyFolder()
    await json('toy', 'run', dir)
    const approved = await json('toy', 'approve', dir, 'T1', '--note', 'fine')
    expect(approved.gates).toEqual([
      expect.objectContaining({ id: 'T1', decision: 'approved', note: 'fine' }),
    ])
    expect(
      await json('toy', 'run', dir, '--only=three,paid', '--paid', '--budget', 'images=0'),
    ).toMatchObject({
      exit: 4,
      error: 'over budget: this run needs 1 images, the run budget is 0',
    })
    expect(await json('toy', 'run', dir, '--from', 'three', '--to=three')).toMatchObject({ exit: 0 })
    expect(JSON.parse(readFileSync(join(dir, '.stage.json'), 'utf8')).three.state).toBe('done')
  })

  it('reads pipeline.toml from --config', async () => {
    const dir = toyFolder()
    const elsewhere = mkdtempSync(join(tmpdir(), 'pipe-config-'))
    temps.push(elsewhere)
    writeFileSync(join(elsewhere, 'budgets.toml'), '[budget.images]\nproject = 0\nrun = 0\n')
    await json('toy', 'run', dir)
    await json('toy', 'approve', dir, 'T1')
    const config = join(elsewhere, 'budgets.toml')
    expect(await json('toy', 'run', dir, '--paid', '--config', config)).toMatchObject({
      exit: 4,
      error: 'over budget: this run needs 1 images, the run budget is 0',
    })
  })

  it('exits 2 for a planned pipeline that is not built yet', async () => {
    expect(await json('character', 'status', 'nowhere')).toEqual({
      ok: false,
      pipeline: 'character',
      command: 'status',
      exit: 2,
      error: 'character: not implemented',
    })
  })

  it.each([
    [['nine', 'run', 'x'], "unknown pipeline 'nine'; see --help"],
    [
      ['toy'],
      'toy needs a command; commands: status, estimate, run, approve, reject, restore, check, adopt, request',
    ],
    [
      ['toy', 'go', 'x'],
      "toy has no command 'go'; commands: status, estimate, run, approve, reject, restore, check, adopt, request",
    ],
    [['toy', 'run'], 'toy run needs a target'],
    [['toy', 'run', 'x', '--fast'], 'unknown option --fast'],
    [['toy', 'run', 'x', '--from'], '--from needs a value'],
    [['toy', 'run', 'x', '--budget', 'images'], "--budget: 'images' is not key=N (N a whole number)"],
    [['toy', 'approve', 'x', 'T1', 'extra'], 'unexpected argument extra'],
  ])('exits 1 for %j', async (argv, error) => {
    expect(await json(...argv)).toMatchObject({ ok: false, exit: 1, error })
  })

  it('prints lines for people without --json, and the error on stderr', async () => {
    const dir = toyFolder()
    const out = await cli('toy', 'run', dir)
    expect(out.exit).toBe(3)
    expect(out.stdout).toContain('one          done')
    expect(out.stdout).toContain('two          gated  gate T1')
    expect(out.stdout).toContain('gate T1: pending')
    expect(() => JSON.parse(out.stdout)).toThrow()
    const refused = await cli('nine', 'run', dir)
    expect([refused.exit, refused.stdout, refused.stderr]).toEqual([
      1,
      '',
      "unknown pipeline 'nine'; see --help\n",
    ])
  })

  // Review round 1, finding 2: a stage that throws is a failed stage (exit 1, one JSON object), not a crash.
  it.each([
    [
      'throws in run',
      {
        run: (): never => {
          throw new Error('boom')
        },
      },
    ],
    [
      'dies inside its effect',
      {
        run: () =>
          Effect.sync((): never => {
            throw new Error('boom')
          }),
      },
    ],
    [
      'throws in outputs',
      {
        outputs: (): never => {
          throw new Error('boom')
        },
        run: () => Effect.succeed({}),
      },
    ],
  ])('exits 1 with one JSON object when a stage %s', async (_, members) => {
    const dir = toyFolder()
    const throwing = definePipeline({
      name: 'toy',
      spec: z.object({ param: z.number() }),
      stages: [{ id: 'paid', cost: { budget: 'images', units: 1 }, ...members }],
    })
    const out = await Effect.runPromise(
      route(['toy', 'run', dir, '--paid', '--json'], [throwing]).pipe(Effect.provide(layers)),
    )
    expect(out.exit).toBe(1)
    const lines = out.stdout.trimEnd().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] as string)).toMatchObject({ ok: false, exit: 1, error: 'paid: boom' })
    expect(JSON.parse(readFileSync(join(dir, '.stage.json'), 'utf8')).paid).toMatchObject({
      state: 'failed',
      notes: 'boom',
    })
  })
})

describe("the router and an agent's decision (M3.8b, PL-d)", () => {
  const agent = { agent: true, env: {} }
  const asAgent = async (...argv: string[]) => {
    const out = await Effect.runPromise(
      route([...argv, '--json'], [toyPipeline()], undefined, agent).pipe(Effect.provide(layers)),
    )
    const lines = out.stdout.trimEnd().split('\n')
    expect(lines).toHaveLength(1)
    return { exit: out.exit, result: JSON.parse(lines[0] as string) as Record<string, unknown> }
  }
  const auditLines = (dir: string) =>
    existsSync(join(dir, 'docs/pipeline-audit.jsonl'))
      ? readFileSync(join(dir, 'docs/pipeline-audit.jsonl'), 'utf8')
          .trimEnd()
          .split('\n')
          .map((line) => JSON.parse(line) as Record<string, unknown>)
      : []

  it.each(['approve', 'reject'])(
    'refuses an agent its %s with exit 4, leaves the gate and logs it',
    async (command) => {
      const dir = toyFolder()
      expect((await asAgent('toy', 'run', dir)).exit).toBe(3)
      const gates = readFileSync(join(dir, 'gates.json'), 'utf8')
      const refused = await asAgent('toy', command, dir, 'T1', '--note', 'looks fine')
      expect(refused.exit).toBe(4)
      expect(refused.result).toEqual({
        ok: false,
        pipeline: 'toy',
        command,
        exit: 4,
        error: `refused: only a person decides a gate; an agent asks with pipeline_request_review (MCP)`,
      })
      expect(readFileSync(join(dir, 'gates.json'), 'utf8')).toBe(gates)
      const lines = auditLines(dir)
      expect(lines).toEqual([
        {
          at: expect.any(String),
          tool: `automata-pipe ${command}`,
          args: { pipeline: 'toy', target: dir, gate: 'T1', note: 'looks fine' },
          ok: false,
          summary: refused.result.error,
          ms: expect.any(Number),
          head: 'unknown',
        },
      ])
    },
  )

  it("lets an agent read and run, and a person's approve still works and logs nothing", async () => {
    const dir = toyFolder()
    expect((await asAgent('toy', 'status', dir)).exit).toBe(0)
    expect((await asAgent('toy', 'run', dir)).exit).toBe(3)
    expect((await json('toy', 'approve', dir, 'T1')).exit).toBe(0)
    expect(auditLines(dir)).toEqual([])
  })
})
