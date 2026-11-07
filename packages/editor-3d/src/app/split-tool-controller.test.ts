// The Split tool (ED3D.6f): from the pointer on a sector's outline to what a tap does there, which is to put the start of a
// cut and then to run `splitSector` to the second tap. The depot is the level: the hall runs from (0, 0) to (8, 6) and the
// dock from (8, 0) to (14, 6), joined by a portal along x = 8; the hall has a window on its north wall (corner 0, from 3.2
// to 4.8 m) and a door on its west wall (corner 3, from z = 3.6 down to 2.4). The canvas is 800 by 400 px with the camera at
// (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with `toScreen`, so no test hides a unit.
import type { PointerKind } from '@automata/editor/kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { AfSector, AfSectorEntry } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { LevelProfile } from '../profile/level-profile'
import { SectorAccessError } from '../profile/sector-access'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { toyBlockout } from '../testing/toy-blockout'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanPointer } from './plan-controller'
import { createSplitTool, type SplitToolOptions } from './split-tool-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(level: AfSector = depot, camera = CAMERA, options: SplitToolOptions = {}) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  editor.view.set({ camera })
  const tool = createSplitTool(editor, SIZE, options)
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

/** A tool whose cut has started on the hall's north wall at x = 3. */
function started(level: AfSector = depot, options: SplitToolOptions = {}) {
  const made = setup(level, CAMERA, options)
  made.tool.tap(made.at(3, 0.1))
  return made
}

const room = (
  id: string,
  corners: AfSectorEntry['corners'],
  more: Partial<AfSectorEntry> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
  ...more,
})

/** An elbow: the notch is the quarter from (3, 3) to (8, 8). */
const ELL: AfSector = toyAfSector({
  sectors: [
    room('ell', [
      [0, 0],
      [8, 0],
      [8, 3],
      [3, 3],
      [3, 8],
      [0, 8],
    ]),
  ],
})

/** A plaza from (0, 0) to (10, 10) with a hole in the middle. */
const PLAZA: AfSector = toyAfSector({
  sectors: [
    room(
      'plaza',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      {
        holes: [
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
          ],
        ],
      },
    ),
  ],
})
const MIDDLE = { x: 5, z: 5, zoom: 1 }

const sectorIds = (editor: ReturnType<typeof setup>['editor']): string[] =>
  afSectorProfile.sectors.list(editor.level).map((each) => each.id)

describe('the start of a cut under the pointer', () => {
  it('names the sector and the wall, its length, where along it and the point to start the cut', () => {
    const { tool, at } = setup()
    tool.hover(at(3.02, 0.1))
    expect(tool.view.target).toEqual({
      kind: 'wall',
      sector: 'hall',
      corner: 0,
      selection: 'wall:hall/0',
      length: 8,
      along: 3,
      point: { x: 3, z: 0 },
      action: 'start',
    })
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.cut).toBeUndefined()
  })

  it('rounds the place to 5 cm, 1 cm with Shift, and keeps it as it is with Alt', () => {
    const { tool, at } = setup()
    tool.hover(at(3.017, 0.1))
    expect(tool.view.target).toMatchObject({ along: 3.0, point: { x: 3, z: 0 } })
    tool.hover(at(3.017, 0.1, 'mouse', { shift: true }))
    expect(tool.view.target).toMatchObject({ along: 3.02, point: { x: 3.02, z: 0 } })
    tool.hover(at(3.017, 0.1, 'mouse', { alt: true }))
    expect(tool.view.target).toMatchObject({ along: 3.017, point: { x: 3.017, z: 0 } })
  })

  it('names the corner under the pointer, which wins over the wall beside it', () => {
    const { tool, at } = setup()
    tool.hover(at(0.05, 0.05))
    expect(tool.view.target).toEqual({
      kind: 'corner',
      sector: 'hall',
      corner: 0,
      point: { x: 0, z: 0 },
      action: 'start',
    })
    tool.hover(at(0.15, 0.02))
    expect(tool.view.target).toMatchObject({ kind: 'corner', corner: 0 })
  })

  it("answers within the pointer kind's reach: 8 px for a mouse, 12 for a Pencil, 22 for a finger", () => {
    const { tool, at } = setup()
    tool.hover(at(3, 0.3, 'mouse'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(3, 0.3, 'pen'))
    expect(tool.view.target).toMatchObject({ kind: 'wall' })
    tool.hover(at(3, 0.5, 'pen'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(3, 0.5, 'touch'))
    expect(tool.view.target).toMatchObject({ kind: 'wall' })
  })

  it('answers nothing over a sector fill, or in a hidden or a locked walls layer', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(4, 3))
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ hidden: ['walls'] })
    tool.hover(at(3, 0.1))
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['walls'] })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ locked: [] })
    tool.hover(at(3, 0.1))
    expect(tool.view.target).toMatchObject({ action: 'start' })
  })

  it("is the model's sentence for a sector that cannot be cut by any line", () => {
    const level = toyBlockout()
    const editor = createLevelEditor({ profile: lastLightProfile, level })
    editor.view.set({ camera: { x: 3.5, z: 2, zoom: 1 } })
    const tool = createSplitTool(editor, SIZE)
    const pointer: PlanPointer = {
      ...toScreen(planViewport(editor.view.state.camera, SIZE), { x: 2, z: 0.1 }),
      kind: 'mouse',
    }
    tool.hover(pointer)
    expect(tool.view.target).toMatchObject({
      sector: 'a',
      action: 'none',
      reason: 'a cannot be cut while something is tied to its walls: opening ab (a → b)',
    })
    tool.tap(pointer)
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.refusal).toBe('a cannot be cut while something is tied to its walls: opening ab (a → b)')
    // The pointer stays where it was tapped, so the view goes on showing what was refused.
    expect(tool.view.target).toMatchObject({ sector: 'a', action: 'none' })
  })
})

