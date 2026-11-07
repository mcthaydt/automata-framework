// The Vertex tool (ED3D.6d): from the pointer over a wall or a corner on the plan to what a tap does there, which is
// `insertCorner` on a wall and `removeCorner` on a corner. The depot is the level: the hall runs from (0, 0) to (8, 6) and
// the dock from (8, 0) to (14, 6), joined by a portal along x = 8; the hall has a window on its north wall (corner 0) and a
// door on its west wall (corner 3). The canvas is 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a
// metre; pixel positions are made with `toScreen`, so no test hides a unit.

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import type { PointerKind } from '@automata/editor/kit/core'
import { describe, expect, it, vi } from 'vitest'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { LevelProfile } from '../profile/level-profile'
import { SectorAccessError } from '../profile/sector-access'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanPointer } from './plan-controller'
import { createVertexTool } from './vertex-tool-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(level: AfSector = depot, camera = CAMERA) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  editor.view.set({ camera })
  const tool = createVertexTool(editor, SIZE)
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

/** The depot's hall with a corner at (4, 6) on its south wall: a corner that can go. */
const ROOMY: AfSector = toyAfSector({
  sectors: [
    {
      ...toyHall,
      corners: [
        [0, 0],
        [8, 0, { next: 'dock' }],
        [8, 6],
        [4, 6],
        [0, 6],
      ],
    },
    toyDock,
  ],
})

/** West of the hall, over the hall's west wall (which starts at its corner 3); the east wall is the annex's corner 1. */
const ANNEX: AfSectorEntry['corners'] = [
  [-6, 0],
  [0, 0],
  [0, 6],
  [-6, 6],
]

describe('the wall under the pointer', () => {
  it('names the sector and corner of the wall, its length, where along it and the point to put a corner', () => {
    const { tool, at } = setup()
    tool.hover(at(5.93, 6.1))
    expect(tool.view.target).toEqual({
      kind: 'wall',
      sector: 'hall',
      corner: 2,
      selection: 'wall:hall/2',
      length: 8,
      along: 2.05,
      point: { x: 5.95, z: 6 },
      action: 'add',
    })
  })

  it("measures from the wall's start corner as the document writes it", () => {
    const forward = setup(toyAfSector({ sectors: [toyHall, toyDock, sector('annex', ANNEX)] }))
    forward.tool.hover(forward.at(-0.1, 2))
    // The wall over the hall's west wall: the annex's (0, 0) to (0, 6), or the hall's (0, 6) to (0, 0), by the pointer's side.
    expect(forward.tool.view.target).toMatchObject({
      sector: 'annex',
      corner: 1,
      along: 2,
      point: { x: 0, z: 2 },
    })
    const turned = setup(toyAfSector({ sectors: [toyHall, toyDock, sector('annex', [...ANNEX].reverse())] }))
    turned.tool.hover(turned.at(-0.1, 2))
    expect(turned.tool.view.target).toMatchObject({
      sector: 'annex',
      corner: 1,
      along: 4,
      point: { x: 0, z: 2 },
    })
  })

  it('rounds the place to 5 cm, 1 cm with Shift, and keeps it as it is with Alt', () => {
    const { tool, at } = setup()
    // 5.93 m on the south wall is 2.07 m from its start at (8, 6).
    tool.hover(at(5.93, 6.1))
    expect(tool.view.target).toMatchObject({ along: 2.05, point: { x: 5.95, z: 6 } })
    tool.hover(at(5.93, 6.1, 'mouse', { shift: true }))
    expect(tool.view.target).toMatchObject({ along: 2.07, point: { x: 5.93, z: 6 } })
    tool.hover(at(5.934, 6.1, 'mouse', { alt: true }))
    expect(tool.view.target).toMatchObject({ along: 2.066, point: { x: 5.934, z: 6 } })
  })

  it('puts the point on a wall that is not along an axis', () => {
    const slanted = setup(
      toyAfSector({
        sectors: [
          sector('room', [
            [0, 0],
            [4, 4],
            [0, 4],
          ]),
        ],
      }),
    )
    slanted.tool.hover(slanted.at(2, 2.2, 'touch', { alt: true }))
    expect(slanted.tool.view.target).toMatchObject({ corner: 0, action: 'add', length: 5.6569 })
    const point = slanted.tool.view.target?.point
    expect(Math.abs((point?.x ?? 0) - (point?.z ?? 1))).toBeLessThan(1e-4)
    // To four decimals, as every edit writes a coordinate: no floating-point tail.
    expect(point?.x).toBe(Math.round((point?.x ?? 0) * 1e4) / 1e4)
    expect(point?.z).toBe(Math.round((point?.z ?? 0) * 1e4) / 1e4)
  })

  it('keeps the place within the wall when rounding would take it past the end', () => {
    const long = toyAfSector({
      sectors: [
        sector('room', [
          [0, 0],
          [8, 0],
          [8, 6.048],
          [0, 6.048],
        ]),
      ],
    })
    // At the closest zoom a mouse reaches 2 cm from a corner: 6.0265 m along a wall of 6.048 m is beyond that, and
    // rounds to 6.05 m, which the wall's end holds back to its own.
    const { tool, at } = setup(long, { x: 7.5, z: 6, zoom: 12.5 })
    tool.hover(at(8, 6.0265))
    expect(tool.view.target).toMatchObject({
      kind: 'wall',
      corner: 1,
      length: 6.048,
      along: 6.048,
      point: { x: 8, z: 6.048 },
      action: 'none',
      reason: 'that point is already a corner',
    })
  })

  it('answers nothing on the masonry a pilaster adds, which is no wall of the document', () => {
    const level = toyAfSector({
      sectors: [
        sector('room', [
          [0, 0, { pilaster: { start: [1, 0.5] } }],
          [8, 0],
          [8, 6],
          [0, 6],
        ]),
      ],
    })
    const { tool, at } = setup(level)
    // The pilaster's face is 0.5 m into the room: 16 px from the wall itself.
    tool.hover(at(0.5, 0.52))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, -0.1))
    expect(tool.view.target).toMatchObject({ kind: 'wall', corner: 0 })
  })

  it("answers within the pointer kind's reach: 8 px for a mouse, 12 for a Pencil, 22 for a finger", () => {
    const { tool, at } = setup()
    // 0.4375 m is 14 px off the hall's south wall.
    tool.hover(at(4, 6.4375, 'mouse'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 6.4375, 'pen'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 6.4375, 'touch'))
    expect(tool.view.target).toMatchObject({ kind: 'wall', sector: 'hall', corner: 2 })
  })

  it('takes the wall of the sector the pointer is in when two lie on one line', () => {
    const { tool, at } = setup()
    tool.hover(at(7.95, 3))
    expect(tool.view.target).toMatchObject({ kind: 'wall', selection: 'wall:hall/1' })
    tool.hover(at(8.05, 3))
    expect(tool.view.target).toMatchObject({ kind: 'wall', selection: 'wall:dock/3' })
  })

  it('answers nothing over a sector fill, or away from every wall and corner', () => {
    const { tool, at } = setup()
    tool.hover(at(4, 3))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(30, 30))
    expect(tool.view.target).toBeUndefined()
  })
})

