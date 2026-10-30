import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { coreImportFindings, importSpecifiers, publicCoreEntries } from './core-imports.ts'

// PRODUCT.1b1, the F1 boundary test (PRODUCT spec §2 F1, §10 P-c and P-d): a Plus package imports core only through
// a public `exports` entry of a core package, as a game or a user would. A deep path into core, or a core package
// Plus cannot install (a private one), fails.

describe('importSpecifiers', () => {
  it('finds static, side-effect, re-export, type and dynamic imports', () => {
    const source = [
      "import { a } from '@x/a'",
      "import type { B } from '@x/b'",
      "import '@x/c'",
      "export { d } from '@x/d'",
      "export * from '@x/e'",
      "const f = await import('@x/f')",
      'import {',
      '  g,',
      "} from '@x/g'",
      "// a comment that says from '@x/not-an-import' is still read, which can only add findings",
    ].join('\n')
    expect(importSpecifiers(source)).toEqual([
      '@x/a',
      '@x/b',
      '@x/c',
      '@x/d',
      '@x/e',
      '@x/f',
      '@x/g',
      '@x/not-an-import',
    ])
  })
})

describe('coreImportFindings', () => {
  let root = ''
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const pack = (dir: string, name: string, exports: Record<string, unknown>): void =>
    write(`.core/packs/${dir}/package.json`, JSON.stringify({ name, version: '0.0.3', exports }))

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plus-f1-'))
    write(
      '.core/packs/packs.json',
      JSON.stringify({
        sourceCommit: 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b',
        packs: [
          {
            name: '@mcthaydt/automata-sim',
            version: '0.0.3',
            file: 'mcthaydt-automata-sim-0.0.3.tgz',
            sha256: 'a'.repeat(64),
            dir: 'automata-sim',
          },
        ],
      }),
    )
    pack('automata-sim', '@mcthaydt/automata-sim', { '.': {}, './hash': {} })
    write('packages/ext/package.json', JSON.stringify({ name: '@mcthaydt/automata-ext' }))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('reads the public entries from the packed manifests', () => {
    expect([...publicCoreEntries(root)].sort()).toEqual([
      '@mcthaydt/automata-sim',
      '@mcthaydt/automata-sim/hash',
    ])
  })

  it('passes public entries, non-core packages, relative paths and sibling Plus packages', () => {
    write(
      'packages/ext/src/a.ts',
      [
        "import { createSim } from '@mcthaydt/automata-sim'",
        "import { xxhash64 } from '@mcthaydt/automata-sim/hash'",
        "import { z } from 'zod'",
        "import { b } from './b.ts'",
        "import { c } from '@mcthaydt/automata-ext/2d'",
      ].join('\n'),
    )
    expect(coreImportFindings(root)).toEqual([])
  })

  // P-d: the failure case.
  it('fails a deep core import, naming the file, line and specifier', () => {
    write('packages/ext/src/deep.ts', "\nimport { x } from '@mcthaydt/automata-sim/src/world/sim'\n")
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/deep.ts:2: "@mcthaydt/automata-sim/src/world/sim" is not a public exports entry of a core package',
    ])
  })

  it('fails a core package that has no pack (a private package Plus cannot install)', () => {
    write('packages/ext/src/private.ts', "import { x } from '@mcthaydt/automata-runtime'\n")
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/private.ts:1: "@mcthaydt/automata-runtime" is not a public exports entry of a core package',
    ])
  })

  it('checks Svelte files and skips node_modules and dist', () => {
    write(
      'packages/ext/src/view.svelte',
      "<script>\nimport x from '@mcthaydt/automata-sim/dist/index.js'\n</script>",
    )
    write('packages/ext/node_modules/y/index.ts', "import '@mcthaydt/automata-sim/deep'")
    write('packages/ext/dist/index.ts', "import '@mcthaydt/automata-sim/deep'")
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/view.svelte:2: "@mcthaydt/automata-sim/dist/index.js" is not a public exports entry of a core package',
    ])
  })

  it('fails an import whose specifier is on a later line than its from or import(', () => {
    write(
      'packages/ext/src/wrapped.ts',
      "const m = await import(\n  '@mcthaydt/automata-sim/src/world/sim'\n)\n",
    )
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/wrapped.ts:2: "@mcthaydt/automata-sim/src/world/sim" is not a public exports entry of a core package',
    ])
  })

  it('fails require forms', () => {
    write('packages/ext/src/req.ts', "import x = require('@mcthaydt/automata-sim/deep')\n")
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/req.ts:1: "@mcthaydt/automata-sim/deep" is not a public exports entry of a core package',
    ])
  })

  it.each(['a.mts', 'a.cts', 'a.tsx', 'a.js', 'a.mjs', 'a.cjs', 'a.jsx'])('checks %s', (file) => {
    write(`packages/ext/src/${file}`, "import '@mcthaydt/automata-sim/deep'\n")
    expect(coreImportFindings(root)).toEqual([
      `packages/ext/src/${file}:1: "@mcthaydt/automata-sim/deep" is not a public exports entry of a core package`,
    ])
  })

  // A private pack (the framework's evidence tool, packed as an extra) is never published, so shipped code may
  // not import it; a test file may, as the physics parity tests do.
  it('allows a private pack in test files only', () => {
    write(
      '.core/packs/packs.json',
      JSON.stringify({
        sourceCommit: 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b',
        packs: [
          {
            name: '@mcthaydt/evidence',
            version: '0.0.0',
            file: 'mcthaydt-evidence-0.0.0.tgz',
            sha256: 'b'.repeat(64),
            dir: 'evidence',
          },
        ],
      }),
    )
    write(
      '.core/packs/evidence/package.json',
      JSON.stringify({ name: '@mcthaydt/evidence', private: true, exports: { './golden': {} } }),
    )
    write('packages/ext/src/a.parity.test.ts', "import { r } from '@mcthaydt/evidence/golden'\n")
    write('packages/ext/src/shipped.ts', "import { r } from '@mcthaydt/evidence/golden'\n")
    expect(coreImportFindings(root)).toEqual([
      'packages/ext/src/shipped.ts:1: "@mcthaydt/evidence/golden" is a private core package, for test files only',
    ])
  })

  it('says to run the sync when there are no packs', () => {
    rmSync(join(root, '.core'), { recursive: true })
    expect(() => coreImportFindings(root)).toThrow('run pnpm core:sync')
  })
})

// P-c: every Plus package passes.
describe('the Plus workspace', () => {
  it('imports core only through public exports entries', () => {
    expect(coreImportFindings(fileURLToPath(new URL('../..', import.meta.url)))).toEqual([])
  })
})
