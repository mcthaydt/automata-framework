// The storage entry (`@mcthaydt/automata-editor/kit/storage`): what a host writing its own ProjectStore (the Automata
// app's, over its own folder) needs of the kit, with no Svelte and no DOM, so Node loads it.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import * as storage from '#src/entries/kit-storage.ts'

const SRC = resolve(import.meta.dirname, '../../../src')

/** The source files `entry` reaches through relative imports, `entry` included. */
function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen
  seen.add(entry)
  for (const [, specifier] of readFileSync(entry, 'utf8').matchAll(/from\s+'(\.[^']*)'/g)) {
    const base = resolve(dirname(entry), specifier as string)
    reachable(/\.(ts|svelte)$/.test(base) ? base : `${base}.ts`, seen)
  }
  return seen
}

describe('the kit storage entry', () => {
  test('gives a host the contract helpers a store is built from', () => {
    expect(Object.keys(storage).sort()).toEqual([
      'StorageError',
      'assertStorePath',
      'assertStorePrefix',
      'classifyStorageError',
      'comparePaths',
      'createMemoryStore',
      'expectationProblem',
      'statPath',
      'toBytes',
    ])
  })

  test('reaches no Svelte component and imports only relative modules', () => {
    for (const file of reachable(resolve(SRC, 'entries/kit-storage.ts'))) {
      expect(file.endsWith('.svelte'), file).toBe(false)
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^import[^']*?from\s+'([^']+)'/gm))
        expect(specifier, `${file} imports ${specifier}`).toMatch(/^\./)
    }
  })

  test('gives the app store its own kind', async () => {
    const store = storage.createMemoryStore()
    expect(store.kind).toBe('memory')
  })
})
