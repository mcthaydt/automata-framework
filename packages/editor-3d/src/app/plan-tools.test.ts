// The Plan view's tool switcher (ED3D.6g-a, plan decision 1): which tool the plan's pointer goes to. The depot is the
// level (the hall from (0, 0) to (8, 6), the dock from (8, 0) to (14, 6)); the canvas is 800 by 400 px with the camera
// at (7, 3) and zoom 1, and pixel positions come from `toScreen`, as in the tools' own tests.
import type { PointerKind } from '@automataframework/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanPointer } from './plan-controller'
import { createPlanTools } from './plan-tools'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }

function setup() {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
  const tools = createPlanTools(editor, SIZE)
  const at = (x: number, z: number, kind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
  })
  const tapAll = (points: readonly (readonly [number, number])[], kind?: PointerKind) => {
    for (const [x, z] of points) {
      tools.hover(at(x, z, kind))
      tools.tap(at(x, z, kind))
    }
  }
  const sectorIds = () => afSectorProfile.sectors.list(editor.level as AfSector).map((each) => each.id)
  return { editor, tools, at, tapAll, sectorIds }
}

const NORTH = [
  [0, -4],
  [4, -4],
  [4, -2],
] as const
const WEST = [
  [-6, 0],
  [0, 0],
  [0, 6],
  [-6, 6],
] as const