describe('the corner under the pointer', () => {
  it('names the sector and the corner, as the document numbers it, and where it is', () => {
    const { tool, at } = setup(ROOMY)
    tool.hover(at(4.1, 6.1))
    expect(tool.view.target).toEqual({
      kind: 'corner',
      sector: 'hall',
      corner: 3,
      point: { x: 4, z: 6 },
      action: 'remove',
    })
  })

  it('wins over the wall beside it, and gives way to the wall beyond its reach', () => {
    const { tool, at } = setup(ROOMY)
    // 4.5 px from the corner, and 10 px along the wall.
    tool.hover(at(4.1, 6.1))
    expect(tool.view.target?.kind).toBe('corner')
    // East of the corner it is the wall that runs to it from (8, 6), west of it the wall that starts there.
    tool.hover(at(4.3125, 6.1))
    expect(tool.view.target).toMatchObject({ kind: 'wall', corner: 2 })
    tool.hover(at(3.6875, 6.1))
    expect(tool.view.target).toMatchObject({ kind: 'wall', corner: 3 })
  })

  it('answers within the pointer kind’s reach', () => {
    const { tool, at } = setup(ROOMY)
    // 14 px from the corner, and 14 px from the wall.
    tool.hover(at(4, 6.4375, 'mouse'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 6.4375, 'touch'))
    expect(tool.view.target).toMatchObject({ kind: 'corner', sector: 'hall', corner: 3 })
  })

  it('is the corner of the sector that holds the pointer when two sectors have one at a point', () => {
    const { tool, at } = setup()
    tool.hover(at(7.95, 0.05))
    expect(tool.view.target).toMatchObject({ kind: 'corner', sector: 'hall', corner: 1 })
    tool.hover(at(8.05, 0.05))
    expect(tool.view.target).toMatchObject({ kind: 'corner', sector: 'dock', corner: 0 })
  })

  it('answers nothing in a hidden or a locked walls layer, for a wall or a corner', () => {
    const { editor, tool, at } = setup(ROOMY)
    editor.view.set({ hidden: ['walls'] })
    tool.hover(at(4.1, 6.1))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(2, 6.1))
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['walls'] })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ locked: [] })
    tool.hover(at(4.1, 6.1))
    expect(tool.view.target).toMatchObject({ kind: 'corner', corner: 3 })
  })
})

