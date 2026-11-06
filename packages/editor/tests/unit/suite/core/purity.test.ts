// EDS-D1: the suite's headless core (its own folder and the editor list it reads) has no Svelte, no DOM, no Node and no
// clock, so the suite app in the browser and the Node adapters load the same list and policy. Enforced here, not only
// written down.
import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

/** `src/`, where the headless folders are. */
const SRC = new URL('../../../../src/', import.meta.url)
/** The headless folders, relative to `src/`: an import is judged by the folder it lands in. */
const CORE_FOLDERS = ['features/suite/core', 'shared/editor-list']
const ALLOWED_PACKAGES = new Set(['zod', 'smol-toml'])
/**
 * Headless folders a core file may import from: the core's two folders and the kit's content documents (no Svelte, no
 * DOM, no clock), which the interchange's import edits through.
 */
const ALLOWED_FOLDERS = [...CORE_FOLDERS.map((folder) => `${folder}/`), 'shared/kit/documents/']
/** The kit's port shapes, as types only: they are erased, so they bring no code (and no Svelte) to run. */
const TYPE_ONLY_FOLDERS = ['shared/kit/ports/']

/** Whether `specifier`, written in a file of `folder`, names a file under one of `folders`. */
const landsIn = (folder: string, specifier: string, folders: readonly string[]): boolean => {
  if (!specifier.startsWith('.')) return false
  const target = posix.join(folder, specifier)
  return folders.some((allowed) => target.startsWith(allowed))
}
// `document` is the DOM global, not an object key: `AskRequest.document` is a port field the Ask session fills in.
const FORBIDDEN =
  /\b(?:Date|setTimeout|setInterval|performance|Math\.random|document(?!\s*:)|window|process|globalThis)\b/

const sourcesOf = (folder: string): string[] =>
  readdirSync(new URL(`${folder}/`, SRC)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))

/** The code of a source with its comments removed (strings stay: an import is a string). */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe.each(CORE_FOLDERS)('%s is headless', (folder) => {
  const sources = sourcesOf(folder)

  it('has sources to check', () => {
    expect(sources.length).toBeGreaterThan(3)
  })

  for (const name of sources) {
    it(`${name} imports only zod, smol-toml, the core's folders, the kit's documents and the kit's port types, and touches no clock, DOM or process`, () => {
      const text = code(readFileSync(new URL(`${folder}/${name}`, SRC), 'utf8'))
      for (const match of text.matchAll(/\bimport\s+(type\s+)?[^;]*?\bfrom\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        const allowed =
          ALLOWED_PACKAGES.has(specifier) ||
          landsIn(folder, specifier, ALLOWED_FOLDERS) ||
          (landsIn(folder, specifier, TYPE_ONLY_FOLDERS) && match[1] !== undefined)
        expect(allowed, specifier).toBe(true)
      }
      for (const match of text.matchAll(/\bexport\s+(type\s+)?\{[^}]*\}\s*from\s+'([^']+)'/g)) {
        const specifier = match[2] ?? ''
        expect(
          landsIn(folder, specifier, ALLOWED_FOLDERS) ||
            (landsIn(folder, specifier, TYPE_ONLY_FOLDERS) && match[1] !== undefined),
          specifier,
        ).toBe(true)
      }
      // An import path names a file (`content-document.ts`), not the DOM global, so the check reads the code around it.
      expect(text.replace(/\bfrom\s+'[^']*'/g, '').match(FORBIDDEN)?.[0]).toBeUndefined()
    })
  }
})
