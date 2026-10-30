// The Things tool (ED3D.7b): the palette over the level's entity definitions, placing a thing with a tap, moving it with
// a drag, deleting and setting a field. The depot is the level: the hall runs from (0, 0) to (8, 6) and the dock from
// (8, 0) to (14, 6); a spawn stands at (1, 1) and a 1 m crate `crate1` at (11, 2). The canvas is 800 by 400 px with the
// camera at (7, 3) and zoom 1, which is 32 px to a metre; pixel positions are made with `toScreen`, so no test hides a
// unit. The grid is the view's default, half a metre.
import type { PointerKind } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { PlanPointer } from '../app/plan-controller'
import type { AfSector } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { type Edit, ok } from '../model/edit'
import { createLevelEditor, type LevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { LevelProfile } from '../profile/level-profile'
import { loadAuthored } from '../testing/fixtures'
import { toyBlockout, toyRoom } from '../testing/toy-blockout'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { createThingsTool, type ThingsToolOptions } from './things-tool-controller'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }
const CAMERA = { x: 7, z: 3, zoom: 1 }

function setup<D = AfSector>(
  level: D = depot as D,
  profile: LevelProfile<D> = afSectorProfile as unknown as LevelProfile<D>,
  options?: ThingsToolOptions,
) {
  const editor: LevelEditor<D> = createLevelEditor({ profile, level })
  editor.view.set({ camera: CAMERA })
  const tool = createThingsTool(editor, SIZE, options)
  /** The pointer at a point of the plan, as the camera now shows it. */
  const at = (
    x: number,
    z: number,
    kind: PointerKind = 'mouse',
    keys: Pick<PlanPointer, 'shift' | 'alt' | 'additive'> = {},
  ): PlanPointer => ({
    ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }),
    kind,
    ...keys,
  })
  return { editor, tool, at }
}

/** The things of the editor's level, as `def/id@x,z`. */
const thingsOf = <D>(editor: LevelEditor<D>): string[] =>
  editor.profile
    .entities(editor.level)
    .things.map((thing) => `${thing.def}/${thing.id}@${thing.x},${thing.z}`)

