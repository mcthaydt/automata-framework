import { timeOfDay } from '@automata/3d'
import { describe, expect, it } from 'vitest'
import { gameScene } from '#src/features/levels-3d/dollhouse/game-scene.ts'
import { EMPTY_LIBRARY } from '#src/shared/level-session/game-library.ts'
import { HALL_LIBRARY as library } from '#src/testing/hall-library.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

// What the 3D view and Walk draw: the game's own world (core's builder over the game's furniture and materials), the
// level's things where they stand, and the time of day the level names. Pure data; the renderer only draws it.

const flat = (): number => 0

const level = (more = {}) =>
  toyAfSector({
    props: [{ id: 'crate-1', use: 'crate', at: [2, 3] }],
    entities: [
      { def: 'spawn', id: 'spawn', x: 1, z: 1 },
      { def: 'ember', id: 'ember-1', x: 3, z: 2 },
      { def: 'goal', id: 'goal', x: 6, z: 4 },
    ],
    ...more,
  })

describe('gameScene', () => {
  it('builds the room and its furniture with the game’s own library', () => {
    const scene = gameScene(level(), library, flat)
    const parts = new Set(scene.pieces.map((piece) => piece.part))
    expect(parts).toContain('floor')
    expect(parts).toContain('wall')
    const crate = scene.pieces.filter((piece) => piece.prop?.id === 'crate-1')
    expect(crate.length).toBeGreaterThan(0)
    expect(crate[0]?.prop?.at[0]).toBeCloseTo(2)
    expect(crate[0]?.prop?.at[2]).toBeCloseTo(3)
  })

  it('colours a piece by the game’s swatch', () => {
    const scene = gameScene(level(), library, flat)
    const crate = scene.pieces.find((piece) => piece.prop?.id === 'crate-1')
    expect(crate).toBeDefined()
    const swatchName = typeof crate?.surface === 'string' ? crate.surface : (crate?.surface.tile ?? '')
    expect(scene.colourOf(swatchName)).toBeTypeOf('number')
  })

  it('moves the furniture when the file does', () => {
    const moved = gameScene(level({ props: [{ id: 'crate-1', use: 'crate', at: [4, 3] }] }), library, flat)
    const crate = moved.pieces.find((piece) => piece.prop?.id === 'crate-1')
    expect(crate?.prop?.at[0]).toBeCloseTo(4)
  })

  it('stands a figure on the spawn, a spark on each ember and a taller one on the goal', () => {
    const scene = gameScene(level(), library, flat)
    const ids = (thing: string) => scene.pieces.filter((piece) => piece.id.startsWith(`stand:${thing}:`))
    expect(ids('spawn').length).toBeGreaterThan(1)
    expect(ids('ember-1').length).toBeGreaterThan(0)
    expect(ids('goal').length).toBeGreaterThan(0)
  })

  it('stands a thing on the floor under it, however high that is', () => {
    const high = (x: number) => (x > 2 ? 0.5 : 0)
    const scene = gameScene(level(), library, high)
    const lowest = (thing: string) =>
      Math.min(
        ...scene.pieces
          .filter((piece) => piece.id.startsWith(`stand:${thing}:`))
          .flatMap((piece) => piece.mesh.positions.filter((_, index) => index % 3 === 1)),
      )
    expect(lowest('spawn')).toBeCloseTo(0)
    expect(lowest('ember-1')).toBeGreaterThanOrEqual(0.5)
  })

  it('stands a character of the cast where the file puts it', () => {
    const scene = gameScene(level({ cast: [{ id: 'keeper', who: 'wick', at: [5, 5] }] }), library, flat)
    expect(scene.pieces.some((piece) => piece.id.startsWith('stand:keeper:'))).toBe(true)
  })

  it('names the time of day the level names, and the day when it names none', () => {
    expect(gameScene(level(), library, flat).time).toEqual(timeOfDay('day'))
    expect(gameScene(level({ time: 'night' }), library, flat).time.name).toBe('night')
  })

  it('draws the things in colours of their own that are not the game’s swatches', () => {
    const scene = gameScene(level(), library, flat)
    const stand = scene.pieces.find((piece) => piece.id.startsWith('stand:spawn:'))
    const name = typeof stand?.surface === 'string' ? stand.surface : ''
    expect(scene.colourOf(name)).toBeTypeOf('number')
  })

  it('still builds a level for a game that has no library: the room draws in grey and the things stand', () => {
    const scene = gameScene(level(), EMPTY_LIBRARY, flat)
    expect(scene.pieces.some((piece) => piece.part === 'floor')).toBe(true)
    expect(scene.pieces.some((piece) => piece.id.startsWith('stand:spawn:'))).toBe(true)
  })

  it('is empty for a file that is not a level', () => {
    expect(gameScene({ format: 'nope' } as never, library, flat).pieces).toEqual([])
  })
})
