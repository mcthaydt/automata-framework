// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileExample } from '../../src/lib/playground/compile'

// The playground's compile step (spec §5.2): the reader's TypeScript in, a module the frame can import out, or the
// diagnostics at their lines. The example sources come from the framework checkout at framework.ref.
const RECTS = readFileSync(resolve('../automata-framework/examples/shapes/shapes-rects.ts'), 'utf8')
const EXAMPLE = { id: 'shapes-rects', moduleUrl: 'https://automata.example/playground/examples/shapes/shapes-rects.ts' }

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
  it("strips the types and keeps every line where the reader wrote it", () => {
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

  it('rewrites import.meta.url to the module URL and nothing else', () => {
    const out = compiled("const a = new URL('../resources/chime.wav', import.meta.url)\nconst b = import.meta.env\n")
    expect(lines(out)[0]).toBe(`const a = new URL('../resources/chime.wav', ${JSON.stringify(EXAMPLE.moduleUrl)})`)
    expect(lines(out)[1]).toBe('const b = import.meta.env')
  })
})