describe('the palette', () => {
  it("lists the level's definitions in order, each with its sub-layer", () => {
    const { tool } = setup()
    expect(tool.view.palette).toEqual([
      {
        def: 'spawn',
        label: 'spawn',
        shape: 'point',
        color: undefined,
        layer: 'things:spawn',
        hidden: false,
        locked: false,
      },
      {
        def: 'crate',
        label: 'crate',
        shape: 'box',
        color: undefined,
        layer: 'things:crate',
        hidden: false,
        locked: false,
      },
    ])
  })

  it("takes a definition's label and colour when it has them", () => {
    const labelled: AfSector = {
      ...depot,
      entityDefs: [{ id: 'lamp', label: 'Lamp', color: '#ffcc00', shape: 'point', fields: [] }],
      entities: [],
    }
    const { tool } = setup(labelled)
    expect(tool.view.palette[0]).toMatchObject({ def: 'lamp', label: 'Lamp', color: '#ffcc00' })
  })

  it('follows what the view store hides and locks, a sub-layer or the whole Things layer', () => {
    const { editor, tool } = setup()
    const heard = vi.fn()
    tool.subscribe(heard)
    editor.view.toggle('hidden', 'things:crate')
    expect(tool.view.palette.map((entry) => [entry.def, entry.hidden, entry.locked])).toEqual([
      ['spawn', false, false],
      ['crate', true, false],
    ])
    editor.view.toggle('locked', 'things')
    expect(tool.view.palette.map((entry) => [entry.def, entry.hidden, entry.locked])).toEqual([
      ['spawn', false, true],
      ['crate', true, true],
    ])
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it("lists Last Light's fixed definitions through the same path", () => {
    const { tool } = setup<Blockout>(toyBlockout(), lastLightProfile)
    expect(tool.view.palette.map((entry) => entry.def)).toEqual([
      'spawn',
      'box',
      'hotspot',
      'lamp',
      'anchor',
      'node',
    ])
  })
})

describe('picking a definition', () => {
  it('makes it the one a tap places, puts the view on its sub-layer and switches the sub-layer on', () => {
    const { editor, tool } = setup()
    editor.view.set({ hidden: ['things:crate', 'things', 'walls'] })
    expect(tool.pick('crate')).toBeUndefined()
    expect(tool.view.active).toBe('crate')
    expect(editor.view.state.layer).toBe('things:crate')
    expect(editor.view.state.hidden).toEqual(['walls'])
    expect(tool.view.palette[1]?.hidden).toBe(false)
  })

  it('keeps a lock: a locked layer stays drawn and not hit', () => {
    const { editor, tool } = setup()
    editor.view.set({ locked: ['things:crate'] })
    tool.pick('crate')
    expect(editor.view.state.locked).toEqual(['things:crate'])
  })

  it('refuses a definition the level does not have, and keeps the one picked', () => {
    const { editor, tool } = setup()
    tool.pick('crate')
    expect(tool.pick('barrel')).toBe('no definition barrel')
    expect(tool.view.active).toBe('crate')
    expect(editor.view.state.layer).toBe('things:crate')
  })

  it('picks nothing with undefined: a tap then places nothing', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.pick(undefined)
    expect(tool.view.active).toBeUndefined()
    tool.tap(at(3, 3))
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2'])
  })

  it('drops the definition picked when the level loses it', () => {
    const { editor, tool } = setup()
    tool.pick('crate')
    const dropCrates: Edit<AfSector> = {
      id: 'test.dropCrates',
      label: 'Drop crates',
      run: (_, level) =>
        ok({
          ...level,
          entityDefs: level.entityDefs?.filter((def) => def.id !== 'crate'),
          entities: level.entities?.filter((thing) => thing.def !== 'crate'),
        }),
    }
    expect(editor.run(dropCrates).ok).toBe(true)
    expect(tool.view.active).toBeUndefined()
    expect(tool.view.palette.map((entry) => entry.def)).toEqual(['spawn'])
  })
})

describe('hovering', () => {
  it('names the thing under the pointer, and offers no place there', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(11.3, 2.2))
    expect(tool.view.hover).toMatchObject({ def: 'crate', id: 'crate1', selection: 'entity:crate/crate1' })
    expect(tool.view.place).toBeUndefined()
  })

  it('offers the grid point and the next id where a tap would add one', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(3.2, 4.3))
    expect(tool.view.hover).toBeUndefined()
    expect(tool.view.place).toEqual({ x: 3, z: 4.5, id: 'crate2', action: 'add' })
  })

  it('rounds to the fine step with Shift and not at all with Alt', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(3.237, 4.312, 'mouse', { shift: true }))
    expect(tool.view.place).toMatchObject({ x: 3.24, z: 4.31 })
    tool.hover(at(3.237, 4.312, 'mouse', { alt: true }))
    expect(tool.view.place).toMatchObject({ x: 3.237, z: 4.312 })
  })

  it('offers no place when nothing is picked', () => {
    const { tool, at } = setup()
    tool.hover(at(3, 3))
    expect(tool.view.place).toBeUndefined()
  })

  it("says the model's sentence where a tap would be refused", () => {
    const { tool, at } = setup()
    tool.pick('spawn')
    tool.hover(at(3, 3))
    expect(tool.view.place).toEqual({
      x: 3,
      z: 3,
      id: 'spawn1',
      action: 'none',
      reason: 'spawn allows one: entity spawn is there already',
    })
    tool.pick('crate')
    tool.hover(at(-3, 9))
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'entity crate2 is outside every sector' })
  })

  it('says a hidden or locked sub-layer takes nothing', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(3, 3))
    editor.view.toggle('hidden', 'things:crate')
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'the crate layer is hidden' })
    editor.view.set({ hidden: [], locked: ['things'] })
    expect(tool.view.place).toMatchObject({ action: 'none', reason: 'the crate layer is locked' })
  })

  it('does not name a thing on a sub-layer that is off', () => {
    const { editor, tool, at } = setup()
    editor.view.toggle('locked', 'things:crate')
    tool.hover(at(11, 2))
    expect(tool.view.hover).toBeUndefined()
  })

  it('follows the camera: the same pixel is over another place after a pan', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    const pointer = at(3, 3)
    tool.hover(pointer)
    editor.view.set({ camera: { ...CAMERA, x: CAMERA.x + 1 } })
    expect(tool.view.place).toMatchObject({ x: 4, z: 3 })
  })

  it('clears the hover and the place when the pointer leaves', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(3, 3))
    tool.leave()
    expect(tool.view.hover).toBeUndefined()
    expect(tool.view.place).toBeUndefined()
  })

  it('keeps the same view object, and says nothing, when nothing changed', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    tool.hover(at(3, 3))
    const view = tool.view
    const heard = vi.fn()
    tool.subscribe(heard)
    tool.hover(at(3.01, 3.01))
    expect(tool.view).toBe(view)
    expect(heard).not.toHaveBeenCalled()
  })

  it('stops telling a subscriber that unsubscribed, and everyone after dispose', () => {
    const { editor, tool, at } = setup()
    const heard = vi.fn()
    const stop = tool.subscribe(heard)
    stop()
    tool.pick('crate')
    expect(heard).not.toHaveBeenCalled()
    const again = vi.fn()
    tool.subscribe(again)
    tool.dispose()
    tool.hover(at(3, 3))
    editor.view.toggle('hidden', 'things:crate')
    expect(again).not.toHaveBeenCalled()
  })

  it('answers for a resized canvas', () => {
    const { tool, at } = setup()
    tool.pick('crate')
    const pointer = at(3, 3)
    tool.resize({ w: 864, h: 400 })
    tool.hover(pointer)
    // The centre moved 32 px right, so the same pixel is a metre further west.
    expect(tool.view.place).toMatchObject({ x: 2, z: 3 })
  })
})

