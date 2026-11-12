// The definition edits (ED3D.13a step 2): add, rename, set a field of and remove an entity definition, on the depot
// (`af-sector/1`), and the refusal on a format whose definitions are fixed. A definitions edit
// never makes a valid instance invalid (the kit's `checkRetype`), and an accepted edit never makes the checks worse.

import type { AfSector2File } from '@automata/3d/level'
import type { FieldDef } from '@automata/editor/kit/fields'
import { describe, expect, it } from 'vitest'
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setDefinitionField,
} from '#src/shared/edit/definition-edits.ts'
import type { Edit, EditResult } from '#src/shared/edit/edit.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { addThing, setThingField } from '#src/shared/edit/thing-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { ThingDef } from '#src/shared/things/thing-def.schema.ts'
import { levelOf, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depotText = loadAuthored('depot.af-sector')
const depot = ((): AfSector2File => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const runAf = (edit: Edit<AfSector2File>, level: AfSector2File = depot): EditResult<AfSector2File> =>
  edit.run(afSectorProfile, level)
/** A format that fixes its definitions leaves `definitions` out of its profile. */
const runFixed = (edit: Edit<AfSector2File>): EditResult<AfSector2File> =>
  edit.run({ ...afSectorProfile, definitions: undefined }, depot)

/** The depot with a second crate and a switch whose ref field may point only at a crate. */
const wired: AfSector2File = {
  ...depot,
  entityDefs: [
    ...(depot.entityDefs ?? []),
    { id: 'switch', shape: 'point', fields: [{ id: 'opens', type: 'ref', to: ['crate'] }] },
  ],
  entities: [
    ...(depot.entities ?? []),
    { def: 'crate', id: 'crate2', x: 12, z: 3, contents: 'empty' },
    { def: 'switch', id: 'sw1', x: 3, z: 2, opens: { target: 'crate1' } },
  ],
}

/** Every problem the `ids` and `entities` checks report, as sentences. */
const entitySentences = (level: AfSector2File): string[] =>
  afSectorProfile
    .checks(level)
    .filter((result) => result.id === 'ids' || result.id === 'entities')
    .flatMap((result) => result.problems.map((problem) => problem.message))

/** The level an edit made, after showing that it made no `ids` or `entities` problem the level did not have. */
function accepted(edit: Edit<AfSector2File>, level: AfSector2File = depot): AfSector2File {
  const next = levelOf(runAf(edit, level))
  const before = new Set(entitySentences(level))
  expect(entitySentences(next).filter((sentence) => !before.has(sentence))).toEqual([])
  return next
}

/** The reason an edit was refused, after showing it is a refusal. */
const refused = (edit: Edit<AfSector2File>, level: AfSector2File = depot): string =>
  reasonOf(runAf(edit, level))

const defIds = (level: AfSector2File): string[] => (level.entityDefs ?? []).map((def) => def.id)
const fieldsOf = (level: AfSector2File, id: string): unknown =>
  (level.entityDefs ?? []).find((def) => def.id === id)?.fields

const barrel: ThingDef = {
  id: 'barrel',
  shape: 'box',
  size: [1, 1.2, 1],
  fields: [{ id: 'fuel', type: 'int', min: 0, max: 9, default: 5 }],
}

describe('the definitions of a format that fixes them', () => {
  it('refuses every definition edit, and changes nothing', () => {
    const fixed = "this level's entity definitions are fixed by its format"
    expect(reasonOf(runFixed(addDefinition({ definition: barrel })))).toBe(fixed)
    expect(reasonOf(runFixed(renameDefinition({ def: 'crate', to: 'chest' })))).toBe(fixed)
    expect(
      reasonOf(runFixed(setDefinitionField({ def: 'crate', value: { id: 'glow', type: 'float' } }))),
    ).toBe(fixed)
    expect(reasonOf(runFixed(removeDefinition({ def: 'crate' })))).toBe(fixed)
  })
})

describe('addDefinition (def.add)', () => {
  it('adds a definition at the end of entityDefs, and a patch writes it', () => {
    const next = accepted(addDefinition({ definition: barrel }))
    expect(defIds(next)).toEqual(['spawn', 'crate', 'barrel'])
    const text = afSectorProfile.patch(depotText, depot, next)
    expect(text.ok && afSectorProfile.parse(text.text)).toEqual({ ok: true, value: next })
  })

  it('refuses an id that is no entity id, and one that is taken', () => {
    expect(refused(addDefinition({ definition: { ...barrel, id: 'Barrel' } }))).toBe(
      'the definition id must be an id: a lowercase letter, then lowercase letters, digits or -',
    )
    expect(refused(addDefinition({ definition: { ...barrel, id: 'crate' } }))).toBe(
      'there is already a definition called crate',
    )
  })

  it('refuses a definition the rules refuse, in the reader’s own sentence', () => {
    const { size: _size, ...unsized } = barrel
    expect(refused(addDefinition({ definition: unsized }))).toBe(
      'entity definition barrel: a box has a size, or float fields w, h and d that give each box its own',
    )
    expect(refused(addDefinition({ definition: { ...barrel, fields: [{ id: 'x', type: 'float' }] } }))).toBe(
      'entity definition barrel: field x is taken: a thing keeps def, id, x, y and z for itself',
    )
  })

  it('refuses a ref field that may point at no definition, and allows itself and $sector', () => {
    const pointing = (to: string[]): ThingDef => ({
      ...barrel,
      fields: [{ id: 'next', type: 'ref', to }],
    })
    expect(refused(addDefinition({ definition: pointing(['crate', 'ghost']) }))).toBe(
      'entity definition barrel: next may point at ghost, which is not a definition or $sector',
    )
    accepted(addDefinition({ definition: pointing(['barrel', '$sector', 'crate']) }))
  })
})

describe('renameDefinition (def.rename)', () => {
  it('renames the definition, what its instances call it and every ref field that may point at it', () => {
    const next = accepted(renameDefinition({ def: 'crate', to: 'box' }), wired)
    expect(defIds(next)).toEqual(['spawn', 'box', 'switch'])
    expect(next.entities?.filter((entity) => entity.def === 'box').map((entity) => entity.id)).toEqual([
      'crate1',
      'crate2',
    ])
    expect(fieldsOf(next, 'switch')).toEqual([{ id: 'opens', type: 'ref', to: ['box'] }])
    expect(next.entities?.find((entity) => entity.id === 'sw1')).toEqual(
      wired.entities?.find((entity) => entity.id === 'sw1'),
    )
  })

  it('renames a ref field’s own definition in its own to', () => {
    const chain: AfSector2File = {
      ...depot,
      entityDefs: [
        ...(depot.entityDefs ?? []),
        { id: 'link', shape: 'point', fields: [{ id: 'next', type: 'ref', to: ['link'] }] },
      ],
    }
    expect(fieldsOf(accepted(renameDefinition({ def: 'link', to: 'node' }), chain), 'node')).toEqual([
      { id: 'next', type: 'ref', to: ['node'] },
    ])
  })

  it('is the level itself for the same id; refuses a bad id, a taken one, and a definition that is not there', () => {
    expect(levelOf(runAf(renameDefinition({ def: 'crate', to: 'crate' })))).toBe(depot)
    expect(refused(renameDefinition({ def: 'crate', to: 'Box' }))).toBe(
      'the definition id must be an id: a lowercase letter, then lowercase letters, digits or -',
    )
    expect(refused(renameDefinition({ def: 'crate', to: 'spawn' }))).toBe(
      'there is already a definition called spawn',
    )
    expect(refused(renameDefinition({ def: 'ghost', to: 'box' }))).toBe('no entity definition ghost')
  })

  it('rewrites the to of a definition the reader could not read', () => {
    const broken: AfSector2File = {
      ...depot,
      entityDefs: [
        ...(depot.entityDefs ?? []),
        { id: 'bad', shape: 'cone', fields: [{ id: 'opens', type: 'ref', to: ['crate', '$sector'] }] },
      ],
    }
    const next = levelOf(runAf(renameDefinition({ def: 'crate', to: 'box' }), broken))
    expect(next.entityDefs?.at(-1)).toEqual({
      id: 'bad',
      shape: 'cone',
      fields: [{ id: 'opens', type: 'ref', to: ['box', '$sector'] }],
    })
  })

  it('refuses a definition the reader could not read, with its sentence', () => {
    const broken: AfSector2File = {
      ...depot,
      entityDefs: [...(depot.entityDefs ?? []), { id: 'bad', shape: 'cone' }],
    }
    expect(refused(renameDefinition({ def: 'bad', to: 'good' }), broken)).toMatch(
      /^entity definition bad: shape: /,
    )
  })
})

describe('setDefinitionField (def.setField)', () => {
  const contents = (more: Partial<FieldDef> = {}): FieldDef => ({
    id: 'contents',
    type: 'enum',
    options: ['supplies', 'tools', 'empty'],
    default: 'supplies',
    ...more,
  })

  it('adds a field at the end of the definition, and instances that lack an optional one still validate', () => {
    const next = accepted(
      setDefinitionField({ def: 'crate', value: { id: 'weight', type: 'float', min: 0 } }),
      wired,
    )
    expect(fieldsOf(next, 'crate')).toEqual([contents(), { id: 'weight', type: 'float', min: 0 }])
    expect(next.entities).toBe(wired.entities)
  })

  it('refuses a new required field while an instance has no value for it, and one that is there already', () => {
    expect(
      refused(
        setDefinitionField({ def: 'crate', value: { id: 'owner', type: 'text', required: true } }),
        wired,
      ),
    ).toBe(
      'crate: owner would stop validating: entity crate1: The thing needs an owner. Fill it in.; entity crate2: The thing needs an owner. Fill it in.',
    )
    expect(refused(setDefinitionField({ def: 'crate', value: { id: 'contents', type: 'text' } }))).toBe(
      'crate already has a field contents',
    )
  })

  it('retypes a field, refused with checkRetype’s list while an instance would stop validating', () => {
    expect(
      refused(
        setDefinitionField({ def: 'crate', field: 'contents', value: contents({ options: ['supplies'] }) }),
        wired,
      ),
    ).toBe(
      'crate: contents would stop validating: entity crate1: contents has no option "tools"; entity crate2: contents has no option "empty"',
    )
    const widened = accepted(
      setDefinitionField({
        def: 'crate',
        field: 'contents',
        value: contents({ options: ['supplies', 'tools', 'empty', 'gold'] }),
      }),
      wired,
    )
    expect(fieldsOf(widened, 'crate')).toEqual([
      contents({ options: ['supplies', 'tools', 'empty', 'gold'] }),
    ])
    const texted = accepted(
      setDefinitionField({ def: 'crate', field: 'contents', value: { id: 'contents', type: 'text' } }),
      wired,
    )
    expect(fieldsOf(texted, 'crate')).toEqual([{ id: 'contents', type: 'text' }])
  })

  it('does not blame a retype for an instance that was already invalid', () => {
    const faulty: AfSector2File = {
      ...wired,
      entities: wired.entities?.map((entity) =>
        entity.id === 'crate2' ? { ...entity, contents: 7 } : entity,
      ),
    }
    const next = levelOf(
      runAf(
        setDefinitionField({
          def: 'crate',
          field: 'contents',
          value: contents({ options: ['tools', 'gold'], default: 'tools' }),
        }),
        faulty,
      ),
    )
    expect(fieldsOf(next, 'crate')).toEqual([contents({ options: ['tools', 'gold'], default: 'tools' })])
  })

  it('renames a field, and every instance keeps its value under the new name', () => {
    const next = accepted(
      setDefinitionField({ def: 'crate', field: 'contents', value: contents({ id: 'holds' }) }),
      wired,
    )
    expect(fieldsOf(next, 'crate')).toEqual([contents({ id: 'holds' })])
    expect(next.entities?.filter((entity) => entity.def === 'crate').map((entity) => entity.holds)).toEqual([
      'tools',
      'empty',
    ])
    expect(next.entities?.some((entity) => Object.hasOwn(entity, 'contents'))).toBe(false)
    const text = afSectorProfile.patch(
      depotText,
      depot,
      levelOf(
        runAf(setDefinitionField({ def: 'crate', field: 'contents', value: contents({ id: 'holds' }) })),
      ),
    )
    expect(text.ok).toBe(true)
  })

  it('refuses a rename to a field id the definition has, or one the kit refuses', () => {
    const twoFields: AfSector2File = {
      ...depot,
      entityDefs: depot.entityDefs?.map((def) =>
        def.id === 'crate' ? { ...def, fields: [contents(), { id: 'weight', type: 'float' }] } : def,
      ),
    }
    expect(
      refused(
        setDefinitionField({ def: 'crate', field: 'contents', value: contents({ id: 'weight' }) }),
        twoFields,
      ),
    ).toBe('crate already has a field weight')
    expect(
      refused(setDefinitionField({ def: 'crate', field: 'contents', value: contents({ id: '9lives' }) })),
    ).toMatch(/^entity definition crate: /)
  })

  it('refuses a narrowed to that leaves a ref pointing at something it no longer allows', () => {
    const withLamp: AfSector2File = {
      ...wired,
      entityDefs: [...(wired.entityDefs ?? []), { id: 'lamp', shape: 'point', fields: [] }],
    }
    expect(
      refused(
        setDefinitionField({
          def: 'switch',
          field: 'opens',
          value: { id: 'opens', type: 'ref', to: ['lamp'] },
        }),
        withLamp,
      ),
    ).toBe('switch: opens would stop validating: entity sw1: opens points at crate1, which is no lamp')
    accepted(
      setDefinitionField({
        def: 'switch',
        field: 'opens',
        value: { id: 'opens', type: 'ref', to: ['lamp', 'crate'] },
      }),
      withLamp,
    )
  })

  it('does not blame a rename of a ref field for a ref that already pointed at nothing', () => {
    const dangling: AfSector2File = {
      ...wired,
      entities: wired.entities?.map((entity) =>
        entity.id === 'sw1' ? { ...entity, opens: { target: 'ghost' } } : entity,
      ),
    }
    const next = levelOf(
      runAf(
        setDefinitionField({
          def: 'switch',
          field: 'opens',
          value: { id: 'trips', type: 'ref', to: ['crate'] },
        }),
        dangling,
      ),
    )
    expect(next.entities?.find((entity) => entity.id === 'sw1')).toMatchObject({ trips: { target: 'ghost' } })
  })

  it('refuses a new ref field that may point at no definition', () => {
    expect(
      refused(setDefinitionField({ def: 'crate', value: { id: 'key', type: 'ref', to: ['ghost'] } })),
    ).toBe('entity definition crate: key may point at ghost, which is not a definition or $sector')
  })

  it('refuses to remove a field the definition cannot do without, in the reader’s sentence', () => {
    const sizeless: AfSector2File = {
      ...depot,
      entityDefs: [
        ...(depot.entityDefs ?? []),
        {
          id: 'shelf',
          shape: 'box',
          fields: ['w', 'h', 'd'].map((id) => ({ id, type: 'float', default: 1 })),
        },
      ],
    }
    expect(refused(setDefinitionField({ def: 'shelf', field: 'w', value: null }), sizeless)).toBe(
      'entity definition shelf: a box has a size, or float fields w, h and d that give each box its own',
    )
  })

  it('removes a field nobody holds a value for, and refuses while an instance holds one', () => {
    expect(refused(setDefinitionField({ def: 'crate', field: 'contents', value: null }), wired)).toBe(
      'crate: contents would stop validating: entity crate1 holds a value for it; entity crate2 holds a value for it',
    )
    const empty: AfSector2File = {
      ...depot,
      entities: depot.entities?.filter((entity) => entity.def !== 'crate'),
    }
    expect(
      fieldsOf(
        accepted(setDefinitionField({ def: 'crate', field: 'contents', value: null }), empty),
        'crate',
      ),
    ).toEqual([])
  })

  it('refuses a field that is not there, and a definition that is not there', () => {
    expect(refused(setDefinitionField({ def: 'crate', field: 'colour', value: null }))).toBe(
      'crate has no field colour',
    )
    expect(refused(setDefinitionField({ def: 'crate', value: null }))).toBe(
      'a field to remove is named by its id',
    )
    expect(refused(setDefinitionField({ def: 'ghost', value: { id: 'a', type: 'int' } }))).toBe(
      'no entity definition ghost',
    )
  })

  it('is the level itself when the field is set to what it is', () => {
    expect(levelOf(runAf(setDefinitionField({ def: 'crate', field: 'contents', value: contents() })))).toBe(
      depot,
    )
  })
})

describe('removeDefinition (def.remove)', () => {
  it('removes a definition nobody uses', () => {
    const bare: AfSector2File = {
      ...depot,
      entities: depot.entities?.filter((entity) => entity.def !== 'crate'),
    }
    expect(defIds(accepted(removeDefinition({ def: 'crate' }), bare))).toEqual(['spawn'])
  })

  it('refuses while an instance stands in the level or another definition may point at it', () => {
    expect(refused(removeDefinition({ def: 'crate' }), wired)).toBe(
      'crate is still used: entity crate1; entity crate2; entity definition switch: opens may point at crate',
    )
    const bare: AfSector2File = { ...wired, entities: [] }
    expect(refused(removeDefinition({ def: 'crate' }), bare)).toBe(
      'crate is still used: entity definition switch: opens may point at crate',
    )
  })

  it('does not count a definition’s own ref field as a use of it', () => {
    const chain: AfSector2File = {
      ...depot,
      entityDefs: [
        ...(depot.entityDefs ?? []),
        { id: 'link', shape: 'point', fields: [{ id: 'next', type: 'ref', to: ['link'] }] },
      ],
    }
    expect(defIds(accepted(removeDefinition({ def: 'link' }), chain))).toEqual(['spawn', 'crate'])
  })

  it('refuses while a definition the reader could not read may point at it', () => {
    const bare: AfSector2File = {
      ...depot,
      entities: depot.entities?.filter((entity) => entity.def !== 'crate'),
      entityDefs: [
        ...(depot.entityDefs ?? []),
        { id: 'bad', shape: 'cone', fields: [{ id: 'opens', type: 'ref', to: ['crate'] }] },
      ],
    }
    expect(refused(removeDefinition({ def: 'crate' }), bare)).toBe(
      'crate is still used: entity definition bad: opens may point at crate',
    )
  })

  it('removes a definition the reader could not read, and refuses one that is not there', () => {
    const broken: AfSector2File = {
      ...depot,
      entityDefs: [...(depot.entityDefs ?? []), { id: 'bad', shape: 'cone' }],
    }
    expect(defIds(levelOf(runAf(removeDefinition({ def: 'bad' }), broken)))).toEqual(['spawn', 'crate'])
    expect(refused(removeDefinition({ def: 'ghost' }))).toBe('no entity definition ghost')
  })
})

describe('through the level editor', () => {
  it('records each edit as one step that undo and redo bring back, and a refusal records nothing', () => {
    const e = createLevelEditor({ profile: afSectorProfile, level: depot, now: () => 0 })
    expect(e.run(addDefinition({ definition: barrel })).ok).toBe(true)
    expect(e.run(renameDefinition({ def: 'barrel', to: 'drum' })).ok).toBe(true)
    expect(e.run(removeDefinition({ def: 'spawn' })).ok).toBe(false)
    expect(defIds(e.level)).toEqual(['spawn', 'crate', 'drum'])
    e.history.undo()
    expect(defIds(e.level)).toEqual(['spawn', 'crate', 'barrel'])
    e.history.undo()
    expect(e.level).toBe(depot)
    e.history.redo()
    expect(defIds(e.level)).toEqual(['spawn', 'crate', 'barrel'])
  })
})

describe('ED3-r, headless', () => {
  it('defines a crate with a ref field, places two, sets the field, writes and re-reads them, and keeps single', () => {
    const level: AfSector2File = {
      ...depot,
      entities: depot.entities?.filter((entity) => entity.def !== 'crate'),
      entityDefs: depot.entityDefs?.filter((def) => def.id !== 'crate'),
    }
    const text = afSectorProfile.patch(depotText, depot, level)
    if (!text.ok) throw new Error('the depot without its crate does not patch')
    const e = createLevelEditor({ profile: afSectorProfile, level, now: () => 0 })
    const crate: ThingDef = {
      id: 'crate',
      shape: 'box',
      size: [1, 1, 1],
      fields: [{ id: 'loot', type: 'ref' }],
    }
    for (const edit of [
      addDefinition<AfSector2File>({ definition: crate }),
      addThing<AfSector2File>({ def: 'crate', id: 'crate1', x: 3, z: 2 }),
      addThing<AfSector2File>({ def: 'crate', id: 'crate2', x: 11, z: 2 }),
      setThingField<AfSector2File>({
        def: 'crate',
        id: 'crate1',
        field: 'loot',
        value: { target: 'crate2' },
      }),
    ])
      expect(e.run(edit)).toMatchObject({ ok: true })
    const saved = afSectorProfile.patch(text.text, level, e.level)
    if (!saved.ok) throw new Error(`the level does not save: ${saved.detail}`)
    const reopened = afSectorProfile.parse(saved.text)
    if (!reopened.ok) throw new Error('the saved level does not reopen')
    expect(reopened.value).toEqual(e.level)
    expect(reopened.value.entityDefs?.at(-1)).toEqual(crate)
    expect(reopened.value.entities?.find((entity) => entity.id === 'crate1')).toMatchObject({
      loot: { target: 'crate2' },
    })
    expect(entitySentences(reopened.value)).toEqual([])
    expect(
      reasonOf(
        addThing<AfSector2File>({ def: 'spawn', id: 'spawn2', x: 2, z: 2 }).run(
          afSectorProfile,
          reopened.value,
        ),
      ),
    ).toBe('spawn allows one: entity spawn is there already')
  })
})
