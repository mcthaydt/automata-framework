// The shell-free entry (`@automataframework/automata-editor-kit/core`): what an editor's headless layers import so that they run on
// Node without the Svelte compiler, the way the 2D lane's `./fields` does.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import * as core from '#src/shared/kit/core/index.ts'

/** The kit folder whose entry this test checks, in `src/`. */
const FOLDER = resolve(import.meta.dirname, '../../../../../src/shared/kit/core')

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

describe('editor-kit core entry', () => {
  test('exports history, selection, commands, the keymap, the viewport, storage, the project list and toasts, and no component', () => {
    expect(Object.keys(core).sort()).toEqual([
      'HistoryError',
      'StorageError',
      'autosaveProblem',
      'cardWords',
      'classifyStorageError',
      'createCommandRegistry',
      'createDocumentSession',
      'createDownloadStore',
      'createFolderStore',
      'createHistory',
      'createHttpStore',
      'createIndexedDbVault',
      'createKeymap',
      'createMemoryStore',
      'createProjectBrowser',
      'createSelection',
      'createToasts',
      'createViewport',
      'defineCommand',
      'discardRecovery',
      'filterEntries',
      'findRecovery',
      'flushOnHide',
      'modifiedLabel',
      'normalizeShortcut',
      'openServedWorkspace',
      'openWorkspace',
      'parseShortcut',
      'pickFolder',
      'projectCount',
      'readStored',
      'reconcileSelection',
      'recoveryUnreadable',
      'reloadedMessage',
      'restoreFolder',
      'retryAction',
      'saveFailure',
      'savedCopyMessage',
      'sizeLabel',
      'splitPath',
      'statPath',
      'stepSelection',
      'storageNotes',
      'storePathProblem',
      'workspaceSubtitle',
    ])
  })

  test('reaches no Svelte file and imports no svelte package, so Node can load it', () => {
    const files = [...reachable(resolve(FOLDER, 'index.ts'))]
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      expect(file.endsWith('.svelte'), file).toBe(false)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from\s+'svelte(\/[^']*)?'/)
    }
  })

  test('works on its own: a history of one number, undone', () => {
    const history = core.createHistory(1)
    history.apply('add', (n) => n + 1)
    expect(history.state).toBe(2)
    history.undo()
    expect(history.state).toBe(1)
  })
})