describe('placing', () => {
  it('adds the picked thing at the tap as one undo step and selects it', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.tap(at(3.2, 4.3))
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2', 'crate/crate2@3,4.5'])
    expect(editor.history.undoLabel).toBe('Add crate crate2')
    expect(editor.selection.ids).toEqual(['entity:crate/crate2'])
    expect(tool.view.refusal).toBeUndefined()
    // The new crate is under the pointer now, and the next one would be crate3.
    expect(tool.view.hover?.id).toBe('crate2')
    tool.hover(at(5, 2))
    expect(tool.view.place?.id).toBe('crate3')
    editor.history.undo()
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2'])
  })

  it('gives the new thing the default of each field, and the values given with the pick', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.tap(at(3, 3))
    tool.pick('crate', { contents: 'empty' })
    tool.tap(at(5, 3))
    expect(editor.level.entities?.slice(2)).toEqual([
      { def: 'crate', id: 'crate2', x: 3, z: 3, contents: 'supplies' },
      { def: 'crate', id: 'crate3', x: 5, z: 3, contents: 'empty' },
    ])
  })

  it('takes the id from the option when there is one', () => {
    const id = vi.fn((def: string, taken: readonly string[]) => `${def}-${taken.length}`)
    const { editor, tool, at } = setup(depot, afSectorProfile, { id })
    tool.pick('crate')
    tool.tap(at(3, 3))
    expect(id).toHaveBeenCalledWith('crate', ['spawn', 'crate1'])
    expect(editor.selection.ids).toEqual(['entity:crate/crate-2'])
  })

  it("is refused with the model's sentence, and adds nothing", () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.tap(at(-3, 9))
    expect(tool.view.refusal).toBe('entity crate2 is outside every sector')
    expect(editor.history.canUndo).toBe(false)
    tool.tap(at(3, 3))
    expect(tool.view.refusal).toBeUndefined()
  })

  it('is refused on a hidden or a locked sub-layer', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    editor.view.toggle('hidden', 'things:crate')
    tool.tap(at(3, 3))
    expect(tool.view.refusal).toBe('the crate layer is hidden')
    editor.view.set({ hidden: [], locked: ['things:crate'] })
    tool.tap(at(3, 3))
    expect(tool.view.refusal).toBe('the crate layer is locked')
    expect(editor.history.canUndo).toBe(false)
  })

  it('lets a floating Last Light thing take the floor of its room as its height', () => {
    const raised = toyBlockout({
      rooms: [{ ...toyRoom('a'), floor: 0.4 }],
      openings: [],
      boxes: [],
      hotspots: [],
    })
    const { editor, tool, at } = setup<Blockout>(raised, lastLightProfile)
    tool.pick('hotspot', { name: 'Sink', reach: 1 })
    tool.tap(at(2, 2))
    expect(editor.level.hotspots).toEqual([{ id: 'hotspot1', x: 2, y: 0.4, z: 2, name: 'Sink', reach: 1 }])
  })

  it('refuses a Last Light thing whose required fields were not given, in the sentence of the values check', () => {
    const { tool, at } = setup<Blockout>(toyBlockout(), lastLightProfile)
    tool.pick('hotspot')
    tool.hover(at(2, 2))
    expect(tool.view.place).toMatchObject({
      action: 'none',
      reason: expect.stringMatching(/^entity hotspot1: /),
    })
  })
})

