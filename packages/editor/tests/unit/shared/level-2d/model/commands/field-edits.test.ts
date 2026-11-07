import type { FieldDef } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { addField, renameField, retypeField } from '#src/shared/level-2d/model/commands/field-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { EntityInstance, Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { entity, withEntities, withNewLevel } from '#src/testing/level-2d/project-edit.ts'

const SLIME = { entity: 'slime' } as const
const platformer = (): Project => platformerTemplate.create(counterIds())
const items = (p: Project): EntityInstance[] =>
  p.levels.flatMap((level) => level.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items : [])))
const item = (p: Project, id: string): EntityInstance | undefined => items(p).find((found) => found.id === id)
const fieldsOf = (p: Project, def: string): readonly FieldDef[] =>
  p.defs.entities.find((found) => found.id === def)?.fields ?? []
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => `${d.code} ${d.path}`)

/** Kit EK-j on the platformer: `hp` is int 1..9; two slimes hold numbers, one holds 12 (already invalid). */
const slimes = (): Project =>
  withEntities(withNewLevel(platformer(), 'level-2', { x: 512, y: 0 }), 'level-1', [
    entity('slime-a', 'slime', 64, 256, { hp: 3 }),
    entity('slime-b', 'slime', 96, 256, { hp: 5 }),
    entity('slime-c', 'slime', 128, 256, { hp: 12 }),
    entity('coin-a', 'coin', 160, 256),
  ])
const hp = (p: Project): FieldDef | undefined => fieldsOf(p, 'slime').find((field) => field.id === 'hp')

describe('addField', () => {
  it("appends the field and gives every existing instance the field's stand-in value", () => {
    const project = slimes()
    const next = addField(project, SLIME, { id: 'speed', type: 'float', default: 1.5 })
    expect(fieldsOf(next, 'slime').map((field) => field.id)).toEqual(['hp', 'patrol', 'tint', 'speed'])
    expect(item(next, 'slime-a')?.fields).toEqual({ hp: 3, speed: 1.5 })
    expect(item(next, 'coin-a')).toBe(item(project, 'coin-a'))
    expect(next.levels[1]).toBe(project.levels[1])
    expect(errors(next)).toEqual(errors(project))
  })

  it('leaves a required field without a value, which the Checks then ask for', () => {
    const next = addField(slimes(), SLIME, { id: 'drop', type: 'text', required: true })
    expect(item(next, 'slime-a')?.fields).toEqual({ hp: 3 })
    expect(errors(next).filter((e) => e.startsWith('fieldMissing'))).toHaveLength(3)
  })

  it('adds a level field to every level', () => {
    const next = addField(slimes(), 'level', { id: 'par', type: 'int', min: 0, default: 60 })
    expect(next.defs.levelFields.map((field) => field.id)).toEqual(['music', 'par'])
    expect(next.levels.map((level) => level.fields.par)).toEqual([60, 60])
    expect(errors(next)).toEqual(errors(slimes()))
  })

  it("refuses a field the kit's rules refuse, an id the owner has and an owner that does not exist", () => {
    expect(() => addField(slimes(), SLIME, { id: 'bad id', type: 'int' })).toThrow(/not a field id/)
    expect(() => addField(slimes(), SLIME, { id: 'mood', type: 'enum', options: [] })).toThrow(/options/)
    expect(() => addField(slimes(), SLIME, { id: 'hp', type: 'int' })).toThrow(/already/)
    expect(() => addField(slimes(), 'level', { id: 'music', type: 'text' })).toThrow(/already/)
    expect(() => addField(slimes(), { entity: 'dragon' }, { id: 'x', type: 'int' })).toThrow(
      /no entity definition "dragon"/,
    )
  })
})

