import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, GOLDEN_NAMES, loadFixture, loadGolden } from './fixtures'

const SOURCE = JSON.parse(readFileSync(new URL('./fixtures/SOURCE.json', import.meta.url), 'utf8')) as {
  repository: string
  commit: string
  files: Record<string, { source: string; bytes: number; sha256: string }>
  goldens: Record<string, { bytes: number; sha256: string; recordedBy: string }>
}

describe('the Last Light fixtures', () => {
  it('record the repository and the commit they were copied from', () => {
    expect(SOURCE.repository).toBe('mcthaydt/PixiJS3D_Experiment_001')
    expect(SOURCE.commit).toBe('92e6704')
  })

  it('are the five shipped files', () => {
    expect([...FIXTURE_NAMES]).toEqual([
      'blockout-clinic',
      'blockout-clinic-dawn',
      'blockout-bay',
      'blockout-prologue',
      'facility',
    ])
    expect(Object.keys(SOURCE.files).sort()).toEqual(FIXTURE_NAMES.map((name) => `${name}.json`).sort())
  })

  for (const name of FIXTURE_NAMES) {
    it(`${name}: has the recorded byte length and sha256`, () => {
      const recorded = SOURCE.files[`${name}.json`]
      const bytes = Buffer.from(loadFixture(name), 'utf8')
      expect(bytes.length).toBe(recorded?.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(recorded?.sha256)
    })
  }

  for (const name of GOLDEN_NAMES) {
    it(`${name} golden: has the recorded byte length and sha256, and says how it was recorded`, () => {
      const recorded = SOURCE.goldens[`${name}.golden.json`]
      const bytes = Buffer.from(loadGolden(name), 'utf8')
      expect(bytes.length).toBe(recorded?.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(recorded?.sha256)
      expect(recorded?.recordedBy).toMatch(/record-.*\.mjs/)
    })
  }

  it('geometry golden: has the resolved map and the nav answers of each of the four blockouts', () => {
    const golden = JSON.parse(loadGolden('geometry')) as Record<string, Record<string, unknown>>
    expect(Object.keys(golden)).toEqual([
      'blockout-clinic',
      'blockout-clinic-dawn',
      'blockout-bay',
      'blockout-prologue',
    ])
    for (const entry of Object.values(golden)) {
      expect(Object.keys(entry)).toEqual(['map', 'grid', 'nav'])
      expect(Object.keys(entry.map as object)).toEqual([
        'sectors',
        'masses',
        'pieces',
        'colliders',
        'sightWalls',
      ])
      expect(Object.keys(entry.nav as object)).toEqual([
        'nodes',
        'clearOpen',
        'clearShut',
        'clearWalls',
        'throughWall',
        'nearWall',
        'nearest',
      ])
    }
  })

  it('are excluded from the formatter, which would rewrite their hand-written layout', () => {
    const biome = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../../biome.json', import.meta.url)), 'utf8'),
    ) as {
      files: { includes: string[] }
    }
    expect(biome.files.includes).toContain('!packages/editor-3d/src/testing/fixtures')
  })
})
