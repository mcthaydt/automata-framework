import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The release check runs where every change to a published package passes: CI's checks job and `ci:local`
// (AGENTS.md: CI runs locally), after the changeset checks it relies on.
const root = new URL('../../../', import.meta.url)
const ciYml = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8')
const scripts = (
  JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { scripts: Record<string, string> }
).scripts

describe('the API report release check is wired in', () => {
  it('is the root `api-report` script', () => {
    expect(scripts['api-report']).toBe('node tooling/api-report/src/cli.ts')
  })

  it("runs in ci.yml's checks job after check-changesets", () => {
    const checks = ciYml.slice(ciYml.indexOf('  checks:'), ciYml.indexOf('\n  parity:'))
    expect(checks.indexOf('- run: pnpm api-report')).toBeGreaterThan(checks.indexOf('check-changesets.ts'))
  })

  it('runs in ci:local after check-changesets', () => {
    const steps = (scripts['ci:local'] ?? '').split(' && ')
    expect(steps.indexOf('pnpm api-report')).toBe(
      steps.indexOf('node tooling/release/src/check-changesets.ts') + 1,
    )
  })
})
