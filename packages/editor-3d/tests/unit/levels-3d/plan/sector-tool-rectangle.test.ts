// The Sector tool's Rectangle shape (ED3D.6c): two taps span an axis-aligned room, and the rest is the Polygon shape's
// path. The depot is the level: the hall runs from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a
// portal along x = 8. The canvas is 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel
// positions are made with `toScreen`, so no test hides a unit. The grid is the view's default, half a metre.

import type { AfSector2File } from '@automata/3d/level'
import type { PointerKind } from '@automata/editor/kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { PlanPointer } from '#src/features/levels-3d/plan/plan-controller.ts'
import { planViewport, toScreen } from '#src/features/levels-3d/plan/plan-viewport.ts'
import {
  createSectorTool,
  type SectorToolOptions,
} from '#src/features/levels-3d/plan/sector-tool-controller.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depot: AfSector2File = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup(options?: SectorToolOptions) {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.view.set({ camera: CAMERA })
  const tool = createSectorTool(editor, SIZE, options)
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (x: number, z: number, kind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
  })
  return { editor, tool, at }
}

describe('the shape', () => {
  it('is a polygon unless the option says a rectangle', () => {
    expect(setup().tool.view.shape).toBe('polygon')
    expect(setup({ shape: 'rectangle' }).tool.view.shape).toBe('rectangle')
  })

  it('switches when nothing is placed, and tells its subscribers', () => {
    const { tool } = setup()
    const heard = vi.fn()
    tool.subscribe(heard)
    tool.setShape('rectangle')
    expect(tool.view.shape).toBe('rectangle')
    expect(heard).toHaveBeenCalledTimes(1)
    tool.setShape('polygon')
    expect(tool.view.shape).toBe('polygon')
  })

  it('is no change, and no notice, when it is the shape already', () => {
    const { tool } = setup({ shape: 'rectangle' })
    const heard = vi.fn()
    tool.subscribe(heard)
    tool.setShape('rectangle')
    expect(heard).not.toHaveBeenCalled()
  })

  it('is refused while corners are placed, and keeps them and the shape', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.setShape('rectangle')
    expect(tool.view.shape).toBe('polygon')
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
    expect(tool.view.refusal).toBe('finish or cancel the outline before changing the shape')
  })

  it('switches once the drawing is cancelled', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.cancel()
    tool.setShape('rectangle')
    expect(tool.view.shape).toBe('rectangle')
    expect(tool.view.refusal).toBeUndefined()
  })

  it('clears the sentence of an earlier refusal, as any change of the drawing does', () => {
    const { tool } = setup()
    tool.nudge(1, 0)
    expect(tool.view.refusal).toBe('place a corner first')
    tool.setShape('rectangle')
    expect(tool.view.refusal).toBeUndefined()
  })

  it('is nothing to refuse when the shape asked for is the one it has, even with corners placed', () => {
    const { tool, at } = setup()
    tool.tap(at(-3, 9.5))
    tool.setShape('polygon')
    expect(tool.view.refusal).toBeUndefined()
  })

  it('is held while portal offers are open', () => {
    const { tool, at } = setup()
    for (const [x, z] of [
      [0, 6],
      [8, 6],
      [8, 10],
      [0, 10],
    ] as const)
      tool.tap(at(x, z))
    tool.close()
    expect(tool.view.offers).toHaveLength(1)
    tool.setShape('rectangle')
    expect(tool.view.shape).toBe('polygon')
    expect(tool.view.refusal).toBe('answer the portal offers first')
  })

  it('still draws a polygon after switching back', () => {
    const { editor, tool, at } = setup({ shape: 'rectangle' })
    tool.setShape('polygon')
    tool.tap(at(-3, 9.5))
    tool.tap(at(0, 9.5))
    tool.tap(at(0, 13.5))
    tool.tap(at(-3, 9.5))
    expect(afSectorProfile.sectors.list(editor.level).map((sector) => sector.id)).toContain('sector-1')
  })
})

/** A rectangle tool with the first corner A placed at (-3, 9.5), under the hall: the second corner is the test's. */
function started() {
  const made = setup({ shape: 'rectangle' })
  made.tool.tap(made.at(-3, 9.5))
  return made
}

