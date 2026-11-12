import { timeOfDay, worldLighting } from '@automata/3d'
import { describe, expect, it } from 'vitest'
import { LEVEL, LIBRARY, LIGHTING, PAINT, WORLD } from '#src/features/room/room.ts'

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
      // The exit sign's own light burns at full: the glow of the old sign's halo (`exitHalo`, up to 0.55 alpha at the exit lamp's level), which is what the corridor's end still shows once the rest have gone.
      ['exit-sign.light0', 1],
      ['desk-lamp.light0', 0],
      ['pendant-lamp.light0', 0],
    ])
  })

  it('are the old game’s kinds and ranges: a screen, fires and a spark are what they are, a pendant reaches all it did', () => {
    // `src/scenes/prologue/level.ts` at 92e6704: each lamp's kind and reach. The kit's moon and fill are other colours than the old
    // game's (it refuses a lamp 0.09 and 0.11 to 0.18 off their tone), so those four stay a neon in the old colour, which keeps
    // their range as it was.
    const OLD: Readonly<Record<string, readonly [kind: string, range: number]>> = {
      deskLamp: ['desk', 5],
      monitorGlow: ['screen', 2.6],
      hallLamp: ['pendant', 7.5],
      wardLamp: ['pendant', 6],
      corridorLamp: ['bulb', 5.5],
      exitLamp: ['bulb', 5.5],
      closetLamp: ['fluorescent', 4.5],
      curtainWest: ['fire', 6],
      curtainEast: ['fire', 6],
      spark: ['spark', 4],
      moon: ['neon', 4.2],
      moonCorridor: ['neon', 3.2],
      wardFill: ['neon', 4.8],
      bayFill: ['neon', 4.4],
      sconce: ['bulb', 3.6],
    }
    for (const [id, [kind, range]] of Object.entries(OLD)) {
      const lamp = WORLD.lamps.find((each) => each.id === id)
      expect({ id, kind: lamp?.kind, range: lamp?.range }).toEqual({ id, kind, range })
    }
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
  it('are the game\u2019s own plaster, not the kit\u2019s mint-green paint, in every room', () => {
    for (const room of LEVEL.sectors)
      expect({ room: room.id, walls: room.wallTexture }).toEqual({ room: room.id, walls: 'ward-plaster' })
  })

  // The old game's plaster is an even sea-green with lighter and darker clusters (the canvas in `src/render/assets.ts` at 92e6704:
  // base #47655a, clusters #5b7b69 and #394d3c). Session 8 took it for the mean of another file, a khaki grey, and made it sand: the
  // frames' green walls were not the light's doing. #47655a is DUEL sage step 1 and #5b7b69 step 2, so it needs no gap in the palette.
  it('is the old plaster\u2019s own green: DUEL sage step 1, #47655a, greener than it is red', () => {
    const colour = PAINT.colourOf('ward-plaster')
    expect(colour, 'the game has no swatch "ward-plaster"').toBeDefined()
    expect(LIBRARY.swatches['ward-plaster']).toMatchObject({ ramp: 'sage', step: 1 })
    expect(colour).toBe(0x47655a)
  })
})

/**
 * The old level's props the world drew nothing for, because the level named a generator where the library wants a preset. The
 * eighteen the kit honestly has are drawn; the two it does not (a chair on its side, a folding screen) are a plain box of the
 * old size: a blockout for the old game's model to replace, since no generator draws them.
 */
