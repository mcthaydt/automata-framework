// The Walk view's camera as plain TypeScript (ED3D.8a step 4, spec D8, §5.3 flow 4, §9 and §10, ED3-n): two sticks and WASD
// with Q and E, the Walk, Fly and Orbit modes, the crosshair pick and the start with no spawn. Time is the `tick` the
// test gives: nothing here reads a clock.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { createWalkController } from '#src/features/levels-3d/walk/walk-controller.ts'
import { moveSector } from '#src/shared/edit/corner-edits.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { setHeights } from '#src/shared/edit/sector-edits.ts'
import { ORBIT_FOV } from '#src/shared/geometry/camera-3d.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { WALK_FOV } from '#src/shared/level-session/level-hints.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const CANVAS = { w: 800, h: 600 }
const DEGREES = Math.PI / 180

/** The toy hall (8 by 6 m, floor 0) and dock (floor -0.5 m) with a portal along x = 8, and a spawn in the hall. */
const withSpawn = (facing: number, x = 2, z = 3): AfSector =>
  toyAfSector({
    entityDefs: [
      { id: 'spawn', shape: 'point', single: true, fields: [{ id: 'facing', type: 'angle', default: 0 }] },
    ],
    entities: [{ def: 'spawn', id: 'spawn', x, z, facing }],
  } as Partial<AfSector>)
/** A spawn facing east (+x), toward the portal, and one facing west (-x), toward the hall's solid west wall. */
const EAST = Math.PI / 2
const WEST = -Math.PI / 2

const walkOn = (level: AfSector) => {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  return { editor, walk: createWalkController(editor, CANVAS) }
}
const eyeOf = (walk: ReturnType<typeof walkOn>['walk']) => walk.view.camera.eye
const ticks = (walk: ReturnType<typeof walkOn>['walk'], count: number, seconds = 0.1) => {
  for (let k = 0; k < count; k += 1) walk.tick(seconds)
}

describe('createWalkController: the start (flow 4, ED3-n)', () => {
  it('starts at the spawn, at the eye height, facing as it faces, with no warning', () => {
    const { walk } = walkOn(withSpawn(EAST))
    expect(walk.view.mode).toBe('walk')
    expect(eyeOf(walk)).toEqual([2, 1.6, 3])
    expect(walk.view.camera.yaw).toBeCloseTo(Math.PI / 2, 12)
    expect(walk.view.camera.fov).toBe(WALK_FOV)
    expect(walk.view.warning).toBeUndefined()
    expect(walk.view.sector).toBe('hall')
  })

  it('starts in the middle of the first sector with a warning when the level has no spawn (ED3-n)', () => {
    const { walk } = walkOn(toyAfSector())
    expect(eyeOf(walk)).toEqual([4, 1.6, 3])
    expect(walk.view.warning).toBe(
      'This level has no spawn, so Walk starts in the middle of the sector hall.',
    )
  })

  it('goes back to the start on restart, which finds a spawn added since', () => {
    const { editor, walk } = walkOn(withSpawn(EAST))
    walk.key('KeyW', true)
    ticks(walk, 5)
    expect(eyeOf(walk)[0]).toBeGreaterThan(2)
    walk.restart()
    expect(eyeOf(walk)).toEqual([2, 1.6, 3])
    expect(editor.level).toBeDefined()
  })
})

