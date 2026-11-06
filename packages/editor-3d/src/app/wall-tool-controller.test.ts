// The wall tools (ED3D.6b): Portal, Door and Window on the plan, from the pointer over a wall to what a tap does. The depot
// is the level: the hall runs from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a portal along x = 8; the
// hall has a window on its north wall (corner 0) and a door on its west wall (corner 3). The canvas is 800 by 400 px with
// the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with `toScreen`, so no test hides a
// unit.
import type { PointerKind } from '@mcthaydt/automata-editor/kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { AfSector, AfSectorEntry } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { setWallKind } from '../model/wall-edits'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { LevelProfile } from '../profile/level-profile'
import { SectorAccessError } from '../profile/sector-access'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { toyBlockout } from '../testing/toy-blockout'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanPointer } from './plan-controller'
import { createWallTool, type WallToolKind } from './wall-tool-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(kind: WallToolKind, level: AfSector = depot) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  editor.view.set({ camera: CAMERA })
  const tool = createWallTool(editor, SIZE, { kind })
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (
    x: number,
    z: number,
    pointerKind: PointerKind = 'mouse',
    keys: Pick<PlanPointer, 'shift' | 'alt'> = {},
  ): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind: pointerKind,
    ...keys,
  })
  return { editor, tool, at }
}

const sector = (id: string, corners: AfSectorEntry['corners']): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
})

/** West of the hall, over the hall's west wall (which starts at its corner 3); the east wall is the annex's corner 1. */
const ANNEX: AfSectorEntry['corners'] = [
  [-6, 0],
  [0, 0],
  [0, 6],
  [-6, 6],
]