describe('the end of a cut', () => {
  it('is placed by the first tap, which fixes the sector and clears the target until the pointer moves', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(3.02, 0.1))
    tool.tap(at(3.02, 0.1))
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 3, z: 0 } })
    expect(tool.view.target).toBeUndefined()
    expect(tool.view.cut).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(false)
  })

  it('shows the cut from the start to the target, and what a tap would do', () => {
    const { tool, at } = started()
    tool.hover(at(3, 5.9))
    expect(tool.view.target).toEqual({
      kind: 'wall',
      sector: 'hall',
      corner: 2,
      selection: 'wall:hall/2',
      length: 8,
      along: 5,
      point: { x: 3, z: 6 },
      action: 'cut',
    })
    expect(tool.view.cut).toEqual({ a: { x: 3, z: 0 }, b: { x: 3, z: 6 }, length: 6 })
  })

  it('can be a corner', () => {
    const { tool, at } = started()
    tool.hover(at(0.05, 5.95))
    expect(tool.view.target).toMatchObject({ kind: 'corner', sector: 'hall', corner: 3, action: 'cut' })
    expect(tool.view.cut).toMatchObject({ b: { x: 0, z: 6 } })
  })

  it('says the same point when the pointer is back on the start, and shows a cut of no length', () => {
    const { tool, at } = started()
    tool.hover(at(3.02, 0.1))
    expect(tool.view.target).toMatchObject({
      action: 'none',
      reason: 'the cut starts and ends at the same point',
    })
    expect(tool.view.cut).toEqual({ a: { x: 3, z: 0 }, b: { x: 3, z: 0 }, length: 0 })
  })

  it('says a cut along a wall of the sector runs along it', () => {
    const { tool, at } = started()
    tool.hover(at(5, 0.1))
    expect(tool.view.target).toMatchObject({ action: 'none', reason: 'the cut runs along a wall of hall' })
  })

  it('says a point of another sector is not on the outline of the one being cut', () => {
    const { tool, at } = started()
    tool.hover(at(13.9, 3))
    expect(tool.view.target).toMatchObject({
      sector: 'dock',
      action: 'none',
      reason: 'that point is not on the outline of hall',
    })
    // The cut is still shown, so a person sees where it would have gone.
    expect(tool.view.cut).toMatchObject({ b: { x: 14, z: 3 } })
  })

  it('is a point on the line that two rooms share, from the side of the other room', () => {
    const { tool, at } = started()
    tool.hover(at(8.1, 3))
    expect(tool.view.target).toMatchObject({ sector: 'dock', point: { x: 8, z: 3 }, action: 'cut' })
    expect(tool.view.cut).toMatchObject({ length: 5.831 })
  })

  it('says a cut through a hole crosses it', () => {
    const { tool, at } = setup(PLAZA, MIDDLE)
    tool.tap(at(5, 0.1))
    tool.hover(at(5, 9.9))
    expect(tool.view.target).toMatchObject({ action: 'none', reason: 'that cut crosses a hole of plaza' })
    tool.hover(at(2, 9.9))
    expect(tool.view.target).toMatchObject({ action: 'cut' })
  })

  it('says a cut across a notch does not stay inside the sector', () => {
    const { tool, at } = setup(ELL, { x: 4, z: 4, zoom: 1 })
    tool.tap(at(7.95, 2.95))
    expect(tool.view.start).toEqual({ sector: 'ell', point: { x: 8, z: 3 } })
    tool.hover(at(2.95, 7.95))
    expect(tool.view.target).toMatchObject({
      kind: 'corner',
      corner: 4,
      action: 'none',
      reason: 'that cut does not stay inside ell',
    })
  })

  it('keeps the start while the pointer leaves, and shows no target or cut', () => {
    const { tool, at } = started()
    tool.hover(at(3, 5.9))
    tool.leave()
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 3, z: 0 } })
    expect(tool.view.target).toBeUndefined()
    expect(tool.view.cut).toBeUndefined()
  })

  it('is dropped by cancel, which clears the sentence too', () => {
    const { tool, at } = started()
    tool.tap(at(5, 0.1))
    expect(tool.view.refusal).toBe('the cut runs along a wall of hall')
    tool.cancel()
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    // Nothing is started: the next tap starts a cut again.
    tool.tap(at(5, 0.1))
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 5, z: 0 } })
  })
})

