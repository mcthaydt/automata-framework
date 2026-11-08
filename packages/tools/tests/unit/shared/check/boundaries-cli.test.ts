import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { boundariesCli } from '#src/shared/check/check-steps.ts'

// The boundaries step of `automata check` runs the checker that ships inside this package. A new game installs no
// `automata-check-boundaries` of its own, so the step has to find the checker beside itself.
describe('boundariesCli', () => {
  it('is a file in this package, not a separately installed one', () => {
    const cli = boundariesCli()
    expect(existsSync(cli)).toBe(true)
    expect(cli).toContain(join('src', 'features', 'boundaries', 'cli.ts'))
  })

  it('runs, and passes a clean sim file', () => {
    const root = mkdtempSync(join(tmpdir(), 'boundaries-cli-'))
    writeFileSync(join(root, 'clean.ts'), 'export const answer = 42\n')
    const out = execFileSync(process.execPath, [boundariesCli(), root], { encoding: 'utf8' })
    expect(out).toContain('0 findings')
  })
})
