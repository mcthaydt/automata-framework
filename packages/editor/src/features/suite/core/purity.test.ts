// EDS-D1: `./core` has no Svelte, no DOM, no Node and no clock, so the suite app in the browser and the Node adapters
// load the same list and policy. Enforced here, not only written down.
import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

/** This folder, relative to `src/`: an import is judged by the folder it lands in. */
const HERE = 'features/suite/core'
const ALLOWED_PACKAGES = new Set(['zod', 'smol-toml'])
/**
 * Headless folders beside this one: its own files, the editor list (the loader and the policy) and the kit's content
 * documents (no Svelte, no DOM, no clock), which the interchange's import edits through.
 */
const ALLOWED_FOLDERS = [`${HERE}/`, 'shared/editor-list/', 'shared/kit/documents/']
/** The kit's port shapes, as types only: they are erased, so they bring no code (and no Svelte) to run. */
const TYPE_ONLY_FOLDERS = ['shared/kit/ports/']

const landsIn = (specifier: string, folders: readonly string[]): boolean => {
  if (!specifier.startsWith('.')) return false
  const target = posix.join(HERE, specifier)
  return folders.some((folder) => target.startsWith(folder))
}
// `document` is the DOM global, not an object key: `AskRequest.document` is a port field the Ask session fills in.
const FORBIDDEN =
  /\b(?:Date|setTimeout|setInterval|performance|Math\.random|document(?!\s*:)|window|process|globalThis)\b/

const sources = readdirSync(new URL('.', import.meta.url)).filter(
  (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
)

/** The code of a source with its comments removed (strings stay: an import is a string). */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the suite core is headless', () => {
  it('has sources to check', () => {
    expect(sources).toContain('index.ts')
  })

  for (const name of sources) {
    it(`${name} imports only zod, smol-toml, the editor list, the kit's documents, its own files and the kit's port types, and touches no clock, DOM or process`, () => {
      const text = code(readFileSync(new URL(name, import.meta.url), 'utf8'))
      for (const match of text.matchAll(/\bimport\s+(type\s+)?[^;]*?\bfrom\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        const allowed =
          ALLOWED_PACKAGES.has(specifier) ||
          landsIn(specifier, ALLOWED_FOLDERS) ||
          (landsIn(specifier, TYPE_ONLY_FOLDERS) && match[1] !== undefined)
        expect(allowed, specifier).toBe(true)
      }
      for (const match of text.matchAll(/\bexport\s+(type\s+)?\{[^}]*\}\s*from\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        expect(
          landsIn(specifier, ALLOWED_FOLDERS) ||
            (landsIn(specifier, TYPE_ONLY_FOLDERS) && match[1] !== undefined),
          specifier,
        ).toBe(true)
      }
      // An import path names a file (`content-document.ts`), not the DOM global, so the check reads the code around it.
      expect(text.replace(/\bfrom\s+'[^']*'/g, '').match(FORBIDDEN)?.[0]).toBeUndefined()
    })
  }
})
