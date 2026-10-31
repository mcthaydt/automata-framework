import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { parseChangelog, readReleases } from '../scripts/sync-releases'
import { PUBLICATION } from '../src/data/publication'
import { RELEASES } from '../src/data/releases'
import Page from '../src/routes/releases/+page.svelte'

// M10.6: a releases page from the framework's own CHANGELOGs, read at framework.ref. Nothing on it is typed by hand except
// whether a release was published, which lives in one pinned file.
const CHANGELOG = `# @mcthaydt/automata-runtime

## 0.0.4

### Minor Changes

- 2ff17aa: First publish of the runtime.
  It ships \`dist\` only.

### Patch Changes

- 79457ff: Try again reloads the frame.
- Updated dependencies [66fe89d]
- Updated dependencies [2908b30]

## 0.0.3

### Patch Changes

- eb734a4: A 3D renderer can be run.
`
const temps: string[] = []
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('parseChangelog', () => {
  it('reads each version, its change kinds and its items with their commit and continued lines', () => {
    const parsed = parseChangelog(CHANGELOG)
    expect(parsed.name).toBe('@mcthaydt/automata-runtime')
    expect(parsed.versions.map((v) => v.version)).toEqual(['0.0.4', '0.0.3'])
    expect(parsed.versions[0].changes.map((c) => c.kind)).toEqual(['Minor Changes', 'Patch Changes'])
    expect(parsed.versions[0].changes[0].items).toEqual([{ commit: '2ff17aa', text: 'First publish of the runtime.\nIt ships `dist` only.' }])
  })

  it('leaves out the "Updated dependencies" lines, which say nothing a reader can use', () => {
    const items = parseChangelog(CHANGELOG).versions[0].changes[1].items
    expect(items).toEqual([{ commit: '79457ff', text: 'Try again reloads the frame.' }])
  })
})

describe('readReleases', () => {
  it('reads every package changelog at the given commit, not the working tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'releases-'))
    temps.push(dir)
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@e.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' })
    git('init', '-q')
    mkdirSync(join(dir, 'packages/runtime'), { recursive: true })
    writeFileSync(join(dir, 'packages/runtime/CHANGELOG.md'), CHANGELOG)
    git('add', '-A'); git('commit', '-q', '-m', 'one')
    const commit = git('rev-parse', 'HEAD').trim()
    writeFileSync(join(dir, 'packages/runtime/CHANGELOG.md'), '# changed later\n')
    const releases = readReleases(dir, commit)
    expect(releases.commit).toBe(commit)
    expect(releases.packages.map((p) => p.name)).toEqual(['@mcthaydt/automata-runtime'])
  })
})

describe('/releases', () => {
  it('lists each package with its versions from the synced changelogs', () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1, name: 'Releases' })).toBeTruthy()
    for (const pkg of RELEASES.packages) expect(view.getByRole('heading', { level: 2, name: pkg.name }), pkg.name).toBeTruthy()
  })

  it('says what is true about publication from the one pinned file, and nothing about npm when nothing is published', () => {
    const text = render(Page).container.textContent ?? ''
    expect(PUBLICATION.npm).toBe(false)
    expect(text).toContain('Nothing has been published to npmjs.org yet')
    expect(text).not.toMatch(/npm (install|i) @mcthaydt/)
  })
})
