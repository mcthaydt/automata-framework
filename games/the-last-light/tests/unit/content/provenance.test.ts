import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Every recorded file the game ships is in PROVENANCE.md with its checksum, and every row names a file that is there and
// has that checksum: nothing is in public/ that was not recorded, and nothing recorded has changed.

const ROOT = join(import.meta.dirname, '../../..')
const rows = readFileSync(join(ROOT, 'PROVENANCE.md'), 'utf8')
  .split('\n')
  .flatMap((line) => {
    const match = /^\| `(public\/[^`]+)` \|.*\| `([0-9a-f]{64})` \|$/.exec(line)
    return match === null ? [] : [{ path: match[1] as string, sha: match[2] as string }]
  })

const shipped = ['public/sounds', 'public/music'].flatMap((folder) =>
  readdirSync(join(ROOT, folder)).map((name) => `${folder}/${name}`),
)

describe('the recorded files', () => {
  it('are the twelve the old prologue plays: nine effects and three tracks', () => {
    expect(rows).toHaveLength(12)
    expect(rows.filter((row) => row.path.startsWith('public/sounds/'))).toHaveLength(9)
    expect(rows.filter((row) => row.path.startsWith('public/music/'))).toHaveLength(3)
  })

  it('have the checksum PROVENANCE.md records, byte for byte', () => {
    for (const row of rows) {
      expect(existsSync(join(ROOT, row.path)), row.path).toBe(true)
      expect(
        createHash('sha256')
          .update(readFileSync(join(ROOT, row.path)))
          .digest('hex'),
        row.path,
      ).toBe(row.sha)
    }
  })

  it('are all that is shipped: nothing in public/ is unrecorded', () => {
    expect(shipped.sort()).toEqual(rows.map((row) => row.path).sort())
  })

  it('leave out the one nothing in the prologue plays', () => {
    expect(shipped.some((path) => path.includes('all-lamps-die'))).toBe(false)
  })
})
