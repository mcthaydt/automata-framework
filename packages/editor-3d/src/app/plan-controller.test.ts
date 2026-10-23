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

describe('tap', () => {
  it('selects the sector under the pointer, a wall within its reach, and clears on nothing', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    expect(editor.selection.ids).toEqual(['sector:hall'])
    controller.tap(at(4, 0.1))
    expect(editor.selection.ids).toEqual(['wall:hall/0'])
    controller.tap(at(-3, 3))
    expect(editor.selection.ids).toEqual([])
  })

  it('replaces the selection with the other sector', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    controller.tap(at(11, 3))
    expect(editor.selection.ids).toEqual(['sector:dock'])
  })

  it('adds with the additive key, and takes off what is already selected', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    controller.tap({ ...at(11, 3), additive: true })
    expect(editor.selection.ids).toEqual(['sector:hall', 'sector:dock'])
    controller.tap({ ...at(4, 3), additive: true })
    expect(editor.selection.ids).toEqual(['sector:dock'])
  })

  it('keeps the selection when an additive tap lands on nothing', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    controller.tap({ ...at(-3, 3), additive: true })
    expect(editor.selection.ids).toEqual(['sector:hall'])
  })

  it('selects nothing on a layer that is locked or hidden, as a tap on nothing', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    editor.view.set({ locked: ['sectors'] })
    controller.tap(at(11, 3))
    expect(editor.selection.ids).toEqual([])
    editor.view.set({ locked: [], hidden: ['sectors'] })
    controller.tap(at(4, 3))
    expect(editor.selection.ids).toEqual([])
  })

  it('selects the sector under a wall whose layer is locked', () => {
    const { editor, controller, at } = setup()
    editor.view.set({ locked: ['walls'] })
    controller.tap(at(4, 0.1))
    expect(editor.selection.ids).toEqual(['sector:hall'])
  })

  it('on a corner handle selects what is under it, and shows the handles of what it selected', () => {
    const { editor, controller, at } = setup()
    controller.tap(at(4, 3))
    controller.hover(at(8, 6))
    expect(controller.view.corner).toMatchObject({ sector: 'hall', corner: 2 })
    controller.tap(at(8, 6))
    expect(editor.selection.ids).toHaveLength(1)
    expect(editor.selection.ids[0]).toMatch(/^wall:(hall|dock)\//)
    // The pointer is still there: the handles of the sector the tap selected are under it.
    expect(controller.view.corner).toBeDefined()
  })

  it('takes the pointer with it, so the hover is where the tap was even when nothing was selected or cleared', () => {
    const { editor, controller, at } = setup()
    controller.hover(at(4, 3))
    expect(controller.view.hover).toMatchObject({ selection: 'sector:hall' })
    controller.tap(at(-3, 3))
    expect(editor.selection.ids).toEqual([])
    expect(controller.view.hover).toBeUndefined()
  })

  it('moves the hover with it: the next handle shows without a pointer move', () => {
    const { controller, at } = setup()
    controller.tap(at(4, 3))
    expect(controller.view.hover).toMatchObject({ selection: 'sector:hall' })
    controller.tap(at(0, 0))
    expect(controller.view.corner).toMatchObject({ sector: 'hall', corner: 0 })
  })
})

/** A sector's outline as `[x, z]` pairs, from the live level. */
const outline = (editor: ReturnType<typeof setup>['editor'], id: string) =>
  afSectorProfile.sectors
    .list(editor.level)
    .find((sector) => sector.id === id)
    ?.corners.map(([x, z]) => [x, z])

/** The hall selected, and a drag begun on its corner 2 at (8, 6), which the dock's corner 3 shares. */
function grabbed() {
  const s = setup()
  s.editor.selection.set(['sector:hall'])
  s.controller.dragStart(s.at(8, 6), s.at(8, 6))
  return s
}

