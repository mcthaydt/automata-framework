import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { extensionImportFindings, extensionPackageNames } from '#src/features/boundaries/extensions.ts'

// "Core never imports an extension": the roots handed to the check (core's packages and the 2D reference game) may
// not import any package under `extensions/`. A game other than the listed roots may use one.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function repo(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-extensions-'))
  roots.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), text)
  }
  return root
}

const NAMES: ReadonlySet<string> = new Set(['@automata/physics'])

describe('extensionImportFindings', () => {
  it('finds core importing an extension, naming the specifier', () => {
    const root = repo({ 'packages/a/src/x.ts': "import '@automata/physics/2d'\n" })
    const findings = extensionImportFindings([join(root, 'packages')], NAMES)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      file: join(root, 'packages/a/src/x.ts'),
      line: 1,
      rule: 'extension-import',
      message: expect.stringContaining('core never imports an extension: @automata/physics/2d'),
    })
  })

  it('lets a game outside the listed roots use an extension', () => {
    const root = repo({
      'packages/a/src/x.ts': 'export const a = 1\n',
      'games/demo/src/main.ts': "import '@automata/physics'\n",
    })
    expect(extensionImportFindings([join(root, 'packages')], NAMES)).toEqual([])
  })

  it('sees a type-only import and a dynamic import, and ignores a name in a string', () => {
    const root = repo({
      'packages/a/src/types.ts': "import type { Body } from '@automata/physics'\n",
      'packages/a/src/lazy.ts': "await import('@automata/physics/3d')\n",
      'packages/a/src/words.ts': "export const word = '@automata/physics'\n",
    })
    expect(extensionImportFindings([join(root, 'packages')], NAMES).map((f) => f.line)).toEqual([1, 1])
  })
})

describe('extensionPackageNames', () => {
  it('reads the names from extensions/*/package.json', () => {
    const root = repo({
      'extensions/physics/package.json': JSON.stringify({ name: '@automata/physics' }),
      'extensions/feel/package.json': JSON.stringify({ name: '@automata/feel' }),
    })
    expect([...extensionPackageNames(root)].sort()).toEqual(['@automata/feel', '@automata/physics'])
  })
})

describe('check-boundaries --no-extension-imports', () => {
  const cli = join(import.meta.dirname, '../../../src/features/boundaries/cli.ts')
  const run = (root: string) =>
    spawnSync(process.execPath, [cli, '--no-extension-imports', 'packages'], { cwd: root, encoding: 'utf8' })

  it('exits 1 and names the import when core imports an extension', () => {
    const root = repo({
      'extensions/physics/package.json': JSON.stringify({ name: '@automata/physics' }),
      'packages/a/src/x.ts': "import { world } from '@automata/physics'\nexport { world }\n",
    })
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('core never imports an extension: @automata/physics')
  })

  it('exits 0 when core stays clear of the extensions', () => {
    const root = repo({
      'extensions/physics/package.json': JSON.stringify({ name: '@automata/physics' }),
      'packages/a/src/x.ts': 'export const a = 1\n',
    })
    expect(run(root).status).toBe(0)
  })
})
