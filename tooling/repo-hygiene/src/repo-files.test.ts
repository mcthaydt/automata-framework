import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The repository's own trust files (QB spec §3 F-7, §4.1, QB.1): a security contact with a response window,
// code owners, and a runbook for lost credentials and a rebuild from Git, each linked from the README.

const root = fileURLToPath(new URL('../../..', import.meta.url))
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
