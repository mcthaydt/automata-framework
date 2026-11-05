import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { ProcessRunner, ProcessRunnerLive } from '#src/shared/node/process-runner.ts'

const run = <A, E>(effect: Effect.Effect<A, E, ProcessRunner>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, ProcessRunnerLive))

describe('ProcessRunner (node:child_process)', () => {
  it('captures stdout, stderr and a non-zero exit code as a result, not an error', async () => {
    const result = await run(
      Effect.flatMap(ProcessRunner, (runner) =>
        runner.run(process.execPath, ['-e', 'console.log("out"); console.error("err"); process.exit(3)']),
      ),
    )
    expect(result).toEqual({ exitCode: 3, stdout: 'out\n', stderr: 'err\n' })
  })

  it('passes cwd, env and stdin to the program', async () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'automata-node-run-')))
    const script =
      'let input = ""; process.stdin.on("data", (d) => (input += d)); process.stdin.on("end", () => console.log(JSON.stringify([process.cwd(), process.env.SHIP_TEST, input])))'
    const result = await run(
      Effect.flatMap(ProcessRunner, (runner) =>
        runner.run(process.execPath, ['-e', script], {
          cwd,
          env: { SHIP_TEST: 'yes' },
          stdin: new TextEncoder().encode('piped'),
        }),
      ),
    )
    expect(JSON.parse(result.stdout)).toEqual([cwd, 'yes', 'piped'])
  })

  it('fails with ProcessError when the program cannot be started', async () => {
    const result = await run(
      Effect.either(Effect.flatMap(ProcessRunner, (runner) => runner.run('automata-no-such-program', []))),
    )
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('ProcessError')
    expect(result.left.message).toContain('automata-no-such-program')
  })
})
