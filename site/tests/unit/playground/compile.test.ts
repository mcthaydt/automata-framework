// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileExample, sucraseDiagnostic } from '../../../src/features/playground/compile'

// The playground's compile step (spec §5.2): the reader's TypeScript in, a module the frame can import out, or the
// diagnostics at their lines. The example sources come from examples/2d.
const RECTS = readFileSync(
  resolve(import.meta.dirname, '../../../../examples/2d/shapes/shapes-rects.ts'),
  'utf8',
)
const EXAMPLE = {
  id: 'shapes-rects',
  moduleUrl: 'https://automata.example/playground/examples/shapes/shapes-rects.ts',
}

const compiled = (source: string): string => {
  const result = compileExample(source, EXAMPLE)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result.code
}
const lines = (text: string) => text.split('\n')
const withLine = (source: string, after: number, text: string) => {
  const all = lines(source)
  all.splice(after, 0, text)
  return all.join('\n')
}

describe('compileExample', () => {
  it('strips the types and keeps every line where the reader wrote it', () => {
    const out = lines(compiled(RECTS))
    const source = lines(RECTS)
    expect(out.length).toBe(source.length + 1) // the sourceURL line
    expect(out[16]).toContain("defineSystem('move'")
    expect(out.join('\n')).not.toMatch(/:\s*(number|string)\b/)
  })

  it('names the file for stack traces, as the frame expects (examples/<module>/<file>)', () => {
    expect(lines(compiled(RECTS)).at(-1)).toBe('//# sourceURL=examples/shapes/shapes-rects.ts')
  })

  it('reports a syntax error inside a system at its own line and column', () => {
    const broken = withLine(RECTS, 20, '    const broken = 1 +;')
    const result = compileExample(broken, EXAMPLE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({ line: 21, column: lines(broken)[20]!.indexOf(';') + 1 })
  })

  it('refuses an import of anything but @mcthaydt/automata and zod, at its line', () => {
    const result = compileExample(`import _ from 'lodash'\n${RECTS}`, EXAMPLE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics).toEqual([
      { line: 1, column: 1, message: 'The playground can import only @mcthaydt/automata and zod.' },
    ])
    expect(compileExample(`export * from './other'\n${RECTS}`, EXAMPLE).ok).toBe(false)
    expect(compileExample(`import { z } from 'zod'\n${RECTS}`, EXAMPLE).ok).toBe(true)
  })

  it('refuses the other ways to reach another module: type-only imports, re-exports and import = require', () => {
    const refused = (source: string) => {
      const result = compileExample(source, EXAMPLE)
      return result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.message)
    }
    const message = 'The playground can import only @mcthaydt/automata and zod.'
    expect(refused("import type { Thing } from './other'")).toEqual([message])
    expect(refused("export { a } from './other'")).toEqual([message])
    expect(refused("import x = require('m')")).toEqual([message])
    expect(refused("export import y = require('m')")).toEqual([message])
  })

  it('refuses the TypeScript forms the type strip would drop or turn into CommonJS', () => {
    const first = (source: string) => {
      const result = compileExample(source, EXAMPLE)
      return result.ok ? undefined : result.diagnostics[0]
    }
    expect(first('const a = 1\nnamespace N { export const b = 2 }')).toEqual({
      line: 2,
      column: 1,
      message: 'The playground does not run namespaces; use a module-level object instead.',
    })
    expect(first('namespace A.B { export const c = 3 }')?.message).toBe(
      'The playground does not run namespaces; use a module-level object instead.',
    )
    expect(first('export = 1')).toEqual({
      line: 1,
      column: 1,
      message: 'The playground runs ES modules; use export default instead of export =.',
    })
    expect(compileExample("declare namespace N { const b: number }\ndeclare module 'm' {}", EXAMPLE).ok).toBe(
      true,
    )
  })

  it('guards every loop at the top of its body with its line, adding no line', () => {
    const source = [
      'for (let i = 0; i < 3; i++) { work(i) }',
      'for (const item of items) work(item)',
      'for (const key in record) {}',
      'while (busy()) step()',
      'do { step() } while (busy())',
    ].join('\n')
    const out = lines(compiled(source))
    expect(out[0]).toBe('for (let i = 0; i < 3; i++) {__afLoop(1); work(i) }')
    expect(out[1]).toBe('for (const item of items) {__afLoop(2);work(item)}')
    expect(out[2]).toBe('for (const key in record) {__afLoop(3);}')
    expect(out[3]).toBe('while (busy()) {__afLoop(4);step()}')
    expect(out[4]).toBe('do {__afLoop(5); step() } while (busy())')
  })

  it('guards labeled, for await and empty-bodied loops', () => {
    const out = lines(
      compiled(
        [
          'outer: for (;;) { break outer }',
          'async function f() { for await (const x of xs) use(x) }',
          'while (busy());',
        ].join('\n'),
      ),
    )
    expect(out[0]).toBe('outer: for (;;) {__afLoop(1); break outer }')
    expect(out[1]).toBe('async function f() { for await (const x of xs) {__afLoop(2);use(x)} }')
    expect(out[2]).toBe('while (busy()){__afLoop(3);;}')
  })

  it('keeps the guard when a loop body starts with import.meta.url', () => {
    const url = JSON.stringify(EXAMPLE.moduleUrl)
    expect(lines(compiled('while (x) { import.meta.url.length }'))[0]).toBe(
      `while (x) {__afLoop(1); ${url}.length }`,
    )
    expect(lines(compiled('while (x) import.meta.url'))[0]).toBe(`while (x) {__afLoop(1);${url}}`)
    expect(lines(compiled('do import.meta.url; while (0)'))[0]).toBe(`do {__afLoop(1);${url};} while (0)`)
  })

  it('rewrites import.meta.url to the module URL and nothing else', () => {
    const out = compiled(
      "const a = new URL('../resources/chime.wav', import.meta.url)\nconst b = import.meta.env\n",
    )
    expect(lines(out)[0]).toBe(
      `const a = new URL('../resources/chime.wav', ${JSON.stringify(EXAMPLE.moduleUrl)})`,
    )
    expect(lines(out)[1]).toBe('const b = import.meta.env')
  })

  it("reports a type-strip failure at the reader's own column, without sucrase's wrapping", () => {
    // Babel catches every syntax error first, so this path is reached only by a sucrase bug; the mapping is tested
    // directly. The edited text has a 12-character guard before the failure.
    const source = 'while (x) { y }'
    const edits = [{ at: 11, text: '__afLoop(1);' }]
    const error = Object.assign(
      new Error('Error transforming examples/shapes/a.ts: Unexpected token (1:25)'),
      { pos: 24 },
    )
    expect(sucraseDiagnostic(source, edits, error)).toEqual({
      line: 1,
      column: 13,
      message: 'Unexpected token',
    })
    expect(sucraseDiagnostic('a\nb', [], new Error('boom'))).toEqual({ line: 1, column: 1, message: 'boom' })
  })
})
