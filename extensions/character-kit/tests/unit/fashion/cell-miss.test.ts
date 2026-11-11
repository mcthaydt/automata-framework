// The report a golden test gives when painted cells miss their md5: every miss, not the first, with the machine it ran on and
// the cell itself, so a difference between two platforms can be read from a CI log by diffing the dump against a cell made
// elsewhere. The golden holds md5s only (it must not change), so the log carries the actual cell, not an expected one.
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { type CellMiss, cellMd5, decodeDump, missReport } from '../../fixtures/cell-miss.ts'

const cellOfBytes = (...rgba: number[]): Uint8Array => Uint8Array.from(rgba)

describe('a golden miss report', () => {
  const same = cellOfBytes(1, 2, 3, 255, 0, 0, 0, 0)
  const other = cellOfBytes(1, 2, 4, 255, 0, 0, 0, 0)
  const miss = (label: string, expected: string, cell: Uint8Array): CellMiss => ({ label, expected, cell })

  it('is nothing when every cell matches', () => {
    expect(missReport([], { arch: 'x64', node: 'v24.0.0', platform: 'linux' })).toBeUndefined()
    expect(cellMd5(same)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('names every miss with its expected and actual md5, and the machine', () => {
    const report = missReport(
      [
        miss('nia on thin, direction 0', cellMd5(same), other),
        miss('nia on heavy, direction 3', cellMd5(same), other),
      ],
      { arch: 'arm64', node: 'v24.21.0', platform: 'darwin' },
    )
    expect(report?.text).toContain('2 cells miss their golden')
    expect(report?.text).toContain('arm64')
    expect(report?.text).toContain('v24.21.0')
    expect(report?.text).toContain('darwin')
    expect(report?.text).toContain(
      `nia on thin, direction 0: expected ${cellMd5(same)}, got ${cellMd5(other)}`,
    )
    expect(report?.text).toContain('nia on heavy, direction 3')
  })

  it('counts the opaque texels so a dump can be sanity-checked without decoding it', () => {
    const report = missReport([miss('a', cellMd5(same), other)], {
      arch: 'x64',
      node: 'v24.0.0',
      platform: 'linux',
    })
    expect(report?.text).toContain('8 bytes, 1 opaque texels')
  })

  it('dumps the actual cell so that it decodes to the same bytes', () => {
    const report = missReport([miss('a b', cellMd5(same), other)], {
      arch: 'x64',
      node: 'v24.0.0',
      platform: 'linux',
    })
    const lines = report?.dumps[0]
    expect(lines?.[0]).toBe('cell-dump a b bytes=8 md5=' + cellMd5(other))
    const bytes = decodeDump(lines ?? [])
    expect([...bytes]).toEqual([...other])
    expect([...gunzipSync(Buffer.from(lines?.slice(1).join('') ?? '', 'base64'))]).toEqual([...other])
  })

  it('keeps long dumps in short lines and dumps at most the first few misses', () => {
    const big = new Uint8Array(40_000).map((_, i) => (i * 2654435761) % 251)
    const misses = Array.from({ length: 9 }, (_, i) => miss(`m${i}`, 'x', big))
    const report = missReport(misses, { arch: 'x64', node: 'v24.0.0', platform: 'linux' })
    expect(report?.dumps.length).toBe(4)
    for (const line of report?.dumps[0] ?? []) expect(line.length).toBeLessThanOrEqual(240)
    expect(report?.text).toContain('9 cells miss their golden')
    expect(report?.text).toContain('only the first 4 are dumped')
    expect([...decodeDump(report?.dumps[0] ?? [])]).toEqual([...big])
  })
})