describe('tapping a thing or nothing', () => {
  it('selects the thing under a tap, whatever is picked, and adds nothing', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.tap(at(11, 2))
    expect(editor.selection.ids).toEqual(['entity:crate/crate1'])
    expect(editor.history.canUndo).toBe(false)
  })

  it('adds a thing to the selection, or takes it off, with additive', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(11, 2))
    tool.tap(at(1, 1, 'mouse', { additive: true }))
    expect(editor.selection.ids).toEqual(['entity:crate/crate1', 'entity:spawn/spawn'])
    tool.tap(at(11, 2, 'mouse', { additive: true }))
    expect(editor.selection.ids).toEqual(['entity:spawn/spawn'])
  })

  it('clears the selection on a tap on nothing with nothing picked, and not with additive', () => {
    const { editor, tool, at } = setup()
    tool.tap(at(11, 2))
    tool.tap(at(3, 3, 'mouse', { additive: true }))
    expect(editor.selection.ids).toEqual(['entity:crate/crate1'])
    tool.tap(at(3, 3))
    expect(editor.selection.ids).toEqual([])
  })

  it('does not select a thing on a sub-layer that is off', () => {
    const { editor, tool, at } = setup()
    editor.view.toggle('hidden', 'things:crate')
    tool.tap(at(11, 2))
    expect(editor.selection.ids).toEqual([])
  })
})

