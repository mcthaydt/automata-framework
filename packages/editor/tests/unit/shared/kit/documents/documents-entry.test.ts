// @vitest-environment node
// The content documents entry (`@mcthaydt/automata-editor/kit/documents`, editor suite spec EDS-D2): headless, so the
// suite's Node adapters, a worker and the editors' headless layers can all load it.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

/** The kit folder whose entry this test checks, in `src/`. */
const FOLDER = resolve(import.meta.dirname, '../../../../../src/shared/kit/documents')

/** The source files `entry` reaches through relative imports, `entry` included. */
function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen
  seen.add(entry)
  const source = readFileSync(entry, 'utf8')
  for (const [, specifier] of source.matchAll(/from\s+'(\.[^']*)'/g)) {
    const base = resolve(dirname(entry), specifier as string)
    const path = /\.(ts|svelte)$/.test(base) ? base : `${base}.ts`
    reachable(path, seen)
  }
  return seen
}

describe('editor-kit documents entry', () => {
  test('is the package export ./documents', async () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../../package.json'), 'utf8'),
    ) as {
      exports: Record<string, unknown>
    }
    expect(manifest.exports['./kit/documents']).toBe('./src/entries/kit-documents.ts')
    const documents = await import('@mcthaydt/automata-editor/kit/documents')
    for (const name of [
      'openDocument',
      'DocumentSyntaxError',
      'patchToml',
      'patchJson',
      'scan',
      'formatJsonNumber',
      'insertElement',
      'readLayout',
    ])
      expect(documents, name).toHaveProperty(name)
  })

  test('reaches no Svelte file, no other part of the kit, no DOM and no Node module', () => {
    const files = [...reachable(resolve(FOLDER, 'index.ts'))]
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      expect(file.startsWith(FOLDER), file).toBe(true)
      expect(file.endsWith('.svelte'), file).toBe(false)
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/from\s+'(svelte(\/[^']*)?|node:[^']*)'/)
      expect(source, file).not.toMatch(/\b(document|window|localStorage|navigator)\.\w/)
    }
  })
})
