// The Merge tool (ED3D.6f): from the pointer over a sector on the plan to what a tap does there, which is to pick the
// sector that stays and then to run `mergeSectors` with the sector under the second tap. The level is a hall from (0, 0) to
// (8, 6) and a dock from (8, 0) to (14, 6) of the same heights, joined by a portal along x = 8, with a yard east of the dock
// where a third room can lead into it. The depot is the same pair at different floors, which a merge refuses. The canvas is
// 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with
// `toScreen`, so no test hides a unit.

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
import { createMergeTool } from './merge-tool-controller'
import type { PlanPointer } from './plan-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

const room = (id: string, corners: AfSectorEntry['corners']): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
})

/** The hall and the dock at the same heights. */
const PAIR: AfSector = toyAfSector({ sectors: [toyHall, { ...toyDock, floor: 0 }] })

/** The pair with a yard east of the dock, which leads into it (and the dock into the yard). */
const WITH_YARD: AfSector = toyAfSector({
  sectors: [
    toyHall,
    {
      ...toyDock,
      floor: 0,
      corners: [
        [8, 0],
        [14, 0, { next: 'yard' }],
        [14, 6],
        [8, 6, { next: 'hall' }],
      ],
    },
    room('yard', [
      [14, 0],
      [18, 0],
      [18, 6],
      [14, 6, { next: 'dock' }],
    ]),
  ],
})

function setup(level: AfSector = PAIR, camera = CAMERA) {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  editor.view.set({ camera })
  const tool = createMergeTool(editor, SIZE)
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (x: number, z: number, pointerKind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind: pointerKind,
  })
  return { editor, tool, at }
}

/** A tool whose first tap has picked the hall as the room that stays. */
function started(level: AfSector = PAIR) {
  const made = setup(level)
  made.tool.tap(made.at(4, 3))
  return made
}

const sectorIds = (editor: ReturnType<typeof setup>['editor']): string[] =>
  afSectorProfile.sectors.list(editor.level).map((each) => each.id)

describe('the sector to keep under the pointer', () => {
  it('names the sector that holds the pointer and says a tap picks it', () => {
    const { tool, at } = setup()
    tool.hover(at(4, 3))
    expect(tool.view.target).toEqual({ sector: 'hall', action: 'keep' })
    tool.hover(at(11, 3))
    expect(tool.view.target).toEqual({ sector: 'dock', action: 'keep' })
    expect(tool.view.keep).toBeUndefined()
  })

  it('takes the sector the pointer is in at a wall that two rooms share', () => {
    const { tool, at } = setup()
    tool.hover(at(7.9, 3))
    expect(tool.view.target).toMatchObject({ sector: 'hall' })
    tool.hover(at(8.1, 3))
    expect(tool.view.target).toMatchObject({ sector: 'dock' })
  })

  it("answers within the pointer kind's reach of a wall: 8 px for a mouse, 12 for a Pencil, 22 for a finger", () => {
    const { tool, at } = setup()
    // West of the hall, 0.4 m (12.8 px) outside its west wall.
    tool.hover(at(-0.4, 3, 'mouse'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(-0.4, 3, 'pen'))
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(-0.4, 3, 'touch'))
    expect(tool.view.target).toEqual({ sector: 'hall', action: 'keep' })
  })

  it('answers nothing away from every sector', () => {
    const { tool, at } = setup()
    tool.hover(at(-4, 3))
    expect(tool.view.target).toBeUndefined()
  })

  it('answers nothing in a hidden or a locked sectors layer, and only the fill without the walls layer', () => {
    const { editor, tool, at } = setup()
    editor.view.set({ hidden: ['sectors'] })
    tool.hover(at(4, 3))
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['sectors'] })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ locked: [], hidden: ['walls'] })
    expect(tool.view.target).toMatchObject({ sector: 'hall' })
    tool.hover(at(-0.4, 3, 'touch'))
    expect(tool.view.target).toBeUndefined()
  })

  it("is the model's sentence for a sector that something is tied to", () => {
    const tied: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        pinned: (_level, id) => (id === 'hall' ? ['door d (hall → dock)'] : []),
      },
    }
    const editor = createLevelEditor({ profile: tied, level: PAIR })
    editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
    const tool = createMergeTool(editor, SIZE)
    const pointer: PlanPointer = {
      ...toScreen(planViewport(editor.view.state.camera, SIZE), { x: 4, z: 3 }),
      kind: 'mouse',
    }
    tool.hover(pointer)
    const sentence = 'hall cannot be merged while something is tied to its walls: door d (hall → dock)'
    expect(tool.view.target).toEqual({ sector: 'hall', action: 'none', reason: sentence })
    tool.tap(pointer)
    expect(tool.view.keep).toBeUndefined()
    expect(tool.view.refusal).toBe(sentence)
    expect(tool.view.target).toMatchObject({ sector: 'hall', action: 'none' })
  })
})