describe('moving by drag', () => {
  it('moves the thing under the press by the grid-rounded offset as one undo step, selected from the start', () => {
    const { editor, tool, at } = setup()
    const heard: string[] = []
    tool.subscribe(() => heard.push(tool.view.gesture))
    tool.dragStart(at(11.1, 2.1), at(10.4, 2.1))
    expect(editor.selection.ids).toEqual(['entity:crate/crate1'])
    expect(tool.view.gesture).toBe('move')
    // 0.7 m west rounds to half a metre.
    expect(thingsOf(editor)[1]).toBe('crate/crate1@10.5,2')
    tool.drag(at(9.2, 3.4))
    expect(thingsOf(editor)[1]).toBe('crate/crate1@9,3.5')
    tool.dragEnd(at(9.2, 3.4), false)
    expect(tool.view.gesture).toBe('idle')
    expect(heard).toContain('move')
    expect(editor.history.undoLabel).toBe('Move crate crate1')
    editor.history.undo()
    expect(thingsOf(editor)[1]).toBe('crate/crate1@11,2')
    expect(editor.history.canUndo).toBe(false)
  })

  it('keeps the offset of a thing off the grid', () => {
    const offGrid: AfSector = {
      ...depot,
      entities: [{ def: 'crate', id: 'crate1', x: 11.2, z: 2.1, contents: 'tools' }],
    }
    const { editor, tool, at } = setup(offGrid)
    tool.dragStart(at(11.2, 2.1), at(10.2, 3.1))
    tool.dragEnd(at(10.2, 3.1), false)
    expect(thingsOf(editor)).toEqual(['crate/crate1@10.2,3.1'])
  })

  it('takes the fine step with Shift and none with Alt', () => {
    const { editor, tool, at } = setup()
    tool.dragStart(at(11, 2), at(10.337, 2, 'mouse', { shift: true }))
    expect(thingsOf(editor)[1]).toBe('crate/crate1@10.34,2')
    tool.drag(at(10.337, 2, 'mouse', { alt: true }))
    expect(thingsOf(editor)[1]).toBe('crate/crate1@10.337,2')
    tool.dragEnd(at(10.337, 2, 'mouse', { alt: true }), false)
    expect(editor.history.undoLabel).toBe('Move crate crate1')
  })

  it('keeps the last accepted place when a run is refused, says why, and clears it on the next accepted run', () => {
    const { editor, tool, at } = setup()
    tool.dragStart(at(11, 2), at(12, 2))
    tool.drag(at(16, 2))
    expect(thingsOf(editor)[1]).toBe('crate/crate1@12,2')
    expect(tool.view.refusal).toBe('entity crate1 is outside every sector')
    tool.drag(at(13, 2))
    expect(tool.view.refusal).toBeUndefined()
    tool.dragEnd(at(16, 2), false)
    expect(thingsOf(editor)[1]).toBe('crate/crate1@13,2')
    expect(tool.view.refusal).toBeUndefined()
  })

  it('leaves no step for a cancelled drag, or a drag that ends where it began', () => {
    const { editor, tool, at } = setup()
    tool.dragStart(at(11, 2), at(9, 2))
    tool.dragEnd(at(9, 2), true)
    expect(thingsOf(editor)[1]).toBe('crate/crate1@11,2')
    tool.dragStart(at(11, 2), at(9, 2))
    tool.drag(at(11.1, 2))
    tool.dragEnd(at(11.1, 2), false)
    expect(thingsOf(editor)[1]).toBe('crate/crate1@11,2')
    expect(editor.history.canUndo).toBe(false)
    expect(tool.view.gesture).toBe('idle')
  })

  it('does not take a drag from nothing, or from a thing on a sub-layer that is off', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.dragStart(at(3, 3), at(4, 3))
    expect(tool.view.gesture).toBe('idle')
    editor.view.toggle('locked', 'things:crate')
    tool.dragStart(at(11, 2), at(10, 2))
    tool.drag(at(9, 2))
    tool.dragEnd(at(9, 2), false)
    expect(tool.view.gesture).toBe('idle')
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2'])
    expect(editor.history.canUndo).toBe(false)
  })

  it('ends the drag when an undo closes its step', () => {
    const { editor, tool, at } = setup()
    tool.pick('crate')
    tool.tap(at(3, 3))
    tool.dragStart(at(11, 2), at(10, 2))
    editor.history.undo()
    expect(tool.view.gesture).toBe('idle')
    tool.drag(at(9, 2))
    tool.dragEnd(at(9, 2), false)
    expect(thingsOf(editor)[1]).toBe('crate/crate1@11,2')
  })

  it('does not start while another step is open', () => {
    const { editor, tool, at } = setup()
    const other = editor.begin('Something else')
    tool.dragStart(at(11, 2), at(10, 2))
    expect(tool.view.gesture).toBe('idle')
    other.cancel()
  })

  it('keeps the height of a thing that floats', () => {
    const lit: AfSector = {
      ...depot,
      entityDefs: [{ id: 'lamp', shape: 'point', sit: 'free', fields: [] }],
      entities: [{ def: 'lamp', id: 'lamp1', x: 2, y: 2.5, z: 2 }],
    }
    const { editor, tool, at } = setup(lit)
    tool.dragStart(at(2, 2), at(3, 2))
    tool.dragEnd(at(3, 2), false)
    expect(editor.level.entities).toEqual([{ def: 'lamp', id: 'lamp1', x: 3, y: 2.5, z: 2 }])
  })
})

/** The depot with a second crate and a switch whose ref opens crate1, so crate1 cannot go while the switch is there. */
const wired: AfSector = {
  ...depot,
  entityDefs: [
    ...(depot.entityDefs ?? []),
    { id: 'switch', shape: 'point', fields: [{ id: 'opens', type: 'ref' }] },
  ],
  entities: [
    ...(depot.entities ?? []),
    { def: 'crate', id: 'crate2', x: 12, z: 4, contents: 'empty' },
    { def: 'switch', id: 'sw1', x: 3, z: 2, opens: { target: 'crate1' } },
  ],
}

