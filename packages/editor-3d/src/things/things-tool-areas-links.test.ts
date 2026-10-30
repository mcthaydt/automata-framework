// The Things tool's rectangles and links (ED3D.7c): a definition that bounds an area (Last Light's camera zone) is placed
// by dragging a rectangle, and the things of the profile's links (Last Light's nav nodes) are joined and parted. The
// level is the toy (room a from (0, 0) to (4, 4), room b from (4.125, 0) to (7, 4), the door abDoor in the doorway at
// x 4.06, z 1.5 to 2.5, the spawn at (1, 1), the hotspot far at (6, 3), the first zone a looking at (3.5, 2)) with its
// nav written by hand: p (1.5, 2.5) and t (2.5, 2.5) in room a, s (5.5, 2.5) in room b, and no edge. The canvas is 800
// by 400 px with the camera at (7, 3), zoom 1 (32 px to a metre); the grid is half a metre.
import type { PointerKind } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import type { PlanPointer } from '../app/plan-controller'
import type { AfSector } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { createLevelEditor, type LevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { LevelProfile } from '../profile/level-profile'
import { loadAuthored } from '../testing/fixtures'
import { must, toyBlockout } from '../testing/toy-blockout'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { createThingsTool } from './things-tool-controller'

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

const toy: Blockout = toyBlockout({
  nav: { derive: false, nodes: { p: { x: 1.5, z: 2.5 }, t: { x: 2.5, z: 2.5 }, s: { x: 5.5, z: 2.5 } } },
})

function setup<D = Blockout>(
  level: D = toy as D,
  profile: LevelProfile<D> = lastLightProfile as unknown as LevelProfile<D>,
) {
  const editor: LevelEditor<D> = createLevelEditor({ profile, level })
  editor.view.set({ camera: CAMERA })
  const tool = createThingsTool(editor, SIZE)
  const at = (x: number, z: number, kind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
  })
  return { editor, tool, at }
}

const zonesOf = (editor: LevelEditor<Blockout>) => editor.level.zones
const edgesOf = (editor: LevelEditor<Blockout>) => editor.level.nav.edges ?? []
const FOLLOW = { distance: 14, follow: 1 }

describe('placing a thing that bounds an area', () => {
  it('draws a rectangle from a drag on nothing, rounded to the grid, and adds it at the middle as one undo step', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    tool.dragStart(at(5.1, 0.6), at(6, 3))
    expect(tool.view.gesture).toBe('area')
    tool.drag(at(6.4, 3.4))
    expect(tool.view.place).toEqual({
      x: 5.75,
      z: 2,
      id: 'zone1',
      action: 'add',
      area: { x0: 5, z0: 0.5, x1: 6.5, z1: 3.5 },
    })
    tool.dragEnd(at(6.4, 3.4), false)
    expect(tool.view.gesture).toBe('idle')
    expect(zonesOf(editor).at(-1)).toEqual({
      id: 'zone1',
      look: [5.75, 0, 2],
      distance: 14,
      follow: 1,
      area: { x: [5, 6.5], z: [0.5, 3.5] },
    })
    expect(editor.history.undoLabel).toBe('Add zone zone1')
    expect(editor.selection.ids).toEqual(['entity:zone/zone1'])
    editor.history.undo()
    expect(editor.level).toBe(toy)
  })

  it('takes a rectangle dragged either way round', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    tool.dragStart(at(6.5, 3.5), at(6, 3))
    tool.dragEnd(at(5, 0.5), false)
    expect(must(zonesOf(editor).at(-1)).area).toEqual({ x: [5, 6.5], z: [0.5, 3.5] })
  })

  it("shows the model's sentence for a rectangle it would refuse, and says it at the end with nothing added", () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    tool.dragStart(at(5, 1), at(5.1, 1.1))
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'the area is at least 0.5 m along x' })
    tool.dragEnd(at(5.1, 1.1), false)
    expect(tool.view.refusal).toBe('the area is at least 0.5 m along x')
    expect(editor.level).toBe(toy)
    expect(editor.history.canUndo).toBe(false)
  })

  it('adds nothing for a cancelled drag', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    tool.dragStart(at(5, 0.5), at(6, 3))
    tool.dragEnd(at(6.5, 3.5), true)
    expect(editor.level).toBe(toy)
    expect(tool.view.gesture).toBe('idle')
  })

  it('is refused with the layer’s sentence when the sub-layer is hidden', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    editor.view.set({ hidden: ['things:zone'] })
    tool.dragStart(at(5, 0.5), at(6, 3))
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'the zone layer is hidden' })
    tool.dragEnd(at(6.5, 3.5), false)
    expect(tool.view.refusal).toBe('the zone layer is hidden')
    expect(editor.level).toBe(toy)
  })

  it('still takes no drag on nothing with a point definition picked, and moves a zone by its marker', () => {
    const { editor, tool, at } = setup()
    tool.pick('hotspot', { name: 'Sign', reach: 1 })
    tool.dragStart(at(5, 0.5), at(6, 3))
    expect(tool.view.gesture).toBe('idle')
    tool.dragEnd(at(6, 3), false)
    expect(editor.level).toBe(toy)
    tool.dragStart(at(3.5, 2), at(3, 2))
    expect(tool.view.gesture).toBe('move')
    tool.dragEnd(at(3, 2), false)
    expect(must(zonesOf(editor)[0]).look).toEqual([3, 1, 2])
  })
})

