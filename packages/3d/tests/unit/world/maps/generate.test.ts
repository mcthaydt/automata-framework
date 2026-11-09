// The generated maps: an apartment and a street block, each a valid `/2` level, the same for a seed, different for
// another, and building cleanly once their rooms are dressed.

import { describe, expect, it } from 'vitest'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { dressLevel } from '#src/features/world/furnish/dress.ts'
import { generateMap, MAP_NAMES } from '#src/features/world/maps/generate-map.ts'
import { afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'
import '#src/features/world/props/kit/register-kit-props.ts'

describe('generated maps', () => {
  it('are named apartment and block', () => {
    expect([...MAP_NAMES]).toEqual(['apartment', 'block'])
  })

  for (const name of MAP_NAMES) {
    it(`${name}@1 is a valid /2 level that the schema reads back unchanged`, () => {
      const level = generateMap(name, 1)
      expect(level.name).toBe(`${name}@1`)
      expect(afSector2Schema.parse(JSON.parse(JSON.stringify(level)))).toEqual(level)
    })

    it(`${name} is the same for a seed and different for another`, () => {
      expect(generateMap(name, 4)).toEqual(generateMap(name, 4))
      expect(generateMap(name, 4)).not.toEqual(generateMap(name, 5))
    })

    it(`${name} builds with nothing wrong once its rooms are dressed`, () => {
      const dressed = dressLevel(generateMap(name, 2), coreLibrary)
      expect(dressed.problems).toEqual([])
      const { pieces, problems } = buildWorld(dressed.level, coreLibrary)
      expect(problems).toEqual([])
      expect(pieces.filter((p) => p.part === 'prop').length).toBeGreaterThan(5)
    })
  }

  it('refuses a map it has no generator for', () => {
    expect(() => generateMap('castle' as 'block', 1)).toThrow(/castle/)
  })
})
