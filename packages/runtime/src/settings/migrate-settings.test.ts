import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readSettings, type SettingsDef, writeSettings } from './migrate-settings.js'

interface TestSettings {
  volume: number
  music: boolean
  label: string
}

const testDef: SettingsDef<TestSettings> = {
  key: 'game_settings',
  version: 2,
  schema: z.object({
    volume: z.number().catch(1),
    music: z.boolean().catch(true),
    label: z.string().catch('default-label'),
  }),
  defaults: {
    volume: 1,
    music: true,
    label: 'default-label',
  },
  migrations: {
    1: (record) => ({
      ...record,
      label: typeof record.title === 'string' ? record.title : 'migrated-label',
    }),
  },
}

describe('migrate-settings', () => {
  it('absent (null), unparseable JSON, a non-object, and a future version give defaults', () => {
    // Absent
    expect(readSettings(testDef, null)).toEqual(testDef.defaults)

    // Unparseable JSON
    expect(readSettings(testDef, '{ not json }')).toEqual(testDef.defaults)

    // Non-object
    expect(readSettings(testDef, '42')).toEqual(testDef.defaults)
    expect(readSettings(testDef, '"string"')).toEqual(testDef.defaults)
    expect(readSettings(testDef, '[1, 2, 3]')).toEqual(testDef.defaults)

    // Future version (version 3 > testDef.version 2)
    const future = JSON.stringify({ version: 3, volume: 0.5, music: false, label: 'future' })
    expect(readSettings(testDef, future)).toEqual(testDef.defaults)
  })

  it('one bad field falls back alone, keeping every valid neighbour', () => {
    const raw = JSON.stringify({
      version: 2,
      volume: 'bad-volume', // Invalid: falls back to 1
      music: false, // Valid: kept
      label: 'custom', // Valid: kept
    })
    const read = readSettings(testDef, raw)
    expect(read).toEqual({
      volume: 1,
      music: false,
      label: 'custom',
    })
  })

  it('a version-1 record migrates to version 2 (migrations run one version at a time; a missing step gives defaults)', () => {
    // Migration 1 -> 2
    const v1Raw = JSON.stringify({
      version: 1,
      volume: 0.7,
      music: false,
      title: 'v1-title',
    })
    const read = readSettings(testDef, v1Raw)
    expect(read).toEqual({
      volume: 0.7,
      music: false,
      label: 'v1-title',
    })

    // Missing migration step: def with version 3 where step 2 is missing
    const v3Def: SettingsDef<TestSettings> = {
      ...testDef,
      version: 3,
      migrations: {
        1: (record) => ({ ...record, label: 'migrated' }),
        // step 2 missing
      },
    }
    expect(readSettings(v3Def, v1Raw)).toEqual(testDef.defaults)
  })

  it('a current-version record is read as it is; writeSettings(def, value) then readSettings round-trips', () => {
    const custom: TestSettings = {
      volume: 0.42,
      music: false,
      label: 'round-trip-label',
    }
    const serialized = writeSettings(testDef, custom)
    expect(typeof serialized).toBe('string')
    const parsed = JSON.parse(serialized)
    expect(parsed.version).toBe(testDef.version)
    expect(parsed.volume).toBe(0.42)

    const deserialized = readSettings(testDef, serialized)
    expect(deserialized).toEqual(custom)
  })
})