describe('a drawing that is never ended', () => {
  it('is dropped by the next drag, which moves the thing under it and adds nothing', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone', FOLLOW)
    tool.dragStart(at(1.5, 0.5), at(2, 1))
    tool.dragStart(at(3.5, 2), at(3, 2))
    expect(tool.view.gesture).toBe('move')
    tool.dragEnd(at(3, 2), false)
    expect(zonesOf(editor).map((zone) => zone.id)).toEqual(['a'])
    expect(must(zonesOf(editor)[0]).look).toEqual([3, 1, 2])
  })
})

describe('linking', () => {
  /** The tool with node p selected. */
  const fromP = () => {
    const made = setup()
    made.tool.tap(made.at(1.5, 2.5))
    expect(made.editor.selection.ids).toEqual(['entity:node/p'])
    return made
  }

  it('answers that one node must be selected first', () => {
    const { editor, tool, at } = setup()
    expect(tool.startLink()).toBe('select one node first')
    expect(tool.view.refusal).toBe('select one node first')
    tool.tap(at(6, 3))
    expect(tool.startLink()).toBe('select one node first')
    editor.selection.set(['entity:node/p', 'entity:node/t'])
    expect(tool.startLink()).toBe('select one node first')
    expect(tool.view.linking).toBeUndefined()
  })

  it('previews what a tap on another node would do, from a dry run of the edit', () => {
    const { tool, at } = fromP()
    expect(tool.startLink()).toBeUndefined()
    expect(tool.view.linking).toEqual({ from: 'p', via: undefined })
    tool.hover(at(2.5, 2.5))
    expect(tool.view.link).toEqual({ a: 'p', b: 't', action: 'add' })
    expect(tool.view.place).toBeUndefined()
    tool.hover(at(5.5, 2.5))
    expect(tool.view.link).toEqual({
      a: 'p',
      b: 's',
      action: 'none',
      reason: 'edge p–s is not clear by 0.3 m with the doors open',
    })
    tool.hover(at(6, 3))
    expect(tool.view.link).toBeUndefined()
  })

  it('links with a tap on another node as one undo step, and ends', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(2.5, 2.5))
    expect(edgesOf(editor)).toEqual([['p', 't']])
    expect(editor.history.undoLabel).toBe('Link p–t')
    expect(tool.view.linking).toBeUndefined()
    expect(editor.selection.ids).toEqual(['entity:node/p'])
  })

  it('passes through what startLink names', () => {
    const { editor, tool, at } = fromP()
    tool.startLink('abDoor')
    expect(tool.view.linking).toEqual({ from: 'p', via: 'abDoor' })
    tool.tap(at(2.5, 2.5))
    expect(edgesOf(editor)).toEqual([['p', 't', 'abDoor']])
  })

  it('keeps linking after a refused tap, with the sentence, and adds nothing', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(5.5, 2.5))
    expect(tool.view.refusal).toBe('edge p–s is not clear by 0.3 m with the doors open')
    expect(tool.view.linking).toEqual({ from: 'p', via: undefined })
    tool.tap(at(1.5, 2.5))
    expect(tool.view.refusal).toBe('an edge joins two different nodes')
    expect(editor.level).toBe(toy)
  })

  it('ends with a tap on nothing, or on a thing that is not a node, and with cancelLink', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(5, 0.5))
    expect(tool.view.linking).toBeUndefined()
    expect(editor.selection.ids).toEqual(['entity:node/p'])
    tool.startLink()
    tool.tap(at(6, 3))
    expect(tool.view.linking).toBeUndefined()
    tool.tap(at(1.5, 2.5))
    tool.startLink()
    tool.cancelLink()
    expect(tool.view.linking).toBeUndefined()
    expect(editor.level).toBe(toy)
  })

  it('unlinks two nodes as one undo step, and answers the sentence for an edge that is not there', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(2.5, 2.5))
    expect(tool.unlink('t', 'p')).toBeUndefined()
    expect(edgesOf(editor)).toEqual([])
    expect(editor.history.undoLabel).toBe('Unlink t–p')
    expect(tool.unlink('p', 's')).toBe('no nav edge p–s')
    expect(tool.view.refusal).toBe('no nav edge p–s')
  })

  it('is refused while the node layer is hidden or locked', () => {
    const { editor, tool } = fromP()
    editor.view.set({ locked: ['things:node'] })
    expect(tool.startLink()).toBe('the node layer is locked')
    expect(tool.unlink('p', 't')).toBe('the node layer is locked')
    editor.view.set({ locked: [], hidden: ['things'] })
    expect(tool.startLink()).toBe('the node layer is hidden')
    expect(tool.view.linking).toBeUndefined()
  })

  it('ends when its sub-layer goes off mid-link', () => {
    const { editor, tool } = fromP()
    tool.startLink()
    editor.view.set({ hidden: ['things:node'] })
    expect(tool.view.linking).toBeUndefined()
  })

  it('answers that a level with no links has none', () => {
    const depot = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!depot.ok) throw new Error('the depot does not parse')
    const { tool } = setup<AfSector>(depot.value, afSectorProfile)
    expect(tool.startLink()).toBe('this level has no links')
    expect(tool.unlink('a', 'b')).toBe('this level has no links')
  })
})
