// The dollhouse viewport as plain TypeScript (ED3D.5e step 3; ED3D spec §6, §10): framing, orbiting, zooming, twisting
// and tapping to select, with one selection shared with the plan. The toy level: the hall from (0, 0) to (8, 6) and the
// dock from (8, 0) to (14, 6), on a 600 by 400 canvas.
import { describe, expect, it } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { toyAfSector } from '../testing/toy-af-sector'
import { orbitCamera, projectPoint } from '../view/mesh/camera-3d'
import { createDollhouseController } from './dollhouse-controller'

const SIZE = { w: 600, h: 400 }
const DEGREES = Math.PI / 180

function setup() {
  const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
  const dollhouse = createDollhouseController(editor, SIZE)
  /** Where a world point shows on the canvas now. */
  const screen = (x: number, y: number, z: number) => {
    const at = projectPoint(orbitCamera(dollhouse.view.orbit), SIZE, [x, y, z])
    if (at === undefined) throw new Error('behind the eye')
    return { x: at.x, y: at.y, kind: 'touch' as const }
  }
  return { editor, dollhouse, screen }
}

describe('the dollhouse controller', () => {
  it('frames the level from the home angles: 30° up', () => {
    const { dollhouse } = setup()
    expect(dollhouse.view.orbit.pitch).toBeCloseTo(30 * DEGREES)
    expect(dollhouse.view.orbit.target[0]).toBeCloseTo(7)
    expect(dollhouse.view.mesh.surfaces.length).toBeGreaterThan(0)
  })

  it('orbits with a drag: across turns, up and down tips, held between 5° and 85°', () => {
    const { dollhouse } = setup()
    const before = dollhouse.view.orbit
    dollhouse.orbitBy(100, 0)
    expect(dollhouse.view.orbit.yaw).not.toBeCloseTo(before.yaw)
    expect(dollhouse.view.orbit.pitch).toBeCloseTo(before.pitch)
    dollhouse.orbitBy(0, 100000)
    expect(dollhouse.view.orbit.pitch).toBeCloseTo(85 * DEGREES)
    dollhouse.orbitBy(0, -100000)
    expect(dollhouse.view.orbit.pitch).toBeCloseTo(5 * DEGREES)
  })

  it('zooms with a pinch or the wheel, and turns with a twist', () => {
    const { dollhouse } = setup()
    const { distance, yaw } = dollhouse.view.orbit
    dollhouse.zoomBy(2)
    expect(dollhouse.view.orbit.distance).toBeCloseTo(distance / 2)
    dollhouse.twist(10 * DEGREES)
    expect(dollhouse.view.orbit.yaw).toBeCloseTo(yaw + 10 * DEGREES)
    dollhouse.fit()
    expect(dollhouse.view.orbit.distance).toBeCloseTo(distance)
  })

  it('selects what a tap hits, the same selection the plan shows, and clears it on a tap on nothing', () => {
    const { dollhouse, editor, screen } = setup()
    dollhouse.tap(screen(4, 0, 3))
    expect(editor.selection.ids).toEqual(['sector:hall'])
    dollhouse.tap({ x: 2, y: 2, kind: 'touch' })
    expect(editor.selection.ids).toEqual([])
  })

  it('tells its subscribers about each change, and leaves the document and the view mode alone', () => {
    const { dollhouse, editor } = setup()
    let calls = 0
    dollhouse.subscribe(() => {
      calls += 1
    })
    const level = editor.level
    dollhouse.orbitBy(10, 10)
    dollhouse.zoomBy(1.5)
    expect(calls).toBe(2)
    expect(editor.level).toBe(level)
    expect(editor.view.state.mode).toBe('plan')
    expect(editor.history.canUndo).toBe(false)
  })

  it('reframes for a new canvas size only until the camera is moved by hand', () => {
    const { dollhouse } = setup()
    const first = dollhouse.view.orbit.distance
    dollhouse.resize({ w: 300, h: 200 })
    expect(dollhouse.view.orbit.distance).toBeGreaterThan(first)
    dollhouse.orbitBy(30, 0)
    const moved = dollhouse.view.orbit
    dollhouse.resize({ w: 600, h: 400 })
    expect(dollhouse.view.orbit).toEqual(moved)
  })
})