describe('the wall under the pointer', () => {
  it('names the sector and corner of the wall, its length and where along it the pointer is', () => {
    const { tool, at } = setup('door')
    tool.hover(at(0.1, 4.2))
    expect(tool.view.target).toMatchObject({
      sector: 'hall',
      corner: 3,
      selection: 'wall:hall/3',
      length: 6,
      along: 1.8,
      point: { x: 0, z: 4.2 },
    })
  })

  it("measures from the wall's start corner as the document writes it", () => {
    const { tool, at } = setup('door')
    // The hall's south wall (corner 2) runs from (8, 6) to (0, 6).
    tool.hover(at(7.5, 6.1))
    expect(tool.view.target).toMatchObject({ corner: 2, along: 0.5, point: { x: 7.5, z: 6 } })
    tool.hover(at(0.5, 6.1))
    expect(tool.view.target).toMatchObject({ corner: 2, along: 7.5, point: { x: 0.5, z: 6 } })
  })

  it('measures the same point of a wall from the other end when the outline is written the other way round', () => {
    const forward = setup('door', toyAfSector({ sectors: [toyHall, toyDock, sector('annex', ANNEX)] }))
    forward.tool.hover(forward.at(-0.1, 2))
    // The wall over the hall's west wall: the annex's (0, 0) to (0, 6), or the hall's (0, 6) to (0, 0), by the pointer's side.
    expect(forward.tool.view.target).toMatchObject({ sector: 'annex', corner: 1, along: 2 })
    const turned = setup(
      'door',
      toyAfSector({ sectors: [toyHall, toyDock, sector('annex', [...ANNEX].reverse())] }),
    )
    turned.tool.hover(turned.at(-0.1, 2))
    expect(turned.tool.view.target).toMatchObject({ sector: 'annex', corner: 1, along: 4 })
  })

  it('rounds the place to 5 cm, 1 cm with Shift, and keeps it as it is with Alt', () => {
    const { tool, at } = setup('door')
    // 5.93 m on the south wall is 2.07 m from its start at (8, 6).
    tool.hover(at(5.93, 6.1))
    expect(tool.view.target?.along).toBe(2.05)
    tool.hover(at(5.93, 6.1, 'mouse', { shift: true }))
    expect(tool.view.target?.along).toBeCloseTo(2.07, 3)
    tool.hover(at(5.934, 6.1, 'mouse', { alt: true }))
    expect(tool.view.target?.along).toBeCloseTo(2.066, 3)
  })

  it('keeps the place within the wall when rounding would take it past the end', () => {
    const long: AfSector = toyAfSector({
      sectors: [
        sector('room', [
          [0, 0],
          [8, 0],
          [8, 6.03],
          [0, 6.03],
        ]),
      ],
    })
    const { tool, at } = setup('door', long)
    // 6.027 m along a wall of 6.03 m rounds to 6.05 m.
    tool.hover(at(8, 6.027))
    expect(tool.view.target).toMatchObject({ corner: 1, length: 6.03, along: 6.03 })
  })

  it("answers within the pointer kind's reach: 8 px for a mouse, 12 for a Pencil, 22 for a finger", () => {
    const { tool, at } = setup('door')
    // 0.4375 m is 14 px off the hall's south wall.
    tool.hover(at(4, 6.4375, 'mouse'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 6.4375, 'pen'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 6.4375, 'touch'))
    expect(tool.view.target).toMatchObject({ sector: 'hall', corner: 2 })
  })

  it('takes the wall of the sector the pointer is in when two lie on one line', () => {
    const { tool, at } = setup('portal')
    tool.hover(at(7.95, 3))
    expect(tool.view.target?.selection).toBe('wall:hall/1')
    tool.hover(at(8.05, 3))
    expect(tool.view.target?.selection).toBe('wall:dock/3')
  })

  it('answers nothing over a sector fill, or away from every wall', () => {
    const { tool, at } = setup('door')
    tool.hover(at(4, 3))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(30, 30))
    expect(tool.view.target).toBeUndefined()
  })

  it('answers nothing in a hidden or a locked walls layer', () => {
    const { editor, tool, at } = setup('door')
    editor.view.set({ hidden: ['walls'] })
    tool.hover(at(4, 6.1))
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['walls'] })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ locked: [] })
    tool.hover(at(4, 6.1))
    expect(tool.view.target).toMatchObject({ corner: 2 })
  })

  it('clears when the pointer leaves, and follows the camera and the canvas size', () => {
    const { editor, tool, at } = setup('door')
    const pointer = at(4, 6.1)
    tool.hover(pointer)
    expect(tool.view.target).toMatchObject({ sector: 'hall', corner: 2 })
    // The camera keeps its centre when the canvas narrows: the same pixel is now 6.25 m further east, on the dock.
    tool.resize({ w: 400, h: 400 })
    expect(tool.view.target).toMatchObject({ sector: 'dock', corner: 2 })
    tool.resize(SIZE)
    expect(tool.view.target).toMatchObject({ sector: 'hall', corner: 2 })
    editor.view.set({ camera: { x: 7, z: 3, zoom: 2 } })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ camera: CAMERA })
    tool.leave()
    expect(tool.view.target).toBeUndefined()
  })

  it('follows an edit of the level under the pointer', () => {
    const { editor, tool, at } = setup('door')
    tool.hover(at(0.1, 4.2))
    expect(tool.view.target?.action).toBe('move')
    editor.run(setWallKind({ sector: 'hall', corner: 3, kind: 'solid' }))
    expect(tool.view.target?.action).toBe('place')
  })

  it('is the same view while nothing changed, and tells a listener only when it did', () => {
    const { tool, at } = setup('door')
    const listener = vi.fn()
    tool.subscribe(listener)
    tool.hover(at(4, 6.1))
    const view = tool.view
    expect(listener).toHaveBeenCalledTimes(1)
    tool.hover(at(4, 6.1))
    expect(tool.view).toBe(view)
    expect(listener).toHaveBeenCalledTimes(1)
    tool.hover(at(5, 6.1))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops following the editor when disposed', () => {
    const { editor, tool, at } = setup('door')
    const listener = vi.fn()
    tool.subscribe(listener)
    tool.hover(at(0.1, 4.2))
    tool.dispose()
    listener.mockClear()
    editor.run(setWallKind({ sector: 'hall', corner: 3, kind: 'solid' }))
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('what a tap would do', () => {
  const action = (kind: WallToolKind, x: number, z: number, level: AfSector = depot) => {
    const { tool, at } = setup(kind, level)
    tool.hover(at(x, z))
    return tool.view.target
  }

  it('is place on a wall without the feature and move on a wall with it', () => {
    expect(action('door', 0.1, 4.2)?.action).toBe('move')
    expect(action('door', 4, 6.1)?.action).toBe('place')
    expect(action('door', 4, -0.1)?.action).toBe('place')
    expect(action('window', 4, -0.1)?.action).toBe('move')
    expect(action('window', 0.1, 4.2)?.action).toBe('place')
  })

  it('refuses a door or a window on a portal wall, saying where it leads', () => {
    for (const kind of ['door', 'window'] as const) {
      expect(action(kind, 7.95, 3)).toMatchObject({
        action: 'none',
        reason: 'that wall is a portal into dock: make it solid first',
      })
      expect(action(kind, 8.05, 3)).toMatchObject({
        action: 'none',
        reason: 'that wall is a portal into hall: make it solid first',
      })
    }
  })

  it('is a portal into the sector behind the wall for the Portal tool, where one lies on it', () => {
    const level = toyAfSector({ sectors: [toyHall, toyDock, sector('annex', ANNEX)] })
    const target = action('portal', -0.1, 3, level)
    expect(target).toMatchObject({ sector: 'annex', corner: 1, action: 'portal', to: 'hall' })
    expect(target).not.toHaveProperty('reason')
  })

  it('gives the Portal tool the sentence for a wall that is done, taken, or has nothing over it', () => {
    expect(action('portal', 7.95, 3)).toMatchObject({
      action: 'none',
      reason: 'that wall is already a portal into dock',
    })
    expect(action('portal', 4, 6.1)).toMatchObject({
      action: 'none',
      reason: 'no other sector has a wall over this one',
    })
    // The hall's west wall leads into a twin that lies over the same segment (and leads back): a third wall over it is taken.
    const twin: AfSectorEntry = sector('twin', [
      [-3, 0],
      [0, 0, { next: 'hall' }],
      [0, 6],
      [-3, 6],
    ])
    const leadingToTwin: AfSectorEntry = {
      ...toyHall,
      corners: toyHall.corners.map((corner, i) => (i === 3 ? ([0, 6, { next: 'twin' }] as const) : corner)),
    }
    const taken = toyAfSector({ sectors: [leadingToTwin, toyDock, sector('annex', ANNEX), twin] })
    expect(action('portal', -0.1, 3, taken)).toMatchObject({
      sector: 'annex',
      action: 'none',
      reason: 'the wall over it already leads into twin',
    })
  })
})

describe('a tap', () => {
  /** The members of one wall of a sector, as the level writes them. */
  const wallOf = (editor: ReturnType<typeof setup>['editor'], id: string, corner: number) =>
    afSectorProfile.sectors.list(editor.level).find((each) => each.id === id)?.corners[corner]?.[2]

  /** Whether a step is open: a session begun now comes back closed. A probe that did open is cancelled, so it leaves nothing. */
  const stepOpen = (editor: ReturnType<typeof setup>['editor']): boolean => {
    const probe = editor.begin('probe')
    const open = !probe.open
    probe.cancel()
    return open
  }

  it('puts a door on a solid wall where the pointer is, as one undo step, and selects the wall', () => {
    const { editor, tool, at } = setup('door')
    tool.tap(at(5.93, 6.1))
    expect(wallOf(editor, 'hall', 2)).toEqual({ door: { at: 2.05, width: 1.2, height: 2.2 } })
    expect(editor.history.undoLabel).toBe('Put a door on wall 2 of hall')
    expect(editor.selection.ids).toEqual(['wall:hall/2'])
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the whole door on the wall: its centre half a width in from either end', () => {
    const near = setup('door')
    near.tool.tap(near.at(7.98, 6.1))
    expect(wallOf(near.editor, 'hall', 2)).toMatchObject({ door: { at: 0.6 } })
    const far = setup('door')
    far.tool.tap(far.at(0.02, 6.1))
    expect(wallOf(far.editor, 'hall', 2)).toMatchObject({ door: { at: 7.4 } })
  })

  it("keeps the whole window on the wall by the window's own width", () => {
    const near = setup('window')
    near.tool.tap(near.at(7.98, 6.1))
    expect(wallOf(near.editor, 'hall', 2)).toMatchObject({ window: { at: 0.8 } })
    const far = setup('window')
    far.tool.tap(far.at(0.02, 6.1))
    expect(wallOf(far.editor, 'hall', 2)).toMatchObject({ window: { at: 7.2 } })
  })

  it('moves the door a wall has to where the pointer is, and is no step when it is already there', () => {
    const { editor, tool, at } = setup('door')
    tool.tap(at(0.1, 4.2))
    expect(wallOf(editor, 'hall', 3)).toEqual({ door: { at: 1.8, width: 1.2, height: 2.2 } })
    expect(editor.history.undoLabel).toBe('Move the door of wall 3 of hall')
    tool.tap(at(0.1, 4.2))
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('puts a window on a wall and moves the one it has, with the window width and height', () => {
    const { editor, tool, at } = setup('window')
    tool.tap(at(5.93, 6.1))
    expect(wallOf(editor, 'hall', 2)).toEqual({ window: { at: 2.05, width: 1.6, y0: 1, y1: 2.6 } })
    expect(editor.history.undoLabel).toBe('Put a window on wall 2 of hall')
    tool.tap(at(2.5, -0.1))
    expect(wallOf(editor, 'hall', 0)).toEqual({ window: { at: 2.5, width: 1.6, y0: 1, y1: 2.6 } })
    expect(editor.history.undoLabel).toBe('Move the window of wall 0 of hall')
  })

  it('says why a feature does not fit, and leaves the level, the history and the step as they were', () => {
    const level = toyAfSector({
      sectors: [
        sector('room', [
          [0, 0, { door: { at: 0.5, width: 1.2, height: 2.2 } }],
          [1, 0],
          [1, 4],
          [0, 4],
        ]),
      ],
    })
    const { editor, tool, at } = setup('door', level)
    tool.tap(at(0.5, -0.1))
    expect(tool.view.refusal).toMatch(/^the door does not fit the wall/)
    expect(editor.level).toEqual(level)
    expect(editor.history.canUndo).toBe(false)
    expect(stepOpen(editor)).toBe(false)
  })

  it('changes nothing on a portal wall for a door or a window, and says so', () => {
    for (const kind of ['door', 'window'] as const) {
      const { editor, tool, at } = setup(kind)
      tool.tap(at(7.95, 3))
      expect(tool.view.refusal).toBe('that wall is a portal into dock: make it solid first')
      expect(editor.level).toEqual(depot)
      expect(editor.history.canUndo).toBe(false)
    }
  })

  it('makes a portal on both sides in one step, taking the door off the wall behind it', () => {
    const level: AfSector = { ...depot, sectors: [...depot.sectors, sector('annex', ANNEX)] }
    const { editor, tool, at } = setup('portal', level)
    tool.tap(at(-0.1, 3))
    expect(wallOf(editor, 'annex', 1)).toEqual({ next: 'hall' })
    expect(wallOf(editor, 'hall', 3)).toEqual({ next: 'annex' })
    expect(editor.history.undoLabel).toBe('Make wall 1 of annex a portal into hall')
    expect(editor.selection.ids).toEqual(['wall:annex/1'])
    editor.history.undo()
    expect(editor.level).toEqual(level)
  })

  it('changes nothing for a portal that is done, taken or has nothing over it, and says why', () => {
    const done = setup('portal')
    done.tool.tap(done.at(7.95, 3))
    expect(done.tool.view.refusal).toBe('that wall is already a portal into dock')
    const none = setup('portal')
    none.tool.tap(none.at(4, 6.1))
    expect(none.tool.view.refusal).toBe('no other sector has a wall over this one')
    for (const made of [done, none]) {
      expect(made.editor.level).toEqual(depot)
      expect(made.editor.history.canUndo).toBe(false)
    }
  })

  it('clears the sentence on a tap that is off every wall, on a hover over another wall and on leave', () => {
    const { tool, at } = setup('door')
    tool.tap(at(7.95, 3))
    expect(tool.view.refusal).toBeDefined()
    tool.hover(at(7.95, 3.5))
    expect(tool.view.refusal).toBeDefined()
    tool.hover(at(4, 6.1))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(7.95, 3))
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(7.95, 3))
    tool.leave()
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence when the next tap works', () => {
    const { editor, tool, at } = setup('door')
    tool.tap(at(7.95, 3))
    tool.tap(at(4, 6.1))
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(true)
  })

  it('moves the door of a wall that has a window too, and leaves the window', () => {
    const level = toyAfSector({
      sectors: [
        sector('room', [
          [0, 0],
          [8, 0],
          [
            8,
            6,
            {
              door: { at: 2, width: 1.2, height: 2.2 },
              window: { at: 5, width: 1.6, y0: 1, y1: 2.6 },
            },
          ],
          [0, 6],
        ]),
      ],
    })
    const { editor, tool, at } = setup('door', level)
    tool.tap(at(6, 6.1))
    expect(afSectorProfile.sectors.list(editor.level)[0]?.corners[2]?.[2]).toEqual({
      door: { at: 2, width: 1.2, height: 2.2 },
      window: { at: 5, width: 1.6, y0: 1, y1: 2.6 },
    })
  })

  it('says what the profile says when it will not write the wall, and leaves nothing open', () => {
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        withSectors() {
          throw new SectorAccessError('the profile will not write it')
        },
      },
    }
    const editor = createLevelEditor({ profile, level: depot })
    editor.view.set({ camera: CAMERA })
    const tool = createWallTool(editor, SIZE, { kind: 'door' })
    tool.tap({ ...toScreen(planViewport(CAMERA, SIZE), { x: 4, z: 6.1 }), kind: 'mouse' })
    expect(tool.view.refusal).toBe('the profile will not write it')
    expect(editor.level).toEqual(depot)
    expect(stepOpen(editor)).toBe(false)
  })

  it('says what the history says when another step is open, and leaves that step open', () => {
    for (const kind of ['door', 'portal'] as const) {
      const level: AfSector = { ...depot, sectors: [...depot.sectors, sector('annex', ANNEX)] }
      const { editor, tool, at } = setup(kind, level)
      const other = editor.begin('a drag')
      tool.tap(kind === 'door' ? at(4, 6.1) : at(-0.1, 3))
      expect(tool.view.refusal).toBeDefined()
      expect(other.open).toBe(true)
      other.cancel()
      expect(editor.level).toEqual(level)
    }
  })

  describe('on a Last Light level', () => {
    const made = (kind: WallToolKind) => {
      const editor = createLevelEditor({ profile: lastLightProfile, level: toyBlockout() })
      editor.view.set({ camera: { x: 3.5, z: 2, zoom: 1 } })
      const tool = createWallTool(editor, SIZE, { kind })
      const at = (x: number, z: number): PlanPointer => ({
        ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
        kind: 'mouse',
      })
      return { editor, tool, at }
    }

    it('puts a door on a wall of a room', () => {
      const { editor, tool, at } = made('door')
      tool.tap(at(1, 4.1))
      expect(tool.view.refusal).toBeUndefined()
      expect(editor.history.undoLabel).toBe('Put a door on wall 2 of a')
    })

    it('puts a window on a wall of a room, and makes a portal where a room lies over it', () => {
      const { editor, tool, at } = made('window')
      tool.tap(at(1, 4.1))
      expect(tool.view.refusal).toBeUndefined()
      expect(editor.history.undoLabel).toBe('Put a window on wall 2 of a')
      const portal = made('portal')
      // Room b starts 0.125 m east of a's east wall: not the same segment, so nothing lies over it.
      portal.tool.tap(portal.at(4.06, 2))
      expect(portal.tool.view.refusal).toBe('no other sector has a wall over this one')
      expect(portal.editor.history.canUndo).toBe(false)
    })
  })
})
