import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 2D editors and site plan, task 14.1: every package is in the project's npm scope, `@automata`. The Owner's personal
// scope survives only in the history (the archive, the refactor records, the changelogs), in the scope codemod and in
// this check, which must name what they replace. `@mcthaydt` as a registry scope (`@mcthaydt:registry`) and as the
// GitHub owner are not package names, so they are not matched; task 14.2 moves the registry.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const OLD_NAME = /@mcthaydt\\?\/|mcthaydt-automata-(?!framework\b)/
const KEPT = [
  /^docs\/archive\//,
  /^docs\/refactor\//,
  /(^|\/)CHANGELOG\.md$/,
  // A changeset's text becomes a changelog entry, so the one announcing the rename names the old scope on purpose.
  /^\.changeset\/[^/]+\.md$/,
  /^tooling\/codemods\/(src|tests\/unit)\/rename-scope(-cli)?(\.test)?\.ts$/,
  /^tooling\/release\/tests\/unit\/scope\.test\.ts$/,
]

/** The tracked text files matching `pattern`; `git grep` exits 1 when nothing matches, which is not an error here. */
function filesMatching(pattern: RegExp): string[] {
  try {
    return execFileSync('git', ['grep', '-l', '-I', '-z', '-P', pattern.source], {
      encoding: 'utf8',
      cwd: root,
    }).split('\0')
  } catch (error) {
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
}

describe('the npm scope', () => {
  it('no tracked file outside the history names a package in the old scope', () => {
    const files = filesMatching(OLD_NAME).filter(
      (path) => path !== '' && !KEPT.some((pattern) => pattern.test(path)),
    )
    expect(files).toEqual([])
  })
})
