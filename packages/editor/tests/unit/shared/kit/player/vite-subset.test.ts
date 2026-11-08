import { describe, expect, it } from 'vitest'
import {
  applyEdits,
  buildConstantEdits,
  findGlobs,
  globToRegExp,
  pluginsOf,
  scanSpecifiers,
} from '#src/shared/kit/player/vite-subset.ts'

const values = (source: string): string[] => scanSpecifiers(source).map((each) => each.value)

describe('scanSpecifiers', () => {
  it('finds every way a module names another', () => {
    const source = [
      "import a from 'one'",
      "import { b, c } from './two.ts'",
      "import * as d from '../three'",
      "import 'four.css'",
      "export * from 'five'",
      "export { e } from 'six'",
      "const f = await import('seven')",
      'import {',
      '  g,',
      "} from 'eight'",
    ].join('\n')
    expect(values(source)).toEqual([
      'one',
      './two.ts',
      '../three',
      'four.css',
      'five',
      'six',
      'seven',
      'eight',
    ])
  })

  it('says which is a side-effect import, so a stylesheet import can be taken out whole', () => {
    const source = "import 'a.css'\nimport b from 'b'\n"
    const [css, plain] = scanSpecifiers(source)
    expect(css?.kind).toBe('side-effect')
    expect(source.slice(css?.statementStart, css?.statementEnd)).toBe("import 'a.css'")
    expect(plain?.kind).toBe('static')
  })

  it('skips type-only imports and exports, which are erased', () => {
    const source = [
      "import type { A } from 'types-only'",
      "export type { B } from 'also-types'",
      "import { type C, d } from 'real'",
    ].join('\n')
    expect(values(source)).toEqual(['real'])
  })

  it('ignores comments and the words inside strings', () => {
    const source = [
      "// import x from 'in-a-line-comment'",
      "/* import y from 'in-a-block' */",
      'const s = "import z from \'in-a-string\'"',
      "const t = `import w from 'in-a-template'`",
      "const url = 'http://example.com' // import q from 'after-url'",
      "import real from 'real'",
    ].join('\n')
    expect(values(source)).toEqual(['real'])
  })

  it('does not mistake import.meta for an import', () => {
    expect(values("const u = import.meta.url\nimport a from 'a'")).toEqual(['a'])
  })

  it('gives the specifier’s own position, so it can be rewritten in place', () => {
    const source = "import a from './x.ts'"
    const [found] = scanSpecifiers(source)
    expect(source.slice(found?.start, found?.end)).toBe('./x.ts')
  })
})

describe('buildConstantEdits', () => {
  const run = (source: string): string => applyEdits(source, buildConstantEdits(source))

  it('makes a build the way a dev page reads it: debug off, DEV on, no hot reload', () => {
    expect(run('if (__AUTOMATA_DEBUG__) x()')).toBe('if (false) x()')
    expect(run('const dev = import.meta.env.DEV')).toBe('const dev = true')
    expect(run('const prod = import.meta.env.PROD')).toBe('const prod = false')
    expect(run('import.meta.hot?.accept("./x.ts", f)')).toBe('undefined?.accept("./x.ts", f)')
  })

  it('leaves the same words in strings and comments alone', () => {
    const source = "const s = 'import.meta.env.DEV'\n// __AUTOMATA_DEBUG__"
    expect(run(source)).toBe(source)
  })
})

describe('findGlobs', () => {
  it('reads an eager glob for urls', () => {
    const source =
      "const art = import.meta.glob('./art/*.png', { eager: true, query: '?url', import: 'default' })"
    const [glob] = findGlobs(source)
    expect(glob?.pattern).toBe('./art/*.png')
    expect(glob?.supported).toBe(true)
    expect(source.slice(glob?.start, glob?.end)).toBe(
      "import.meta.glob('./art/*.png', { eager: true, query: '?url', import: 'default' })",
    )
  })

  it('marks a glob it cannot run: not eager, or not for urls', () => {
    expect(findGlobs("import.meta.glob('./a/*.ts')")[0]?.supported).toBe(false)
    expect(findGlobs("import.meta.glob('./a/*.png', { eager: true })")[0]?.supported).toBe(false)
  })
})

describe('globToRegExp', () => {
  it('matches * inside a folder, ** across folders, and {a,b}', () => {
    expect(globToRegExp('art/*.png').test('art/a.png')).toBe(true)
    expect(globToRegExp('art/*.png').test('art/deep/a.png')).toBe(false)
    expect(globToRegExp('art/**/*.png').test('art/deep/er/a.png')).toBe(true)
    expect(globToRegExp('a.{png,jpg}').test('a.jpg')).toBe(true)
    expect(globToRegExp('a.{png,jpg}').test('a.gif')).toBe(false)
    expect(globToRegExp('a.png').test('axpng')).toBe(false)
  })
})

describe('pluginsOf', () => {
  it('lists the calls in a Vite config’s plugins array', () => {
    const config =
      "export default defineConfig({ base: './', plugins: [svelte(), automataContent({ root: '.' })] })"
    expect(pluginsOf(config)).toEqual(['svelte', 'automataContent'])
  })

  it('has none when the config names none, and nothing when it has no plugins array', () => {
    expect(pluginsOf('export default defineConfig({ plugins: [] })')).toEqual([])
    expect(pluginsOf('export default defineConfig({})')).toEqual([])
  })

  it('reads a config with a plugin that takes brackets, and ignores commented ones', () => {
    const config = 'plugins: [\n  // other(),\n  svelte({ compilerOptions: { a: [1, 2] } }),\n  thing,\n]'
    expect(pluginsOf(config)).toEqual(['svelte', 'thing'])
  })
})
