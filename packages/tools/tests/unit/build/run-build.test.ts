import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { runBuild } from '#src/features/build/run-build.ts'
import { Files } from '#src/shared/node/files.ts'
import { ProcessRunner, type RunOptions, type RunResult } from '#src/shared/node/process-runner.ts'

// FR.3: `automata build` runs the game's own `vite build`; `--debug` sets AUTOMATA_DEBUG=1 for it, which the content plugin turns into
// the `__AUTOMATA_DEBUG__` constant. A release build sets nothing, so its debug-only code is dropped.

const GAME = '/work/moss'
const VITE = `${GAME}/node_modules/.bin/vite`
interface Call {
  readonly command: string
  readonly args: readonly string[]
  readonly options: RunOptions | undefined
}

function run(options: { debug: boolean; installed?: boolean; exitCode?: number }) {
  const calls: Call[] = []
  const result: RunResult = {
    exitCode: options.exitCode ?? 0,
    stdout: 'built',
    stderr: options.exitCode ? 'boom' : '',
  }
  const layers = Layer.mergeAll(
    Layer.succeed(ProcessRunner, {
      run: (command, args, runOptions) =>
        Effect.sync(() => {
          calls.push({ command, args, options: runOptions })
          return result
        }),
    }),
    Layer.succeed(Files, {
      readText: () => Effect.die('unused'),
      readBytes: () => Effect.die('unused'),
      writeText: () => Effect.die('unused'),
      exists: (path) => Effect.succeed(options.installed !== false && path === VITE),
      listFiles: () => Effect.succeed([]),
      remove: () => Effect.void,
    }),
  )
  const outcome = Effect.runPromise(
    Effect.provide(Effect.either(runBuild({ gameDir: GAME, debug: options.debug })), layers),
  )
  return { calls, outcome }
}

describe('runBuild', () => {
  it('runs vite build in the game folder and sets nothing for a release build', async () => {
    const { calls, outcome } = run({ debug: false })
    expect(await outcome).toMatchObject({ _tag: 'Right', right: { exitCode: 0 } })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ command: VITE, args: ['build'] })
    expect(calls[0]?.options?.cwd).toBe(GAME)
    expect(calls[0]?.options?.env?.AUTOMATA_DEBUG).toBeUndefined()
  })

  it('sets AUTOMATA_DEBUG=1 for a --debug build', async () => {
    const { calls, outcome } = run({ debug: true })
    await outcome
    expect(calls[0]?.options?.env).toEqual({ AUTOMATA_DEBUG: '1' })
  })

  it('reports vite’s exit code and the tail of its output when the build fails', async () => {
    const outcome = await run({ debug: false, exitCode: 1 }).outcome
    expect(outcome).toMatchObject({ _tag: 'Right', right: { exitCode: 1 } })
    expect(outcome._tag === 'Right' && outcome.right.tail).toContain('boom')
  })

  it('fails naming vite and how to install it when it is not there', async () => {
    const outcome = await run({ debug: false, installed: false }).outcome
    expect(outcome._tag === 'Left' && outcome.left.message).toBe(
      'vite not found; install it: npm install --save-dev vite',
    )
  })
})