describe('the sector to take in under the pointer', () => {
  it('is placed by the first tap, which clears the target until the pointer moves', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(4, 3))
    tool.tap(at(4, 3))
    expect(tool.view.keep).toBe('hall')
    expect(tool.view.target).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(false)
  })

  it('says a tap on the next door neighbour takes it in', () => {
    const { tool, at } = started()
    tool.hover(at(11, 3))
    expect(tool.view.target).toEqual({ sector: 'dock', action: 'merge' })
  })

  it('says a sector cannot be merged with itself', () => {
    const { tool, at } = started()
    tool.hover(at(4, 3))
    expect(tool.view.target).toEqual({
      sector: 'hall',
      action: 'none',
      reason: 'a sector cannot be merged with itself',
    })
  })

  it('says why two rooms with different floors cannot be one', () => {
    const { tool, at } = started(depot)
    tool.hover(at(11, 3))
    expect(tool.view.target).toMatchObject({
      sector: 'dock',
      action: 'none',
      reason: 'hall and dock have different floors (0 and -0.5): make them the same first',
    })
  })

  it('says a room with no wall in common has none', () => {
    const level = toyAfSector({
      sectors: [
        toyHall,
        { ...toyDock, floor: 0 },
        room('annex', [
          [15, 0],
          [19, 0],
          [19, 4],
          [15, 4],
        ]),
      ],
    })
    const { tool, at } = started(level)
    tool.hover(at(17, 2))
    expect(tool.view.target).toMatchObject({
      sector: 'annex',
      action: 'none',
      reason:
        'hall and annex have no wall in common: a shared wall runs between the same two corners in both',
    })
  })

  it('keeps the first sector while the pointer leaves, and shows no target', () => {
    const { tool, at } = started()
    tool.hover(at(11, 3))
    tool.leave()
    expect(tool.view.keep).toBe('hall')
    expect(tool.view.target).toBeUndefined()
  })

  it('is dropped by cancel, which clears the sentence too', () => {
    const { tool, at } = started()
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBe('a sector cannot be merged with itself')
    tool.cancel()
    expect(tool.view.keep).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    // Nothing is picked: the next tap picks a room that stays again.
    tool.tap(at(11, 3))
    expect(tool.view.keep).toBe('dock')
  })
})

describe('what a tap would do is what the edit would do', () => {
  it('never disagrees with the tap: what it says would merge does, and what it says would not changes nothing', () => {
    const spots = [
      [11, 3],
      [4, 3],
      [8.1, 3],
      [7.9, 3],
      [17, 3],
      [-0.1, 3],
      [14.1, 3],
      [-4, 3],
    ] as const
    for (const [x, z] of spots) {
      const hovered = started(WITH_YARD)
      hovered.tool.hover(hovered.at(x, z))
      const said = hovered.tool.view.target
      const tapped = started(WITH_YARD)
      tapped.tool.tap(tapped.at(x, z))
      const merges = said?.action === 'merge'
      expect({ spot: [x, z], changed: tapped.editor.history.canUndo }).toEqual({
        spot: [x, z],
        changed: merges,
      })
    }
  })
})

