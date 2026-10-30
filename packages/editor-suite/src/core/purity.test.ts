// EDS-D1: `./core` has no Svelte, no DOM, no Node and no clock, so the suite app in the browser and the Node adapters
// load the same list and policy. Enforced here, not only written down.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ALLOWED_IMPORTS = new Set(['zod', 'smol-toml'])
/** The kit's port shapes, as types only: they are erased, so they bring no code (and no Svelte) to run. */
const TYPE_ONLY_IMPORTS = new Set(['@mcthaydt/automata-editor-kit/ports'])
// `document` is the DOM global, not an object key: `AskRequest.document` is a port field the Ask session fills in.
const FORBIDDEN =
  /\b(?:Date|setTimeout|setInterval|performance|Math\.random|document(?!\s*:)|window|process|globalThis)\b/

const sources = readdirSync(new URL('.', import.meta.url)).filter(
  (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
)

/** The code of a source with its comments removed (strings stay: an import is a string). */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('editor-suite/core is headless', () => {
  it('has sources to check', () => {
    expect(sources).toContain('index.ts')
  })

  for (const name of sources) {
    it(`${name} imports only zod, smol-toml, its own files and the kit's port types, and touches no clock, DOM or process`, () => {
      const text = code(readFileSync(new URL(name, import.meta.url), 'utf8'))
      for (const match of text.matchAll(/\bimport\s+(type\s+)?[^;]*?\bfrom\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        const allowed =
          specifier.startsWith('./') ||
          ALLOWED_IMPORTS.has(specifier) ||
          (TYPE_ONLY_IMPORTS.has(specifier) && match[1] !== undefined)
        expect(allowed, specifier).toBe(true)
      }
      for (const match of text.matchAll(/\bexport\s+(type\s+)?\{[^}]*\}\s*from\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        expect(
          specifier.startsWith('./') || (TYPE_ONLY_IMPORTS.has(specifier) && match[1] !== undefined),
          specifier,
        ).toBe(true)
      }
      expect(text.match(FORBIDDEN)?.[0]).toBeUndefined()
    })
  }
})
