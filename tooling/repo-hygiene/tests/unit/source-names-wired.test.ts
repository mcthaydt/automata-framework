import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { findSourceNames, SOURCE_NAMES } from '#src/source-names.ts'

// The source-names rule only guards what it reads and only when something runs it: `pnpm check` runs it, and it
// reads the docs and the generated references as well as the published READMEs and changelogs. The records that name
// the source projects as evidence (the archive, provenance and the refactor's audits) are left out.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})
function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'af-source-names-wired-'))
  folders.push(dir)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

describe('the source-names rule', () => {
  it('runs in pnpm check', () => {
    expect(scripts['source-names']).toBe(
      'node tooling/repo-hygiene/src/source-names-cli.ts && node tooling/repo-hygiene/src/sources-md-cli.ts',
    )
    expect(scripts['sources-md']).toBe('node tooling/repo-hygiene/src/sources-md-cli.ts')
    expect(scripts.check).toContain('pnpm source-names')
  })

  it('reads the docs and the generated references, not the records', () => {
    const name = SOURCE_NAMES[0]?.sample ?? ''
    const dir = tree({
      'docs/stack.md': `${name}\n`,
      'docs/cheatsheet.md': `${name}\n`,
      'agents/automata/skills/automata-api/reference/api.md': `${name}\n`,
      'docs/archive/old.md': `${name}\n`,
      'docs/provenance/sources.md': `${name}\n`,
      'docs/refactor/audit.md': `${name}\n`,
    })
    expect(findSourceNames(dir)).toEqual([
      'agents/automata/skills/automata-api/reference/api.md:1: names a source project (entry 1)',
      'docs/cheatsheet.md:1: names a source project (entry 1)',
      'docs/stack.md:1: names a source project (entry 1)',
    ])
  })
})
