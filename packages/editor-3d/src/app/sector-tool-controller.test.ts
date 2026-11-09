// The Sector tool (ED3D.6a): drawing a sector on the plan, from the first tap to the portal offers. The depot is the level:
// the hall runs from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a portal along x = 8. The canvas is
// 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with
// `toScreen`, so no test hides a unit. The grid is the view's default, half a metre.
import type { PointerKind } from '@automataframework/automata-editor/kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { moveSector } from '../model/corner-edits'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { LevelProfile } from '../profile/level-profile'
import { SectorAccessError } from '../profile/sector-access'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import { toyBlockout } from '../testing/toy-blockout'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanPointer } from './plan-controller'
import { createSectorTool, type SectorToolOptions } from './sector-tool-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(
  level: AfSector = depot,
  options?: SectorToolOptions,
  profile: LevelProfile<AfSector> = afSectorProfile,
) {
  const editor = createLevelEditor({ profile, level })
  editor.view.set({ camera: CAMERA })
  const tool = createSectorTool(editor, SIZE, options)
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (
    x: number,
    z: number,
    kind: PointerKind = 'mouse',
    keys: Pick<PlanPointer, 'shift' | 'alt'> = {},
  ): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
    ...keys,
  })
  return { editor, tool, at }
}

/** Hovers a point, then taps it: what the pointer would place, and the corners after the tap. */
function place(tool: ReturnType<typeof setup>['tool'], pointer: PlanPointer) {
  tool.hover(pointer)
  const snap = tool.view.snap
  tool.tap(pointer)
  return snap
}

describe('placing corners', () => {
  it('adds the point of a tap rounded to the grid, which the hover said before it', () => {
    const { tool, at } = setup()
    expect(place(tool, at(-3.2, 9.3))).toMatchObject({ x: -3, z: 9.5, kind: 'grid' })
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
  })

  it('snaps to a corner of a sector, then a wall line, before the grid', () => {
    const { tool, at } = setup()
    // 0.1 m is 3.2 px: inside a mouse's reach of the hall's corner (8, 6) and of its south wall.
    expect(place(tool, at(8.1, 6.1))?.kind).toBe('vertex')
    expect(tool.view.corners).toEqual([{ x: 8, z: 6 }])
    expect(place(tool, at(4.2, 6.1))).toMatchObject({ kind: 'wall', target: 'wall:hall/2' })
    expect(tool.view.corners[1]).toEqual({ x: 4.2, z: 6 })
  })

  it('goes onto the horizontal or vertical through the last corner when the pointer is near it', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    // 0.05 m is 1.6 px off the horizontal through the last corner.
    expect(place(tool, at(-1.2, 9.55))?.kind).toBe('axis')
    expect(tool.view.corners[1]).toEqual({ x: -1, z: 9.5 })
  })

  it('takes the fine step with Shift and no snap with Alt', () => {
    const { tool, at } = setup()
    expect(place(tool, at(-3.22, 9.33, 'mouse', { shift: true }))?.kind).toBe('data')
    expect(tool.view.corners[0]).toEqual({ x: -3.22, z: 9.33 })
    expect(place(tool, at(-1.234, 9.876, 'mouse', { alt: true }))?.kind).toBe('free')
    expect(tool.view.corners[1]?.x).toBeCloseTo(-1.234, 3)
  })

  it("snaps as far as the pointer kind reaches: a finger's 22 px to a wall, a mouse's 8", () => {
    const { editor, tool, at } = setup()
    editor.view.set({ grid: { step: 0.5, snap: false } })
    // 0.45 m is 14.4 px off the hall's south wall.
    tool.hover(at(4.2, 6.45, 'mouse'))
    expect(tool.view.snap?.kind).toBe('data')
    tool.hover(at(4.2, 6.45, 'touch'))
    expect(tool.view.snap).toMatchObject({ x: 4.2, z: 6, kind: 'wall' })
  })

  it('does not snap to a wall of a layer that is locked either', () => {
    const { editor, tool, at } = setup()
    editor.view.set({ grid: { step: 0.5, snap: false } })
    editor.view.toggle('locked', 'walls')
    tool.hover(at(4, 6.1))
    expect(tool.view.snap).toMatchObject({ z: 6.1, kind: 'data' })
  })

  it('does not snap to a wall of a layer that is hidden', () => {
    const { editor, tool, at } = setup()
    editor.view.set({ grid: { step: 0.5, snap: false } })
    tool.tap(at(4, 6.1))
    expect(tool.view.corners[0]).toEqual({ x: 4, z: 6 })
    tool.cancel()
    editor.view.toggle('hidden', 'walls')
    tool.tap(at(4, 6.1))
    expect(tool.view.corners[0]).toEqual({ x: 4, z: 6.1 })
  })

  it('refuses a tap on a point that is a corner already, and adds nothing', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(-1, 11))
    tool.tap(at(-1, 11))
    expect(tool.view.corners).toHaveLength(2)
    expect(tool.view.refusal).toBe('that point is already a corner')
    // The first corner is one too, until there are three to close.
    tool.tap(at(-3, 9.5))
    expect(tool.view.corners).toHaveLength(2)
    expect(tool.view.refusal).toBe('that point is already a corner')
  })

  it('clears the sentence when the next corner is added', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(-3, 9.5))
    expect(tool.view.refusal).toBeDefined()
    tool.tap(at(-1, 11))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('does not touch the level', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(-1, 11))
    expect(editor.level).toBe(depot)
    expect(editor.history.canUndo).toBe(false)
  })
})

