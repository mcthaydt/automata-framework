// The maps the kit ships under `library/maps/`: each a valid `/2` level, exactly what the converter makes of the
// fixture (so the files cannot drift from it), and each builds with the kit's library and nothing wrong.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afSector2Schema } from '@automata/3d/level'
import { buildWorld } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import { dressLevel } from '#src/features/furnish/dress.ts'
import { convertBuilderMap } from '#src/features/maps/convert-builder-map.ts'
import '#src/features/props/register-props.ts'
import fixture from '../../fixtures/builder-maps.json' with { type: 'json' }

const DIR = join(import.meta.dirname, '../../../library/maps')
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.af-sector.json'))

describe('library/maps', () => {
  it('has one file for each map of the fixture', () => {
    expect(FILES.map((f) => f.replace('.af-sector.json', '')).sort()).toEqual(Object.keys(fixture).sort())
  })
  for (const file of FILES) {
    const id = file.replace('.af-sector.json', '')
    const level = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
    it(`${id} is what the converter makes of the fixture`, () => {
      expect(afSector2Schema.parse(level)).toEqual(level)
      const plan = (fixture as Record<string, object>)[id]
      expect(level).toEqual(JSON.parse(JSON.stringify(convertBuilderMap({ id, ...plan }))))
    })
    it(`${id} builds with the kit's library and nothing wrong once dressed`, () => {
      const dressed = dressLevel(level, worldKitLibrary)
      expect(dressed.problems).toEqual([])
      expect(buildWorld(dressed.level, worldKitLibrary).problems).toEqual([])
    })
  }
})