describe('what a tap would do is what the edit would do', () => {
  const target = (x: number, z: number, level: AfSector = depot, camera = CAMERA) => {
    const { tool, at } = setup(level, camera)
    tool.hover(at(x, z))
    return tool.view.target
  }

  it('is add on a wall and remove on a corner that can go', () => {
    expect(target(2, 6.1)?.action).toBe('add')
    expect(target(4.1, 6.1, ROOMY)?.action).toBe('remove')
  })

  it('is the model’s sentence for a corner that cannot go', () => {
    expect(target(7.95, 5.95)).toMatchObject({
      kind: 'corner',
      sector: 'hall',
      corner: 2,
      action: 'none',
      reason: 'the walls at corner 2 of hall lead into dock: make them solid first',
    })
    expect(target(0.05, 5.95)).toMatchObject({
      kind: 'corner',
      sector: 'hall',
      corner: 3,
      action: 'none',
      reason: 'the joined wall is too short for its door',
    })
    const triangle = toyAfSector({
      sectors: [
        sector('tri', [
          [0, 0],
          [6, 0],
          [0, 6],
        ]),
      ],
    })
    expect(target(5.95, 0.05, triangle)).toMatchObject({
      kind: 'corner',
      action: 'none',
      reason: 'a sector needs at least three corners',
    })
  })

  it('is the model’s sentence for a wall that cannot take a corner there', () => {
    // The window on the hall's north wall is centred 4 m from its start and 1.6 m wide.
    expect(target(4, -0.1)).toMatchObject({
      kind: 'wall',
      sector: 'hall',
      corner: 0,
      along: 4,
      action: 'none',
      reason: 'the new corner would cut through the window',
    })
    expect(target(2, -0.1)?.action).toBe('add')
  })

  it('says a point that rounds onto the end of a wall is already a corner', () => {
    // At the closest zoom (400 px to a metre) a mouse reaches 8 px, 2 cm, and 2.25 cm along the wall rounds to its end.
    const camera = { x: 7.5, z: 6, zoom: 12.5 }
    expect(target(7.9775, 6, depot, camera)).toMatchObject({
      kind: 'wall',
      sector: 'hall',
      corner: 2,
      along: 0,
      action: 'none',
      reason: 'that point is already a corner',
    })
  })

  it('never disagrees with the tap: what it says would work does, and what it says would not changes nothing', () => {
    const spots = [
      [2, 6.1],
      [5.93, 6.1],
      [4, -0.1],
      [2, -0.1],
      [0.1, 4.2],
      [0.1, 3],
      [7.95, 3],
      [8.05, 3],
      [7.95, 5.95],
      [0.05, 5.95],
      [-0.05, 0.05],
      [13.95, 3],
      [10, 6.1],
    ] as const
    for (const [x, z] of spots) {
      const hovered = setup()
      hovered.tool.hover(hovered.at(x, z))
      const said = hovered.tool.view.target
      const tapped = setup()
      tapped.tool.tap(tapped.at(x, z))
      const works = said?.action === 'add' || said?.action === 'remove'
      expect({ spot: [x, z], changed: tapped.editor.history.canUndo }).toEqual({
        spot: [x, z],
        changed: works,
      })
    }
  })
})

