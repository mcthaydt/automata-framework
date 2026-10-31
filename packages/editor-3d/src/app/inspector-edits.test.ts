// What the inspector's widgets do to the level (ED3D.5f step 3, plan decision 1; ED3D spec §5.3 flow 3: a drag is one
// transaction): a set is one undo step; a scrub (start, updates, commit) is one step too; a cancel leaves the level as it
// was; a refusal changes nothing and answers the model's sentence. The depot, as in `inspector-cards.test.ts`.
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { inspectorOf } from './inspector-cards'
import { createInspectorEdits } from './inspector-edits'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

function setup(selected: string) {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.selection.set([selected])
  return { editor, edits: createInspectorEdits(editor), card: () => inspectorOf(editor) }
}

describe('inspector edits', () => {
  it('sets a sector’s floor as one undo step', () => {
    const { editor, edits, card } = setup('sector:hall')
    expect(edits.change({ kind: 'sector', id: 'hall', floor: 0.5 }, 'set')).toBeUndefined()
    expect(card()).toMatchObject({ floor: 0.5 })
    expect(editor.history.undoLabel).toBe('Set the heights of hall')
    editor.history.undo()
    expect(editor.level).toEqual(depot)
  })

  it('makes a scrub of the light one undo step, and a cancelled scrub nothing', () => {
    const { editor, edits, card } = setup('sector:hall')
    edits.change({ kind: 'sector', id: 'hall', light: 0.9 }, 'start')
    edits.change({ kind: 'sector', id: 'hall', light: 0.8 }, 'update')
    edits.change({ kind: 'sector', id: 'hall', light: 0.7 }, 'update')
    edits.change({ kind: 'sector', id: 'hall', light: 0.6 }, 'commit')
    expect(card()).toMatchObject({ light: 0.6 })
    editor.history.undo()
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
    edits.change({ kind: 'sector', id: 'hall', light: 0.2 }, 'start')
    edits.change({ kind: 'sector', id: 'hall', light: 0.1 }, 'cancel')
    expect(editor.level).toEqual(depot)
    expect(editor.history.canUndo).toBe(false)
  })

  it('refuses a floor above the ceiling in the model’s sentence and changes nothing', () => {
    const { editor, edits } = setup('sector:hall')
    expect(edits.change({ kind: 'sector', id: 'hall', floor: 5 }, 'set')).toMatch(/ceiling/)
    expect(editor.level).toEqual(depot)
  })

  it('changes a wall’s kind, its door, its occlude and its flags, each one step', () => {
    const { editor, edits, card } = setup('wall:hall/2')
    expect(edits.change({ kind: 'wall', sector: 'hall', corner: 2, type: 'door' }, 'set')).toBeUndefined()
    expect(card()).toMatchObject({ type: 'door' })
    expect(
      edits.change({ kind: 'wall', sector: 'hall', corner: 2, door: { width: 1.5 } }, 'set'),
    ).toBeUndefined()
    expect(card()).toMatchObject({ door: { width: 1.5 } })
    expect(edits.change({ kind: 'wall', sector: 'hall', corner: 2, occlude: 'fade' }, 'set')).toBeUndefined()
    expect(card()).toMatchObject({ occlude: 'fade' })
    expect(
      edits.change({ kind: 'wall', sector: 'hall', corner: 2, flags: { handrail: 1 } }, 'set'),
    ).toBeUndefined()
    expect(card()).toMatchObject({ handrail: 1 })
    for (let step = 0; step < 4; step++) editor.history.undo()
    expect(editor.level).toEqual(depot)
  })

  it('sets a sector’s materials as one step', () => {
    const { edits, card } = setup('sector:dock')
    expect(
      edits.change({ kind: 'sector', id: 'dock', materials: { floorTexture: 'tile' } }, 'set'),
    ).toBeUndefined()
    expect(card()).toMatchObject({ floorTexture: 'tile' })
  })

  it('removes a thing as one step (ED3D.7d)', () => {
    const { editor, edits } = setup('entity:crate/crate1')
    expect(
      edits.change({ kind: 'thing', definition: 'crate', id: 'crate1', remove: true }, 'set'),
    ).toBeUndefined()
    expect(afSectorProfile.entities(editor.level as AfSector).things.map((thing) => thing.id)).toEqual([
      'spawn',
    ])
    editor.history.undo()
    expect(editor.level).toEqual(depot)
  })
})

describe('a thing’s field (ED3D.7d-b)', () => {
  const crate = { kind: 'thing', definition: 'crate', id: 'crate1', field: 'contents' } as const

  it('sets the field as one undo step', () => {
    const { editor, edits, card } = setup('entity:crate/crate1')
    expect(edits.change({ ...crate, value: 'empty' }, 'set')).toBeUndefined()
    expect(card()).toMatchObject({ fields: [{ id: 'contents', value: 'empty' }] })
    editor.history.undo()
    expect(card()).toMatchObject({ fields: [{ id: 'contents', value: 'tools' }] })
  })

  it('answers the model’s sentence for a value the field rejects, and changes nothing', () => {
    const { edits, card } = setup('entity:crate/crate1')
    expect(edits.change({ ...crate, value: 'gold' }, 'set')).toMatch(/crate1/)
    expect(card()).toMatchObject({ fields: [{ id: 'contents', value: 'tools' }] })
  })
})
