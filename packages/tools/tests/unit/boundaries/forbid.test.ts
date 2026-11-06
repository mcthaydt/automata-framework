import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { forbidFindings } from '#src/features/boundaries/forbid.ts'

// The `--forbid` check: a package names the packages it may never import, so a dimension (3D) cannot leak into
// another's package. Value, type and dynamic imports all count; a name in a string or a comment does not.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

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
  it.each([
    "import { Mesh } from '@pixi/3d'",
    "import type { Mesh } from '@pixi/3d'",
    "export { Mesh } from '@pixi/3d'",
    "await import('@pixi/3d')",
    "import { load } from '@pixi/3d/loader'",
  ])('fails `%s`, naming the import and the package', (code) => {
    const root = pkg({ 'src/a.ts': `${code}\n` })
    const { findings } = forbidFindings(root, ['@pixi/3d'])
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      file: join(root, 'src/a.ts'),
      line: 1,
      rule: 'forbidden-import',
    })
    expect(findings[0]?.message).toMatch(/^imports "@pixi\/3d(\/loader)?", which .* may not use\.$/)
    expect(findings[0]?.message).toContain(root)
  })

  it('reads tests and Svelte components too, and ignores names in strings and comments', () => {
    const root = pkg({
      'src/a.ts': "// import '@pixi/3d'\nexport const name = '@pixi/3d'\n",
      'tests/unit/a.test.ts': "import '@pixi/3d'\n",
      'src/View.svelte': '<script lang="ts">\n  import \'@pixi/3d\'\n</script>\n',
    })
    const { files, findings } = forbidFindings(root, ['@pixi/3d'])
    expect(files).toHaveLength(3)
    expect(findings.map((f) => [f.file.replace(root, ''), f.line])).toEqual([
      ['/src/View.svelte', 2],
      ['/tests/unit/a.test.ts', 1],
    ])
  })

  it('does not mistake a package that starts with the same letters', () => {
    const root = pkg({ 'src/a.ts': "import '@pixi/3d-extras'\nimport 'zod'\n" })
    expect(forbidFindings(root, ['@pixi/3d']).findings).toEqual([])
  })

  it('judges every name in the list', () => {
    const root = pkg({ 'src/a.ts': "import 'a-3d'\nimport 'b-3d'\n" })
    expect(forbidFindings(root, ['a-3d', 'b-3d']).findings).toHaveLength(2)
  })
})
