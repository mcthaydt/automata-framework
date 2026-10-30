import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// runMain replaced Effect.runPromise in both bins (M3.8b review round 3). A rejected runPromise made Node print the
// error and exit 1; a program that dies under runMain must still fail loudly, never exit 0 in silence.
describe('runMain', () => {
  it('exits 1 and prints the cause when the program dies', () => {
    const die = fileURLToPath(new URL('./testing/die.ts', import.meta.url))
    const run = spawnSync(process.execPath, [die], { encoding: 'utf8' })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('the command broke')
  })
})
