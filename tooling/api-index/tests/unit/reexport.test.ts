import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { entryPoints } from '#src/entry-points.ts'
import { indexRows } from '#src/rows.ts'

// A workspace package's `exports` point at source (`./src/index.ts`), and pnpm links it into every other package's
// node_modules. A re-export of it from a published declaration must still read the built `.d.ts`, never the source.
const fixture = fileURLToPath(new URL('../../fixtures/reexport', import.meta.url))
let temp: string
beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), 'api-index-reexport-'))
  cpSync(fixture, temp, { recursive: true })
  mkdirSync(join(temp, 'node_modules/@fx'), { recursive: true })
  for (const name of ['base', 'umbrella', 'chain'])
    symlinkSync(join(temp, 'packages', name), join(temp, 'node_modules/@fx', name), 'dir')
})
afterAll(() => rmSync(temp, { recursive: true, force: true }))

const rowsFor = (name: string) => indexRows(entryPoints(temp)).filter((row) => row.name === name)

describe('indexRows over re-exported packages', () => {
  it('a re-export of another published package reads its declaration, not its source', () => {
    expect(rowsFor('defineThing').map((row) => [row.package, row.signature])).toEqual([
      ['@fx/base', 'function defineThing(id: string): string;'],
      ['@fx/chain', 'function defineThing(id: string): string;'],
      ['@fx/umbrella', 'function defineThing(id: string): string;'],
    ])
  })

  it('a re-exported re-export reads the declaration', () => {
    expect(rowsFor('defineThing').find((row) => row.package === '@fx/chain')?.signature).toBe(
      'function defineThing(id: string): string;',
    )
  })
})