describe('the view', () => {
  it('follows the camera, the canvas size and an edit of the level under the pointer', () => {
    const { editor, tool, at } = setup()
    tool.hover(at(4, 3))
    expect(tool.view.target).toMatchObject({ sector: 'hall' })
    // The camera keeps its centre when the canvas narrows: the same pixel is now 6.25 m further east, on the dock.
    tool.resize({ w: 400, h: 400 })
    expect(tool.view.target).toMatchObject({ sector: 'dock' })
    tool.resize(SIZE)
    expect(tool.view.target).toMatchObject({ sector: 'hall' })
    // Moved 13 m east, the same pixel is past the dock.
    editor.view.set({ camera: { x: 20, z: 3, zoom: 1 } })
    expect(tool.view.target).toBeUndefined()
    editor.view.set({ camera: CAMERA })
    tool.leave()
    expect(tool.view.target).toBeUndefined()
    tool.hover(at(4, 3))
    editor.history.apply('x', () => ({ level: WITH_YARD }))
    expect(tool.view.target).toMatchObject({ sector: 'hall', action: 'keep' })
  })

  it('is the same view while nothing changed, and tells a listener only when it did', () => {
    const { tool, at } = setup()
    const listener = vi.fn()
    tool.subscribe(listener)
    tool.hover(at(4, 3))
    const view = tool.view
    expect(listener).toHaveBeenCalledTimes(1)
    tool.hover(at(4, 3))
    expect(tool.view).toBe(view)
    expect(listener).toHaveBeenCalledTimes(1)
    tool.hover(at(11, 3))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stops telling a listener that unsubscribed, and stops following the editor when disposed', () => {
    const { editor, tool, at } = setup()
    const listener = vi.fn()
    const stop = tool.subscribe(listener)
    tool.hover(at(4, 3))
    stop()
    tool.hover(at(11, 3))
    expect(listener).toHaveBeenCalledTimes(1)
    const other = vi.fn()
    tool.subscribe(other)
    tool.dispose()
    const before = tool.view
    // Moved east, the pointer would be over nothing, if the tool were still following the camera.
    editor.view.set({ camera: { x: 30, z: 3, zoom: 1 } })
    editor.history.apply('x', () => ({ level: WITH_YARD }))
    expect(other).not.toHaveBeenCalled()
    expect(tool.view).toBe(before)
  })
})

