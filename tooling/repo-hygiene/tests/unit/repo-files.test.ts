import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The repository's own trust files (QB spec §3 F-7, §4.1, QB.1): a security contact with a response window,
// code owners, and a runbook for lost credentials and a rebuild from Git, each linked from the README.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const read = (path: string): string => readFileSync(join(root, path), 'utf8')

describe('SECURITY.md', () => {
  const security = read('SECURITY.md')

  it('names a private reporting channel and a contact address', () => {
    expect(security).toContain('/security/advisories/new')
    expect(security).toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
  })

  it('states a response window', () => {
    expect(security).toMatch(/within \d+ (?:working )?days/)
  })
})

it('CODEOWNERS assigns every path to the Owner', () => {
  const owners = read('.github/CODEOWNERS')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  expect(owners).toContain('* @mcthaydt')
})

it('the runbook covers lost credentials and a rebuild from Git', () => {
  const runbook = read('docs/runbook.md')
  expect(runbook).toMatch(/^## Lost credentials/m)
  expect(runbook).toMatch(/^## Rebuild from Git/m)
})

it('the README links SECURITY.md and the runbook', () => {
  const readme = read('README.md')
  expect(readme).toContain('](SECURITY.md)')
  expect(readme).toContain('](docs/runbook.md)')
})

// The files GitHub shows to someone arriving from outside: how to contribute, how to behave, and forms that ask for
// what a bug in a deterministic game needs. Blank issues are off so every report goes through a form.
describe('community files', () => {
  it('CONTRIBUTING.md says how to set up, check a change and open a pull request', () => {
    const contributing = read('.github/CONTRIBUTING.md')
    expect(contributing).toContain('pnpm install')
    expect(contributing).toContain('pnpm check')
    expect(contributing).toContain('](../AGENTS.md)')
    expect(contributing).toContain('](../SECURITY.md)')
  })

  it('CODE_OF_CONDUCT.md names who to report to', () => {
    expect(read('CODE_OF_CONDUCT.md')).toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
  })

  it('the issue chooser has no blank issues and sends vulnerabilities to SECURITY.md', () => {
    const config = read('.github/ISSUE_TEMPLATE/config.yml')
    expect(config).toMatch(/^blank_issues_enabled: false$/m)
    expect(config).toContain('/security/advisories/new')
  })

  it('the bug form asks for the version, the target, the browser and a seed', () => {
    const bug = read('.github/ISSUE_TEMPLATE/bug-report.yml')
    for (const id of ['version', 'target', 'browser', 'seed', 'steps']) expect(bug).toContain(`id: ${id}`)
  })

  it('no community file names Ruken, which AF does not ship to', () => {
    const files = [
      '.github/CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/ISSUE_TEMPLATE/bug-report.yml',
      '.github/ISSUE_TEMPLATE/feature-request.yml',
      '.github/PULL_REQUEST_TEMPLATE.md',
    ]
    for (const file of files) expect(read(file), file).not.toMatch(/ruken/i)
  })

  it('there is a feature request form', () => {
    expect(read('.github/ISSUE_TEMPLATE/feature-request.yml')).toMatch(/^name: /m)
  })

  it('the pull request template asks for a test first and a passing pnpm check', () => {
    const template = read('.github/PULL_REQUEST_TEMPLATE.md')
    expect(template).toMatch(/test/i)
    expect(template).toContain('pnpm check')
  })
})