describe('a corner drag', () => {
  it('moves the corner, and the corner the portal joins to it, as one undo step named for the edit', () => {
    const { editor, controller, at } = grabbed()
    expect(controller.view.gesture).toBe('corner')
    controller.drag(at(9.2, 5.2))
    // Live: the level shows the corner at the grid point before the drag is over, and there is no step yet to keep.
    expect(outline(editor, 'hall')).toEqual([
      [0, 0],
      [8, 0],
      [9, 5],
      [0, 6],
    ])
    expect(outline(editor, 'dock')?.[3]).toEqual([9, 5])
    controller.dragEnd(at(9.2, 5.2), false)
    expect(controller.view.gesture).toBe('idle')
    expect(editor.history.undoLabel).toBe('Move corner 2 of hall')
    editor.history.undo()
    expect(outline(editor, 'hall')?.[2]).toEqual([8, 6])
    expect(outline(editor, 'dock')?.[3]).toEqual([8, 6])
    // One step: nothing is left to undo.
    expect(editor.history.canUndo).toBe(false)
  })

  it('grabs what the press was on, not what the first move is over', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    controller.dragStart(at(8, 6), at(8.5, 5.2))
    expect(controller.view.gesture).toBe('corner')
    controller.dragEnd(at(8.5, 5.2), false)
    expect(outline(editor, 'hall')?.[2]).toEqual([8.5, 5])
  })

  it('is not a corner drag when no selected sector has a handle under the press', () => {
    const { editor, controller, at } = setup()
    controller.dragStart(at(8, 6), at(9, 5))
    expect(controller.view.gesture).not.toBe('corner')
    controller.dragEnd(at(9, 5), false)
    expect(outline(editor, 'hall')?.[2]).toEqual([8, 6])
    expect(editor.history.canUndo).toBe(false)
  })

  it('snaps to the grid, and says so', () => {
    const { controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    expect(controller.view.snap).toMatchObject({ x: 9, z: 5, kind: 'grid' })
  })

  it('snaps to a wall line of the level as the drag found it, and names the wall', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(10, 5.95))
    expect(controller.view.snap).toMatchObject({ x: 10, z: 6, kind: 'wall', target: 'wall:dock/2' })
    controller.dragEnd(at(10, 5.95), false)
    expect(outline(editor, 'hall')?.[2]).toEqual([10, 6])
  })

  it('snaps to a vertex, and names the wall that starts there', () => {
    const { controller, at } = grabbed()
    controller.drag(at(13.9, 0.1))
    expect(controller.view.snap).toMatchObject({ x: 14, z: 0, kind: 'vertex', target: 'wall:dock/1' })
  })

  it('does not snap to itself: the targets are the level at the press, so a drag back to the start snaps to the start', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    // The corner is at (9, 5) now; the pointer comes back near where it began.
    controller.drag(at(8.05, 5.95))
    expect(controller.view.snap).toMatchObject({ x: 8, z: 6, kind: 'vertex' })
    expect(outline(editor, 'hall')?.[2]).toEqual([8, 6])
  })

  it('leaves no step when the corner ends where it began', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    controller.drag(at(8.05, 5.95))
    controller.dragEnd(at(8.05, 5.95), false)
    expect(editor.history.canUndo).toBe(false)
    expect(editor.level).toBe(depot)
  })

  it("snaps to the view's grid, at its step, or to the data step when the grid is off", () => {
    const { editor, controller, at } = grabbed()
    editor.view.set({ grid: { step: 1, snap: true } })
    controller.drag(at(9.4, 5.2))
    expect(controller.view.snap).toMatchObject({ x: 9, z: 5, kind: 'grid' })
    editor.view.set({ grid: { step: 1, snap: false } })
    controller.drag(at(9.43, 5.21))
    expect(controller.view.snap).toMatchObject({ x: 9.45, z: 5.2, kind: 'data' })
  })

  it('takes the pointer as it is with Alt, and the fine step with Shift', () => {
    const { controller, at } = grabbed()
    controller.drag({ ...at(9.23, 5.2), alt: true })
    expect(controller.view.snap).toMatchObject({ x: 9.23, z: 5.2, kind: 'free' })
    controller.drag({ ...at(9.237, 5.2), shift: true })
    expect(controller.view.snap).toMatchObject({ x: 9.24, z: 5.2, kind: 'data' })
  })

  it('keeps the last accepted position and shows the sentence when the edit refuses a move', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    controller.dragStart(at(0, 0), at(0, 0))
    controller.drag(at(-1, 0))
    expect(outline(editor, 'hall')?.[0]).toEqual([-1, 0])
    expect(controller.view.refusal).toBeUndefined()
    // Across the hall's own east wall the outline would cross itself.
    controller.drag(at(9, 3))
    expect(controller.view.refusal).toEqual(expect.any(String))
    expect(controller.view.refusal).not.toBe('')
    expect(outline(editor, 'hall')?.[0]).toEqual([-1, 0])
    // The next accepted run clears it.
    controller.drag(at(-1.5, 0))
    expect(controller.view.refusal).toBeUndefined()
    expect(outline(editor, 'hall')?.[0]).toEqual([-1.5, 0])
    controller.dragEnd(at(-1.5, 0), false)
    expect(outline(editor, 'hall')?.[0]).toEqual([-1.5, 0])
  })

  it('records no step when every move was refused, and drops the sentence with the drag', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    controller.dragStart(at(0, 0), at(9, 3))
    expect(controller.view.refusal).toEqual(expect.any(String))
    controller.dragEnd(at(9, 3), false)
    expect(controller.view.refusal).toBeUndefined()
    expect(controller.view.snap).toBeUndefined()
    expect(editor.history.canUndo).toBe(false)
    expect(editor.level).toBe(depot)
  })

  it('leaves the level as it was when the drag is cancelled', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    controller.dragEnd(at(9.2, 5.2), true)
    expect(controller.view.gesture).toBe('idle')
    expect(editor.level).toBe(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('drops the sentence of a refused move when an undo ends the drag', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    controller.dragStart(at(0, 0), at(-1, 0))
    controller.drag(at(9, 3))
    expect(controller.view.refusal).toEqual(expect.any(String))
    editor.history.undo()
    expect(controller.view.gesture).toBe('idle')
    expect(controller.view.refusal).toBeUndefined()
  })

  it('is never told a drag began when another edit session is open', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    const seen: string[] = []
    controller.subscribe(() => seen.push(controller.view.gesture))
    const other = editor.begin('another')
    controller.dragStart(at(8, 6), at(9, 5))
    other.cancel()
    expect(seen).not.toContain('corner')
  })

  it('ends when an undo cancels it, and the next move does not crash or write', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    expect(controller.view.snap).toBeDefined()
    editor.history.undo()
    expect(controller.view.gesture).toBe('idle')
    expect(controller.view.snap).toBeUndefined()
    expect(controller.view.refusal).toBeUndefined()
    controller.drag(at(9.7, 5.2))
    controller.dragEnd(at(9.7, 5.2), false)
    expect(editor.level).toBe(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('cancels a drag that was never ended when the next one begins', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    controller.dragStart(at(0, 6), at(0, 6))
    expect(controller.view.gesture).toBe('corner')
    expect(editor.level).toBe(depot)
    controller.drag(at(-1, 6))
    controller.dragEnd(at(-1, 6), false)
    expect(editor.history.undoLabel).toBe('Move corner 3 of hall')
    expect(outline(editor, 'hall')?.[2]).toEqual([8, 6])
    expect(outline(editor, 'hall')?.[3]).toEqual([-1, 6])
    editor.history.undo()
    expect(editor.history.canUndo).toBe(false)
  })

  it('follows the pointer with the hover when no corner is grabbed', () => {
    const { controller, at } = setup()
    controller.dragStart(at(8, 6), at(9, 5))
    controller.drag(at(4, 3))
    expect(controller.view.hover).toMatchObject({ selection: 'sector:hall' })
    controller.dragEnd(at(-3, 3), false)
    expect(controller.view.hover).toBeUndefined()
  })

  it('starts clean for the next drag', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    controller.dragEnd(at(9.2, 5.2), false)
    controller.dragStart(at(9, 5), at(9, 5))
    expect(controller.view.gesture).toBe('corner')
    controller.drag(at(9.5, 4))
    controller.dragEnd(at(9.5, 4), false)
    expect(outline(editor, 'hall')?.[2]).toEqual([9.5, 4])
    editor.history.undo()
    expect(outline(editor, 'hall')?.[2]).toEqual([9, 5])
    editor.history.undo()
    expect(outline(editor, 'hall')?.[2]).toEqual([8, 6])
  })

  it('applies the final position when the drag ends there', () => {
    const { editor, controller, at } = grabbed()
    controller.drag(at(9.2, 5.2))
    controller.dragEnd(at(10.2, 5.2), false)
    expect(outline(editor, 'hall')?.[2]).toEqual([10, 5])
  })

  it('does not start while another edit session is open', () => {
    const { editor, controller, at } = setup()
    editor.selection.set(['sector:hall'])
    const other = editor.begin('another')
    controller.dragStart(at(8, 6), at(9, 5))
    expect(controller.view.gesture).not.toBe('corner')
    other.cancel()
  })
})