describe('what the pointer would place', () => {
  it('shows the snap target of a hover, and the pending edge to it with its length', () => {
    const { tool, at } = setup()
    tool.hover(at(-3.2, 9.3))
    expect(tool.view.snap).toMatchObject({ x: -3, z: 9.5 })
    // No corner yet: no edge to show.
    expect(tool.view.edges).toEqual([])
    tool.tap(at(-3, 9.5))
    tool.hover(at(1, 9.5))
    expect(tool.view.edges).toEqual([{ a: { x: -3, z: 9.5 }, b: { x: 1, z: 9.5 }, length: 4, pending: true }])
  })

  it('lists the placed edges with their lengths, then the pending one', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.tap(at(0, 13.5))
    tool.hover(at(-3, 13.5))
    expect(tool.view.edges).toEqual([
      { a: { x: -3, z: 9.5 }, b: { x: 0, z: 9.5 }, length: 3, pending: false },
      { a: { x: 0, z: 9.5 }, b: { x: 0, z: 13.5 }, length: 4, pending: false },
      { a: { x: 0, z: 13.5 }, b: { x: -3, z: 13.5 }, length: 3, pending: true },
    ])
  })

  it('shows no pending edge when the pointer is on the last corner, and rounds a length to a tenth of a millimetre', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(-2, 11.5))
    expect(tool.view.edges).toEqual([
      { a: { x: -3, z: 9.5 }, b: { x: -2, z: 11.5 }, length: 2.2361, pending: false },
    ])
  })

  it('takes a tap as where the pointer is, with no hover before it', () => {
    const { tool, at } = setup()
    tool.tap(at(-3.2, 9.3))
    expect(tool.view.snap).toBeDefined()
  })

  it('follows the level: moving a sector under the pointer moves the snap target', () => {
    const { editor, tool, at } = setup()
    // Near the hall's corner (0, 0) the target is that corner; after the sector moves by a metre it is no longer there.
    tool.hover(at(0.1, 0.1))
    expect(tool.view.snap).toMatchObject({ x: 0, z: 0, kind: 'vertex' })
    editor.run(moveSector({ id: 'hall', dx: -1, dz: 0 }))
    expect(tool.view.snap?.kind).not.toBe('vertex')
  })

  it('goes when the pointer leaves', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.hover(at(1, 9.5))
    tool.leave()
    expect(tool.view.snap).toBeUndefined()
    expect(tool.view.edges).toEqual([])
  })

  it('follows the camera: the same pixel snaps to another point once the plan is panned', () => {
    const { editor, tool, at } = setup()
    const pointer = at(-3.2, 9.3)
    tool.hover(pointer)
    expect(tool.view.snap).toMatchObject({ x: -3, z: 9.5 })
    editor.view.set({ camera: { x: 8, z: 3, zoom: 1 } })
    expect(tool.view.snap).toMatchObject({ x: -2, z: 9.5 })
  })

  it('tells the subscribers once for a change and not for a repeat', () => {
    const { tool, at } = setup()
    const told = vi.fn()
    tool.subscribe(told)
    tool.hover(at(-3, 9.5))
    expect(told).toHaveBeenCalledTimes(1)
    tool.hover(at(-3, 9.5))
    expect(told).toHaveBeenCalledTimes(1)
    tool.hover(at(-2, 9.5))
    expect(told).toHaveBeenCalledTimes(2)
  })

  it('stops telling a subscriber that has stopped, and all of them when it is disposed', () => {
    const { tool, at } = setup()
    const [first, second] = [vi.fn(), vi.fn()]
    const stop = tool.subscribe(first)
    tool.subscribe(second)
    stop()
    tool.hover(at(-3, 9.5))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    tool.dispose()
    tool.hover(at(-2, 9.5))
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('closing, as the view says it', () => {
  const triangle = (tool: ReturnType<typeof setup>['tool'], at: ReturnType<typeof setup>['at']): void => {
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.tap(at(0, 13.5))
  }

  it('is closing only with three corners and the pointer within reach of the first', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.hover(at(-3, 9.5))
    expect(tool.view.closing).toBe(false)
    tool.tap(at(0, 13.5))
    tool.hover(at(-3, 9.5))
    expect(tool.view.closing).toBe(true)
    tool.hover(at(-3, 12))
    expect(tool.view.closing).toBe(false)
  })

  it("reaches as far as the pointer kind does: a mouse's 8 px, a finger's 22", () => {
    const { tool, at } = setup()
    triangle(tool, at)
    // 0.45 m is 14.4 px.
    tool.hover(at(-3, 9.95, 'mouse'))
    expect(tool.view.closing).toBe(false)
    tool.hover(at(-3, 9.95, 'touch'))
    expect(tool.view.closing).toBe(true)
  })

  it('closes at exactly the reach and not a hair past it', () => {
    const { tool, at } = setup()
    triangle(tool, at)
    // 0.25 m is 8 px, a mouse's reach exactly.
    tool.hover(at(-3, 9.75))
    expect(tool.view.closing).toBe(true)
    tool.hover(at(-3, 9.76))
    expect(tool.view.closing).toBe(false)
  })

  it('is not closing with no pointer over the plan', () => {
    const { tool, at } = setup()
    triangle(tool, at)
    tool.hover(at(-3, 9.5))
    tool.leave()
    expect(tool.view.closing).toBe(false)
  })
})

describe('the loupe and the nudge pad', () => {
  it('shows the snapped point under a Pencil and nothing under a mouse or a finger', () => {
    const { tool, at } = setup()
    tool.hover(at(-3.2, 9.3, 'pen'))
    expect(tool.view.loupe).toEqual({ x: -3, z: 9.5 })
    tool.hover(at(-3.2, 9.3, 'mouse'))
    expect(tool.view.loupe).toBeUndefined()
    tool.hover(at(-3.2, 9.3, 'touch'))
    expect(tool.view.loupe).toBeUndefined()
    tool.hover(at(-3.2, 9.3, 'pen'))
    tool.leave()
    expect(tool.view.loupe).toBeUndefined()
  })

  it('moves the last corner by whole steps of the grid, and shows it in the loupe', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.nudge(1, -2)
    expect(tool.view.corners).toEqual([
      { x: -3, z: 9.5 },
      { x: 0.5, z: 8.5 },
    ])
    expect(tool.view.loupe).toEqual({ x: 0.5, z: 8.5 })
    editor.view.set({ grid: { step: 0.25, snap: true } })
    tool.nudge(-3, 0)
    expect(tool.view.corners[1]).toEqual({ x: -0.25, z: 8.5 })
  })

  it('rounds a nudge to the data step, so a corner never drifts', () => {
    const { editor, tool, at } = setup()
    editor.view.set({ grid: { step: 0.1, snap: false } })
    tool.tap(at(-3.2, 9.3, 'mouse', { shift: true }))
    for (let i = 0; i < 7; i++) tool.nudge(1, 0)
    expect(tool.view.corners[0]).toEqual({ x: -2.5, z: 9.3 })
  })

  it('has the loupe go on the next hover, and with the tap that places the next corner', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.nudge(1, 0)
    expect(tool.view.loupe).toBeDefined()
    tool.hover(at(0, 9.5, 'mouse'))
    expect(tool.view.loupe).toBeUndefined()
    tool.nudge(1, 0)
    tool.tap(at(0, 13.5))
    expect(tool.view.loupe).toBeUndefined()
    tool.nudge(1, 0)
    tool.leave()
    expect(tool.view.loupe).toBeUndefined()
    tool.nudge(1, 0)
    tool.cancel()
    expect(tool.view.loupe).toBeUndefined()
  })

  it('refuses a nudge with no corner placed', () => {
    const { tool } = setup()
    tool.nudge(1, 0)
    expect(tool.view.corners).toEqual([])
    expect(tool.view.refusal).toBe('place a corner first')
  })

  it('does not move the last corner onto another one', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(-2.5, 9.5))
    tool.nudge(-1, 0)
    expect(tool.view.corners[1]).toEqual({ x: -2.5, z: 9.5 })
    expect(tool.view.refusal).toBe('that point is already a corner')
  })
})

