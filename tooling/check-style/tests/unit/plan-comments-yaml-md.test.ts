import { describe, expect, it } from 'vitest'
import { checksPlanIds, docPlanIdFindings } from '#src/docs.ts'

// Workflows, config and the docs a reader opens say why in plain words too. A YAML or `.npmrc` comment and a line of
// Markdown prose are read; a value, a code block and the folders that are records by design (the archive, the
// refactor's audits, provenance, the ADRs) are not.

const lines = (file: string, text: string) => docPlanIdFindings(file, text).map((finding) => finding.line)

describe('plan IDs in YAML and Markdown', () => {
  it('flag a YAML comment that cites a plan, and not a value or an anchor', () => {
    const yaml = [
      '# Runs the release (QB.1, QB spec §4.1)',
      'on: push',
      'jobs:',
      '  build: # the reason for M2.4',
      '    runs-on: ubuntu-latest',
      '    env: { A: "M2.4 is a value" }',
      '    steps: [{ run: "echo #M2.4" }]',
    ].join('\n')
    expect(lines('.github/workflows/a.yml', yaml)).toEqual([1, 4])
    expect(lines('.npmrc', '# GitHub Packages for M2.4\n@x:registry=https://x\n')).toEqual([1])
  })

  it('flag Markdown prose and comments, and not a code block', () => {
    const markdown = [
      '# Versions',
      '',
      'Pinned by DX.11 (task 6.4).',
      '',
      '```sh',
      'echo M2.4',
      '```',
      '<!-- PUB.0 -->',
    ].join('\n')
    expect(lines('docs/versions.md', markdown)).toEqual([3, 8])
  })

  it('leave plain words alone', () => {
    expect(lines('docs/a.md', 'Tasks run in order. HTTP/2 and UTF-8 work. Node 24.21 runs it.\n')).toEqual([])
  })

  it('read the docs people open, not the records', () => {
    for (const file of [
      'docs/versions.md',
      'README.md',
      '.github/workflows/ci.yml',
      '.npmrc',
      'pnpm-workspace.yaml',
    ])
      expect(checksPlanIds(file), file).toBe(true)
    for (const file of [
      'docs/archive/old.md',
      'docs/refactor/plan.md',
      'docs/provenance/sources.md',
      'docs/adr/0006-distribution-targets.md',
      'vendor/ruken/README.md',
      'games/emberwick/src/shared/art/PROVENANCE.md',
      'tooling/x/tests/fixtures/plan.md',
      'packages/sim/CHANGELOG.md',
      '.changeset/a.md',
      'src/a.ts',
    ])
      expect(checksPlanIds(file), file).toBe(false)
  })
})
