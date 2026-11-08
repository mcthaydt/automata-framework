import { createDirector } from '@automata/cutscenes/director'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { levelWalls, planView, wallsOfLevel, wallsOfSectors } from '#src/features/sequence/plan-view.ts'
import { ROOMS } from '../../fixtures/rooms-fixtures.ts'

const placed = {
  id: 'gate',
  duration: 10,
  camera: [{ t: 0, pos: [0, 1, 0], look: [4, 1, 0] }],
  actor: [{ who: 'keeper', t: 0, x: 2, z: 3, facing: 1.5707963267948966 }],
  caption: [{ t: 1, until: 3, line: 'keeper.hi' }],
  fade: [
    { t: 0, value: 0 },
    { t: 9, value: 1 },
  ],
} as never

const stateAt = (t: number) => createDirector(placed, () => undefined).stateAt(t)

const level = (rows: string[]) =>
  ({
    format: 'af2d-content',
    version: 1,
    id: 'hall',
    name: 'Hall',
    layers: [{ def: 'collision', kind: 'intgrid', rows }],
  }) as never

describe('planView', () => {
  it('puts an actor where the fit puts it, with its name and facing', () => {
    const plan = planView(stateAt(0), [], { w: 400, h: 300 })
    const keeper = plan.actors.find((actor) => actor.name === 'keeper')
    expect(keeper).toBeDefined()
    // x runs 0..4 (the camera at 0, looking at 4), z 0..3: the scale is the tighter fit.
    expect(plan.scale).toBeCloseTo(Math.min((400 - 48) / 4, (300 - 48) / 3))
    expect(keeper?.x).toBeCloseTo(24 + 2 * plan.scale)
    expect(keeper?.y).toBeCloseTo(24 + 3 * plan.scale)
    // 90° turned the way keys turn is up the screen: the director moves x by cos and z by −sin.
    expect(keeper?.facing).toBeCloseTo(-90)
  })

  it('points the camera wedge from where it stands to what it looks at, spread by the lens', () => {
    const plan = planView(stateAt(0), [], { w: 400, h: 300 })
    expect(plan.camera.angle).toBeCloseTo(0)
    expect(plan.camera.spread).toBeGreaterThan(0)
    const wide = planView(
      createDirector({ ...(placed as object), lens: 20 } as never, () => undefined).stateAt(0),
      [],
      { w: 400, h: 300 },
    )
    expect(wide.camera.spread).toBeGreaterThan(plan.camera.spread)
  })

  it('shows the line on screen only while it is, and the fade at the end', () => {
    expect(planView(stateAt(0.5), [], { w: 100, h: 100 }).captionLine).toBeUndefined()
    expect(planView(stateAt(2), [], { w: 100, h: 100 }).captionLine).toBe('keeper.hi')
    expect(planView(stateAt(10), [], { w: 100, h: 100 }).fade).toBe(1)
  })

  it('draws the walls it is given in the same fit', () => {
    const plan = planView(stateAt(0), [[0, 0, 4, 0]], { w: 400, h: 300 })
    expect(plan.walls).toHaveLength(1)
    expect(plan.walls[0]?.[0]).toBeCloseTo(24)
  })
})

describe('walls of a level', () => {
  it('gives the four walls of the one solid cell of a 2x2 level', () => {
    expect(wallsOfLevel(level(['. 1', '. .']))).toEqual([
      [1, 0, 2, 0],
      [2, 0, 2, 1],
      [2, 1, 1, 1],
      [1, 1, 1, 0],
    ])
  })

  it('reads them from the level’s file, and gives none for a file that is not there', async () => {
    const { ports } = await createMemoryPorts({
      files: { 'content/levels/broken.toml': 'not = [' },
      classify: (path) => ({
        path,
        editor: 'levels-2d',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
    })
    expect(await levelWalls(ports, 'content/levels/none.toml')).toEqual([])
    expect(await levelWalls(ports, 'content/levels/broken.toml')).toEqual([])
  })

  it('reads the walls of a 3D room from its file too', async () => {
    const { ports } = await createMemoryPorts({
      files: { 'content/levels/rooms.af-sector.json': JSON.stringify(ROOMS) },
      classify: (path) => ({
        path,
        editor: 'levels-3d',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
    })
    expect(await levelWalls(ports, 'content/levels/rooms.af-sector.json')).toHaveLength(8)
    expect(await levelWalls(ports, 'content/levels/none.af-sector.json')).toEqual([])
  })
})

describe('wallsOfSectors', () => {
  it('gives a wall for each pair of corners of each room, in metres, back to the first corner', () => {
    const walls = wallsOfSectors(ROOMS as never)
    expect(walls).toHaveLength(8)
    expect(walls.slice(0, 4)).toEqual([
      [0, 0, 4, 0],
      [4, 0, 4, 4],
      [4, 4, 0, 4],
      [0, 4, 0, 0],
    ])
  })

  it('has none for a level with no rooms', () => {
    expect(wallsOfSectors({ format: 'af-sector/2', name: 'x', sectors: [] } as never)).toEqual([])
  })
})
