import { createHistory, type History } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import { placeEntity, setEntityField } from '../../model/commands/entity-edits'
import { counterIds } from '../../model/ids'
import type { EntityDef2D, Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { createEntitiesSession, type EntitiesSession } from './entities-session'

const target = { level: 'level-1', layer: 'entities' } as const

/** The platformer with two slimes on level 1, the second tinted by hand. */
function withSlimes(): Project {
  let project = platformerTemplate.create(counterIds())
  project = placeEntity(project, target, { id: 'slime-1', def: 'slime', x: 32, y: 64 })
  project = placeEntity(project, target, { id: 'slime-2', def: 'slime', x: 64, y: 64 })
  return setEntityField(project, target, 'slime-2', 'tint', '#ff0000')
}

function open(project: Project = withSlimes()): { history: History<unknown>; session: EntitiesSession } {
  const history = createHistory<unknown>(project)
  const session = createEntitiesSession({ history, ids: counterIds(500) })
  if (session === undefined) throw new Error('no session')
  return { history, session }
}

const stateOf = (history: History<unknown>): Project => history.state as Project
const defOf = (history: History<unknown>, id: string): EntityDef2D | undefined =>
  stateOf(history).defs.entities.find((def) => def.id === id)
const slimes = (history: History<unknown>): string[] =>
  stateOf(history)
    .levels.flatMap((level) => level.layers)
    .flatMap((layer) => (layer.kind === 'entities' ? layer.items : []))
    .filter((item) => item.def === 'slime')
    .map((item) => item.id)

/** Runs `edit` and says it added exactly one undo step with `label`. */
function oneStep(history: History<unknown>, label: string, edit: () => unknown): void {
  const before = history.revision
  expect(edit()).toEqual({ ok: true })
  expect(history.revision).toBe(before + 1)
  expect(history.undoLabel).toBe(label)
}

/** Runs `edit` and says it was refused with `message` and added no step. */
function refusedWith(history: History<unknown>, message: string | RegExp, edit: () => unknown): void {
  const before = history.revision
  expect(edit()).toEqual({ ok: false, message: expect.stringMatching(message) })
  expect(history.revision).toBe(before)
}

describe('the Entities session: definitions', () => {
  it('is undefined for a document that is not a level project', () => {
    expect(
      createEntitiesSession({ history: createHistory<unknown>({ kind: 'other' }), ids: counterIds() }),
    ).toBe(undefined)
  })

  it('adds a 16 × 16 rect with its pivot at the bottom centre, and selects it', () => {
    const { history, session } = open()
    oneStep(history, 'Add entity', () => session.addDefinition())
    const added = defOf(history, 'entity-000000dw')
    expect(added).toMatchObject({
      shape: 'rect',
      size: { w: 16, h: 16 },
      pivot: { x: 0.5, y: 1 },
      fields: [],
    })
    expect(session.selection.def?.id).toBe('entity-000000dw')
  })

  it('renames a definition and its instances follow, keeping it selected', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' } })
    oneStep(history, 'Rename entity', () => session.renameDefinition('blob'))
    expect(defOf(history, 'blob')).toBeDefined()
    expect(session.selection.def?.id).toBe('blob')
    refusedWith(history, /already used/, () => session.renameDefinition('coin'))
  })

  it('edits the label, colour, shape, size, pivot, single and tile as one step each', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'coin' } })
    oneStep(history, 'Edit entity', () => session.editDefinition({ label: 'Gem' }))
    oneStep(history, 'Edit entity', () => session.editDefinition({ shape: 'point' }))
    oneStep(history, 'Edit entity', () => session.editDefinition({ size: { w: 24, h: 8 } }))
    oneStep(history, 'Edit entity', () => session.editDefinition({ pivot: { x: 0, y: 0 } }))
    oneStep(history, 'Edit entity', () => session.editDefinition({ single: true }))
    oneStep(history, 'Edit entity', () => session.editDefinition({ tile: { tileset: 'terrain', index: 2 } }))
    expect(defOf(history, 'coin')).toMatchObject({
      label: 'Gem',
      shape: 'point',
      size: { w: 24, h: 8 },
      pivot: { x: 0, y: 0 },
      single: true,
      tile: { tileset: 'terrain', index: 2 },
    })
    oneStep(history, 'Edit entity', () => session.editDefinition({ tile: undefined }))
    expect(defOf(history, 'coin')?.tile).toBeUndefined()
  })

  it('refuses a value the model refuses, with its message and no step', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'coin' } })
    refusedWith(history, /./, () => session.editDefinition({ size: { w: 0, h: 8 } }))
    refusedWith(history, /tiles 0 to/, () =>
      session.editDefinition({ tile: { tileset: 'terrain', index: 9999 } }),
    )
  })

  it('duplicates a definition under a new id with no instances, and selects the copy', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' } })
    oneStep(history, 'Duplicate entity', () => session.duplicateDefinition())
    const copy = session.selection.def
    expect(copy?.id).toBe('entity-000000dw')
    expect(copy?.label).toBe('Copy of Slime')
    expect(copy?.fields).toEqual(defOf(history, 'slime')?.fields)
  })

  it('deletes an unused definition without asking', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'coin' } })
    oneStep(history, 'Delete entity', () => session.deleteDefinition())
    expect(defOf(history, 'coin')).toBeUndefined()
  })

  it('refuses to delete a definition in use with its instances, then "anyway" removes them as one step (G-f)', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' } })
    const before = history.revision
    const refusal = session.deleteDefinition()
    expect(refusal.ok).toBe(false)
    expect(refusal.ok === false && 'uses' in refusal ? refusal.uses.map((use) => use.path) : []).toEqual([
      'levels[level-1].layers[entities].items[slime-1]',
      'levels[level-1].layers[entities].items[slime-2]',
    ])
    expect(history.revision).toBe(before)
    oneStep(history, 'Delete entity', () => session.deleteDefinition({ anyway: true }))
    expect(defOf(history, 'slime')).toBeUndefined()
    expect(slimes(history)).toEqual([])
    expect(session.selection.def?.id).toBe('player-start')
    history.undo()
    expect(slimes(history)).toEqual(['slime-1', 'slime-2'])
  })
})

