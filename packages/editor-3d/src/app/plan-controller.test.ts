// The Plan controller (ED3D.5a): what a pointer does to the selection, the level and the camera on the plan. The depot is
// the level: the hall runs from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a portal along x = 8. The
// canvas is 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with
// `toScreen`, so no test hides a unit.
import type { PointerKind } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { moveCorner } from '../model/corner-edits'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { createPlanController, type PlanPointer } from './plan-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(level: AfSector = depot) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  editor.view.set({ camera: CAMERA })
  const controller = createPlanController(editor, SIZE)
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (x: number, z: number, kind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
  })
  return { editor, controller, at }
}

describe('hover', () => {
  it('is the sector under the pointer, and nothing over nothing', () => {
    const { controller, at } = setup()
    controller.hover(at(4, 3))
    expect(controller.view.hover).toMatchObject({ kind: 'sector', selection: 'sector:hall', sector: 'hall' })
    controller.hover(at(-3, 3))
    expect(controller.view.hover).toBeUndefined()
  })

  it("is the wall within the pointer kind's reach, and a finger reaches further than a mouse", () => {
    const { controller, at } = setup()
    // Close to the hall's north wall: 0.1 m is 3.2 px.
    controller.hover(at(4, 0.1))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:hall/0', sector: 'hall' })
    // 0.45 m is 14.4 px: past a mouse's 8, inside a finger's 22.
    controller.hover(at(4, 0.45, 'mouse'))
    expect(controller.view.hover).toMatchObject({ kind: 'sector', selection: 'sector:hall' })
    controller.hover(at(4, 0.45, 'touch'))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:hall/0' })
  })

  it('is the wall of the room the pointer is in, on a line two rooms share', () => {
    const { controller, at } = setup()
    controller.hover(at(7.98, 3))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:hall/1' })
    controller.hover(at(8.02, 3))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:dock/3' })
  })

  it('goes when the pointer leaves, and so does the handle under it', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    controller.hover(at(0, 0))
    expect(controller.view.corner).toMatchObject({ corner: 0 })
    controller.leave()
    expect(controller.view.hover).toBeUndefined()
    expect(controller.view.corner).toBeUndefined()
  })

  it('tells the subscribers once for a change and not for a repeat', () => {
    const { controller, at } = setup()
    const told = vi.fn()
    controller.subscribe(told)
    controller.hover(at(4, 3))
    controller.hover(at(4.5, 3.5))
    controller.hover(at(5, 2))
    expect(told).toHaveBeenCalledTimes(1)
    controller.hover(at(-3, 3))
    expect(told).toHaveBeenCalledTimes(2)
    controller.leave()
    controller.leave()
    expect(told).toHaveBeenCalledTimes(2)
  })

  it('stops telling a subscriber that left', () => {
    const { controller, at } = setup()
    const told = vi.fn()
    const stop = controller.subscribe(told)
    stop()
    controller.hover(at(4, 3))
    expect(told).not.toHaveBeenCalled()
  })

  it('leaves out what the layers leave out: a locked walls layer gives the sector under the wall', () => {
    const { editor, controller, at } = setup()
    editor.view.set({ locked: ['walls'] })
    controller.hover(at(4, 0.1))
    expect(controller.view.hover).toMatchObject({ kind: 'sector', selection: 'sector:hall' })
  })

  it('leaves out what the layers leave out: a hidden sectors layer leaves the wall and not the sector', () => {
    const { editor, controller, at } = setup()
    editor.view.set({ hidden: ['sectors'] })
    controller.hover(at(4, 3))
    expect(controller.view.hover).toBeUndefined()
    controller.hover(at(4, 0.1))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:hall/0' })
  })

  it('follows a change of the layers with no pointer move', () => {
    const { editor, controller, at } = setup()
    controller.hover(at(4, 0.1))
    expect(controller.view.hover).toMatchObject({ kind: 'wall' })
    editor.view.set({ locked: ['walls'] })
    expect(controller.view.hover).toMatchObject({ kind: 'sector' })
    editor.view.set({ locked: [] })
    expect(controller.view.hover).toMatchObject({ kind: 'wall' })
  })
})