describe('createWalkController: Walk', () => {
  it('walks forward and strafes at 3 m/s with the keys and the move stick, which add up to no more than full', () => {
    const { walk } = walkOn(withSpawn(EAST))
    expect(walk.key('KeyW', true)).toBe(true)
    walk.tick(0.1)
    expect(eyeOf(walk)[0]).toBeCloseTo(2.3, 12)
    walk.stick('move', { x: 0, y: 1 })
    walk.tick(0.1)
    expect(eyeOf(walk)[0]).toBeCloseTo(2.6, 12)
    walk.key('KeyW', false)
    walk.stick('move', { x: 0, y: 0 })
    walk.key('KeyD', true)
    walk.tick(0.1)
    // Facing east, right is south (+z).
    expect(eyeOf(walk)[2]).toBeCloseTo(3.3, 12)
    walk.key('KeyD', false)
    walk.key('KeyS', true)
    walk.key('KeyA', true)
    walk.tick(0.1)
    const [x, , z] = eyeOf(walk)
    expect(Math.hypot(x - 2.6, z - 3.3)).toBeCloseTo(0.3, 12)
    expect(walk.key('KeyX', true)).toBe(false)
  })

  it('holds a tick to a tenth of a second, and ignores one that is not a number of seconds', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.key('KeyW', true)
    walk.tick(5)
    expect(eyeOf(walk)[0]).toBeCloseTo(2.3, 12)
    walk.tick(-1)
    walk.tick(Number.NaN)
    expect(eyeOf(walk)[0]).toBeCloseTo(2.3, 12)
  })

  it('turns with the look stick and with Q and E, at 120 degrees a second, and holds the pitch to 85 degrees', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.stick('look', { x: 1, y: 0 })
    walk.tick(0.1)
    expect(walk.view.camera.yaw).toBeCloseTo(EAST + 12 * DEGREES, 12)
    walk.stick('look', { x: 0, y: 0 })
    walk.key('KeyQ', true)
    walk.tick(0.1)
    expect(walk.view.camera.yaw).toBeCloseTo(EAST, 12)
    walk.key('KeyQ', false)
    walk.stick('look', { x: 0, y: 1 })
    ticks(walk, 20)
    expect(walk.view.camera.pitch).toBeCloseTo(85 * DEGREES, 12)
    walk.stick('look', { x: 0, y: -1 })
    ticks(walk, 30)
    expect(walk.view.camera.pitch).toBeCloseTo(-85 * DEGREES, 12)
  })

  it('is stopped by a solid wall a quarter of a metre short of it, and slides along it', () => {
    const { walk } = walkOn(withSpawn(WEST))
    walk.key('KeyW', true)
    ticks(walk, 20)
    expect(eyeOf(walk)[0]).toBeGreaterThanOrEqual(0.25 - 1e-9)
    expect(eyeOf(walk)[0]).toBeLessThan(0.6)
    // Pushing into the wall and to the right (north, facing west) slides north along it.
    walk.key('KeyD', true)
    const before = eyeOf(walk)
    ticks(walk, 3)
    const after = eyeOf(walk)
    expect(after[0]).toBeGreaterThanOrEqual(0.25 - 1e-9)
    expect(after[2]).toBeLessThan(before[2] - 0.5)
  })

  it('crosses at a portal and the eye follows the floor down into the dock', () => {
    const { walk } = walkOn(withSpawn(EAST, 7.5))
    walk.key('KeyW', true)
    ticks(walk, 3)
    expect(eyeOf(walk)[0]).toBeGreaterThan(8)
    expect(eyeOf(walk)[1]).toBeCloseTo(1.1, 12)
    expect(walk.view.sector).toBe('dock')
  })

  it('cannot climb back over a step taller than a quarter of a metre', () => {
    const { walk } = walkOn(withSpawn(WEST, 8.5))
    expect(walk.view.sector).toBe('dock')
    walk.key('KeyW', true)
    ticks(walk, 10)
    expect(eyeOf(walk)[0]).toBeGreaterThan(8)
  })

  it('stands on the new floor when an edit moves it', () => {
    const { editor, walk } = walkOn(withSpawn(EAST))
    editor.run(setHeights<AfSector>({ id: 'hall', floor: 0.5, ceiling: 4 }))
    expect(eyeOf(walk)[1]).toBeCloseTo(2.1, 12)
  })
})

