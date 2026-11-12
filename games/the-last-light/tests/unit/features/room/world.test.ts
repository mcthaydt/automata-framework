import { describe, expect, it } from 'vitest'
import { LEVEL, WORLD } from '#src/features/room/room.ts'

// The ward as the screen builds it from the level. The builder reports what it could not use as sentences and draws the rest,
// so a lamp it refuses is not a failure anywhere: the room is simply darker, or lit from the wrong place. These tests are where
// that is a failure.

/** The old game's lamps at 92e6704 (`src/scenes/prologue/level.ts`): where each hangs, `[x, height, z]`. */
const OLD_LAMPS: Readonly<Record<string, readonly [number, number, number]>> = {
  deskLamp: [3.05, 1.55, 1.15],
  hallLamp: [0, 3.4, 2.6],
  wardLamp: [-3.2, 3.4, 3.4],
  corridorLamp: [0, 3, -3.2],
  exitLamp: [0, 2.75, -5.8],
  closetLamp: [3.1, 3.4, -4.5],
  curtainWest: [-4.1, 1.3, -0.5],
  moonCorridor: [-0.9, 2.3, -4.9],
}

describe('the ward’s lamps', () => {
  it('are all in the world: the builder refuses none of the level’s fifteen', () => {
    const refused = WORLD.problems.filter((problem) => /lamp/i.test(problem.code))
    expect(refused.map((problem) => problem.message)).toEqual([])
    expect(WORLD.lamps.map((lamp) => lamp.id).sort()).toEqual(
      (LEVEL.lamps ?? []).map((lamp) => lamp.id).sort(),
    )
  })

  it('hang where the old game hung them, at their own height', () => {
    for (const [id, [x, height, z]] of Object.entries(OLD_LAMPS)) {
      const lamp = WORLD.lamps.find((each) => each.id === id)
      expect({ id, at: lamp?.at }).toEqual({ id, at: [x, height, z] })
    }
  })

  it('burn at the level the old game set them to when the night begins', () => {
    const level = (id: string) => WORLD.lamps.find((lamp) => lamp.id === id)?.level
    expect(level('hallLamp')).toBe(0.6)
    expect(level('wardLamp')).toBe(0.5)
    expect(level('exitLamp')).toBe(1.25)
    // The corridor's bulb and the closet's tube have gone, so the lamp has a dark to light; the curtains and the spark wait.
    expect(level('corridorLamp')).toBe(0.12)
    expect(level('closetLamp')).toBe(0)
    expect(level('curtainWest')).toBe(0)
    expect(level('spark')).toBe(0)
  })
})

describe('the ward\u2019s rooms', () => {
  it('each name their floor, walls and ceiling, since a room that names none is drawn in the builder\u2019s first-person oak and warm plaster', () => {
    for (const room of LEVEL.sectors) {
      expect({
        room: room.id,
        floor: room.floorTexture,
        walls: room.wallTexture,
        ceiling: room.ceilingTexture,
      }).toEqual({
        room: room.id,
        floor: expect.any(String),
        walls: expect.any(String),
        ceiling: expect.any(String),
      })
    }
  })

  it('name only swatches the kit has', () => {
    const named = WORLD.problems.filter(
      (problem) => problem.code === 'unknown-swatch' && problem.name !== 'undefined',
    )
    expect(named.map((problem) => problem.message)).toEqual([])
  })
})
