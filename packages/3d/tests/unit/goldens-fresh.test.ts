// The committed goldens (tests/fixtures/goldens) are AF's record of its own behaviour: recording again into a
// temporary folder must reproduce them. A difference means the code moved a golden; re-record in a named commit
// that explains the change (`pnpm --filter @automata/3d goldens`).

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GOLDEN_FILES, GOLDENS, recordGoldens } from '../../scripts/record-goldens.ts'

const out = mkdtempSync(join(tmpdir(), 'goldens-fresh-'))
afterAll(() => rmSync(out, { recursive: true, force: true }))

const read = (dir: string, name: string): unknown => JSON.parse(readFileSync(join(dir, name), 'utf8'))

/** The goldens' own tolerance: 1e-9, relative past 1 (the files keep 12 and 13 significant digits). */
function expectSame(actual: unknown, expected: unknown, where: string): void {
  if (typeof expected === 'number') {
    expect(typeof actual, where).toBe('number')
    expect(Math.abs((actual as number) - expected), where).toBeLessThanOrEqual(
      1e-9 * Math.max(1, Math.abs(expected)),
    )
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual) && actual.length, where).toBe(expected.length)
    for (const [n, value] of expected.entries()) expectSame((actual as unknown[])[n], value, `${where}[${n}]`)
  } else if (expected && typeof expected === 'object') {
    expect(Object.keys(actual as object), where).toEqual(Object.keys(expected))
    for (const [key, value] of Object.entries(expected))
      expectSame((actual as Record<string, unknown>)[key], value, `${where}.${key}`)
  } else expect(actual, where).toBe(expected)
}

describe('the committed goldens', () => {
  it('are the three files the recorder writes, and no others', () => {
    expect(readdirSync(GOLDENS).sort()).toEqual([...GOLDEN_FILES].sort())
  })
  it('recording into a temporary folder reproduces them', async () => {
    const written = await recordGoldens(out)
    expect(written.map((path) => path.slice(out.length + 1)).sort()).toEqual([...GOLDEN_FILES].sort())
    for (const name of GOLDEN_FILES) expectSame(read(out, name), read(GOLDENS, name), name)
  }, 60_000)
})
