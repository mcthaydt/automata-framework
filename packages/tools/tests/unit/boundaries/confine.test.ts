import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { confineFindings } from '#src/features/boundaries/confine.ts'

// The `--confine` check: a package that only one door may reach (the figure painter, through the character kit's
// door). Every other source under the roots, tests included, may not import it, so a game, an example or another
// extension cannot depend on it by declaring the dependency.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A repository folder holding the given files (paths from its root), and its path. */
function repo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-confine-'))
  roots.push(root)
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), code)
  }
  return root
}

const DOOR = 'extensions/kit/src/door'

describe('confineFindings', () => {
  it('lets the door import the package, and its subpaths', () => {
    const root = repo({
      [`${DOOR}/door.ts`]: "export { member } from '@x/painter'\n",
      [`${DOOR}/door-view.ts`]: "export { Sprite } from '@x/painter/view'\n",
    })
    expect(confineFindings([join(root, 'extensions')], '@x/painter', join(root, DOOR)).findings).toEqual([])
  })

  it('fails any other source, naming the specifier and the door', () => {
    const root = repo({
      [`${DOOR}/door.ts`]: "export { member } from '@x/painter'\n",
      'games/g/src/a.ts': "import { member } from '@x/painter'\nexport const a = member\n",
      'extensions/other/tests/b.test.ts':
        "import type { Cell } from '@x/painter/kit'\nexport type B = Cell\n",
    })
    const { findings } = confineFindings(
      [join(root, 'extensions'), join(root, 'games')],
      '@x/painter',
      join(root, DOOR),
    )
    expect(findings.map((f) => `${f.file.slice(root.length + 1)}:${f.line} ${f.rule}`)).toEqual([
      'extensions/other/tests/b.test.ts:1 confined-import',
      'games/g/src/a.ts:1 confined-import',
    ])
    expect(findings[1]?.message).toBe(`imports "@x/painter", which only ${join(root, DOOR)} may use.`)
  })

  it('does not take a folder that merely starts with the door for the door', () => {
    const root = repo({ [`${DOOR}-2/x.ts`]: "import '@x/painter'\n" })
    expect(confineFindings([join(root, 'extensions')], '@x/painter', join(root, DOOR)).findings).toHaveLength(
      1,
    )
  })

  it('does not take a lookalike package for it', () => {
    const root = repo({ 'games/g/src/a.ts': "import '@x/painter-extras'\n" })
    expect(confineFindings([join(root, 'games')], '@x/painter', join(root, DOOR)).findings).toEqual([])
  })
})
