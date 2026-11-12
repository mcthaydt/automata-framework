import { describe, expect, it } from 'vitest'
import { LEVEL, PAINT, WORLD } from '#src/features/room/room.ts'

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
    // The lamp a prop's own shade carries (the desk lamp's, the pendant's) is out: the level's lamps are the room's light.
    const own = WORLD.lamps.filter((lamp) => lamp.prop === undefined)
    expect(own.map((lamp) => lamp.id).sort()).toEqual((LEVEL.lamps ?? []).map((lamp) => lamp.id).sort())
    expect(
      WORLD.lamps.filter((lamp) => lamp.prop !== undefined).map((lamp) => [lamp.id, lamp.level]),
    ).toEqual([
      ['desk-lamp.light0', 0],
      ['pendant-lamp.light0', 0],
    ])
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

  it('name only swatches the library has, and every piece names one (the builder says "undefined" of a piece that names none)', () => {
    const unknown = WORLD.problems.filter((problem) => problem.code === 'unknown-swatch')
    expect(unknown.map((problem) => problem.message)).toEqual([])
  })
})

describe('the ward\u2019s walls', () => {
  /** The old game's default wall, `plaster` (`public/art/plaster.png` at 92e6704): its mean colour, 0x858667. */
  const OLD_PLASTER = [0x85, 0x86, 0x67] as const

  it('are the game\u2019s own plaster, not the kit\u2019s mint-green paint, in every room', () => {
    for (const room of LEVEL.sectors)
      expect({ room: room.id, walls: room.wallTexture }).toEqual({ room: room.id, walls: 'ward-plaster' })
  })

  it('are within a few steps of the old plaster\u2019s colour, no brighter and no greener', () => {
    const colour = PAINT.colourOf('ward-plaster')
    expect(colour, 'the game has no swatch "ward-plaster"').toBeDefined()
    const rgb = [(colour ?? 0) >> 16, ((colour ?? 0) >> 8) & 0xff, (colour ?? 0) & 0xff]
    const distance = Math.hypot(...rgb.map((channel, i) => channel - (OLD_PLASTER[i] ?? 0)))
    expect(distance).toBeLessThan(20)
    // The kit's plasterPaint is #8ac196: a luma of 170 against the old plaster's 131.
    const luma = 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0)
    expect(luma).toBeLessThan(145)
  })
})

/**
 * The old level's props the world drew nothing for, because the level named a generator where the library wants a preset. The
 * eighteen the kit honestly has are drawn; the two it does not are left out and say why (editor gaps, row 16).
 */
const LEFT_OUT: Readonly<Record<string, string>> = {
  'fallen-chair': 'a chair on its side: a prop can be turned about its base only, not tipped over',
  'privacy-screen': 'a folding screen on hinges: the kit\u2019s screen is a television',
}
const OLD_PROPS_THE_BUILDER_REFUSED = [
  'bed',
  'nightstand',
  'drawers',
  'fallen-chair',
  'office-chair',
  'filing-1',
  'filing-2',
  'wall-tv',
  'privacy-screen',
  'mop-bucket',
  'desk-lamp',
  'pendant-lamp',
  'junction-box',
  'floor-plant-1',
  'floor-plant-2',
  'desk-plant',
  'book-stack-1',
  'book-stack-2',
  'overbed-table',
  'water-cooler',
]

describe('the ward\u2019s furniture', () => {
  const drawn = (id: string) => WORLD.pieces.some((piece) => piece.id.includes(`:prop:${id}.`))

  it('is all drawn but for what the kit has nothing of, which is named and left out of the level', () => {
    for (const id of OLD_PROPS_THE_BUILDER_REFUSED)
      if (Object.hasOwn(LEFT_OUT, id))
        expect({ id, inLevel: (LEVEL.props ?? []).some((prop) => prop.id === id) }).toEqual({
          id,
          inLevel: false,
        })
      else expect({ id, drawn: drawn(id) }).toEqual({ id, drawn: true })
  })

  it('leaves the builder nothing to refuse', () => {
    expect(WORLD.problems.map((problem) => problem.message)).toEqual([])
  })
})

/**
 * Which way each prop faces. The old game turns a model by a `yaw` (about y; 0 faces south, and a quarter turn faces east); the
 * level's `angle` is degrees clockwise from east, 90 facing south, so the turn the builder makes is `90 - angle`. The converter
 * had copied the yaw into the angle, which turned every prop that had one by the wrong amount (the wall television faced the wall).
 * The old yaws, in degrees, at 92e6704 (`src/scenes/clinic/props.ts`); a prop with none faces south.
 */
const OLD_YAW: Readonly<Record<string, number>> = {
  wheelchair: 90,
  sink: 90,
  trolley: 90,
  'wall-tv': 90,
  'mop-bucket': 90,
  'key-cabinet': -90,
  'floor-plant-2': 90,
  'book-stack-2': 90,
  'overbed-table': -90,
  'radiator-1': 90,
  'radiator-2': -90,
  'extinguisher-cabinet': 90,
  gurney: 90,
  'water-cooler': -90,
  'strip-light-1': 90,
  'strip-light-2': 90,
  'stock-archive-2': 90,
  'stock-bandages-2': 90,
  'stock-bottles-2': 90,
  'stock-boxes-2': 90,
  'stock-linen-2': 90,
  'stock-rolls-2': 90,
  'stock-canisters-2': -90,
  'stock-linen-3': -90,
  'stock-boxes-3': -90,
  'stock-toolbox-2': -90,
}
/** The ward bed's long side is along the plan's depth in the old model; the kit's runs along x, head at -x, so it is turned a quarter
 *  the other way to put the head at the north end. */
const BED_ANGLE = 180

describe('the ward\u2019s props face as the old game turned them', () => {
  const turnOf = (angle: number | undefined): number => (((90 - (angle ?? 90)) % 360) + 360) % 360

  for (const prop of LEVEL.props ?? []) {
    const yaw = prop.id === 'bed' ? turnOf(BED_ANGLE) : (OLD_YAW[prop.id] ?? 0)
    it(`${prop.id} turns ${yaw} degrees`, () => {
      expect(turnOf(prop.angle)).toBe(((yaw % 360) + 360) % 360)
    })
  }
})