describe('the Entities session: fields', () => {
  it('adds an optional text field to the selected owner, and selects it', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' } })
    oneStep(history, 'Add field', () => session.addField())
    expect(session.selection.field).toEqual({ id: 'field_000000dw', type: 'text', default: '' })
    session.select({ owner: 'level' })
    oneStep(history, 'Add field', () => session.addField())
    expect(stateOf(history).defs.levelFields.map((field) => field.id)).toEqual(['music', 'field_000000dx'])
  })

  it('renames a field and keeps it selected', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' }, field: 'hp' })
    oneStep(history, 'Rename field', () => session.renameField('health'))
    expect(session.selection.field?.id).toBe('health')
    refusedWith(history, /already used/, () => session.renameField('tint'))
  })

  it('changes a field definition through the retype rule as one step', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' }, field: 'hp' })
    const hp = session.selection.field
    if (hp === undefined) throw new Error('no hp')
    oneStep(history, 'Change field', () => session.changeField({ ...hp, label: 'Health', max: 12 }))
    expect(session.selection.field).toMatchObject({ label: 'Health', max: 12 })
    refusedWith(history, /./, () => session.changeField({ ...hp, min: 5, max: 1 }))
  })

  it('refuses a change that breaks values with each one, then "anyway" is one step (G-f)', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' }, field: 'hp' })
    const before = history.revision
    const refusal = session.setType('text')
    expect(refusal.ok === false && 'uses' in refusal ? refusal.uses.map((use) => use.path) : []).toEqual([
      'levels[level-1].layers[entities].items[slime-1].fields.hp',
      'levels[level-1].layers[entities].items[slime-2].fields.hp',
    ])
    expect(history.revision).toBe(before)
    oneStep(history, 'Change field', () => session.setType('text', { anyway: true }))
    expect(session.selection.field).toEqual({ id: 'hp', type: 'text', label: 'Hit points' })
  })

  it('changes the type of a field nothing holds without asking', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'door' }, field: 'target' })
    oneStep(history, 'Change field', () => session.setType('enum'))
    expect(session.selection.field).toMatchObject({ type: 'enum', options: ['a'], required: true })
  })

  it('deletes a field in use only "anyway", as one step, and the selection falls back', () => {
    const { history, session } = open()
    session.select({ owner: { entity: 'slime' }, field: 'tint' })
    const refusal = session.deleteField()
    expect(refusal.ok === false && 'uses' in refusal ? refusal.uses.map((use) => use.path) : []).toEqual([
      'levels[level-1].layers[entities].items[slime-2].fields.tint',
    ])
    oneStep(history, 'Delete field', () => session.deleteField({ anyway: true }))
    expect(session.selection.fields.map((field) => field.id)).toEqual(['hp', 'patrol'])
    expect(session.selection.field?.id).toBe('hp')
  })

  it('tells its subscribers about selection and history changes', () => {
    const { history, session } = open()
    let told = 0
    const stop = session.subscribe(() => told++)
    session.select({ owner: 'level' })
    expect(told).toBe(1)
    session.addField()
    expect(told).toBeGreaterThan(1)
    const afterAdd = told
    history.undo()
    expect(told).toBe(afterAdd + 1)
    stop()
    session.select({ owner: { entity: 'slime' } })
    expect(told).toBe(afterAdd + 1)
    session.dispose()
  })
})
