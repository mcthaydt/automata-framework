// EDS-D1: `./core` has no Svelte, no DOM, no Node and no clock, so the suite app in the browser and the Node adapters
// load the same list and policy. Enforced here, not only written down.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ALLOWED_IMPORTS = new Set(['zod', 'smol-toml'])
const FORBIDDEN =
  /\b(?:Date|setTimeout|setInterval|performance|Math\.random|document|window|process|globalThis)\b/

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
    it(`${name} imports only zod, smol-toml and its own files, and touches no clock, DOM or process`, () => {
      const text = code(readFileSync(new URL(name, import.meta.url), 'utf8'))
      const imports = [...text.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1] ?? '')
      for (const specifier of imports) {
        expect(specifier.startsWith('./') || ALLOWED_IMPORTS.has(specifier), specifier).toBe(true)
      }
      expect(text.match(FORBIDDEN)?.[0]).toBeUndefined()
    })
  }
})
