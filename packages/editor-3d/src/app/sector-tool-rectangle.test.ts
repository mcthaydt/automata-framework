// The Sector tool's Rectangle shape (ED3D.6c): two taps span an axis-aligned room, and the rest is the Polygon shape's
// path. The depot is the level: the hall runs from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a
// portal along x = 8. The canvas is 800 by 400 px with the camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel
// positions are made with `toScreen`, so no test hides a unit. The grid is the view's default, half a metre.
import type { PointerKind } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
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
