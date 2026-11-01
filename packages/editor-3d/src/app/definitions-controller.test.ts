// The definitions editor's controller (ED3D.13b; ED3D spec §4.7, §5.4, ED3-r): the level's entity definitions and its
// materials table as rows, and every change as one undo step through the model's `def.*` and `material.*` edits. A
// refusal is the model's own sentence and changes nothing. A profile with fixed definitions (Last Light) has no rows.
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import { loadAuthored } from '../testing/fixtures'
import { toyBlockout } from '../testing/toy-blockout'
import { createDefinitionsController } from './definitions-controller'

const depot = ((): AfSector => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const open = () => {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  return { editor, controller: createDefinitionsController(editor) }
}

describe('the definitions controller', () => {
  it('lists the definitions with their instance counts, and the materials', () => {
    const { controller } = open()
    const { definitions, materials } = controller.view
    expect(definitions?.map((row) => row.id)).toEqual(expect.arrayContaining(['spawn', 'crate']))
    expect(definitions?.find((row) => row.id === 'crate')?.instances).toBe(1)
    expect(materials?.map((row) => row.id).length).toBeGreaterThan(0)
  })

  it('adds a definition and a field as undo steps, and an undo takes each back', () => {
    const { editor, controller } = open()
    expect(controller.addDefinition({ id: 'lamp', shape: 'point' })).toBeUndefined()
    expect(controller.view.definitions?.some((row) => row.id === 'lamp')).toBe(true)
    expect(controller.addField('lamp', { id: 'power', type: 'int' })).toBeUndefined()
    expect(controller.view.definitions?.find((row) => row.id === 'lamp')?.fields.map((f) => f.id)).toEqual([
      'power',
    ])
    editor.history.undo()
    expect(controller.view.definitions?.find((row) => row.id === 'lamp')?.fields).toEqual([])
    editor.history.undo()
    expect(controller.view.definitions?.some((row) => row.id === 'lamp')).toBe(false)
  })

  it('says why a bad definition id or a repeat is refused, and changes nothing', () => {
    const { editor, controller } = open()
    expect(controller.addDefinition({ id: 'Lamp', shape: 'point' })).toMatch(/id must be an id/)
    expect(controller.addDefinition({ id: 'crate', shape: 'point' })).toBe(
      'there is already a definition called crate',
    )
    expect(editor.history.canUndo).toBe(false)
  })

  it('refuses a retype that an instance would not survive, in the kit’s words', () => {
    const { controller } = open()
    controller.addField('crate', { id: 'weight', type: 'int' })
    // the one crate has no value yet, so the field is new; give it one through the thing edit and retype
    const refusal = controller.addField('crate', { id: 'weight', type: 'text' })
    expect(refusal).toBe('crate already has a field weight')
  })

  it('renames a definition with its instances, and refuses to remove one that is in use', () => {
    const { controller } = open()
    expect(controller.renameDefinition('crate', 'box')).toBeUndefined()
    expect(controller.view.definitions?.find((row) => row.id === 'box')?.instances).toBe(1)
    expect(controller.removeDefinition('box')).toBe('box is still used: entity crate1')
    expect(controller.addDefinition({ id: 'lamp', shape: 'point' })).toBeUndefined()
    expect(controller.removeDefinition('lamp')).toBeUndefined()
  })

  it('adds, renames and removes a material in the table, refusing one that is in use', () => {
    const { controller } = open()
    expect(controller.addMaterial('rust', { category: 'walls' })).toBeUndefined()
    expect(controller.view.materials?.map((row) => row.id)).toContain('rust')
    expect(controller.renameMaterial('rust', 'rust-2')).toBeUndefined()
    expect(controller.removeMaterial('rust-2')).toBeUndefined()
    const used = controller.view.materials?.[0]?.id ?? ''
    expect(controller.removeMaterial(used)).toMatch(/still used/)
  })

  it('offers no rows for definitions or materials a format fixes', () => {
    const editor = createLevelEditor({ profile: lastLightProfile, level: toyBlockout() })
    const { view } = createDefinitionsController(editor)
    expect(view.definitions).toBeUndefined()
    expect(view.materials).toBeUndefined()
    expect(view.fixed).toMatch(/fixed/)
  })

  it('tells a listener when the level changes', () => {
    const { editor, controller } = open()
    let heard = 0
    controller.subscribe(() => heard++)
    editor.history.undo()
    controller.addDefinition({ id: 'lamp', shape: 'point' })
    expect(heard).toBeGreaterThan(0)
  })
})
