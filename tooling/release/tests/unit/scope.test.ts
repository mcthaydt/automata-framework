import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The project's npm scope is `@automataframework`. The Owner's own account name is not a scope any package lives
// under. History keeps the old name: `docs/archive/`, `docs/refactor/` (the plans quote the names they were built
// under) and the changelogs.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const HISTORY = [/^docs\/archive\//, /^docs\/refactor\//, /(^|\/)CHANGELOG\.md$/]
const OLD_SCOPE = /@mcthaydt(\\?\/|:)/

const tracked = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((file) => file !== '' && !HISTORY.some((pattern) => pattern.test(file)))

describe('the npm scope', () => {
  it('is @automataframework: no tracked file outside the history names @mcthaydt as a scope', () => {
    const stale = tracked().filter((file) => {
      // A dangling symlink or a binary is not text to scan.
      const path = `${root}/${file}`
      if (!existsSync(path)) return false
      const bytes = readFileSync(path)
      if (bytes.includes(0)) return false
      return OLD_SCOPE.test(bytes.toString('utf8'))
    })
    expect(stale).toEqual([])
  })
})
