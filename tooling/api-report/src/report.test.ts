import { describe, expect, it } from 'vitest'
import type { PackageApi } from './extract.ts'
import { parseReport, renderReport } from './report.ts'

const api: PackageApi = {
  package: '@fx/alpha',
  version: '0.0.1',
  entries: [
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
  ],
}

describe('API report text', () => {
  it('has a heading per entry point and per export, each declaration in a ts block', () => {
    const text = renderReport(api)
    expect(text).toContain('# @fx/alpha API report')
    expect(text).toContain('## `./sub`')
    expect(text).toContain('### `add` (function)\n\n```ts\nfunction add(a: number, b: number): number;\n```')
    expect(text).not.toContain('0.0.1')
  })

  it('parses back to the same entries', () => {
    const parsed = parseReport(renderReport(api))
    expect(parsed.package).toBe('@fx/alpha')
    expect(parsed.entries).toEqual(api.entries)
  })
})
