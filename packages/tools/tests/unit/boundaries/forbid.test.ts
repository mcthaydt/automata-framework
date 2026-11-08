import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { forbidFindings } from '#src/features/boundaries/forbid.ts'

// The `--forbid` check: a package names the packages it may never import (the 2D editor and 3D), and a break is
// reported with where it is, so the dependency cycle is caught before the build.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A package folder holding the given files (paths from the package root), and its path. */
function pkg(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-forbid-'))
  roots.push(root)
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), code)
  }
  return root
}

describe('forbidFindings', () => {
  it('fails a value import of a forbidden package, with where and why', () => {
    const root = pkg({ 'src/a.ts': "import { Mesh } from '@pixi/3d'\nexport const a = Mesh\n" })
    const { findings, files } = forbidFindings(root, ['@pixi/3d'])
    expect(files).toEqual([join(root, 'src/a.ts')])
    expect(findings).toEqual([
      {
        file: join(root, 'src/a.ts'),
        line: 1,
        col: 1,
        rule: 'forbidden-import',
        message: `imports "@pixi/3d", which ${root} may not use.`,
      },
    ])
  })

  it('fails a type-only import too, and a subpath of the package', () => {
    const root = pkg({
      'src/a.ts': "import type { Mesh } from '@pixi/3d'\nexport type A = Mesh\n",
      'src/b.ts': "export { x } from '@pixi/3d/extras'\n",
    })
    expect(forbidFindings(root, ['@pixi/3d']).findings.map((f) => f.file)).toEqual([
      join(root, 'src/a.ts'),
      join(root, 'src/b.ts'),
    ])
  })

  it('reads tests and Svelte components, not only src', () => {
    const root = pkg({
      'tests/unit/a.test.ts': "import '@pixi/3d'\n",
      'src/View.svelte': '<script lang="ts">\n  import { Mesh } from \'@pixi/3d\'\n</script>\n',
    })
    const { findings } = forbidFindings(root, ['@pixi/3d'])
    expect(findings.map((f) => `${f.file.slice(root.length + 1)}:${f.line}`)).toEqual([
      'src/View.svelte:2',
      'tests/unit/a.test.ts:1',
    ])
  })

  it('passes a package that imports none of them, and a name that only starts the same', () => {
    const root = pkg({
      'src/a.ts':
        "import { x } from '@pixi/3d-lookalike'\nimport { y } from 'pixi.js'\nexport const a = [x, y]\n",
    })
    expect(forbidFindings(root, ['@pixi/3d']).findings).toEqual([])
  })

  it('does not count a package named in a string or a comment', () => {
    const root = pkg({ 'src/a.ts': "// @pixi/3d\nexport const a = '@pixi/3d'\n" })
    expect(forbidFindings(root, ['@pixi/3d']).findings).toEqual([])
  })
})
