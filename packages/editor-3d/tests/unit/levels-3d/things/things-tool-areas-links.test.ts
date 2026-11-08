// The Things tool's rectangles and links (ED3D.7c): a definition that bounds an area is placed by dragging a rectangle,
// and the things of a profile's links are joined and parted. No af-sector definition bounds an area and the format has
// no links, so the tests give the depot a `zone` definition with an `area`, and the profile a link table of their own
// (links kept beside the level, as a format that has them would keep them in the file). The canvas is 800 by 400 px with
// the camera at (7, 3), zoom 1 (32 px to a metre); the grid is half a metre.

import type { AfSector2File } from '@automata/3d/level'
import type { PointerKind } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { PlanPointer } from '#src/features/levels-3d/plan/plan-controller.ts'
import { planViewport, toScreen } from '#src/features/levels-3d/plan/plan-viewport.ts'
import { createThingsTool } from '#src/features/levels-3d/things/things-tool-controller.ts'
import { createLevelEditor, type LevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { ThingAccessError } from '#src/shared/level-session/thing-access.ts'
import type { ThingLink, ThingLinks } from '#src/shared/level-session/thing-links.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

const float = (id: string) => ({ id, type: 'float' as const, default: 0 })

/** The toy level with a `zone` that bounds a rectangle, a `hotspot` point, and three `node`s p, t and s. */
const toy: AfSector2File = toyAfSector({
  entityDefs: [
    {
      id: 'zone',
      shape: 'point',
      fields: [float('x0'), float('z0'), float('x1'), float('z1')],
      area: ['x0', 'z0', 'x1', 'z1'],
    },
    { id: 'hotspot', shape: 'point', fields: [] },
    { id: 'node', shape: 'point', fields: [] },
  ],
  entities: [
    { def: 'zone', id: 'a', x: 3.5, z: 2, x0: 3, z0: 1.5, x1: 4, z1: 2.5 },
    { def: 'node', id: 'p', x: 1.5, z: 2.5 },
    { def: 'node', id: 't', x: 2.5, z: 2.5 },
    { def: 'node', id: 's', x: 12.5, z: 2.5 },
  ],
})

/** Links kept beside each level they belong to, so an edit that returns a new level carries its links with it. */
const kept = new WeakMap<AfSector2File, readonly ThingLink[]>()
const linksOf = (level: AfSector2File): readonly ThingLink[] => kept.get(level) ?? []
const withLinks = (level: AfSector2File, links: readonly ThingLink[]): AfSector2File => {
  const next = { ...level }
  kept.set(next, links)
  return next
}

const NOT_CLEAR = 'edge p–s is not clear'
const links: ThingLinks<AfSector2File> = {
  def: 'node',
  list: linksOf,
  add: (level, link) => {
    if (link.a === link.b) throw new ThingAccessError('an edge joins two different nodes')
    if (link.b === 's') throw new ThingAccessError(NOT_CLEAR)
    return withLinks(level, [...linksOf(level), link])
  },
  remove: (level, a, b) => {
    const rest = linksOf(level).filter((l) => !((l.a === a && l.b === b) || (l.a === b && l.b === a)))
    if (rest.length === linksOf(level).length) throw new ThingAccessError(`no edge ${a}–${b}`)
    return withLinks(level, rest)
  },
}
const profile = { ...afSectorProfile, links }

function setup(level: AfSector2File = toy) {
  const editor: LevelEditor<AfSector2File> = createLevelEditor({ profile, level })
  editor.view.set({ camera: CAMERA })
  const tool = createThingsTool(editor, SIZE)
  const at = (x: number, z: number, kind: PointerKind = 'mouse'): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
  })
  return { editor, tool, at }
}

const thingOf = (editor: LevelEditor<AfSector2File>, id: string) =>
  editor.profile.entities(editor.level).things.find((thing) => thing.id === id)
const idsOf = (editor: LevelEditor<AfSector2File>) =>
  editor.profile.entities(editor.level).things.map((thing) => thing.id)

