// The ports entry (`@automata/editor-kit/ports`, editor suite spec §4.1 and §4.3): the shapes every suite
// editor and host stands on. It is headless: Svelte appears only as the `Snippet` type, so Node loads it.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { SuiteEditor, SuiteUndo } from '#src/shared/kit/ports/index.ts'
import * as ports from '#src/shared/kit/ports/index.ts'

/** The kit folder whose entry this test checks, in `src/`. */
const FOLDER = resolve(import.meta.dirname, '../../../../../src/shared/kit/ports')

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

/** One import statement, however many lines it spans, with its module specifier. */
const IMPORT_STATEMENT = /^import\s[^']*?from\s+'([^']*)'/gm

describe('editor-kit ports entry', () => {
  test('the import matcher sees a statement the formatter spread over several lines', () => {
    const source = "import {\n  mount,\n  type Snippet,\n} from 'svelte'\nimport type { A } from './a'\n"
    expect(
      [...source.matchAll(IMPORT_STATEMENT)].map(([statement, specifier]) => [
        statement.startsWith('import type'),
        specifier,
      ]),
    ).toEqual([
      [false, 'svelte'],
      [true, './a'],
    ])
  })

  test('has one value at run time, defineSuiteEditor; everything else is a type', () => {
    expect(Object.keys(ports).sort()).toEqual(['defineSuiteEditor'])
  })

  test('reaches no Svelte file and imports svelte only as a type', () => {
    const files = [...reachable(resolve(FOLDER, 'index.ts'))]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(file.endsWith('.svelte'), file).toBe(false)
      // Whole statements, over as many lines as the formatter gives them: `import {\n  a,\n} from '...'`.
      const statements = [...source.matchAll(IMPORT_STATEMENT)]
      for (const [statement, specifier = ''] of statements) {
        if (/^svelte(\/|$)/.test(specifier)) expect(statement, file).toMatch(/^import type\s/)
        // Nothing but types and relative modules: a port shape never pulls a library in at run time.
        if (!/^import type\s/.test(statement)) expect(specifier, file).toMatch(/^\./)
      }
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

  test('an editor may offer an Undo hook over its session; without it the top bar has no Undo', () => {
    interface Session {
      text: string
    }
    const undo = (_session: Session): SuiteUndo => ({
      canUndo: () => false,
      canRedo: () => false,
      undoLabel: () => undefined,
      redoLabel: () => undefined,
      undo: () => undefined,
      redo: () => undefined,
      subscribe: () => () => undefined,
    })
    const editor: SuiteEditor<Session> = {
      id: 'tuner',
      label: 'Tuner',
      icon: 'sliders',
      hue: 'color/ed/tuner',
      open: async () => ({ text: '' }),
      regions: {} as SuiteEditor<Session>['regions'],
      undo,
    }
    const session = { text: 'a = 1\n' }
    expect(editor.undo?.(session).canUndo()).toBe(false)
  })
})
