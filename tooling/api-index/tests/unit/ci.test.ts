import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The index is built from emitted .d.ts, so it runs after `pnpm build`, in the release checks (refactor task 1.2).
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>

describe('pnpm api-index in the gates', () => {
  it('is a root script running this package', () => {
    expect(scripts['api-index']).toBe('node tooling/api-index/src/cli.ts')
  })

  it('has a root cheatsheet script that rewrites the committed page', () => {
    expect(scripts.cheatsheet).toBe('node tooling/api-index/src/cli.ts --write-cheatsheet')
  })

  it("runs after pnpm build in release-checks.yml's job", () => {
    const releaseChecks = readFileSync(join(root, '.github/workflows/release-checks.yml'), 'utf8')
    const build = releaseChecks.indexOf('\n      - run: pnpm build\n')
    expect(build).toBeGreaterThan(-1)
    expect(releaseChecks.indexOf('\n      - run: pnpm api-index\n')).toBeGreaterThan(build)
  })
})
