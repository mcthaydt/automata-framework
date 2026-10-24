import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryPoints } from './entry-points.ts'
import { type ApiExport, extractExports } from './extract.ts'

const repo = fileURLToPath(new URL('../fixtures/repo', import.meta.url))
const exports = extractExports(entryPoints(repo))
const find = (name: string): ApiExport | undefined => exports.find((each) => each.name === name)

describe('extractExports', () => {
  it('covers every export of every entry point, sorted by package, entry point and name', () => {
    expect(exports.map((each) => `${each.entryPoint}#${each.name}`)).toEqual([
      '.#add',
      '.#area',
      '.#Color',
      '.#Counter',
      '.#DEFAULT_SIZE',
      '.#Named',
      '.#ShapeKind',
      '.#Size',
      '.#undocumented',
      './sub#subOnly',
    ])
    expect(new Set(exports.map((each) => `${each.package}@${each.version}`))).toEqual(
      new Set(['@fixture/alpha@1.2.3']),
    )
  })

  it('gives each kind, and the declaration without export or declare as the signature', () => {
    expect(find('add')).toMatchObject({
      kind: 'function',
      signature: 'function add(a: number, b: number): number;\nfunction add(a: string, b: string): string;',
    })
    expect(find('Named')).toMatchObject({ kind: 'interface' })
    expect(find('Named')?.signature).toMatch(/^interface Named \{\n\s+readonly name: string;\n\}$/)
    expect(find('Size')).toMatchObject({ kind: 'type', signature: "type Size = 'small' | 'large';" })
    expect(find('DEFAULT_SIZE')).toMatchObject({ kind: 'const', signature: 'const DEFAULT_SIZE: Size;' })
    expect(find('Counter')).toMatchObject({ kind: 'class' })
    expect(find('Color')).toMatchObject({ kind: 'enum' })
  })

  it('reads the doc comment with its tags, joining the comments of overloads', () => {
    expect(find('add')?.doc).toBe(
      'Adds two numbers.\nAdds two strings.\n@param a the first\n@returns the sum',
    )
    expect(find('Counter')?.doc).toBe('A counter.\n@deprecated use `add`')
    expect(find('undocumented')?.doc).toBe('')
  })

  it('names a re-export renamed through a chunk by its exported name', () => {
    expect(find('area')).toMatchObject({
      kind: 'function',
      signature: 'function area(size: number): number;',
    })
    expect(find('ShapeKind')).toMatchObject({
      kind: 'type',
      signature: "type ShapeKind = 'box' | 'ball';",
      doc: 'A shape kind, renamed through this chunk the way rolldown-plugin-dts does.',
    })
  })
})
