// The headless layers (`shared/` and the Levels 3D feature) import no Svelte, no DOM, no clock and no Node. The rule is
// enforced here and not only written down, so a later change cannot quietly add one. Which layer may import which is
// `pnpm boundaries`' (`--features packages/editor-3d --components`).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findImpurities } from '#src/testing/purity.ts'

describe('findImpurities', () => {
  it('flags a forbidden import, a DOM global, a clock, a timer and randomness', () => {
    const bad = [
      "import { writable } from 'svelte/store'",
      "import ts from 'typescript'",
      "import { Effect } from 'effect'",
      "import { readFileSync } from 'node:fs'",
      'const now = Date.now()',
      'const when = new Date()',
      'setTimeout(() => {}, 1)',
      'requestAnimationFrame(tick)',
      'const t = performance.now()',
      'const r = Math.random()',
      'const el = document.body',
      "localStorage.setItem('a', 'b')",
      'const width = window.innerWidth',
      'addEventListener(window, 1)',
      // A string is text, but the code of a template's `${}` is code, and code after a string is code.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      'const title = `the page ${document.title}`',
      "const wide = 'the width is ' + window.innerWidth",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      'const nested = `a ${`b ${Date.now()}`}`',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      'const braces = `${f({ a: 1 }, document)} text`',
      "const tricky = 'it\\'s' + document.body",
    ]
    for (const line of bad) expect(findImpurities(line), line).not.toEqual([])
  })

  it('passes ordinary code, and mentions in comments and words that only contain a name', () => {
    const fine = [
      "import { z } from 'zod'",
      "import { scan } from './locate'",
      '// no Date, no Math.random, no document here',
      '/* setTimeout is banned */ const x = 1',
      'const update = 1',
      'const mandate = 2',
      // `window` and `document` are also names of a wall's members in the format.
      'readonly window?: WindowDef | undefined',
      'window: windowSchema.optional(),',
      'const piece = wall.window',
      "const key = 'window'",
      // A sentence for the person may name the things of the format, and so may a comment inside a template.
      "const sentence = 'the window does not fit the wall'",
      'const label = "Set the window of the document"',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      'const label = `Set the window of wall ${corner} of ${sector}`',
      "const escaped = 'it\\'s the window'",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      'const object = `${f({ a: 1 })} the window`',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the source text a finding is looked for in.
      "const plain = 'costs ${document} or ${window}'",
      'const slash = /*/ Date.now() */ 1',
      'const text = `line one\nthe window and the document`',
      "const url = 'http://example.com/window'",
      'const next = 1 // the window and Date.now() are named here',
    ]
    for (const line of fine) expect(findImpurities(line), line).toEqual([])
  })
})

const files = (directory: string, keep: (name: string) => boolean): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return files(path, keep)
    return keep(entry.name) ? [path] : []
  })
const src = (folder: string): string => new URL(`../../../src/${folder}`, import.meta.url).pathname

// The Pixi renderers are the views of the headless layers and may use a store and the DOM. The Studio's own controller
// and view keep Svelte stores; it is a separate feature that was never one of the pure layers.
describe('the pure layers', () => {
  for (const folder of ['shared', 'features/levels-3d']) {
    it(`src/${folder} has no impure import or global`, () => {
      const found = files(
        src(folder),
        (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('-renderer.ts'),
      )
      expect(found.length).toBeGreaterThan(0)
      const findings = found.flatMap((file) =>
        findImpurities(readFileSync(file, 'utf8')).map((finding) => `${file}: ${finding}`),
      )
      expect(findings).toEqual([])
    })
  }
})

// The views take time from the boot's clock (ED3D-D1): a component's script reads none of its own.
const CLOCK =
  /^(Date|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|queueMicrotask|performance\.now|Math\.random)$/
describe('the components', () => {
  it('read no clock of their own', () => {
    const components = files(src('.'), (name) => name.endsWith('.svelte') && name !== 'ShellProbe.svelte')
    expect(components.length).toBeGreaterThan(20)
    const findings = components.flatMap((file) => {
      const scripts = [...readFileSync(file, 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
        (m) => m[1] ?? '',
      )
      return findImpurities(scripts.join('\n'))
        .filter((found) => CLOCK.test(found))
        .map((found) => `${file}: ${found}`)
    })
    expect(findings).toEqual([])
  })
})
