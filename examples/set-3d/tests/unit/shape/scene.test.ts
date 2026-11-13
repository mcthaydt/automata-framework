import { render3dExtension } from '@automata/3d'
import { readLevel } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { SCENE_CAST, SCENE_ZONES, scene } from '#src/entries/index.ts'
import file from '../../../content/levels/station.af-sector.json'

// The level file as the editor writes it: the only source of the zones a scene can start in.
const level = readLevel(file)

describe('scene', () => {
  it('reads the level file without a problem', () => {
    expect(level.problems).toEqual([])
  })

  it('lists the zones the level file names, once each, in the order its sectors come', () => {
    const named = level.level.sectors.map((sector) => sector.zone)
    expect(SCENE_ZONES).toEqual([...new Set(named.filter((zone) => zone !== undefined))])
    expect(SCENE_ZONES.length).toBeGreaterThan(0)
  })

  it('has a cast, which is a list of character file ids (the character files come with the cast)', () => {
    expect(Array.isArray(SCENE_CAST)).toBe(true)
  })

  it('refuses a zone the level does not have, and names the zones it does', () => {
    expect(() => scene({ start: 'nowhere' })).toThrow(
      `There is no zone called "nowhere". The zones are: ${SCENE_ZONES.join(', ')}`,
    )
  })

  it('refuses a cast member that has no character file, and names the ones that do', () => {
    expect(() => scene({ start: SCENE_ZONES[0] as string, cast: ['nobody'] })).toThrow(
      /There is no character called "nobody"\. The characters are: /,
    )
  })

  it('is a game definition that draws in 3D', () => {
    const game = scene({ start: SCENE_ZONES[0] as string })
    expect(game.extensions).toContain(render3dExtension)
  })

  it("adds the example's one thing after the 3D extension", () => {
    const extra = { name: 'one-thing', sim: [] } as never
    const game = scene({ start: SCENE_ZONES[0] as string, extensions: [extra] })
    expect(game.extensions).toEqual([render3dExtension, extra])
  })
})