describe('corner handles', () => {
  it("show for a selected sector's corner, and not for an unselected one", () => {
    const { editor, controller, at } = setup()
    controller.hover(at(0, 0))
    expect(controller.view.corner).toBeUndefined()
    editor.selection.set(['sector:hall'])
    controller.hover(at(0, 0))
    expect(controller.view.corner).toMatchObject({ sector: 'hall', corner: 0, at: { x: 0, z: 0 } })
    // The dock's far corner, with only the hall selected.
    controller.hover(at(14, 0))
    expect(controller.view.corner).toBeUndefined()
  })

  it('belong to the sector a selected wall is of', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['wall:dock/0'])
    controller.hover(at(14, 0))
    expect(controller.view.corner).toMatchObject({ sector: 'dock', corner: 1 })
  })

  it('appear when the selection changes, with no pointer move', () => {
    const { editor, controller, at } = setup()
    controller.hover(at(8, 6))
    expect(controller.view.corner).toBeUndefined()
    editor.selection.set(['sector:dock'])
    expect(controller.view.corner).toMatchObject({ sector: 'dock', corner: 3 })
    editor.selection.clear()
    expect(controller.view.corner).toBeUndefined()
  })

  it('need the walls layer shown and unlocked', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    editor.view.set({ locked: ['walls'] })
    controller.hover(at(0, 0))
    expect(controller.view.corner).toBeUndefined()
    editor.view.set({ locked: [], hidden: ['walls'] })
    expect(controller.view.corner).toBeUndefined()
    editor.view.set({ hidden: [] })
    expect(controller.view.corner).toMatchObject({ sector: 'hall', corner: 0 })
  })

  it('answer the corner of a selected sector over the one of an unselected sector at the same place', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:dock'])
    // (8, 0) is the hall's corner 1 and the dock's corner 0.
    controller.hover(at(8, 0))
    expect(controller.view.corner).toMatchObject({ sector: 'dock', corner: 0 })
  })
})

describe('the geometry the picks read', () => {
  it('follows the level: an edit that moves a wall, and its undo', () => {
    const { editor, controller, at } = setup()
    controller.hover(at(-1, 0.05))
    expect(controller.view.hover).toBeUndefined()
    editor.run(moveCorner({ sector: 'hall', corner: 0, x: -2, z: 0 }))
    expect(controller.view.hover).toMatchObject({ kind: 'wall', selection: 'wall:hall/0' })
    editor.history.undo()
    expect(controller.view.hover).toBeUndefined()
  })

  it('is empty for a level that cannot be resolved, which is no crash and no hit', () => {
    const broken: AfSector = {
      ...depot,
      sectors: depot.sectors.map((sector) =>
        sector.id === 'hall'
          ? {
              ...sector,
              corners: sector.corners.map((corner) =>
                corner[0] === 8 && corner[1] === 0 ? [8, 0, { next: 'ghost' }] : corner,
              ),
            }
          : sector,
      ),
    } as AfSector
    expect(() => afSectorProfile.geometry(broken)).toThrow()
    const { controller, at } = setup(broken)
    controller.hover(at(4, 3))
    expect(controller.view.hover).toBeUndefined()
  })

  it('is built once for each level, not for each pick', () => {
    const geometry = vi.spyOn(afSectorProfile, 'geometry')
    try {
      const { editor, controller, at } = setup()
      controller.hover(at(4, 3))
      controller.hover(at(1, 1))
      controller.hover(at(4, 0.1))
      editor.selection.set(['sector:hall'])
      editor.view.set({ locked: ['walls'] })
      expect(geometry).toHaveBeenCalledTimes(1)
      editor.run(moveCorner({ sector: 'hall', corner: 0, x: -2, z: 0 }))
      expect(geometry).toHaveBeenCalledTimes(2)
    } finally {
      geometry.mockRestore()
    }
  })

  it("lets an error that is not the geometry's own through", () => {
    const profile = {
      ...afSectorProfile,
      geometry: () => {
        throw new TypeError('not a GeometryError')
      },
    }
    const editor = createLevelEditor({ profile, level: depot })
    const controller = createPlanController(editor, SIZE)
    expect(() => controller.hover({ x: 10, y: 10, kind: 'mouse' })).toThrow('not a GeometryError')
  })

  it('stops following the editor once it is disposed', () => {
    const geometry = vi.spyOn(afSectorProfile, 'geometry')
    try {
      const { editor, controller, at } = setup()
      controller.hover(at(4, 0.1))
      const told = vi.fn()
      controller.subscribe(told)
      controller.dispose()
      const built = geometry.mock.calls.length
      editor.run(moveCorner({ sector: 'hall', corner: 0, x: -2, z: 0 }))
      editor.view.set({ locked: ['walls'] })
      editor.selection.set(['sector:dock'])
      expect(told).not.toHaveBeenCalled()
      expect(geometry.mock.calls.length).toBe(built)
    } finally {
      geometry.mockRestore()
    }
  })
})
