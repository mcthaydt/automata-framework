import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CORPUS, CorpusFileMissingError } from './corpus.ts'
import { entryPoints } from './entry-points.ts'
import { apiJson, apiReference, llmsFullText } from './render.ts'
import { indexRows } from './rows.ts'

const repo = fileURLToPath(new URL('../fixtures/repo', import.meta.url))
const afRoot = fileURLToPath(new URL('../../..', import.meta.url))
const exports = indexRows(entryPoints(repo))

describe('api.json', () => {
  it('carries the version and every field of every export', () => {
    const json = JSON.parse(apiJson(exports)) as { version: string; exports: Record<string, unknown>[] }
    expect(json.version).toBe('1.2.3')
    expect(json.exports).toHaveLength(exports.length)
    expect(json.exports[0]).toEqual({
      package: '@fixture/alpha',
      entryPoint: '.',
      name: 'add',
      kind: 'function',
      signature: exports[0]?.signature,
      doc: exports[0]?.doc,
      version: '1.2.3',
    })
  })

  it('refuses exports from more than one version, since an index describes exactly one', () => {
    const mixed = [...exports, { ...exports[0], version: '9.9.9' } as (typeof exports)[number]]
    expect(() => apiJson(mixed)).toThrow(/one version.*1\.2\.3.*9\.9\.9/)
  })
})

describe('the reference (api.md and llms-api.txt)', () => {
  const md = apiReference(exports)

  it('states the version it describes', () => {
    expect(md.split('\n')[0]).toBe('# Automata API reference, version 1.2.3')
  })

  it('has one section per entry point, with each export, its doc and its signature in a ts block', () => {
    expect(md).toContain("### `import { … } from '@fixture/alpha'`")
    expect(md).toContain("### `import { … } from '@fixture/alpha/sub'`")
    expect(md).toContain(
      '#### `subOnly` (function)\n\nOnly in the sub entry point.\n\n```ts\nfunction subOnly(): void;\n```',
    )
  })

  it('says so when an export has no doc comment', () => {
    expect(md).toContain('#### `undocumented` (const)\n\n_No doc comment._\n\n```ts')
  })
})

describe('llms-full.txt', () => {
  it('holds each corpus file in order, then the API reference', () => {
    const full = llmsFullText(repo, ['docs/guide.md', 'docs/decisions.md'], exports)
    const guide = full.indexOf('# Alpha guide')
    const decisions = full.indexOf('# Alpha decisions')
    const api = full.indexOf('# Automata API reference, version 1.2.3')
    expect(full.split('\n')[0]).toBe('# Automata Framework 1.2.3: full documentation')
    expect(full).toContain('Source: `docs/guide.md`')
    expect(guide).toBeGreaterThan(0)
    expect(decisions).toBeGreaterThan(guide)
    expect(api).toBeGreaterThan(decisions)
  })

  it('fails on a corpus file that does not exist rather than leaving it out', () => {
    expect(() => llmsFullText(repo, ['docs/missing.md'], exports)).toThrow(CorpusFileMissingError)
  })

  it("names only files that exist in AF's own corpus", () => {
    expect(CORPUS.filter((path) => !existsSync(join(afRoot, path)))).toEqual([])
  })
})