describe('two corners', () => {
  const NO_ROOM = 'a rectangle needs a width and a height'

  it('places the first corner and has nothing to draw yet', () => {
    const { tool } = started()
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
    expect(tool.view.edges).toEqual([])
  })

  it('shows the four sides as pending, north-west corner first, from the first corner to where the pointer would place the second', () => {
    const { tool, at } = started()
    // 0.1 m is 3.2 px, which the grid takes to (1, 12).
    tool.hover(at(1.1, 12.1))
    expect(tool.view.edges).toEqual([
      { a: { x: -3, z: 9.5 }, b: { x: 1, z: 9.5 }, length: 4, pending: true },
      { a: { x: 1, z: 9.5 }, b: { x: 1, z: 12 }, length: 2.5, pending: true },
      { a: { x: 1, z: 12 }, b: { x: -3, z: 12 }, length: 4, pending: true },
      { a: { x: -3, z: 12 }, b: { x: -3, z: 9.5 }, length: 2.5, pending: true },
    ])
  })

  it('writes the sides the same way round when the second corner is above and to the left', () => {
    const { tool, at } = started()
    tool.hover(at(-6, 7))
    expect(tool.view.edges.map((edge) => edge.a)).toEqual([
      { x: -6, z: 7 },
      { x: -3, z: 7 },
      { x: -3, z: 9.5 },
      { x: -6, z: 9.5 },
    ])
  })

  it('has no sides where the point has no width or no depth against the first corner', () => {
    const { tool, at } = started()
    tool.hover(at(1, 9.5))
    expect(tool.view.edges).toEqual([])
    tool.hover(at(-3, 12))
    expect(tool.view.edges).toEqual([])
    tool.hover(at(-3, 9.5))
    expect(tool.view.edges).toEqual([])
  })

  it('places the second corner as the opposite one, and the sides are placed', () => {
    const { editor, tool, at } = started()
    tool.tap(at(1, 12))
    expect(tool.view.corners).toEqual([
      { x: -3, z: 9.5 },
      { x: 1, z: 12 },
    ])
    expect(tool.view.edges).toHaveLength(4)
    expect(tool.view.edges.every((edge) => !edge.pending)).toBe(true)
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the sides placed when the pointer moves, until a tap moves the corner', () => {
    const { tool, at } = started()
    tool.tap(at(1, 12))
    tool.hover(at(5, 15))
    expect(tool.view.edges.map((edge) => edge.length)).toEqual([4, 2.5, 4, 2.5])
    expect(tool.view.edges.every((edge) => !edge.pending)).toBe(true)
  })

  it('is closing only with the second corner placed and the pointer within reach of it', () => {
    const { tool, at } = started()
    tool.hover(at(-3, 9.5))
    expect(tool.view.closing).toBe(false)
    tool.tap(at(1, 12))
    tool.hover(at(1, 12))
    expect(tool.view.closing).toBe(true)
    tool.hover(at(-3, 9.5))
    expect(tool.view.closing).toBe(false)
  })

  it("reaches as far as the pointer kind does: a mouse's 8 px, a finger's 22, and not a hair past", () => {
    const { tool, at } = started()
    tool.tap(at(1, 12))
    // 0.25 m is 8 px.
    tool.hover(at(1, 12.25))
    expect(tool.view.closing).toBe(true)
    tool.hover(at(1, 12.26))
    expect(tool.view.closing).toBe(false)
    // 0.6 m is 19.2 px.
    tool.hover(at(1, 12.6, 'touch'))
    expect(tool.view.closing).toBe(true)
    tool.hover(at(1, 12.6, 'mouse'))
    expect(tool.view.closing).toBe(false)
  })

  it('moves the second corner with a tap that is not on it, and adds no sector', () => {
    const { editor, tool, at } = started()
    tool.tap(at(1, 12))
    tool.tap(at(3, 14))
    expect(tool.view.corners).toEqual([
      { x: -3, z: 9.5 },
      { x: 3, z: 14 },
    ])
    expect(tool.view.refusal).toBeUndefined()
    expect(editor.history.canUndo).toBe(false)
  })

  it('refuses a corner with no width or no depth, and keeps what was placed', () => {
    const { tool, at } = started()
    tool.tap(at(1, 9.5))
    expect(tool.view.refusal).toBe(NO_ROOM)
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
    tool.tap(at(-3, 12))
    expect(tool.view.refusal).toBe(NO_ROOM)
    tool.tap(at(-3, 9.5))
    expect(tool.view.refusal).toBe(NO_ROOM)
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
  })

  it('refuses a move of the second corner onto the first corner’s lines, and the second corner stays', () => {
    const { tool, at } = started()
    tool.tap(at(1, 12))
    tool.tap(at(-3, 14))
    expect(tool.view.refusal).toBe(NO_ROOM)
    expect(tool.view.corners[1]).toEqual({ x: 1, z: 12 })
    tool.tap(at(3, 9.5))
    expect(tool.view.refusal).toBe(NO_ROOM)
    expect(tool.view.corners[1]).toEqual({ x: 1, z: 12 })
  })

  it('clears the sentence with the next corner that is placed', () => {
    const { tool, at } = started()
    tool.tap(at(1, 9.5))
    tool.tap(at(1, 12))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('does not snap onto the axis through the first corner, which would be a room of no width', () => {
    const { tool, at } = started()
    // 1.6 px off the horizontal through the first corner: a polygon goes onto it, a rectangle does not.
    tool.hover(at(1.2, 9.55))
    expect(tool.view.snap?.kind).toBe('grid')
    const polygon = setup()
    polygon.tool.tap(polygon.at(-3, 9.5))
    polygon.tool.hover(polygon.at(1.2, 9.55))
    expect(polygon.tool.view.snap?.kind).toBe('axis')
  })

  it('moves the second corner by a grid step with the nudge pad', () => {
    const { tool, at } = started()
    tool.tap(at(1, 12))
    tool.nudge(1, 0)
    expect(tool.view.corners[1]).toEqual({ x: 1.5, z: 12 })
    tool.nudge(0, 1)
    expect(tool.view.corners[1]).toEqual({ x: 1.5, z: 12.5 })
  })

  it('puts the second corner back when a nudge would leave no width or no depth', () => {
    const { tool, at } = started()
    tool.tap(at(-2.5, 12))
    tool.nudge(-1, 0)
    expect(tool.view.corners[1]).toEqual({ x: -2.5, z: 12 })
    expect(tool.view.refusal).toBe(NO_ROOM)
    tool.tap(at(1, 10))
    tool.nudge(0, -1)
    expect(tool.view.corners[1]).toEqual({ x: 1, z: 10 })
  })

  it('moves the first corner with the nudge pad while it is the only one', () => {
    const { tool } = started()
    tool.nudge(0, 1)
    expect(tool.view.corners).toEqual([{ x: -3, z: 10 }])
  })

  it('takes the second corner back and then the first', () => {
    const { tool, at } = started()
    tool.tap(at(1, 12))
    tool.undoCorner()
    expect(tool.view.corners).toEqual([{ x: -3, z: 9.5 }])
    // The pointer is still where the tap was, so the sides to it are pending again.
    expect(tool.view.edges).toHaveLength(4)
    expect(tool.view.edges.every((edge) => edge.pending)).toBe(true)
    tool.undoCorner()
    expect(tool.view.corners).toEqual([])
    expect(tool.view.edges).toEqual([])
  })

  it('says where the second corner goes when closed with fewer than two', () => {
    const { tool } = started()
    tool.close()
    expect(tool.view.refusal).toBe('tap the opposite corner of the rectangle')
    tool.undoCorner()
    tool.close()
    expect(tool.view.refusal).toBe('tap the opposite corner of the rectangle')
  })
})

describe('closing the rectangle', () => {
  type Made = ReturnType<typeof setup>
  const sectorOf = (editor: Made['editor'], id: string) =>
    afSectorProfile.sectors.list(editor.level as AfSector2File).find((each) => each.id === id)
  const wall = (made: Made, sector: string, corner: number) =>
    sectorOf(made.editor, sector)?.corners[corner]?.[2]
  /** Draws the room from one of its corners to the opposite one, then closes it with a tap on that corner. */
  const draw = ({ tool, at }: Made, from: readonly [number, number], to: readonly [number, number]): void => {
    tool.tap(at(...from))
    tool.tap(at(...to))
    tool.tap(at(...to))
  }
  const ROOM = [
    [-3, 9.5],
    [1, 9.5],
    [1, 12],
    [-3, 12],
  ]

  it.each([
    ['north-west to south-east', [-3, 9.5], [1, 12]],
    ['north-east to south-west', [1, 9.5], [-3, 12]],
    ['south-east to north-west', [1, 12], [-3, 9.5]],
    ['south-west to north-east', [-3, 12], [1, 9.5]],
  ] as const)('writes the same room whichever diagonal is drawn (%s)', (_name, from, to) => {
    const made = setup({ shape: 'rectangle' })
    draw(made, from, to)
    expect(sectorOf(made.editor, 'sector-1')?.corners).toEqual(ROOM)
  })

  it('adds the room as one undo step, selects it, clears the drawing and keeps the shape', () => {
    const made = setup({ shape: 'rectangle' })
    draw(made, [-3, 9.5], [1, 12])
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
    expect(made.editor.selection.ids).toEqual(['sector:sector-1'])
    expect(made.tool.view).toMatchObject({
      shape: 'rectangle',
      corners: [],
      edges: [],
      refusal: undefined,
      closing: false,
    })
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
    expect(made.editor.history.canUndo).toBe(false)
  })

  it('closes with the Close button as well, and draws the next room with the next id', () => {
    const made = setup({ shape: 'rectangle' })
    made.tool.tap(made.at(-3, 9.5))
    made.tool.tap(made.at(1, 12))
    made.tool.close()
    expect(sectorOf(made.editor, 'sector-1')?.corners).toEqual(ROOM)
    draw(made, [3, 9.5], [6, 13])
    expect(sectorOf(made.editor, 'sector-2')?.corners).toEqual([
      [3, 9.5],
      [6, 9.5],
      [6, 13],
      [3, 13],
    ])
  })

  it('takes the heights and the light of the sector the selection names, else the last sector', () => {
    const plain = setup({ shape: 'rectangle' })
    draw(plain, [-3, 9.5], [1, 12])
    expect(sectorOf(plain.editor, 'sector-1')).toMatchObject({ floor: -0.5, light: 0.7 })
    const chosen = setup({ shape: 'rectangle' })
    chosen.editor.selection.set(['sector:hall'])
    draw(chosen, [-3, 9.5], [1, 12])
    expect(sectorOf(chosen.editor, 'sector-1')).toMatchObject({ floor: 0, light: 1 })
  })

  it('offers a portal where a wall of the room lies on a neighbour’s, as the polygon does for the same room', () => {
    const polygon = setup()
    for (const [x, z] of [
      [-6, 0],
      [0, 0],
      [0, 6],
      [-6, 6],
    ] as const)
      polygon.tool.tap(polygon.at(x, z))
    polygon.tool.close()
    const made = setup({ shape: 'rectangle' })
    draw(made, [-6, 0], [0, 6])
    expect(made.tool.view.offers).toEqual([
      { sector: 'sector-1', corner: 1, to: 'hall', toCorner: 3, length: 6 },
    ])
    expect(made.tool.view.offers).toEqual(polygon.tool.view.offers)
    expect(made.editor.level).toEqual(polygon.editor.level)
  })

  it('makes both sides portals when the offer is accepted, in the one step the room is in', () => {
    const made = setup({ shape: 'rectangle' })
    draw(made, [0, 6], [8, 10])
    expect(made.tool.view.offers).toEqual([
      { sector: 'sector-1', corner: 0, to: 'hall', toCorner: 2, length: 8 },
    ])
    made.tool.acceptOffer(0)
    expect(wall(made, 'sector-1', 0)).toEqual({ next: 'hall' })
    expect(wall(made, 'hall', 2)).toEqual({ next: 'sector-1' })
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
    made.editor.history.undo()
    expect(made.editor.level).toEqual(depot)
    expect(made.editor.history.canUndo).toBe(false)
  })

  it('leaves the wall solid when the offer is declined', () => {
    const made = setup({ shape: 'rectangle' })
    draw(made, [0, 6], [8, 10])
    made.tool.declineOffer(0)
    expect(wall(made, 'sector-1', 0)).toBeUndefined()
    expect(wall(made, 'hall', 2)).toBeUndefined()
    expect(made.tool.view.offers).toEqual([])
  })

  it('offers nothing for a wall that spans two neighbour walls, which is not the same segment as either', () => {
    const made = setup({ shape: 'rectangle' })
    draw(made, [0, 6], [14, 10])
    expect(made.tool.view.offers).toEqual([])
    expect(made.editor.history.undoLabel).toBe('Draw sector sector-1')
  })

  it('refuses a room that overlaps a sector with the model’s sentence, and keeps both corners', () => {
    const made = setup({ shape: 'rectangle' })
    made.tool.tap(made.at(-3, 2))
    made.tool.tap(made.at(3, 4))
    made.tool.close()
    expect(made.tool.view.refusal).toBe('the new sector overlaps hall')
    expect(made.tool.view.corners).toHaveLength(2)
    expect(made.editor.level).toBe(depot)
    expect(made.editor.history.canUndo).toBe(false)
  })
})