describe('retypeField (kit EK-j)', () => {
  it('refuses to make hp text while two slimes hold numbers, and lists exactly those two', () => {
    const result = retypeField(slimes(), SLIME, 'hp', { id: 'hp', type: 'text' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.uses.map((use) => use.path)).toEqual([
      'levels[level-1].layers[entities].items[slime-a].fields.hp',
      'levels[level-1].layers[entities].items[slime-b].fields.hp',
    ])
    expect(result.ok === false && result.uses[0]?.message).toMatch(/hp/)
  })

  it('passes a change every value still fits', () => {
    const result = retypeField(slimes(), SLIME, 'hp', { id: 'hp', type: 'int', min: 1, max: 20, default: 3 })
    expect(result.ok).toBe(true)
    expect(result.ok && hp(result.project)?.max).toBe(20)
    expect(result.ok && item(result.project, 'slime-c')?.fields.hp).toBe(12)
    expect(result.ok && errors(result.project)).toEqual([])
  })

  it('anyway drops the broken values and gives those instances the new stand-in, in one project', () => {
    const result = retypeField(
      slimes(),
      SLIME,
      'hp',
      { id: 'hp', type: 'text', default: 'weak' },
      { anyway: true },
    )
    if (!result.ok) throw new Error('refused')
    expect(item(result.project, 'slime-a')?.fields.hp).toBe('weak')
    expect(item(result.project, 'slime-b')?.fields.hp).toBe('weak')
    // Already invalid before the retype, so it is the Checks' to report, not the retype's to drop.
    expect(item(result.project, 'slime-c')?.fields.hp).toBe(12)
  })

  it('anyway leaves a required field without a stand-in empty, for the Checks to ask for', () => {
    const result = retypeField(
      slimes(),
      SLIME,
      'hp',
      { id: 'hp', type: 'bool', required: true },
      { anyway: true },
    )
    if (!result.ok) throw new Error('refused')
    expect(item(result.project, 'slime-a')?.fields).toEqual({})
    expect(errors(result.project)).toContain(
      'fieldMissing levels[level-1].layers[entities].items[slime-a].fields.hp',
    )
  })

  it('renames and retypes in one call, moving the values that fit', () => {
    const result = retypeField(slimes(), SLIME, 'hp', { id: 'health', type: 'int', min: 0, max: 99 })
    if (!result.ok) throw new Error('refused')
    expect(fieldsOf(result.project, 'slime')[0]?.id).toBe('health')
    expect(item(result.project, 'slime-a')?.fields).toEqual({ health: 3 })
  })

  it('retypes a level field against every level', () => {
    const withMusic = {
      ...slimes(),
      levels: slimes().levels.map((level, i) => ({ ...level, fields: { music: i === 0 ? 'calm' : '' } })),
    }
    const result = retypeField(withMusic, 'level', 'music', {
      id: 'music',
      type: 'enum',
      options: ['calm', 'boss'],
    })
    expect(result.ok === false && result.uses.map((use) => use.path)).toEqual([
      'levels[level-2].fields.music',
    ])
  })

  it('returns the same project for the same definition', () => {
    const project = slimes()
    const same = retypeField(project, SLIME, 'hp', { ...(hp(project) as FieldDef) })
    expect(same.ok && same.project).toBe(project)
  })

  it("refuses a new definition the kit's rules refuse and a new id another field has", () => {
    expect(() => retypeField(slimes(), SLIME, 'hp', { id: 'hp', type: 'int', min: 5, max: 1 })).toThrow(
      /min 5/,
    )
    expect(() => retypeField(slimes(), SLIME, 'hp', { id: 'tint', type: 'int' })).toThrow(/already/)
    expect(() => retypeField(slimes(), SLIME, 'nope', { id: 'nope', type: 'int' })).toThrow(/no field "nope"/)
  })
})

describe('renameField', () => {
  it('renames the field and keeps every value under the new id, in key order', () => {
    const next = renameField(slimes(), SLIME, 'hp', 'health')
    expect(fieldsOf(next, 'slime').map((field) => field.id)).toEqual(['health', 'patrol', 'tint'])
    expect(item(next, 'slime-a')?.fields).toEqual({ health: 3 })
    expect(item(next, 'slime-c')?.fields).toEqual({ health: 12 })
  })

  it('renames a level field on every level', () => {
    const next = renameField(slimes(), 'level', 'music', 'song')
    expect(next.defs.levelFields[0]?.id).toBe('song')
    expect(errors(next)).toEqual(errors(slimes()))
  })

  it('returns the same project for the same id and refuses a taken or bad one', () => {
    const project = slimes()
    expect(renameField(project, SLIME, 'hp', 'hp')).toBe(project)
    expect(() => renameField(project, SLIME, 'hp', 'tint')).toThrow(/already/)
    expect(() => renameField(project, SLIME, 'hp', '9lives')).toThrow(/not a field id/)
  })
})