describe('a tap', () => {
  it('takes the second sector into the first, as one undo step, and selects the one that stays', () => {
    const { editor, tool, at } = started()
    tool.tap(at(11, 3))
    expect(sectorIds(editor)).toEqual(['hall'])
    expect(
      afSectorProfile.sectors
        .list(editor.level)
        .find((each) => each.id === 'hall')
        ?.corners.map(([x, z]) => [x, z]),
    ).toEqual([
      [0, 0],
      [14, 0],
      [14, 6],
      [0, 6],
    ])
    expect(editor.history.undoLabel).toBe('Merge dock into hall')
    expect(editor.selection.ids).toEqual(['sector:hall'])
    expect(tool.view.keep).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
    editor.history.undo()
    expect(editor.level).toEqual(PAIR)
    expect(editor.history.canUndo).toBe(false)
  })

  it('leaves the pointer showing what a tap there would do next', () => {
    const { tool, at } = started()
    tool.tap(at(11, 3))
    expect(tool.view.target).toEqual({ sector: 'hall', action: 'keep' })
  })

  it('makes the walls elsewhere that led into the sector taken in lead into the one that stays', () => {
    const { editor, tool, at } = started(WITH_YARD)
    tool.tap(at(11, 3))
    expect(sectorIds(editor)).toEqual(['hall', 'yard'])
    const yard = afSectorProfile.sectors.list(editor.level).find((each) => each.id === 'yard')
    expect(yard?.corners.map((corner) => afSectorProfile.sectors.portalOf(editor.level, corner[2]))).toEqual([
      undefined,
      undefined,
      undefined,
      'hall',
    ])
    editor.history.undo()
    expect(editor.level).toEqual(WITH_YARD)
  })

  it('takes the second sector into the first whichever is tapped first', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(11, 3))
    tool.tap(at(4, 3))
    expect(sectorIds(editor)).toEqual(['dock'])
    expect(editor.history.undoLabel).toBe('Merge hall into dock')
  })

  it('changes nothing off every sector, and clears the sentence', () => {
    const { editor, tool, at } = started()
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBeDefined()
    tool.tap(at(-4, 3))
    expect(tool.view.refusal).toBeUndefined()
    expect(tool.view.keep).toBe('hall')
    expect(editor.history.canUndo).toBe(false)
  })

  it('changes nothing on a merge the model refuses, keeps the first sector and says why', () => {
    const { editor, tool, at } = started(depot)
    tool.tap(at(11, 3))
    expect(tool.view.refusal).toBe(
      'hall and dock have different floors (0 and -0.5): make them the same first',
    )
    expect(tool.view.keep).toBe('hall')
    // The pointer is still where it was tapped, so the view goes on showing the merge that was refused.
    expect(tool.view.target).toMatchObject({ sector: 'dock', action: 'none' })
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the sentence while the pointer stays on that sector, and clears it on another sector, empty ground and leave', () => {
    const { tool, at } = started()
    tool.tap(at(4, 3))
    tool.hover(at(5, 2))
    expect(tool.view.refusal).toBe('a sector cannot be merged with itself')
    tool.hover(at(11, 3))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(4, 3))
    tool.hover(at(-4, 3))
    expect(tool.view.refusal).toBeUndefined()
    tool.tap(at(4, 3))
    tool.leave()
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence when the next tap works', () => {
    const { tool, at } = started()
    tool.tap(at(4, 3))
    tool.tap(at(11, 3))
    expect(tool.view.refusal).toBeUndefined()
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
    const editor = createLevelEditor({ profile, level: PAIR })
    editor.view.set({ camera: CAMERA })
    const tool = createMergeTool(editor, SIZE)
    const at = (x: number, z: number): PlanPointer => ({
      ...toScreen(planViewport(CAMERA, SIZE), { x, z }),
      kind: 'mouse',
    })
    tool.tap(at(4, 3))
    tool.tap(at(11, 3))
    expect(tool.view.refusal).toBe('the profile will not write it')
    expect(editor.level).toEqual(PAIR)
    expect(editor.history.canUndo).toBe(false)
  })

  it('says what the history says when another step is open, and leaves that step open', () => {
    const { editor, tool, at } = started()
    const other = editor.begin('a drag')
    tool.tap(at(11, 3))
    expect(tool.view.refusal).toBeDefined()
    expect(other.open).toBe(true)
    other.cancel()
    expect(editor.level).toEqual(PAIR)
  })
})

describe('the first sector dies with the level it was picked on', () => {
  it('is dropped by an edit', () => {
    const { editor, tool } = started()
    editor.history.apply('x', () => ({ level: WITH_YARD }))
    expect(tool.view.keep).toBeUndefined()
  })

  it('is dropped by an undo and by a redo', () => {
    const { editor, tool, at } = started()
    tool.tap(at(11, 3))
    editor.history.undo()
    tool.tap(at(4, 3))
    expect(tool.view.keep).toBe('hall')
    editor.history.redo()
    expect(tool.view.keep).toBeUndefined()
    expect(sectorIds(editor)).toEqual(['hall'])
  })

  it('is dropped with the sentence a refused tap gave', () => {
    const { editor, tool, at } = started()
    tool.tap(at(4, 3))
    expect(tool.view.refusal).toBeDefined()
    editor.history.apply('x', () => ({ level: WITH_YARD }))
    expect(tool.view.keep).toBeUndefined()
    expect(tool.view.refusal).toBeUndefined()
  })
})
