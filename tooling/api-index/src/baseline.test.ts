import { describe, expect, it } from 'vitest'
import { checkDocs, exportId } from './baseline.ts'
import type { ApiExport } from './rows.ts'

const row = (entryPoint: string, name: string, doc: string): ApiExport => ({
  package: '@fixture/alpha',
  entryPoint,
  name,
  kind: 'const',
  signature: `const ${name}: number;`,
  doc,
  version: '1.2.3',
})

describe('exportId', () => {
  it('is the import specifier and the export name', () => {
    expect(exportId(row('.', 'add', ''))).toBe('@fixture/alpha#add')
    expect(exportId(row('./sub', 'subOnly', ''))).toBe('@fixture/alpha/sub#subOnly')
  })
})

describe('checkDocs (the baseline only shrinks; new exports arrive documented)', () => {
  const exports = [row('.', 'documented', 'Has a doc.'), row('.', 'bare', ''), row('./sub', 'newBare', '')]

  it('reports an undocumented export that is not in the baseline', () => {
    expect(checkDocs(exports, ['@fixture/alpha#bare'])).toEqual({
      undocumented: ['@fixture/alpha/sub#newBare'],
      stale: [],
    })
  })

  it('reports a baseline entry that is now documented or no longer exported, so it gets deleted', () => {
    expect(
      checkDocs(exports, [
        '@fixture/alpha#bare',
        '@fixture/alpha#documented',
        '@fixture/alpha#gone',
        '@fixture/alpha/sub#newBare',
      ]),
    ).toEqual({ undocumented: [], stale: ['@fixture/alpha#documented', '@fixture/alpha#gone'] })
  })

  it('reports nothing when the baseline is exactly the undocumented set', () => {
    expect(checkDocs(exports, ['@fixture/alpha#bare', '@fixture/alpha/sub#newBare'])).toEqual({
      undocumented: [],
      stale: [],
    })
  })
})
