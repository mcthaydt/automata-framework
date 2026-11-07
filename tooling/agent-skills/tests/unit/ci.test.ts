import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The API reference is compared with DX.4's output, so `pnpm agent-skills` runs after `pnpm api-index`; the
// manifests are validated by Claude Code itself (`pnpm plugin:validate`). Both run in the release checks.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
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

  it("runs both after pnpm api-index in release-checks.yml's job", () => {
    // Release checks run on a push to main and on the nightly schedule, not on every pull request (refactor task 1.2).
    const releaseChecks = readFileSync(join(root, '.github/workflows/release-checks.yml'), 'utf8')
    const apiIndex = releaseChecks.indexOf('\n      - run: pnpm api-index\n')
    expect(apiIndex).toBeGreaterThan(-1)
    expect(releaseChecks.indexOf('\n      - run: pnpm agent-skills\n')).toBeGreaterThan(apiIndex)
    expect(releaseChecks.indexOf('\n      - run: pnpm plugin:validate\n')).toBeGreaterThan(apiIndex)
  })

  it('plugin:validate checks the mirror tree', () => {
    const validate = scripts['plugin:validate'] ?? ''
    expect(validate).toContain('node tooling/agent-skills/src/mirror-cli.ts --out .mirror/automata-skills')
    expect(validate).toContain('plugin validate .mirror/automata-skills --strict')
  })
})

describe('the release job that fills the mirror', () => {
  const workflow = readFileSync(join(root, '.github/workflows/release-packages.yml'), 'utf8')
  const job = workflow.slice(workflow.indexOf('\n  skills:\n'))

  it('writes the mirror with the generator', () => {
    expect(job).toContain('node tooling/agent-skills/src/mirror-cli.ts --out "$mirror"')
    expect(job).toContain('actions/setup-node')
    expect(job).not.toContain('cp -R agents/automata')
  })

  it('still empties the clone but .git first', () => {
    const empty = job.indexOf('find "$mirror" -mindepth 1 -maxdepth 1 ! -name .git')
    expect(empty).toBeGreaterThan(-1)
    expect(job.indexOf('mirror-cli.ts')).toBeGreaterThan(empty)
  })
})
