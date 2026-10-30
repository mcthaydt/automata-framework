// The ports entry (`@mcthaydt/automata-editor-kit/ports`, editor suite spec §4.1 and §4.3): the shapes every suite
// editor and host stands on. It is headless: Svelte appears only as the `Snippet` type, so Node loads it.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { SuiteEditor } from './index'
import * as ports from './index'

/** The source files `entry` reaches through relative imports, `entry` included. */
function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen
  seen.add(entry)
  const source = readFileSync(entry, 'utf8')
  for (const [, specifier] of source.matchAll(/from\s+'(\.[^']*)'/g)) {
    const base = resolve(dirname(entry), specifier as string)
    reachable(/\.(ts|svelte)$/.test(base) ? base : `${base}.ts`, seen)
  }
  return seen
}

describe('editor-kit ports entry', () => {
  test('has one value at run time, defineSuiteEditor; everything else is a type', () => {
    expect(Object.keys(ports).sort()).toEqual(['defineSuiteEditor'])
  })

  test('reaches no Svelte file and imports svelte only as a type', () => {
    const files = [...reachable(resolve(import.meta.dirname, 'index.ts'))]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(file.endsWith('.svelte'), file).toBe(false)
      for (const [statement] of source.matchAll(/^import[^\n]*from\s+'svelte(\/[^']*)?'/gm))
        expect(statement, file).toMatch(/^import type /)
      // Nothing but types and relative modules: a port shape never pulls a library in at run time.
      for (const [, specifier] of source.matchAll(/^import (?!type )[^\n]*from\s+'([^']*)'/gm))
        expect(specifier, file).toMatch(/^\./)
    }
  })

  test('defineSuiteEditor gives back the editor it was given, so the id the list names stays checked by type', () => {
    const editor: SuiteEditor<{ readonly files: number }> = {
      id: 'tuner',
      label: 'Tuner',
      icon: 'sliders',
      hue: 'color/ed/tuner',
      open: async (files) => ({ files: files.length }),
      regions: {} as SuiteEditor<{ readonly files: number }>['regions'],
      contributions: ['tuner.source'],
    }
    expect(ports.defineSuiteEditor(editor)).toBe(editor)
  })
})
