import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { publishedFileExists, relativeImports } from '../fixtures/dist-reading.ts'

// The checks on a built package read its `publishConfig` and its JavaScript the way Node's loader and the
// registry do, so a pattern export and a JSON import with its attribute are not mistaken for missing files.
const dir = mkdtempSync(join(tmpdir(), 'af-dist-reading-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
mkdirSync(join(dir, 'dist/words'), { recursive: true })
writeFileSync(join(dir, 'dist/words/en.json'), '{}')
writeFileSync(join(dir, 'dist/index.js'), '')

describe('publishedFileExists', () => {
  it('finds a plain file', () => {
    expect(publishedFileExists(dir, './dist/index.js')).toBe(true)
  })

  it('misses a plain file that is not there', () => {
    expect(publishedFileExists(dir, './dist/missing.js')).toBe(false)
  })

  it('finds a pattern export when a file matches the pattern', () => {
    expect(publishedFileExists(dir, './dist/words/*.json')).toBe(true)
  })

  it('misses a pattern export that nothing matches, or whose folder is not there', () => {
    expect(publishedFileExists(dir, './dist/words/*.yaml')).toBe(false)
    expect(publishedFileExists(dir, './dist/nowhere/*.json')).toBe(false)
  })
})

describe('relativeImports', () => {
  it('ignores what is written in a comment or a template literal, however its backticks pair up', () => {
    const code = [
      '// a lone backtick ` in a comment',
      "/** `import x from './in-a-doc-comment.js'` */",
      'export const template = `',
      "import type { Tuning } from '../../shared/tuning.ts'",
      '// a comment inside the template',
      '`',
      "import real from './real.js'",
    ].join('\n')
    expect(relativeImports(code)).toEqual([{ specifier: './real.js', jsonAttribute: false }])
  })

  it('reads a re-export of everything and a type import in a declaration file', () => {
    const code = `export * from './all.js';\nexport type T = import('./typed.js').T;`
    expect(relativeImports(code, 'x.d.ts')).toEqual([
      { specifier: './all.js', jsonAttribute: false },
      { specifier: './typed.js', jsonAttribute: false },
    ])
  })

  it('reads a plain import, an export-from and a dynamic import', () => {
    const code = `import a from './a.js';\nexport { b } from '../b.js';\nconst c = await import('./c.js');`
    expect(relativeImports(code)).toEqual([
      { specifier: './a.js', jsonAttribute: false },
      { specifier: '../b.js', jsonAttribute: false },
      { specifier: './c.js', jsonAttribute: false },
    ])
  })

  it('reports whether a JSON import carries its import attribute', () => {
    const code = `import en from './words/en.json' with { type: 'json' };\nimport bare from './words/bare.json';`
    expect(relativeImports(code)).toEqual([
      { specifier: './words/en.json', jsonAttribute: true },
      { specifier: './words/bare.json', jsonAttribute: false },
    ])
  })
})