const BOX_ONLY: Readonly<Record<string, string>> = {
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

  it('is all drawn, as the kit’s generator or, for what the kit has nothing of, as a box of the old size', () => {
    for (const id of OLD_PROPS_THE_BUILDER_REFUSED) {
      expect({ id, drawn: drawn(id) }).toEqual({ id, drawn: true })
      if (Object.hasOwn(BOX_ONLY, id))
        expect((LEVEL.props ?? []).find((prop) => prop.id === id)?.kind).toBe('box')
    }
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
  'fallen-chair': 90,
  'privacy-screen': 22.92,
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
  // The old game stretched the strip light's model across its length and turned it; ours keeps its proportions, so it is turned to lie
  // along the blockout (`tools/convert/models.ts`, TURNED).
  'strip-light-1': 0,
  'strip-light-2': 0,
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

  // What turns on screen is the model, at the blockout's turn and the fit's, which together are the old game's yaw. (Ten of the
  // old furniture are a box now, turned the old yaw by the fit; the rest are the kit's props turned as the old model was, or by
  // the quarter that brings the kit's front to the model's.)
  for (const prop of LEVEL.props ?? []) {
    const yaw = OLD_YAW[prop.id] ?? 0
    it(`${prop.id}'s model turns ${yaw} degrees`, () => {
      expect((((turnOf(prop.angle) + (prop.fit?.turn ?? 0)) % 360) + 360) % 360).toBe(
        ((yaw % 360) + 360) % 360,
      )
    })
  }

  it('turns the bed’s blockout a quarter the other way, to put its head at the north end', () => {
    expect(turnOf((LEVEL.props ?? []).find((prop) => prop.id === 'bed')?.angle)).toBe(turnOf(BED_ANGLE))
  })
})

// The old floor is a dark glazed tile painted from two DUEL steps: `#625d54` (sand step 0, three tiles in four) and `#5b5c69` under the
// cooler lamps (`src/render/assets.ts` at 92e6704). The kit's `tileFloor` is slate step 5, `#abaebe`: nearly four times the light, so a
// room lit by the old game's own lamps drew twice as bright (mean luma 88 against 44 on the floor at the spawn) and washed to a grey.
describe('the ward\u2019s floor', () => {
  // A tile on dark grout: the cool tile is slate step 2 (#5b5c69, the old floor's fourth tile), the grout two steps down its ramp, and
  // the warm tiles the accent, DUEL sand step 0 (#625d54, the old floor's other three). Flat sand 0 had no grout to draw.
  it('is the old tile\u2019s own colours: DUEL slate step 2 with sand step 0 for the warm tiles', () => {
    expect(LIBRARY.swatches['ward-floor']).toMatchObject({
      ramp: 'slate',
      step: 2,
      accent: 'ward-floor-warm',
    })
    expect(LIBRARY.swatches['ward-floor-warm']).toMatchObject({ ramp: 'sand', step: 0 })
  })

  it('is what every tiled room stands on, and the counter keeps its laminate', () => {
    const floors = LEVEL.sectors.map((room) => [room.id, room.floorTexture])
    expect(floors.filter(([, floor]) => floor === 'tileFloor')).toEqual([])
    expect(floors.filter(([, floor]) => floor === 'ward-floor').length).toBe(6)
  })
})

// The old walls are two bands: cream glazed tile to 1.14 m (`DEFAULT_TRIM.wainscot`, `src/game/sector-format.ts` at 92e6704, painted
// from `#ccc3b1`, which is a DUEL step: sand 5) under plaster above. A room with the old default trim carries the tile as a wall `dado`;
// the rooms that name their own trim (the counter, the doorways) and the walls with a door, a window or an opening do not.
describe('the ward’s walls', () => {
  const dadoPieces = WORLD.pieces.filter((piece) => piece.id.split(':')[1] === 'dado')

  it('are tile under plaster: the old wainscot, 1.14 m of glazed tile along the solid walls', () => {
    expect(dadoPieces.length).toBeGreaterThan(10)
    for (const piece of dadoPieces) expect(piece.surface).toBe('ward-wainscot')
    const top = Math.max(...dadoPieces.flatMap((piece) => piece.mesh.positions.filter((_, i) => i % 3 === 1)))
    expect(top).toBeCloseTo(1.14, 2)
  })

  it('stand on the old tile’s own colour: DUEL sand step 5, #ccc3b1, with no gap to the palette', () => {
    expect(LIBRARY.swatches['ward-wainscot']).toMatchObject({ ramp: 'sand', step: 5 })
  })

  it('leave the counter and the doorways bare, as the old trim does', () => {
    for (const piece of dadoPieces) expect(['counter', 'doorway']).not.toContain(piece.sector)
  })
})

// The old game multiplied a texel's linear colour by its light and showed the product as it was; the framework's `srgb` light multiplies
// the sRGB colour, which for the same numbers is a good deal brighter (a mid grey is 0.5 in sRGB and 0.21 in linear light). So the lamps
// are the old game's strengths times the gain `content/look.toml` says, measured against the old game's real play (the audit folder).
describe('the ward\u2019s lamps', () => {
  it('are the old game\u2019s strengths times the look file\u2019s gain', () => {
    const old = worldLighting(WORLD, timeOfDay('lampLit'), { night: true }).lamps
    expect(LIGHTING.lamps.length).toBe(old.length)
    for (const [i, lamp] of LIGHTING.lamps.entries())
      expect(lamp.strength).toBeCloseTo((old[i]?.strength ?? 0) * 0.7, 6)
  })
})

// The old hall's noticeboard (`dress.ts` at 92e6704: a cork box 1.7 by 0.9 at (3.3, 1.95, -0.84) on the north wall, the day shift's note and
// a photograph pinned on it) is what the objective points at and the hotspot `noticeboard` reaches. Without a piece there the hotspot
// named a bare wall.
describe('the ward’s noticeboard', () => {
  const pieces = WORLD.pieces.filter((piece) => piece.id.includes(':prop:noticeboard.'))
  const bounds = (axis: number) => {
    const values = pieces.flatMap((piece) => piece.mesh.positions.filter((_, i) => i % 3 === axis))
    return [Math.min(...values), Math.max(...values)] as const
  }

  it('hangs on the hall’s north wall where the hotspot is, as wide as the old board, with its slips pinned on', () => {
    expect(pieces.length).toBeGreaterThan(0)
    const [x0, x1] = bounds(0)
    const [y0, y1] = bounds(1)
    const [z0, z1] = bounds(2)
    expect((x0 + x1) / 2).toBeCloseTo(3.3, 1)
    expect(x1 - x0).toBeGreaterThan(1.6)
    expect(x1 - x0).toBeLessThan(1.9)
    // The hotspot is at 1.9 m, and the board holds it.
    expect(y0).toBeLessThan(1.9)
    expect(y1).toBeGreaterThan(1.9)
    // Its back on the wall (z -0.875), its face into the hall.
    expect(z0).toBeGreaterThan(-0.9)
    expect(z1).toBeLessThan(-0.7)
    expect(pieces.some((piece) => piece.id.endsWith('.slips'))).toBe(true)
  })
})

// The old corridor's end has a green EXIT sign over its door (`signOn` in `dress.ts` at 92e6704: a 0.42 m plaque at (0, 2.25, -6.875)) and a
// halo of its glow on the wall, which is what still glows once the lights have gone. The level had the door and no sign.
describe('the corridor’s exit sign', () => {
  const pieces = WORLD.pieces.filter((piece) => piece.id.includes(':prop:exit-sign.'))

  it('hangs over the exit door on the corridor’s end wall, a little under half a metre wide', () => {
    expect(pieces.length).toBeGreaterThan(0)
    const xs = pieces.flatMap((piece) => piece.mesh.positions.filter((_, i) => i % 3 === 0))
    const ys = pieces.flatMap((piece) => piece.mesh.positions.filter((_, i) => i % 3 === 1))
    const zs = pieces.flatMap((piece) => piece.mesh.positions.filter((_, i) => i % 3 === 2))
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 1)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.3)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.6)
    // Above the door (2.1 m) and under the window's sill line (2.45), on the wall (z -6.875).
    expect(Math.min(...ys)).toBeGreaterThan(2.1)
    expect(Math.max(...ys)).toBeLessThan(2.5)
    expect(Math.min(...zs)).toBeGreaterThan(-6.9)
    expect(Math.max(...zs)).toBeLessThan(-6.7)
  })

  it('glows green and lights the wall round it', () => {
    // (A swatch the library lacks is a `problems` entry: the walls' test of unknown swatches covers the sign's two.)
    expect(WORLD.problems.map((problem) => problem.message)).toEqual([])
    expect(LIBRARY.swatches['exit-green']).toMatchObject({ emit: true })
    const lamp = WORLD.lamps.find((each) => each.prop === 'exit-sign')
    expect(lamp, 'a lamp of the sign’s own').toBeDefined()
  })
})
