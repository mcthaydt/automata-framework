import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { keepsOldNames, NEW_SCOPE, renameScope } from '#src/rename-scope.ts'

// The packages publish as `@automataframework/*`; `@automata` on npmjs.org is another account's. A branch made before
// the rename can bring an old name back when it merges, so this fails on any tracked file the scope codemod would still
// change. The codemod's own table and keep-list decide, so the check and the fix can never disagree:
//   node tooling/codemods/src/rename-scope-cli.ts
// A test that ran before the rename would fail on every file, so it waits for the rename (the switch below); the
// codemod's own tests hold its rules meanwhile.
const root = fileURLToPath(new URL('../../../..', import.meta.url))

/** The tracked text files that hold the word at all; `git grep` exits 1 when none do, which is not an error here. */
function filesNamingAutomata(): string[] {
  try {
    return execFileSync('git', ['grep', '-l', '-I', '-z', 'automata'], {
      encoding: 'utf8',
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    }).split('\0')
  } catch (error) {
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
}

/** The tracked files outside the history that the codemod would still change. */
const stale = (): string[] =>
  filesNamingAutomata().filter((path) => {
    if (path === '' || keepsOldNames(path)) return false
    const text = readFileSync(`${root}${path}`, 'utf8')
    return renameScope(text) !== text
  })

// The switch: the rename has landed once the framework package carries the new name. This test and the codemod can
// reach `main` before the rename itself; until then the old names are expected, and only the switch's own sanity holds.
const framework = JSON.parse(readFileSync(`${root}packages/automata/package.json`, 'utf8')).name as string
const renamed = framework === `@${NEW_SCOPE}/framework`

describe('the npm scope', () => {
  it.runIf(renamed)('no tracked file outside the history names a package in the old scope', () => {
    expect(stale(), 'run node tooling/codemods/src/rename-scope-cli.ts').toEqual([])
  })

  it.skipIf(renamed)('before the rename, the framework package still has its old name', () => {
    expect(framework).toBe('@automata/framework')
  })
})