describe('what a tap would do is what the edit would do', () => {
  it('never disagrees with the tap: what it says would cut does, and what it says would not changes nothing', () => {
    const spots = [
      [3, 5.9],
      [5, 5.9],
      [0.05, 5.95],
      [7.95, 5.95],
      [7.9, 2],
      [8.1, 4],
      [0.1, 3],
      [0.1, 2],
      [5, 0.1],
      [3.02, 0.1],
      [13.9, 3],
      [10, 6.1],
      [4, 3],
    ] as const
    for (const [x, z] of spots) {
      const hovered = started()
      hovered.tool.hover(hovered.at(x, z))
      const said = hovered.tool.view.target
      const tapped = started()
      tapped.tool.tap(tapped.at(x, z))
      const cut = said?.action === 'cut'
      expect({ spot: [x, z], changed: tapped.editor.history.canUndo }).toEqual({ spot: [x, z], changed: cut })
    }
  })
})

describe('the view', () => {
  it('follows the camera, the canvas size and an edit of the level under the pointer', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(4, 6.1))
    expect(tool.view.target).toMatchObject({ sector: 'hall', corner: 2 })
    tool.resize({ w: 400, h: 400 })
    expect(tool.view.target).toMatchObject({ sector: 'dock', corner: 2 })
    tool.resize(SIZE)
    editor.view.set({ camera: { x: 7, z: 3, zoom: 2 } })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ camera: CAMERA })
    tool.leave()
    expect(tool.view.target).toBeUndefined()
  })

  it('is the same view while nothing changed, and tells a listener only when it did', () => {
    const { tool, at } = setup()
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

  it('stops telling a listener that unsubscribed, and stops following the editor when disposed', () => {
    const { editor, tool, at } = setup()
    const listener = vi.fn()
    const stop = tool.subscribe(listener)
    tool.hover(at(4, 6.1))
    stop()
    tool.hover(at(5, 6.1))
    expect(listener).toHaveBeenCalledTimes(1)
    const other = vi.fn()
    tool.subscribe(other)
    tool.dispose()
    const before = tool.view
    editor.view.set({ camera: { x: 7, z: 3, zoom: 2 } })
    editor.history.apply('x', () => ({ level: ELL }))
    expect(other).not.toHaveBeenCalled()
    expect(tool.view).toBe(before)
  })
})

