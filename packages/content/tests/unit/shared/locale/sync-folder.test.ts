import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { syncFolder } from '#src/shared/locale/sync-folder.ts'

// `syncFolder` makes one folder match another by writing only what differs, so a dev server watching the target never
// sees it emptied or rewritten while nothing changed (task 1.7: Paraglide emptied its folder on every compile).

function folder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sync-folder-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true })
    writeFileSync(join(root, name), text)
  }
  return root
}

const mtimeOf = (root: string, name: string): number => statSync(join(root, name)).mtimeMs

describe('syncFolder', () => {
  it('writes what is new, rewrites what differs, and removes what the source no longer has', async () => {
    const from = folder({ 'a.js': 'A2', 'sub/b.js': 'B', 'c.js': 'C' })
    const to = folder({ 'a.js': 'A1', 'old.js': 'gone', 'sub/stale.js': 'gone' })
    expect(await syncFolder(from, to)).toEqual({ written: 3, removed: 2 })
    expect(readFileSync(join(to, 'a.js'), 'utf8')).toBe('A2')
    expect(readFileSync(join(to, 'sub/b.js'), 'utf8')).toBe('B')
    expect(existsSync(join(to, 'old.js'))).toBe(false)
    expect(existsSync(join(to, 'sub/stale.js'))).toBe(false)
  })

  it('touches nothing when the folders already match', async () => {
    const from = folder({ 'a.js': 'A', 'sub/b.js': 'B' })
    const to = folder({ 'a.js': 'A', 'sub/b.js': 'B' })
    const before = [mtimeOf(to, 'a.js'), mtimeOf(to, 'sub/b.js')]
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await syncFolder(from, to)).toEqual({ written: 0, removed: 0 })
    expect([mtimeOf(to, 'a.js'), mtimeOf(to, 'sub/b.js')]).toEqual(before)
  })

  it('creates the target when it does not exist, and drops folders it no longer needs', async () => {
    const from = folder({ 'a.js': 'A' })
    const to = join(folder({}), 'made')
    expect(await syncFolder(from, to)).toEqual({ written: 1, removed: 0 })
    const other = folder({ 'a.js': 'A', 'dir/x.js': 'x' })
    expect(await syncFolder(from, other)).toEqual({ written: 0, removed: 1 })
    expect(readdirSync(other)).toEqual(['a.js'])
  })
})