describe('createWalkController: Fly and Orbit', () => {
  it('flies along the look with no walls in the way, and goes up with E and the lift buttons, down with Q', () => {
    const { walk } = walkOn(withSpawn(WEST))
    walk.setMode('fly')
    expect(walk.view.mode).toBe('fly')
    walk.key('KeyE', true)
    walk.tick(0.1)
    expect(eyeOf(walk)[1]).toBeCloseTo(2.2, 12)
    walk.key('KeyE', false)
    walk.lift(-1)
    walk.tick(0.1)
    expect(eyeOf(walk)[1]).toBeCloseTo(1.6, 12)
    walk.lift(0)
    walk.key('KeyW', true)
    ticks(walk, 10)
    expect(eyeOf(walk)[0]).toBeCloseTo(-4, 12)
  })

  it('lands on the floor under it back in Walk, or where Walk last stood when that is outside every sector', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.setMode('fly')
    walk.key('KeyE', true)
    walk.tick(0.1)
    walk.key('KeyE', false)
    walk.key('KeyW', true)
    ticks(walk, 11)
    walk.setMode('walk')
    expect(eyeOf(walk)).toEqual([expect.closeTo(8.6, 12), expect.closeTo(1.1, 12), 3])
    walk.setMode('fly')
    ticks(walk, 30)
    expect(eyeOf(walk)[0]).toBeGreaterThan(14)
    walk.setMode('walk')
    expect(eyeOf(walk)).toEqual([expect.closeTo(8.6, 12), expect.closeTo(1.1, 12), 3])
  })

  it('orbits a point 8 m off at 30 degrees through the 24 mm lens, turning with the look stick', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.setMode('orbit')
    const { camera } = walk.view
    expect(camera.fov).toBe(ORBIT_FOV)
    expect(camera.pitch).toBeCloseTo(-30 * DEGREES, 12)
    const [x, y, z] = camera.eye
    expect(Math.hypot(x - 2, y - 1, z - 3)).toBeCloseTo(8, 12)
    walk.stick('look', { x: 1, y: 0 })
    walk.tick(0.1)
    expect(walk.view.camera.yaw).toBeCloseTo(EAST + 12 * DEGREES, 12)
    walk.stick('look', { x: 0, y: 0 })
    walk.stick('move', { x: 0, y: 1 })
    walk.tick(0.1)
    walk.stick('move', { x: 0, y: 0 })
    walk.setMode('walk')
    expect(eyeOf(walk)[1]).toBeCloseTo(1.6, 12)
    expect(eyeOf(walk)[0]).toBeGreaterThan(2)
  })
})

describe('createWalkController: the crosshair', () => {
  it('aims at the wall in front and a tap selects it, a floor selects its sector, and nothing clears', () => {
    const { editor, walk } = walkOn(withSpawn(WEST))
    expect(walk.view.aim).toMatchObject({ role: 'wall', sector: 'hall', selection: 'wall:hall/3' })
    expect(walk.view.aim?.distance).toBeCloseTo(2, 12)
    walk.pick()
    expect(editor.selection.ids).toEqual(['wall:hall/3'])
    walk.stick('look', { x: 0, y: -1 })
    ticks(walk, 30)
    expect(walk.view.aim).toMatchObject({ role: 'floor', selection: 'sector:hall' })
    walk.pick()
    expect(editor.selection.ids).toEqual(['sector:hall'])
    walk.setMode('fly')
    walk.stick('look', { x: 0, y: 0 })
    walk.key('KeyS', true)
    ticks(walk, 20)
    walk.key('KeyS', false)
    walk.stick('look', { x: 0, y: 1 })
    ticks(walk, 30)
    expect(walk.view.aim).toBeUndefined()
    walk.pick()
    expect(editor.selection.ids).toEqual([])
  })

  it('sees through a hidden layer and selects nothing on a locked one', () => {
    const { editor, walk } = walkOn(withSpawn(WEST))
    editor.view.set({ hidden: ['walls'] })
    expect(walk.view.aim).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['walls'] })
    expect(walk.view.aim).toMatchObject({ role: 'wall', selection: undefined })
    editor.selection.set(['sector:dock'])
    walk.pick()
    expect(editor.selection.ids).toEqual([])
  })

  it('follows an edit and a new canvas size', () => {
    const { editor, walk } = walkOn(withSpawn(WEST))
    let told = 0
    walk.subscribe(() => {
      told += 1
    })
    editor.run(moveSector<AfSector>({ id: 'hall', dx: -1, dz: 0 }))
    expect(walk.view.aim?.distance).toBeCloseTo(3, 12)
    expect(told).toBeGreaterThan(0)
    walk.resize({ w: 390, h: 844 })
    expect(walk.view.aim?.selection).toBe('wall:hall/3')
  })

  it('stops following the editor once disposed', () => {
    const { editor, walk } = walkOn(withSpawn(WEST))
    let told = 0
    walk.subscribe(() => {
      told += 1
    })
    walk.dispose()
    editor.run(moveSector<AfSector>({ id: 'hall', dx: -1, dz: 0 }))
    walk.key('KeyW', true)
    walk.tick(0.1)
    expect(told).toBe(0)
  })
})

