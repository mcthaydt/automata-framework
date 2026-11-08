import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AUTHORED_NAMES, loadAuthored } from '#src/testing/fixtures.ts'

const SOURCE = JSON.parse(
  readFileSync(new URL('../../../src/testing/fixtures/SOURCE.json', import.meta.url), 'utf8'),
) as {
  authored: Record<string, { bytes: number; sha256: string; purpose: string }>
}

describe('the authored fixtures', () => {
  it('are the depot sample, and SOURCE.json lists exactly them', () => {
    expect([...AUTHORED_NAMES]).toEqual(['depot.af-sector'])
    expect(Object.keys(SOURCE.authored).sort()).toEqual(AUTHORED_NAMES.map((name) => `${name}.json`).sort())
  })

  for (const name of AUTHORED_NAMES) {
    it(`${name}: has the recorded byte length and sha256, and says what it is for`, () => {
      const recorded = SOURCE.authored[`${name}.json`]
      const bytes = Buffer.from(loadAuthored(name), 'utf8')
      expect(bytes.length).toBe(recorded?.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(recorded?.sha256)
      expect(recorded?.purpose).toMatch(/ED3D\.1b/)
    })
  }

  it('are excluded from the formatter, which would rewrite their hand-written layout', () => {
    const biome = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../../../biome.json', import.meta.url)), 'utf8'),
    ) as {
      files: { includes: string[] }
    }
    expect(biome.files.includes).toContain('!packages/editor-3d/src/testing/fixtures')
  })
})