describe('the view', () => {
  it('clears when the pointer leaves, and follows the camera and the canvas size', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(4, 6.1))
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
    const { editor, tool, at } = setup(ROOMY)
    tool.hover(at(4.1, 6.1))
    expect(tool.view.target).toMatchObject({ kind: 'corner', action: 'remove' })
    editor.history.apply('x', () => ({ level: depot }))
    expect(tool.view.target).toMatchObject({ kind: 'wall', corner: 2, action: 'add' })
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

  it('stops following the editor when disposed', () => {
    const { editor, tool, at } = setup()
    const listener = vi.fn()
    tool.subscribe(listener)
    tool.hover(at(4, 6.1))
    tool.dispose()
    listener.mockClear()
    const before = tool.view
    editor.view.set({ camera: { x: 7, z: 3, zoom: 2 } })
    editor.history.apply('x', () => ({ level: ROOMY }))
    expect(listener).not.toHaveBeenCalled()
    expect(tool.view).toBe(before)
  })

  it('stops telling a listener that unsubscribed', () => {
    const { tool, at } = setup()
    const listener = vi.fn()
    const stop = tool.subscribe(listener)
    tool.hover(at(4, 6.1))
    stop()
    tool.hover(at(5, 6.1))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('a tap', () => {
  const corners = (editor: ReturnType<typeof setup>['editor'], id: string) =>
    afSectorProfile.sectors.list(editor.level).find((each) => each.id === id)?.corners

  /** Whether a step is open: a session begun now comes back closed. A probe that did open is cancelled, so it leaves nothing. */
  const stepOpen = (editor: ReturnType<typeof setup>['editor']): boolean => {
    const probe = editor.begin('probe')
    const open = !probe.open
    probe.cancel()
    return open
  }

  it('puts a corner on a wall where the pointer is, as one undo step, and selects the two walls it made', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(5.93, 6.1))
    expect(corners(editor, 'hall')?.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [8, 0],
      [8, 6],
      [5.95, 6],
      [0, 6],
    ])
    expect(editor.history.undoLabel).toBe('Add a corner to wall 2 of hall')
    expect(editor.selection.ids).toEqual(['wall:hall/2', 'wall:hall/3'])
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('splits both sides of a portal in the same step', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(7.95, 3))
    expect(corners(editor, 'hall')?.[2]).toEqual([8, 3, { next: 'dock' }])
    expect(corners(editor, 'dock')?.[4]).toEqual([8, 3, { next: 'hall' }])
    expect(editor.history.undoLabel).toBe('Add a corner to wall 1 of hall')
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('takes a corner away, as one undo step, and selects the wall it made', () => {
    const { editor, tool, at } = setup(ROOMY)
    tool.tap(at(4.1, 6.1))
    expect(corners(editor, 'hall')?.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [8, 0],
      [8, 6],
      [0, 6],
    ])
    expect(editor.history.undoLabel).toBe('Remove corner 3 of hall')
    expect(editor.selection.ids).toEqual(['wall:hall/2'])
    editor.history.undo()
    expect(editor.level).toEqual(ROOMY)
    expect(editor.history.canUndo).toBe(false)
  })

  it('finds the corner it just made under the pointer, and a second tap takes it away', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(4, 6.1))
    expect(tool.view.target).toMatchObject({ kind: 'corner', sector: 'hall', corner: 3, action: 'remove' })
    tool.tap(at(4, 6.1))
    expect(editor.level).toEqual(depot)
    expect(editor.history.undoLabel).toBe('Remove corner 3 of hall')
    editor.history.undo()
    expect(editor.history.undoLabel).toBe('Add a corner to wall 2 of hall')
  })

  it('changes nothing on a corner that cannot go, and says why', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(7.95, 5.95))
    expect(tool.view.refusal).toBe('the walls at corner 2 of hall lead into dock: make them solid first')
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('changes nothing on a wall that cannot take a corner there, and says why', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(4, -0.1))
    expect(tool.view.refusal).toBe('the new corner would cut through the window')
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
    expect(stepOpen(editor)).toBe(false)
  })

  it('changes nothing off every wall and corner, and clears the sentence', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(7.95, 5.95))
    expect(tool.view.refusal).toBeDefined()
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the sentence while the pointer stays on that corner, and clears it on another target and on leave', () => {
    const { tool, at } = setup()
    tool.tap(at(7.95, 5.95))
    tool.hover(at(7.96, 5.96))
    expect(tool.view.refusal).toBeDefined()
    tool.hover(at(4, 6.1))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(7.95, 5.95))
    tool.leave()
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence on another corner of the same sector, and on empty ground', () => {
    const { tool, at } = setup()
    tool.tap(at(7.95, 5.95))
    expect(tool.view.refusal).toBeDefined()
    // The hall's corner 3, (0, 6), is refused too, with a sentence of its own.
    tool.hover(at(0.05, 5.95))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(7.95, 5.95))
    tool.hover(at(4, 3))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('keeps the sentence for a wall while the pointer moves along it', () => {
    const { tool, at } = setup()
    tool.tap(at(4, -0.1))
    tool.hover(at(4.2, -0.1))
    expect(tool.view.refusal).toBe('the new corner would cut through the window')
  })

  it('clears the sentence when the next tap works', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(7.95, 5.95))
    tool.tap(at(2, 6.1))
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(true)
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
    const tool = createVertexTool(editor, SIZE)
    tool.tap({ ...toScreen(planViewport(CAMERA, SIZE), { x: 2, z: 6.1 }), kind: 'mouse' })
    expect(tool.view.refusal).toBe('the profile will not write it')
    expect(editor.level).toEqual(depot)
    expect(stepOpen(editor)).toBe(false)
  })

  it('says what the history says when another step is open, and leaves that step open', () => {
    const { editor, tool, at } = setup()
    const other = editor.begin('a drag')
    tool.tap(at(2, 6.1))
    expect(tool.view.refusal).toBeDefined()
    expect(other.open).toBe(true)
    other.cancel()
    expect(editor.level).toEqual(depot)
  })
})
