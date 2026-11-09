// The generated maps: an apartment and a street block, each a valid `/2` level, the same for a seed, different for
// another, and building cleanly once their rooms are dressed.
import { afSector2Schema } from '@automata/3d/level'
import { buildWorld } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import { dressLevel } from '#src/features/furnish/dress.ts'
import { generateMap, MAP_NAMES } from '#src/features/maps/generate-map.ts'
import '#src/features/props/register-props.ts'

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
      const dressed = dressLevel(generateMap(name, 2), worldKitLibrary)
      expect(dressed.problems).toEqual([])
      const { pieces, problems } = buildWorld(dressed.level, worldKitLibrary)
      expect(problems).toEqual([])
      expect(pieces.filter((p) => p.part === 'prop').length).toBeGreaterThan(5)
    })
  }

  it('refuses a map it has no generator for', () => {
    expect(() => generateMap('castle' as 'block', 1)).toThrow(/castle/)
  })
})
