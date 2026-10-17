import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The API reference is compared with DX.4's output, so `pnpm agent-skills` runs after `pnpm api-index`; the
// manifests are validated by Claude Code itself (`pnpm plugin:validate`). Both run in CI and in the local gate.
const root = fileURLToPath(new URL('../../..', import.meta.url))
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>

describe('the agent package in the gates', () => {
  it('has root scripts for the package check and for Claude Code validation (pinned)', () => {
    expect(scripts['agent-skills']).toBe('node tooling/agent-skills/src/cli.ts')
    const validate = scripts['plugin:validate'] ?? ''
    expect(validate).toContain(
      'pnpm dlx @anthropic-ai/claude-code@2.1.301 plugin validate agents/automata --strict',
    )
    expect(validate).toContain('pnpm dlx @anthropic-ai/claude-code@2.1.301 plugin validate . --strict')
  })

  it('runs both after pnpm api-index in ci:local', () => {
    const steps = (scripts['ci:local'] ?? '').split(' && ')
    const apiIndex = steps.indexOf('pnpm api-index')
    expect(apiIndex).toBeGreaterThan(-1)
    expect(steps.indexOf('pnpm agent-skills')).toBeGreaterThan(apiIndex)
    expect(steps.indexOf('pnpm plugin:validate')).toBeGreaterThan(apiIndex)
  })

  it("runs both after pnpm api-index in ci.yml's checks job", () => {
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
    const checks = ci.slice(ci.indexOf('\n  checks:'), ci.indexOf('\n  parity:'))
    const apiIndex = checks.indexOf('\n      - run: pnpm api-index\n')
    expect(apiIndex).toBeGreaterThan(-1)
    expect(checks.indexOf('\n      - run: pnpm agent-skills\n')).toBeGreaterThan(apiIndex)
    expect(checks.indexOf('\n      - run: pnpm plugin:validate\n')).toBeGreaterThan(apiIndex)
  })
})
