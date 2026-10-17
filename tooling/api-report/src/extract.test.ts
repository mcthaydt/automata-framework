import { describe, expect, it } from 'vitest'
import { corePackages } from './core-packages.ts'
import { extractApi } from './extract.ts'
import { FIXTURE_EXCLUDED, FIXTURE_ROOT } from './fixture.ts'

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