describe('createWalkController: what stops Walk, per profile', () => {
  it('af-sector: refuses a step into a sector too low to stand in', () => {
    const level = withSpawn(EAST, 7.5)
    const low: AfSector = {
      ...level,
      sectors: level.sectors.map((s) => (s.id === 'dock' ? { ...s, ceiling: 1 } : s)),
    }
    const { walk } = walkOn(low)
    walk.key('KeyW', true)
    ticks(walk, 5)
    expect(eyeOf(walk)[0]).toBeLessThan(8)
    expect(walk.view.sector).toBe('hall')
  })

  it('af-sector: slides along a diagonal wall it is pushed into', () => {
    // A room with its north-east corner cut off by a wall from (8, 4) to (4, 8).
    const level = withSpawn(EAST, 5, 5)
    const cut: AfSector = {
      ...level,
      sectors: [
        {
          id: 'hall',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [8, 0],
            [8, 4],
            [4, 8],
            [0, 8],
          ],
        },
      ],
    } as AfSector
    // Facing east at z = 5, the wall x + z = 12 is ahead at x = 7.
    const start = walkOn(cut).walk
    start.key('KeyW', true)
    ticks(start, 20)
    const [x, , z] = eyeOf(start)
    // Pushed east into the wall, the eye goes along it, east and north, and keeps its distance.
    expect(z).toBeLessThan(4.5)
    expect(x).toBeGreaterThan(7)
    expect((12 - x - z) / Math.SQRT2).toBeGreaterThanOrEqual(0.25 - 1e-9)
  })
})

describe('createWalkController: Fly moves no faster on a diagonal', () => {
  it('holds forward, strafe and lift together to full speed', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.setMode('fly')
    for (const code of ['KeyW', 'KeyD', 'KeyE']) walk.key(code, true)
    walk.tick(0.1)
    const [x, y, z] = eyeOf(walk)
    expect(Math.hypot(x - 2, y - 1.6, z - 3)).toBeCloseTo(0.6, 12)
  })
})

describe('createWalkController: the shipped depot', () => {
  it('walks from the spawn of the depot, which is not stuck in the margin', () => {
    const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!parsed.ok) throw new Error('the depot does not parse')
    const walk = createWalkController(
      createLevelEditor({ profile: afSectorProfile, level: parsed.value }),
      CANVAS,
    )
    const [x0, , z0] = eyeOf(walk)
    for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
      walk.key(code, true)
      walk.tick(0.1)
      walk.key(code, false)
    }
    walk.key('KeyW', true)
    walk.key('KeyD', true)
    ticks(walk, 3)
    const [x, , z] = eyeOf(walk)
    expect(Math.hypot(x - x0, z - z0)).toBeGreaterThan(0.1)
  })
})

describe('createWalkController: looking by a drag and the mesh to draw (ED3D.8b)', () => {
  it('turns the heading and tips the pitch by a drag, holding the pitch to 85 degrees', () => {
    const { walk } = walkOn(withSpawn(EAST))
    const yaw = walk.view.camera.yaw
    walk.lookBy(0.2, 0.1)
    expect(walk.view.camera.yaw).toBeCloseTo(yaw + 0.2, 12)
    expect(walk.view.camera.pitch).toBeCloseTo(0.1, 12)
    walk.lookBy(0, 10)
    expect(walk.view.camera.pitch).toBeCloseTo(85 * DEGREES, 12)
  })

  it('turns Orbit’s heading by a drag', () => {
    const { walk } = walkOn(withSpawn(EAST))
    walk.setMode('orbit')
    const before = walk.view.camera
    walk.lookBy(0.3, 0)
    expect(walk.view.camera.yaw).not.toBeCloseTo(before.yaw, 6)
  })

  it('has the level’s mesh for the view to draw, the same one while the level does not change', () => {
    const { walk, editor } = walkOn(withSpawn(EAST))
    const mesh = walk.mesh
    expect(mesh.surfaces.length).toBeGreaterThan(0)
    expect(walk.mesh).toBe(mesh)
    editor.run(setHeights({ id: 'hall', ceiling: 5 }))
    expect(walk.mesh).not.toBe(mesh)
  })
})