describe('a tap', () => {
  it('cuts the sector from the start to the tap, as one undo step, and selects the two halves', () => {
    const { editor, tool, at } = started()
    tool.tap(at(3, 5.9))
    // x = 3 from the north wall to the south wall: the hall keeps the larger east part.
    expect(sectorIds(editor)).toEqual(['hall', 'sector-1', 'dock'])
    expect(editor.history.undoLabel).toBe('Split hall into hall and sector-1')
    expect(editor.selection.ids).toEqual(['sector:hall', 'sector:sector-1'])
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('leaves the pointer showing what a tap there would do next', () => {
    const { tool, at } = started()
    tool.tap(at(3, 5.9))
    // The cut made a corner of both halves there.
    expect(tool.view.target).toMatchObject({ kind: 'corner', point: { x: 3, z: 6 }, action: 'start' })
  })

  it('splits the other side of a portal that the cut meets, in the same step', () => {
    const { editor, tool, at } = setup()
    // From the portal wall at z = 2 to the west wall at z = 2, clear of the door.
    tool.tap(at(7.9, 2))
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 8, z: 2 } })
    tool.tap(at(0.1, 2))
    expect(sectorIds(editor)).toEqual(['hall', 'sector-1', 'dock'])
    const dock = afSectorProfile.sectors.list(editor.level).find((each) => each.id === 'dock')
    expect(
      dock?.corners.map(([x, z, wall]) => [x, z, typeof wall === 'object' ? wall.next : undefined]),
    ).toEqual([
      [8, 0, undefined],
      [14, 0, undefined],
      [14, 6, undefined],
      [8, 6, 'hall'],
      [8, 2, 'sector-1'],
    ])
    const openings = afSectorProfile.checks(editor.level).find((result) => result.id === 'openings')
    expect(openings?.ok).toBe(true)
    expect(editor.history.undoLabel).toBe('Split hall into hall and sector-1')
    editor.history.undo()
    expect(editor.level).toEqual(depot)
  })

  it('names the new sector by the id option, or the lowest free sector-N', () => {
    const named = started(depot, { id: () => 'annex' })
    named.tool.tap(named.at(3, 5.9))
    expect(sectorIds(named.editor)).toEqual(['hall', 'annex', 'dock'])
    expect(named.editor.history.undoLabel).toBe('Split hall into hall and annex')
    const taken = setup(
      toyAfSector({
        sectors: [
          room('sector-1', [
            [20, 0],
            [24, 0],
            [24, 4],
            [20, 4],
          ]),
          ...depot.sectors,
        ],
      }),
    )
    taken.tool.tap(taken.at(3, 0.1))
    taken.tool.tap(taken.at(3, 5.9))
    expect(sectorIds(taken.editor)).toEqual(['sector-1', 'hall', 'sector-2', 'dock'])
  })

  it('keeps the id with the half that runs from the start to the end when the halves are the same size', () => {
    const { editor, tool, at } = setup(ELL, { x: 4, z: 4, zoom: 1 })
    // Corner to corner across the elbow: two halves of 19.5 m².
    tool.tap(at(3.05, 3.05))
    tool.tap(at(0.05, 0.05))
    const ids = (id: string) =>
      afSectorProfile.sectors
        .list(editor.level)
        .find((each) => each.id === id)
        ?.corners.map(([x, z]) => [x, z])
    expect(ids('ell')).toEqual([
      [0, 0],
      [3, 3],
      [3, 8],
      [0, 8],
    ])
    editor.history.undo()
    tool.tap(at(0.05, 0.05))
    tool.tap(at(3.05, 3.05))
    expect(ids('ell')).toEqual([
      [0, 0],
      [8, 0],
      [8, 3],
      [3, 3],
    ])
  })

  it('changes nothing off every wall and corner, and clears the sentence', () => {
    const { editor, tool, at } = started()
    tool.tap(at(5, 0.1))
    expect(tool.view.refusal).toBeDefined()
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBeUndefined()
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 3, z: 0 } })
    expect(editor.history.canUndo).toBe(false)
  })

  it('changes nothing on a cut the model refuses, keeps the start and says why', () => {
    const { editor, tool, at } = started()
    tool.tap(at(5, 0.1))
    expect(tool.view.refusal).toBe('the cut runs along a wall of hall')
    expect(tool.view.start).toEqual({ sector: 'hall', point: { x: 3, z: 0 } })
    // The pointer is still where it was tapped, so the view goes on showing the cut that was refused.
    expect(tool.view.target).toMatchObject({ point: { x: 5, z: 0 }, action: 'none' })
    expect(tool.view.cut).toMatchObject({ a: { x: 3, z: 0 }, b: { x: 5, z: 0 }, length: 2 })
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the sentence while the pointer stays on that point, and clears it on another point and on leave', () => {
    const { tool, at } = started()
    tool.tap(at(5, 0.1))
    tool.hover(at(5.01, 0.12))
    expect(tool.view.refusal).toBe('the cut runs along a wall of hall')
    tool.hover(at(6, 0.1))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(5, 0.1))
    tool.leave()
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence on empty ground', () => {
    const { tool, at } = started()
    tool.tap(at(5, 0.1))
    tool.hover(at(4, 3))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the first tap’s sentence for the other sector that has a corner at the same point', () => {
    const level = toyAfSector({
      sectors: [
        room('a', [
          [0, 0, { next: 'a' }],
          [8, 0],
          [8, 6],
          [0, 6],
        ]),
        room('b', [
          [8, 0],
          [14, 0],
          [14, 6],
          [8, 6],
        ]),
      ],
    })
    const { tool, at } = setup(level)
    tool.tap(at(7.95, 5.95))
    expect(tool.view.refusal).toBe('a has a portal into itself')
    tool.hover(at(8.05, 5.95))
    expect(tool.view.target).toMatchObject({ sector: 'b', action: 'start' })
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence when the next tap works', () => {
    const { tool, at } = started()
    tool.tap(at(5, 0.1))
    tool.tap(at(3, 5.9))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('is refused at the first tap for a sector that cannot be cut, with no start', () => {
    const loop = toyAfSector({
      sectors: [
        room('a', [
          [0, 0, { next: 'a' }],
          [8, 0],
          [8, 6],
          [0, 6],
        ]),
      ],
    })
    const { tool, at } = setup(loop)
    tool.tap(at(4, 6.1))
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.refusal).toBe('a has a portal into itself')
  })

  it('says what the profile says when it will not write the level, and leaves nothing open', () => {
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
    const tool = createSplitTool(editor, SIZE)
    const at = (x: number, z: number): PlanPointer => ({
      ...toScreen(planViewport(CAMERA, SIZE), { x, z }),
      kind: 'mouse',
    })
    tool.tap(at(3, 0.1))
    tool.tap(at(3, 5.9))
    expect(tool.view.refusal).toBe('the profile will not write it')
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('says what the history says when another step is open, and leaves that step open', () => {
    const { editor, tool, at } = started()
    const other = editor.begin('a drag')
    tool.tap(at(3, 5.9))
    expect(tool.view.refusal).toBeDefined()
    expect(other.open).toBe(true)
    other.cancel()
    expect(editor.level).toEqual(depot)
  })
})

