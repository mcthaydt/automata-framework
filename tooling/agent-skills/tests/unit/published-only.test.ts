import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { publishablePackages } from '../../../release/src/publishable-packages.ts'
import { packageNamesIn } from '#src/package-names.ts'

// Only published packages may be named in the public agent package: an agent told to install a package that is not
// on the registry fails in a way the person cannot fix. 3D skill text joins this package in the same change that
// publishes the 3D packages.
const REPO = resolve(import.meta.dirname, '../../../..')

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
function tree(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'package-names-'))
  temps.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

describe('packageNamesIn', () => {
  it('finds a package named in the example .ts', () => {
    const dir = tree({ 'skills/x/example/src/a.ts': "import { a } from '@automata/3d/sim'\n" })
    expect(packageNamesIn(dir).get('@automata/3d')).toEqual(['skills/x/example/src/a.ts'])
  })

  it('counts a subpath as its package and reads .md, .mjs and .json too', () => {
    const dir = tree({
      'a.md': 'Use `@automata/sim/math` and @automata/sim.\n',
      'hooks/check.mjs': "const p = '@automata/tools'\n",
      'plugin.json': '{ "x": "@automata/sim" }\n',
      'notes.txt': '@automata/ignored\n',
    })
    const names = packageNamesIn(dir)
    expect([...names.keys()]).toEqual(['@automata/sim', '@automata/tools'])
    expect(names.get('@automata/sim')).toEqual(['a.md', 'plugin.json'])
  })

  it('skips node_modules', () => {
    const dir = tree({ 'node_modules/p/index.ts': "import '@automata/3d'\n" })
    expect(packageNamesIn(dir).size).toBe(0)
  })
})

describe('the agent package', () => {
  it('names only published packages', () => {
    const published = new Set(publishablePackages(REPO).map((p) => p.manifest.name))
    const unpublished = [...packageNamesIn(join(REPO, 'agents/automata'))].filter(([name]) => !published.has(name))
    expect(unpublished).toEqual([])
  })
})
