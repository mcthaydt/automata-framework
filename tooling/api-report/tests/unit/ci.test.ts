import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The release check runs in the release checks workflow (push to main and nightly; refactor task 1.2), where every
// published package is built, and it follows the changeset checks the PR gate already ran.
const root = new URL('../../../../', import.meta.url)
const releaseChecks = readFileSync(new URL('.github/workflows/release-checks.yml', root), 'utf8')
const scripts = (
  JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { scripts: Record<string, string> }
).scripts

describe('the API report release check is wired in', () => {
  it('is the root `api-report` script', () => {
    expect(scripts['api-report']).toBe('node tooling/api-report/src/cli.ts')
  })

  it("runs in release-checks.yml's job before the build that the other release checks need", () => {
    const apiReport = releaseChecks.indexOf('- run: pnpm api-report')
    expect(apiReport).toBeGreaterThan(-1)
    expect(releaseChecks.indexOf('- run: pnpm build\n')).toBeGreaterThan(apiReport)
  })
})