describe('taking a corner back and starting again', () => {
  it('takes the last corner back, and the sentence and the loupe with it', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.nudge(1, 0)
    tool.undoCorner()
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
    expect(tool.view.loupe).toBeUndefined()
    tool.tap(at(-3, 9.5))
    expect(tool.view.refusal).toBeDefined()
    tool.undoCorner()
    tool.undoCorner()
    expect(tool.view.corners).toEqual([])
    expect(tool.view.refusal).toBeUndefined()
  })

  it('drops every corner on cancel', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.tap(at(-3, 9.5))
    expect(tool.view.refusal).toBeDefined()
    tool.cancel()
    expect(tool.view.corners).toEqual([])
    expect(tool.view.refusal).toBeUndefined()
  })

  it('keeps the same view object when nothing changes', () => {
    const { tool, at } = setup()
    tool.hover(at(-3, 9.5))
    const view = tool.view
    tool.hover(at(-3, 9.5))
    tool.undoCorner()
    tool.cancel()
    expect(tool.view).toBe(view)
  })

  it('moves with a canvas of another size, which the camera does not follow', () => {
    const { tool, at } = setup()
    const pointer = at(-3, 9.5)
    tool.hover(pointer)
    tool.resize({ w: 400, h: 200 })
    // The camera keeps its centre, so the same pixel is a different point on a smaller canvas.
    expect(tool.view.snap).not.toMatchObject({ x: -3, z: 9.5 })
  })
})

