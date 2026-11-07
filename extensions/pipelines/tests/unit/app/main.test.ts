import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { runMain } from '#src/app/main.ts'

// runMain replaced Effect.runPromise in both bins. A rejected runPromise made Node print the
// error and exit 1; a program that dies under runMain must still fail loudly, never exit 0 in silence.
describe('runMain', () => {
  it('exits 1 and prints the cause when the program dies', () => {
    const die = fileURLToPath(new URL('../../../src/testing/die.ts', import.meta.url))
    const run = spawnSync(process.execPath, [die], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('the command broke')
  })
  // Issue #14: Effect.runFork runs the fiber synchronously up to its first async boundary, so a program's first effects
  // run inside runFork. Handlers installed after it left a window where a signal met no listener and killed the process.
  it('listens for SIGINT and SIGTERM before the program’s first effect runs', async () => {
    const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]
    const seen = await new Promise<number[]>((done) =>
      runMain(
        Effect.sync(() => [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]),
        done,
      ),
    )
    expect(seen).toEqual([before[0]! + 1, before[1]! + 1])
    expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toEqual(before)
  })

  it('exits 130 on a SIGINT that arrives during the program’s first synchronous step', () => {
    const fixture = fileURLToPath(new URL('../../../src/testing/signal-first.ts', import.meta.url))
    const run = spawnSync(process.execPath, [fixture], { encoding: 'utf8', timeout: 20_000 })
    expect({ status: run.status, signal: run.signal }).toEqual({ status: 130, signal: null })
  })
})
