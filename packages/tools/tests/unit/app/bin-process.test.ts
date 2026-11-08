import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// pnpm links the workspace `automata` bin to the source file, so plain Node must be able to load it. A command
// that pulls in a package with extensionless imports (the editor suite) crashed every in-repository use.
const BIN = join(import.meta.dirname, '../../../src/app/bin.ts')

describe('the workspace automata bin, run from source by plain Node', () => {
  it('prints the usage for --help and exits 0', () => {
    const run = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('Usage: automata create-game')
    expect(run.status).toBe(0)
  })

  it('prints the ship usage for `ship --help` and exits 0', () => {
    const run = spawnSync(process.execPath, [BIN, 'ship', '--help'], { encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('automata ship prepare')
    expect(run.status).toBe(0)
  })
})