describe('closing the outline', () => {
  /** A triangle south of the depot, which touches nothing. */
  const draw = (tool: ReturnType<typeof setup>['tool'], at: ReturnType<typeof setup>['at']): void => {
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.tap(at(0, 13.5))
  }
  const sectorOf = (editor: ReturnType<typeof setup>['editor'], id: string) =>
    afSectorProfile.sectors.list(editor.level as AfSector).find((each) => each.id === id)

  it('adds the sector as one undo step, selects it and clears the drawing', () => {
    const { editor, tool, at } = setup()
    draw(tool, at)
    tool.close()
    expect(sectorOf(editor, 'sector-1')?.corners).toEqual([
      [-3, 9.5],
      [0, 9.5],
      [0, 13.5],
    ])
    expect(editor.history.undoLabel).toBe('Draw sector sector-1')
    expect(editor.selection.ids).toEqual(['sector:sector-1'])
    expect(tool.view).toMatchObject({ corners: [], edges: [], refusal: undefined, closing: false })
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('closes with a tap on the first corner too, and that tap places no corner', () => {
    const { editor, tool, at } = setup()
    draw(tool, at)
    tool.hover(at(-3, 9.5))
    expect(tool.view.closing).toBe(true)
    tool.tap(at(-3, 9.5))
    expect(sectorOf(editor, 'sector-1')?.corners).toHaveLength(3)
    expect(tool.view.corners).toEqual([])
  })

  it('names the sector the lowest free sector-N, or what the options say', () => {
    const { editor, tool, at } = setup(
      toyAfSector({
        sectors: [
          toyHall,
          toyDock,
          {
            ...toyDock,
            id: 'sector-2',
            corners: [
              [20, 0],
              [24, 0],
              [24, 4],
              [20, 4],
            ],
          },
        ],
      }),
    )
    draw(tool, at)
    tool.close()
    expect(sectorOf(editor, 'sector-1')).toBeDefined()
    tool.tap(at(8, 14))
    tool.tap(at(11, 14))
    tool.tap(at(11, 18))
    tool.close()
    expect(sectorOf(editor, 'sector-3')).toBeDefined()
    const named = setup(depot, { id: (taken) => `annex-${taken.length}` })
    draw(named.tool, named.at)
    named.tool.close()
    expect(sectorOf(named.editor, 'annex-2')).toBeDefined()
    expect(named.editor.history.undoLabel).toBe('Draw sector annex-2')
  })

  it('takes the heights and the light of the sector the selection names, else the last sector', () => {
    const fresh = () => {
      const made = setup()
      draw(made.tool, made.at)
      return made
    }
    const plain = fresh()
    plain.tool.close()
    // The depot's last sector is the dock: half a metre down, light 0.7.
    expect(sectorOf(plain.editor, 'sector-1')).toMatchObject({ floor: -0.5, ceiling: 4, light: 0.7 })
    const bySector = fresh()
    bySector.editor.selection.set(['sector:hall'])
    bySector.tool.close()
    expect(sectorOf(bySector.editor, 'sector-1')).toMatchObject({ floor: 0, light: 1 })
    const byWall = fresh()
    byWall.editor.selection.set(['wall:hall/2'])
    byWall.tool.close()
    expect(sectorOf(byWall.editor, 'sector-1')).toMatchObject({ floor: 0, light: 1 })
    const several = fresh()
    several.editor.selection.set(['sector:hall', 'sector:dock'])
    several.tool.close()
    expect(sectorOf(several.editor, 'sector-1')).toMatchObject({ floor: -0.5, light: 0.7 })
  })

  it('refuses fewer than three corners, and keeps them', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.close()
    expect(tool.view.refusal).toBe('a sector needs at least three corners')
    expect(tool.view.corners).toHaveLength(2)
    expect(editor.level).toBe(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('refuses an outline that crosses itself, and one that overlaps a sector, with the model sentences', () => {
    const crossing = setup()
    crossing.tool.tap(crossing.at(-3, 9.5))
    crossing.tool.tap(crossing.at(0, 13.5))
    crossing.tool.tap(crossing.at(0, 9.5))
    crossing.tool.tap(crossing.at(-3, 13.5))
    crossing.tool.close()
    expect(crossing.tool.view.refusal).toBe('the outline crosses itself')
    const over = setup()
    over.tool.tap(over.at(2, 2))
    over.tool.tap(over.at(4, 2))
    over.tool.tap(over.at(3, 4))
    over.tool.close()
    expect(over.tool.view.refusal).toBe('the new sector overlaps hall')
    for (const made of [crossing, over]) {
      expect(made.tool.view.corners.length).toBeGreaterThan(2)
      expect(made.editor.level).toBe(depot)
      expect(made.editor.history.canUndo).toBe(false)
      expect(made.editor.history.undoLabel).toBeUndefined()
    }
  })

  it('has a refusal go with the next change of the drawing, and lets a second close succeed', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.close()
    expect(tool.view.refusal).toBeDefined()
    tool.tap(at(0, 13.5))
    expect(tool.view.refusal).toBeUndefined()
    tool.close()
    expect(sectorOf(editor, 'sector-1')).toBeDefined()
  })

  it('refuses while another step is open, keeps the corners, and closes once it is over', () => {
    const { editor, tool, at } = setup()
    draw(tool, at)
    const other = editor.begin('Something else')
    tool.close()
    expect(tool.view.refusal).toBeDefined()
    expect(tool.view.corners).toHaveLength(3)
    other.cancel()
    tool.close()
    expect(sectorOf(editor, 'sector-1')).toBeDefined()
    expect(tool.view.refusal).toBeUndefined()
  })

  it('adds a room to a Last Light level', () => {
    const editor = createLevelEditor({ profile: lastLightProfile, level: toyBlockout() })
    editor.view.set({ camera: { x: 0, z: 0, zoom: 1 } })
    const tool = createSectorTool(editor, SIZE)
    const at = (x: number, z: number): PlanPointer => ({
      ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
      kind: 'mouse',
    })
    tool.tap(at(-8, 8))
    tool.tap(at(-5, 8))
    tool.tap(at(-5, 11))
    tool.close()
    expect(lastLightProfile.sectors.list(editor.level).map((room) => room.id)).toContain('sector-1')
    expect(editor.history.undoLabel).toBe('Draw sector sector-1')
  })
})

describe('the portal offers', () => {
  type Made = ReturnType<typeof setup>
  /** A sector west of the hall: its east wall is over the hall's west wall (the hall's wall 3, which has a door). */
  const drawAnnex = ({ tool, at }: Made): void => {
    for (const [x, z] of [
      [-6, 0],
      [0, 0],
      [0, 6],
      [-6, 6],
    ] as const)
      tool.tap(at(x, z))
    tool.close()
  }
  /** A sector south of both rooms, with one wall over each of their south walls. */
  const drawSouth = ({ tool, at }: Made): void => {
    for (const [x, z] of [
      [0, 6],
      [8, 6],
      [14, 6],
      [14, 10],
      [0, 10],
    ] as const)
      tool.tap(at(x, z))
    tool.close()
  }
  const wall = (made: Made, sector: string, corner: number) =>
    afSectorProfile.sectors.list(made.editor.level as AfSector).find((each) => each.id === sector)?.corners[
      corner
    ]?.[2]
  /** Whether a step is open: a session begun now comes back closed. A probe that did open is cancelled, so it leaves nothing. */
  const stepOpen = (made: Made): boolean => {
    const probe = made.editor.begin('probe')
    const open = !probe.open
    probe.cancel()
    return open
  }

  it('puts the sector in the level and leaves the step open with the offers, when a wall is over a neighbour wall', () => {
    const made = setup()
    drawAnnex(made)
    expect(made.tool.view.offers).toEqual([
      { sector: 'sector-1', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
    expect(wall(made, 'sector-1', 1)).toBeUndefined()
    expect(stepOpen(made)).toBe(true)
    expect(made.tool.view.corners).toEqual([])
    expect(made.editor.selection.ids).toEqual(['sector:sector-1'])
  })

  it('makes both sides portals when an offer is accepted, and ends the step with the last offer as one undo step', () => {
    const made = setup()
    drawAnnex(made)
    made.tool.acceptOffer(0)
    expect(wall(made, 'sector-1', 1)).toEqual({ next: 'hall' })
    // The hall's wall had a door, which a portal takes off.
    expect(wall(made, 'hall', 3)).toEqual({ next: 'sector-1' })
    expect(made.tool.view.offers).toEqual([])
    expect(stepOpen(made)).toBe(false)
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
    expect(made.editor.history.canUndo).toBe(false)
  })

  it('leaves the wall solid when an offer is declined, and ends the step with the last offer', () => {
    const made = setup()
    drawAnnex(made)
    made.tool.declineOffer(0)
    expect(wall(made, 'sector-1', 1)).toBeUndefined()
    expect(wall(made, 'hall', 3)).toEqual({ door: { at: 3, width: 1.2, height: 2.2 } })
    expect(stepOpen(made)).toBe(false)
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
  })

  it('answers offers one at a time, in any order, and ends the step with the last', () => {
    const made = setup()
    drawSouth(made)
    expect(made.tool.view.offers.map((offer) => offer.to)).toEqual(['hall', 'dock'])
    made.tool.acceptOffer(1)
    expect(made.tool.view.offers.map((offer) => offer.to)).toEqual(['hall'])
    expect(stepOpen(made)).toBe(true)
    expect(wall(made, 'sector-1', 1)).toEqual({ next: 'dock' })
    expect(wall(made, 'sector-1', 0)).toBeUndefined()
    made.tool.declineOffer(0)
    expect(stepOpen(made)).toBe(false)
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
  })

  it('accepts every offer in order with acceptAll, as one step', () => {
    const made = setup()
    drawSouth(made)
    made.tool.acceptAll()
    expect(wall(made, 'sector-1', 0)).toEqual({ next: 'hall' })
    expect(wall(made, 'sector-1', 1)).toEqual({ next: 'dock' })
    expect(wall(made, 'hall', 2)).toEqual({ next: 'sector-1' })
    expect(wall(made, 'dock', 2)).toEqual({ next: 'sector-1' })
    expect(made.tool.view.offers).toEqual([])
    expect(stepOpen(made)).toBe(false)
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
    expect(made.editor.history.canUndo).toBe(false)
  })

  it('declines what is left and ends the step on finish', () => {
    const made = setup()
    drawSouth(made)
    made.tool.acceptOffer(0)
    made.tool.finish()
    expect(wall(made, 'sector-1', 0)).toEqual({ next: 'hall' })
    expect(wall(made, 'sector-1', 1)).toBeUndefined()
    expect(made.tool.view.offers).toEqual([])
    expect(stepOpen(made)).toBe(false)
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
  })

  it('takes the sector away with cancel, and leaves nothing to undo', () => {
    const made = setup()
    drawSouth(made)
    made.tool.acceptOffer(0)
    made.tool.cancel()
    expect(made.editor.level).toEqual(depot)
    expect(made.tool.view.offers).toEqual([])
    expect(stepOpen(made)).toBe(false)
    expect(made.editor.history.canUndo).toBe(false)
  })

  it('ends the drawing when an undo ends the step, and can draw again', () => {
    const made = setup()
    drawAnnex(made)
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
    expect(made.tool.view.offers).toEqual([])
    drawAnnex(made)
    expect(made.tool.view.offers).toHaveLength(1)
  })

  it('keeps an offer that is refused, with the sentence, and lets the rest go on', () => {
    // The profile refuses the second write of sectors, which is the portal of the first offer.
    let writes = 0
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        withSectors(level, sectors) {
          writes++
          if (writes > 1) throw new SectorAccessError('the profile will not write it')
          return afSectorProfile.sectors.withSectors(level, sectors)
        },
      },
    }
    const made = setup(depot, undefined, profile)
    drawAnnex(made)
    made.tool.acceptOffer(0)
    expect(made.tool.view.refusal).toBe('the profile will not write it')
    expect(made.tool.view.offers).toHaveLength(1)
    expect(stepOpen(made)).toBe(true)
    made.tool.finish()
    expect(wall(made, 'sector-1', 1)).toBeUndefined()
    expect(made.tool.view.refusal).toBeUndefined()
    expect(stepOpen(made)).toBe(false)
  })

  it('forgets the sentence of a refused offer when the next offer is answered', () => {
    let writes = 0
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        withSectors(level, sectors) {
          writes++
          if (writes > 1) throw new SectorAccessError('the profile will not write it')
          return afSectorProfile.sectors.withSectors(level, sectors)
        },
      },
    }
    const made = setup(depot, undefined, profile)
    drawSouth(made)
    made.tool.acceptOffer(0)
    expect(made.tool.view.refusal).toBe('the profile will not write it')
    made.tool.declineOffer(1)
    expect(made.tool.view.refusal).toBeUndefined()
    expect(made.tool.view.offers.map((offer) => offer.to)).toEqual(['hall'])
  })

  it('stops acceptAll at the first refusal', () => {
    let writes = 0
    const profile: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        withSectors(level, sectors) {
          writes++
          if (writes > 2) throw new SectorAccessError('no more')
          return afSectorProfile.sectors.withSectors(level, sectors)
        },
      },
    }
    const made = setup(depot, undefined, profile)
    drawSouth(made)
    made.tool.acceptAll()
    expect(made.tool.view.refusal).toBe('no more')
    expect(made.tool.view.offers.map((offer) => offer.to)).toEqual(['dock'])
    expect(wall(made, 'sector-1', 0)).toEqual({ next: 'hall' })
  })

  it('ignores a tap, a nudge, a close and a corner taken back while offering, and says why', () => {
    const made = setup()
    drawAnnex(made)
    for (const act of [
      () => made.tool.tap(made.at(-3, 9.5)),
      () => made.tool.nudge(1, 0),
      () => made.tool.close(),
      () => made.tool.undoCorner(),
    ]) {
      act()
      expect(made.tool.view.refusal).toBe('answer the portal offers first')
      expect(made.tool.view.corners).toEqual([])
      expect(made.tool.view.offers).toHaveLength(1)
    }
    // A hover still follows the pointer.
    made.tool.hover(made.at(-3, 9.5))
    expect(made.tool.view.snap).toBeDefined()
  })

  it('answers nothing for an offer that is not there, or when there are none', () => {
    const made = setup()
    made.tool.acceptOffer(0)
    made.tool.declineOffer(0)
    made.tool.acceptAll()
    made.tool.finish()
    expect(made.tool.view.refusal).toBeUndefined()
    drawAnnex(made)
    made.tool.acceptOffer(3)
    made.tool.declineOffer(-1)
    expect(made.tool.view.offers).toHaveLength(1)
    expect(made.tool.view.refusal).toBeUndefined()
  })

  it('ends an open offering with its sector kept when the tool is disposed', () => {
    const made = setup()
    drawAnnex(made)
    made.tool.dispose()
    expect(stepOpen(made)).toBe(false)
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
  })

  it('commits at once when a sector has no neighbour wall to offer a portal for', () => {
    const made = setup()
    for (const [x, z] of [
      [-3, 9.5],
      [0, 9.5],
      [0, 13.5],
    ] as const)
      made.tool.tap(made.at(x, z))
    made.tool.close()
    expect(made.tool.view.offers).toEqual([])
    expect(stepOpen(made)).toBe(false)
  })
})
