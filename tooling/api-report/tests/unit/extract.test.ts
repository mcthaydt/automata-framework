import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { corePackages } from '#src/core-packages.ts'
import { declarationExports, extractApi, sourceExports } from '#src/extract.ts'
import { FIXTURE_EXCLUDED, FIXTURE_ROOT } from '#src/fixture.ts'

describe('corePackages', () => {
  it('lists every packages/* folder but the excluded, with its TypeScript exports entries', () => {
    const found = corePackages(FIXTURE_ROOT, FIXTURE_EXCLUDED)
    expect(found.map((pkg) => [pkg.folder, pkg.name, pkg.version])).toEqual([
      ['alpha', '@fx/alpha', '0.0.1'],
      ['beta', '@fx/beta', '1.2.0'],
    ])
    expect(found[0]?.entries.map((entry) => entry.entryPoint)).toEqual(['.', './sub'])
  })
})

describe('extractApi (declarations from source, no build)', () => {
  const [alpha, beta] = extractApi(corePackages(FIXTURE_ROOT, FIXTURE_EXCLUDED))
  const root = alpha?.entries.find((entry) => entry.entryPoint === '.')?.exports ?? []
  const byName = (name: string) => root.find((entry) => entry.name === name)

  it('lists each entry point and its exports sorted by name', () => {
    expect(alpha?.entries.map((entry) => entry.entryPoint)).toEqual(['.', './sub'])
    expect(root.map((entry) => entry.name)).toEqual([
      'add',
      'Box',
      'Counter',
      'Id',
      'Shape',
      'shapeArea',
      'Widget',
    ])
    expect(beta?.entries[0]?.exports.map((entry) => entry.name)).toEqual(['Shape', 'shapeArea'])
  })

  it('gives declarations without bodies or initializers', () => {
    expect(byName('add')).toEqual({
      name: 'add',
      kind: 'function',
      declaration: 'function add(a: number, b: number): number;',
    })
    expect(byName('Box')?.declaration).toContain('grow(by: number): Box;')
    expect(byName('Box')?.declaration).not.toContain('return')
    expect(byName('Counter')).toMatchObject({ kind: 'interface' })
    expect(byName('Counter')?.declaration).toContain('const Counter: {')
    expect(byName('Counter')?.declaration).not.toContain('zero: { count: 0 }')
    expect(byName('Id')).toEqual({ name: 'Id', kind: 'type', declaration: 'type Id = string;' })
  })

  it("resolves a sibling package's re-export to its declaration", () => {
    expect(byName('shapeArea')?.declaration).toBe('function shapeArea(shape: Shape): number;')
  })

  it('names a Svelte component by the file it comes from', () => {
    expect(byName('Widget')).toEqual({
      name: 'Widget',
      kind: 'svelte',
      declaration: "component from './widget.svelte'",
    })
  })
})

describe('sourceExports (the one extractor, from source)', () => {
  const packages = corePackages(FIXTURE_ROOT, FIXTURE_EXCLUDED)
  const exportsOf = sourceExports(packages)

  it('reads an entry module in the order the checker lists its exports, with no doc comments', () => {
    const root = exportsOf(join(FIXTURE_ROOT, 'packages/alpha/src/index.ts')) ?? []
    // The source has `/** Adds two numbers. */`, but its declarations are emitted without comments.
    expect(root.find((exported) => exported.name === 'add')).toEqual({
      name: 'add',
      kind: 'function',
      declaration: 'function add(a: number, b: number): number;',
      doc: '',
    })
    expect(root.map((exported) => exported.doc)).toEqual(root.map(() => ''))
  })
})

describe('declarationExports (the one extractor, from emitted .d.ts)', () => {
  // An entry point and the chunk it re-exports from, shaped the way rolldown-plugin-dts writes them.
  const dir = mkdtempSync(join(tmpdir(), 'api-extract-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const file = (name: string, text: string) => {
    writeFileSync(join(dir, name), text)
    return join(dir, name)
  }
  file(
    'chunk-a1.d.ts',
    "/** A shape kind. */\ntype ShapeKind$1 = 'box' | 'ball';\nexport { ShapeKind$1 as t };\n",
  )
  const entry = file(
    'index.d.ts',
    [
      "import { t as ShapeKind } from './chunk-a1.js';",
      '/**',
      ' * Adds two numbers.',
      ' * @returns the sum',
      ' */',
      'export declare function add(a: number, b: number): number;',
      "export { default as Widget } from './widget.svelte';",
      'export { ShapeKind };',
      '',
    ].join('\n'),
  )
  const script = file('script.d.ts', 'declare const notExported: number;\n')
  const exportsOf = declarationExports([entry, script])

  it('reads each export with its doc comment and tags, and an alias renamed in a chunk by its exported name', () => {
    expect(exportsOf(entry)).toEqual([
      {
        name: 'add',
        kind: 'function',
        declaration: 'function add(a: number, b: number): number;',
        doc: 'Adds two numbers.\n@returns the sum',
      },
      { name: 'Widget', kind: 'svelte', declaration: "component from './widget.svelte'", doc: '' },
      {
        name: 'ShapeKind',
        kind: 'type',
        declaration: "type ShapeKind = 'box' | 'ball';",
        doc: 'A shape kind.',
      },
    ])
  })

  it('gives undefined for a file that is not a module', () => {
    expect(exportsOf(script)).toBeUndefined()
  })
})