describe('the plan tools', () => {
  it('starts on Select, whose taps select', () => {
    const { tools, tapAll, editor } = setup()
    expect(tools.state.tool).toBe('select')
    tapAll([[2, 2]])
    expect(editor.selection.ids).toEqual(['sector:hall'])
  })

  it('sends taps to the Sector tool once Polygon is chosen, and a tap on the first corner adds the sector as one step', () => {
    const { tools, tapAll, sectorIds, editor } = setup()
    tools.choose('polygon')
    expect(tools.state.tool).toBe('polygon')
    tapAll([...NORTH, NORTH[0]], 'pen')
    expect(sectorIds()).toContain('sector-1')
    expect(editor.history.undoLabel).toBe('Draw sector sector-1')
    expect(tools.sector?.view.corners).toEqual([])
  })

  it('tells its subscribers when the tool or its view changes', () => {
    const { tools, tapAll } = setup()
    let calls = 0
    const stop = tools.subscribe(() => {
      calls += 1
    })
    tools.choose('polygon')
    const afterChoose = calls
    expect(afterChoose).toBeGreaterThan(0)
    tapAll([NORTH[0]])
    expect(calls).toBeGreaterThan(afterChoose)
    stop()
  })

  it('keeps one Sector tool between Polygon and Rectangle, which refuses to change shape mid-outline', () => {
    const { tools, tapAll } = setup()
    tools.choose('polygon')
    const sector = tools.sector
    tapAll([NORTH[0]])
    tools.choose('rectangle')
    expect(tools.sector).toBe(sector)
    expect(tools.state.tool).toBe('polygon')
    expect(tools.sector?.view.refusal).toBe('finish or cancel the outline before changing the shape')
    tools.sector?.cancel()
    tools.choose('rectangle')
    expect(tools.state.tool).toBe('rectangle')
    expect(tools.sector?.view.shape).toBe('rectangle')
  })

  it('drops an open outline when another tool is chosen: no sector and nothing to undo', () => {
    const { tools, tapAll, sectorIds, editor } = setup()
    tools.choose('polygon')
    tapAll(NORTH)
    tools.choose('select')
    expect(tools.state.tool).toBe('select')
    expect(tools.sector).toBeUndefined()
    expect(sectorIds()).toEqual(['hall', 'dock'])
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps a closed sector whose portal offers are open when another tool is chosen, leaving the walls solid', () => {
    const { tools, tapAll, sectorIds, editor } = setup()
    tools.choose('polygon')
    tapAll(WEST)
    tools.sector?.close()
    expect(tools.sector?.view.offers.length).toBe(1)
    tools.choose('vertex')
    expect(sectorIds()).toContain('sector-1')
    expect(editor.history.undoLabel).toBe('Draw sector sector-1')
  })

  it('makes the tool each id names', () => {
    const { tools } = setup()
    for (const id of ['vertex', 'portal', 'door', 'window', 'split', 'merge', 'select'] as const) {
      tools.choose(id)
      expect(tools.state.tool).toBe(id)
    }
    tools.choose('door')
    const state = tools.state
    if (state.tool !== 'door') throw new Error('door')
    expect(state.view.target).toBeUndefined()
  })

  it('pans and zooms through Select whatever the tool', () => {
    const { tools, editor } = setup()
    tools.choose('polygon')
    tools.select.panBy(32, 0)
    expect(editor.view.state.camera.x).toBe(6)
  })

  it('pans with a touch or mouse drag while a drawing tool is active, and does nothing with a Pencil drag', () => {
    const { tools, editor, at } = setup()
    tools.choose('polygon')
    // Pixels fixed before the drag, as a finger's are: the camera moves under them.
    const press = at(2, 2)
    const moved = { x: press.x + 32, y: press.y }
    tools.dragStart({ ...press, kind: 'touch' }, { ...press, kind: 'touch' })
    tools.drag({ ...moved, kind: 'touch' })
    tools.dragEnd({ ...moved, kind: 'touch' }, false)
    expect(editor.view.state.camera.x).toBe(6)
    tools.dragStart({ ...press, kind: 'pen' }, { ...press, kind: 'pen' })
    tools.drag({ ...moved, kind: 'pen' })
    tools.dragEnd({ ...moved, kind: 'pen' }, false)
    expect(editor.view.state.camera.x).toBe(6)
  })

  it('disposes the active tool, which keeps a closed sector', () => {
    const { tools, tapAll, sectorIds } = setup()
    tools.choose('polygon')
    tapAll(WEST)
    tools.sector?.close()
    tools.dispose()
    expect(sectorIds()).toContain('sector-1')
  })

  it('remembers the kind of the last tap or hover, for the nudge pad (ED3D.6g-b)', () => {
    const { tools, at } = setup()
    expect(tools.pointerKind).toBeUndefined()
    tools.choose('polygon')
    tools.hover(at(1, -3, 'pen'))
    expect(tools.pointerKind).toBe('pen')
    tools.tap(at(1, -3, 'touch'))
    expect(tools.pointerKind).toBe('touch')
    tools.hover(at(1, -3, 'mouse'))
    expect(tools.pointerKind).toBe('mouse')
  })

  describe('the Things tool (ED3D.7d)', () => {
    it('places the picked definition with a tap, as one undo step', () => {
      const { tools, editor, at } = setup()
      tools.choose('things')
      expect(tools.state.tool).toBe('things')
      expect(tools.things?.pick('crate')).toBeUndefined()
      tools.hover(at(11, 4))
      tools.tap(at(11, 4))
      expect(editor.history.undoLabel).toMatch(/^Add crate/)
      const crates = afSectorProfile
        .entities(editor.level as AfSector)
        .things.filter((each) => each.def === 'crate')
      expect(crates).toHaveLength(2)
    })

    it('moves a thing with a drag, as one undo step, and does not pan', () => {
      const { tools, editor, at } = setup()
      tools.choose('things')
      const camera = editor.view.state.camera
      tools.dragStart(at(11, 2), at(11, 2))
      tools.drag(at(12, 3))
      tools.dragEnd(at(12, 3), false)
      expect(editor.view.state.camera).toEqual(camera)
      expect(editor.history.undoLabel).toMatch(/^Move crate/)
    })

    it('disposes the Things tool when another is chosen', () => {
      const { tools } = setup()
      tools.choose('things')
      tools.choose('select')
      expect(tools.things).toBeUndefined()
    })
  })
})
