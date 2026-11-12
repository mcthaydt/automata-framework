import { content } from 'virtual:automata/content'
import { sceneLamps } from '@automata/3d'
import { describe, expect, it } from 'vitest'
import { lightsOutSchema, lightsOutStates } from '#src/features/lamp/lights-out.content.ts'
import { WORLD } from '#src/features/room/room.ts'

// When the lights go the old game does not black the room: its dress puts each lamp at a level of its own (hall 0.1, ward 0.12,
// the exit lamp 0.95, the desk lamp out) and the rest burn as they did (`src/scenes/clinic/dress.ts`, the unpowered levels, the
// flicker at its mean). The levels are the file `content/lights-out.toml`; these hold that the screen puts the lamps there.

const FILE = lightsOutSchema.parse(content['lights-out'])
const authored = Object.fromEntries(WORLD.lamps.map((lamp) => [lamp.id, lamp.level]))

/** What each lamp burns at once the lights have gone, as the scene's light gets it. */
const burning = (): Record<string, number> =>
  Object.fromEntries(
    sceneLamps(WORLD.lamps, true, lightsOutStates(FILE, WORLD.lamps).lamps).map((lamp) => [
      lamp.id,
      lamp.level,
    ]),
  )

describe('the lamps once the lights have gone', () => {
  it('burn at the levels the old game set: the hall 0.1, the ward 0.12, the exit 0.95, the desk lamp out', () => {
    const levels = burning()
    expect(levels.hallLamp).toBeCloseTo(0.1, 9)
    expect(levels.wardLamp).toBeCloseTo(0.12, 9)
    expect(levels.exitLamp).toBeCloseTo(0.95, 9)
    expect(levels.deskLamp).toBe(0)
  })

  it('leave the corridor bulb at 0.3 of the 0.12 it had, as the old dress had it', () => {
    expect(burning().corridorLamp).toBeCloseTo(0.036, 9)
  })

  it('leave every other lamp as the level lit it', () => {
    const named = new Set(Object.keys(FILE.levels))
    for (const [id, level] of Object.entries(burning()))
      if (!named.has(id)) expect({ id, level }).toEqual({ id, level: authored[id] })
  })

  it('name only lamps the level has, and a lamp that burns at all in the level', () => {
    for (const [id, level] of Object.entries(FILE.levels)) {
      expect(
        authored[id],
        `content/lights-out.toml names "${id}", which the level has no lamp of`,
      ).toBeDefined()
      if (level > 0)
        expect(authored[id], `"${id}" is out in the level, so it cannot burn at ${level}`).toBeGreaterThan(0)
    }
  })
})
