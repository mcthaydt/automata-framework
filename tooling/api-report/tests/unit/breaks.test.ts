import { describe, expect, it } from 'vitest'
import { type ApiBreak, apiBreaks, undeclaredBreaks } from '#src/breaks.ts'
import type { ApiEntry, ApiExport } from '#src/extract.ts'
import type { ParsedReport } from '#src/report.ts'

const report = (entries: ApiEntry[]): ParsedReport => ({ package: '@fx/alpha', entries })
const base = report([
  {
    entryPoint: '.',
    exports: [
      { name: 'add', kind: 'function', declaration: 'function add(a: number, b: number): number;' },
      {
        name: 'Counter',
        kind: 'interface',
        declaration: 'interface Counter {\n    readonly count: number;\n}',
      },
    ],
  },
  { entryPoint: './sub', exports: [{ name: 'SUB', kind: 'const', declaration: 'const SUB: string;' }] },
])

describe('apiBreaks', () => {
  it('finds nothing when the API is unchanged or only grows', () => {
    expect(apiBreaks(base, base)).toEqual([])
    const grown = report([
      { ...(base.entries[0] as ApiEntry) },
      {
        entryPoint: './sub',
        exports: [
          ...(base.entries[1]?.exports ?? []),
          { name: 'MORE', kind: 'const', declaration: 'const MORE: number;' },
        ],
      },
      { entryPoint: './new', exports: [] },
    ])
    expect(apiBreaks(base, grown)).toEqual([])
  })

  it('reports a removed entry point, a removed export and a changed declaration', () => {
    const head = report([
      {
        entryPoint: '.',
        exports: [
          {
            name: 'Counter',
            kind: 'interface',
            declaration: 'interface Counter {\n    readonly count: number;\n    reset(): void;\n}',
          },
        ],
      },
    ])
    expect(apiBreaks(base, head)).toEqual([
      { package: '@fx/alpha', entryPoint: '.', name: 'add', change: 'removed' },
      { package: '@fx/alpha', entryPoint: '.', name: 'Counter', change: 'changed' },
      { package: '@fx/alpha', entryPoint: './sub', name: undefined, change: 'removed' },
    ])
  })
})

describe('apiBreaks, across a rename', () => {
  it('names the package by its current name, so a changeset under the new name declares the break', () => {
    const head = { package: '@fx/renamed', entries: [{ entryPoint: '.', exports: [] }] }
    expect(apiBreaks(base, head).map((found) => found.package)).toEqual([
      '@fx/renamed',
      '@fx/renamed',
      '@fx/renamed',
    ])
  })
})

describe('apiBreaks, a function that only gains optional trailing parameters', () => {
  const before = 'function add(a: number, b: number): number;'
  const exportOf = (declaration: string, kind: ApiExport['kind'] = 'function') => ({
    name: 'add',
    kind,
    declaration,
  })
  const breaksFor = (declaration: string, kind: ApiExport['kind'] = 'function') =>
    apiBreaks(report([{ entryPoint: '.', exports: [exportOf(before)] }]), {
      entries: [{ entryPoint: '.', exports: [exportOf(declaration, kind)] }],
    })
  const changed = [{ package: '@fx/alpha', entryPoint: '.', name: 'add', change: 'changed' }]

  it('is additive when one optional parameter is appended', () => {
    expect(breaksFor('function add(a: number, b: number, round?: boolean): number;')).toEqual([])
  })

  it('is additive when several optional parameters are appended', () => {
    expect(breaksFor('function add(a: number, b: number, round?: boolean, scale?: number): number;')).toEqual(
      [],
    )
  })

  it('is a break when a required parameter is appended', () => {
    expect(breaksFor('function add(a: number, b: number, round: boolean): number;')).toEqual(changed)
  })

  it('is a break when an optional parameter comes before an existing one', () => {
    expect(breaksFor('function add(a: number, round?: boolean, b?: number): number;')).toEqual(changed)
  })

  it("is a break when an existing parameter's type changes", () => {
    expect(breaksFor('function add(a: number, b: bigint, round?: boolean): number;')).toEqual(changed)
  })

  it('is a break when the return type changes, whatever else is appended', () => {
    expect(breaksFor('function add(a: number, b: number, round?: boolean): bigint;')).toEqual(changed)
  })

  it('is a break when the appended parameter is a rest parameter', () => {
    expect(breaksFor('function add(a: number, b: number, ...more: number[]): number;')).toEqual(changed)
  })

  it('is a break when the declaration is overloaded', () => {
    const overloaded =
      'function add(a: number, b: number, round?: boolean): number;\nfunction add(a: string): string;'
    expect(breaksFor(overloaded)).toEqual(changed)
  })

  it('stays a break for an export that is not a function', () => {
    const base = report([
      {
        entryPoint: '.',
        exports: [
          {
            name: 'Options',
            kind: 'interface',
            declaration: 'interface Options {\n    readonly a: number;\n}',
          },
        ],
      },
    ])
    const head = report([
      {
        entryPoint: '.',
        exports: [
          {
            name: 'Options',
            kind: 'interface',
            declaration: 'interface Options {\n    readonly a: number;\n    readonly b?: number;\n}',
          },
        ],
      },
    ])
    expect(apiBreaks(base, head)).toEqual([
      { package: '@fx/alpha', entryPoint: '.', name: 'Options', change: 'changed' },
    ])
  })
})

describe('undeclaredBreaks (04: patch only before 1.0; major from 1.0)', () => {
  const removed: ApiBreak = { package: '@fx/alpha', entryPoint: '.', name: 'add', change: 'removed' }
  const changeset = (bump: string, body: string, name = '@fx/alpha') =>
    `---\n'${name}': ${bump}\n---\n\n${body}\n`

  it('keeps a break no changeset declares', () => {
    expect(undeclaredBreaks([removed], {}, { '@fx/alpha': '0.0.3' })).toEqual([removed])
    expect(
      undeclaredBreaks([removed], { 'a.md': changeset('patch', 'Removes add.') }, { '@fx/alpha': '0.0.3' }),
    ).toEqual([removed])
  })

  it('before 1.0, a patch changeset for the package with a BREAKING: line declares it', () => {
    const files = { 'a.md': changeset('patch', 'Tidy.\n\nBREAKING: `add` is gone; use `sum`.') }
    expect(undeclaredBreaks([removed], files, { '@fx/alpha': '0.0.3' })).toEqual([])
  })

  it('from 1.0, only a major changeset declares it', () => {
    const versions = { '@fx/alpha': '1.4.0' }
    expect(undeclaredBreaks([removed], { 'a.md': changeset('patch', 'BREAKING: gone.') }, versions)).toEqual([
      removed,
    ])
    expect(undeclaredBreaks([removed], { 'a.md': changeset('major', 'Removes add.') }, versions)).toEqual([])
  })

  it("does not take another package's changeset as a declaration", () => {
    const files = { 'a.md': changeset('patch', 'BREAKING: gone.', '@fx/beta') }
    expect(undeclaredBreaks([removed], files, { '@fx/alpha': '0.0.3' })).toEqual([removed])
  })
})