describe('placing a thing that bounds an area', () => {
  it('draws a rectangle from a drag on nothing, rounded to the grid, and adds it at the middle as one undo step', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone')
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
    expect(thingOf(editor, 'zone1')).toMatchObject({
      x: 5.75,
      z: 2,
      values: { x0: 5, z0: 0.5, x1: 6.5, z1: 3.5 },
    })
    expect(editor.history.undoLabel).toBe('Add zone zone1')
    expect(editor.selection.ids).toEqual(['entity:zone/zone1'])
    editor.history.undo()
    expect(editor.level).toBe(toy)
  })

  it('takes a rectangle dragged either way round', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone')
    tool.dragStart(at(6.5, 3.5), at(6, 3))
    tool.drag(at(5, 0.5))
    expect(tool.view.place?.area).toEqual({ x0: 5, z0: 0.5, x1: 6.5, z1: 3.5 })
    tool.dragEnd(at(5, 0.5), false)
    expect(thingOf(editor, 'zone1')?.values).toMatchObject({ x0: 5, z0: 0.5, x1: 6.5, z1: 3.5 })
  })

  it('adds nothing for a cancelled drag', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone')
    tool.dragStart(at(5, 0.5), at(6, 3))
    tool.dragEnd(at(6.5, 3.5), true)
    expect(editor.level).toBe(toy)
    expect(tool.view.gesture).toBe('idle')
  })

  it('is refused with the layer’s sentence when the sub-layer is hidden', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone')
    editor.view.set({ hidden: ['things:zone'] })
    tool.dragStart(at(5, 0.5), at(6, 3))
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'the zone layer is hidden' })
    tool.dragEnd(at(6.5, 3.5), false)
    expect(tool.view.refusal).toBe('the zone layer is hidden')
    expect(editor.level).toBe(toy)
  })

  it('still takes no drag on nothing with a point definition picked, and moves a zone by its marker', () => {
    const { editor, tool, at } = setup()
    tool.pick('hotspot')
    tool.dragStart(at(5, 0.5), at(6, 3))
    expect(tool.view.gesture).toBe('idle')
    tool.dragEnd(at(6, 3), false)
    expect(editor.level).toBe(toy)
    tool.dragStart(at(3.5, 2), at(3, 2))
    expect(tool.view.gesture).toBe('move')
    tool.dragEnd(at(3, 2), false)
    expect(thingOf(editor, 'a')).toMatchObject({ x: 3, z: 2 })
  })
})

describe('a drawing that is never ended', () => {
  it('is dropped by the next drag, which moves the thing under it and adds nothing', () => {
    const { editor, tool, at } = setup()
    tool.pick('zone')
    tool.dragStart(at(1.5, 0.5), at(2, 1))
    tool.dragStart(at(3.5, 2), at(3, 2))
    expect(tool.view.gesture).toBe('move')
    tool.dragEnd(at(3, 2), false)
    expect(idsOf(editor)).not.toContain('zone1')
    expect(thingOf(editor, 'a')).toMatchObject({ x: 3, z: 2 })
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
  const edgesOf = (editor: LevelEditor<AfSector2File>) => linksOf(editor.level).map((l) => [l.a, l.b, l.via])

  it('answers that one node must be selected first', () => {
    const { editor, tool, at } = setup()
    expect(tool.startLink()).toBe('select one node first')
    expect(tool.view.refusal).toBe('select one node first')
    tool.tap(at(3.5, 2))
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
    tool.hover(at(12.5, 2.5))
    expect(tool.view.link).toEqual({ a: 'p', b: 's', action: 'none', reason: NOT_CLEAR })
    tool.hover(at(3.5, 2))
    expect(tool.view.link).toBeUndefined()
  })

  it('links with a tap on another node as one undo step, and ends', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(2.5, 2.5))
    expect(edgesOf(editor)).toEqual([['p', 't', undefined]])
    expect(editor.history.undoLabel).toBe('Link p–t')
    expect(tool.view.linking).toBeUndefined()
    expect(editor.selection.ids).toEqual(['entity:node/p'])
  })

  it('passes through what startLink names', () => {
    const { editor, tool, at } = fromP()
    tool.startLink('a')
    expect(tool.view.linking).toEqual({ from: 'p', via: 'a' })
    tool.tap(at(2.5, 2.5))
    expect(edgesOf(editor)).toEqual([['p', 't', 'a']])
  })

  it('keeps linking after a refused tap, with the sentence, and adds nothing', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.tap(at(12.5, 2.5))
    expect(tool.view.refusal).toBe(NOT_CLEAR)
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
    tool.tap(at(3.5, 2))
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
    expect(tool.unlink('p', 's')).toBe('no edge p–s')
    expect(tool.view.refusal).toBe('no edge p–s')
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

  it('ends when a drag starts, which moves the thing under it as before', () => {
    const { editor, tool, at } = fromP()
    tool.startLink()
    tool.dragStart(at(2.5, 2.5), at(3, 2.5))
    expect(tool.view.linking).toBeUndefined()
    expect(tool.view.gesture).toBe('move')
    tool.dragEnd(at(3, 2.5), false)
    expect(edgesOf(editor)).toEqual([])
    expect(thingOf(editor, 't')).toMatchObject({ x: 3, z: 2.5 })
  })

  it('ends when its sub-layer goes off mid-link', () => {
    const { editor, tool } = fromP()
    tool.startLink()
    editor.view.set({ hidden: ['things:node'] })
    expect(tool.view.linking).toBeUndefined()
  })

  it('answers that a level with no links has none', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toy })
    editor.view.set({ camera: CAMERA })
    const tool = createThingsTool(editor, SIZE)
    expect(tool.startLink()).toBe('this level has no links')
    expect(tool.unlink('a', 'b')).toBe('this level has no links')
  })
})