describe('deleting', () => {
  it('takes the selected thing out as one undo step, and the selection drops it', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    expect(tool.remove()).toBeUndefined()
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1'])
    expect(editor.history.undoLabel).toBe('Remove crate crate1')
    expect(editor.selection.ids).toEqual([])
    editor.history.undo()
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2'])
  })

  it('takes several out as one step, and leaves what is not a thing in the selection alone', () => {
    const { editor, tool } = setup(wired)
    editor.selection.set(['entity:crate/crate2', 'sector:hall', 'entity:switch/sw1'])
    expect(tool.remove()).toBeUndefined()
    expect(thingsOf(editor)).toEqual(['spawn/spawn@1,1', 'crate/crate1@11,2'])
    expect(editor.history.undoLabel).toBe('Remove 2 things')
    expect(editor.selection.ids).toEqual(['sector:hall'])
    editor.history.undo()
    expect(thingsOf(editor)).toHaveLength(4)
    expect(editor.history.canUndo).toBe(false)
  })

  it("is refused with the edit's sentence while something names the thing, and then nothing goes", () => {
    const { editor, tool } = setup(wired)
    editor.selection.set(['entity:crate/crate2', 'entity:crate/crate1'])
    const reason = tool.remove()
    expect(reason).toMatch(/^crate crate1 is still referenced: /)
    expect(tool.view.refusal).toBe(reason)
    expect(thingsOf(editor)).toHaveLength(4)
    expect(editor.history.canUndo).toBe(false)
  })

  it('answers that a thing must be selected first', () => {
    const { editor, tool } = setup()
    expect(tool.remove()).toBe('select a thing first')
    editor.selection.set(['sector:hall'])
    expect(tool.remove()).toBe('select a thing first')
    expect(tool.view.refusal).toBe('select a thing first')
  })

  it('is refused for a thing on a hidden or locked sub-layer', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    editor.view.toggle('locked', 'things:crate')
    expect(tool.remove()).toBe('the crate layer is locked')
    editor.view.set({ locked: [], hidden: ['things'] })
    expect(tool.remove()).toBe('the crate layer is hidden')
    expect(thingsOf(editor)).toHaveLength(2)
  })

  it('does not start while another step is open', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    const other = editor.begin('Something else')
    expect(tool.remove()).toBeDefined()
    other.cancel()
    expect(thingsOf(editor)).toHaveLength(2)
  })
})

describe('setting a field', () => {
  it('sets a field of the one selected thing as one undo step, and clears it with null', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    expect(tool.setField('contents', 'empty')).toBeUndefined()
    expect(editor.level.entities?.[1]).toMatchObject({ contents: 'empty' })
    expect(editor.history.undoLabel).toBe('Set contents of crate1')
    expect(tool.setField('contents', null)).toBeUndefined()
    expect(editor.level.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 11, z: 2 })
  })

  it("answers the edit's sentence for a value that does not fit, and changes nothing", () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    const reason = tool.setField('contents', 'gold')
    expect(reason).toMatch(/^entity crate1: /)
    expect(tool.view.refusal).toBe(reason)
    expect(editor.history.canUndo).toBe(false)
  })

  it('answers that one thing must be selected', () => {
    const { editor, tool } = setup()
    expect(tool.setField('contents', 'empty')).toBe('select one thing first')
    editor.selection.set(['entity:crate/crate1', 'entity:spawn/spawn'])
    expect(tool.setField('contents', 'empty')).toBe('select one thing first')
    editor.selection.set(['entity:crate/crate1', 'sector:hall'])
    expect(tool.setField('contents', 'empty')).toBeUndefined()
  })

  it('is refused for a thing on a locked sub-layer', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:spawn/spawn'])
    editor.view.toggle('locked', 'things:spawn')
    expect(tool.setField('facing', 90)).toBe('the spawn layer is locked')
  })

  it('makes scrubbing one field one undo step', () => {
    let now = 0
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot, now: () => now })
    const tool = createThingsTool(editor, SIZE)
    editor.selection.set(['entity:spawn/spawn'])
    for (const facing of [10, 20, 30]) {
      now += 50
      tool.setField('facing', facing)
    }
    expect(editor.level.entities?.[0]).toMatchObject({ facing: 30 })
    editor.history.undo()
    expect(editor.level.entities?.[0]).toMatchObject({ facing: 0 })
    expect(editor.history.canUndo).toBe(false)
  })

  it('clears an earlier refusal when the next action goes in', () => {
    const { editor, tool } = setup()
    editor.selection.set(['entity:crate/crate1'])
    tool.setField('contents', 'gold')
    tool.setField('contents', 'tools')
    expect(tool.view.refusal).toBeUndefined()
  })
})