describe('the start dies with the level it was placed on', () => {
  it('is dropped by an edit', () => {
    const { editor, tool } = started()
    editor.history.apply('x', () => ({ level: ELL }))
    expect(tool.view.start).toBeUndefined()
  })

  it('is dropped by an undo and by a redo', () => {
    const { editor, tool, at } = started()
    tool.tap(at(3, 5.9))
    editor.history.undo()
    tool.tap(at(3, 0.1))
    expect(tool.view.start).toBeDefined()
    editor.history.redo()
    expect(tool.view.start).toBeUndefined()
    expect(sectorIds(editor)).toEqual(['hall', 'sector-1', 'dock'])
  })

  it('is dropped with the sentence a refused tap gave', () => {
    const { editor, tool, at } = started()
    tool.tap(at(5, 0.1))
    expect(tool.view.refusal).toBeDefined()
    editor.history.apply('x', () => ({ level: ELL }))
    expect(tool.view.start).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
  })
})

describe('on a Last Light level', () => {
  const made = () => {
    const level: Blockout = toyBlockout({ openings: [] })
    const editor = createLevelEditor({ profile: lastLightProfile, level })
    editor.view.set({ camera: { x: 3.5, z: 2, zoom: 1 } })
    const tool = createSplitTool(editor, SIZE)
    const at = (x: number, z: number): PlanPointer => ({
      ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
      kind: 'mouse',
    })
    return { editor, tool, at }
  }

  it('cuts a room in two, and one undo takes it back', () => {
    const { editor, tool, at } = made()
    tool.tap(at(2, 0.1))
    tool.tap(at(2, 3.9))
    expect(editor.level.rooms.map((each) => each.id)).toEqual(['a', 'sector-1', 'b'])
    expect(editor.history.undoLabel).toBe('Split a into a and sector-1')
    editor.history.undo()
    expect(editor.level).toEqual(toyBlockout({ openings: [] }))
  })
})
