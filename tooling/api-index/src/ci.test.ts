import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The index is built from emitted .d.ts, so it runs after `pnpm build`, in CI and in the local gate alike.
const root = fileURLToPath(new URL('../../..', import.meta.url))
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>

describe('pnpm api-index in the gates', () => {
  it('is a root script running this package', () => {
    expect(scripts['api-index']).toBe('node tooling/api-index/src/cli.ts')
  })

  it('runs after pnpm build in ci:local', () => {
    const steps = (scripts['ci:local'] ?? '').split(' && ')
    expect(steps.indexOf('pnpm api-index')).toBeGreaterThan(steps.indexOf('pnpm build'))
    expect(steps.indexOf('pnpm build')).toBeGreaterThan(-1)
  })

  it("runs after pnpm build in ci.yml's checks job", () => {
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
    const checks = ci.slice(ci.indexOf('\n  checks:'), ci.indexOf('\n  parity:'))
    const build = checks.indexOf('\n      - run: pnpm build\n')
    expect(build).toBeGreaterThan(-1)
    expect(checks.indexOf('\n      - run: pnpm api-index\n')).toBeGreaterThan(build)
  })
})
