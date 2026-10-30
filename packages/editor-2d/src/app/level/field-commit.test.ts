import { createHistory, type History } from '@mcthaydt/automata-editor-kit/core'
import type { FieldValue } from '@mcthaydt/automata-editor-kit/fields'
import { describe, expect, it } from 'vitest'
import { placeEntity } from '../../model/commands/entity-edits'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { projectHistory } from './edit-history'
import { commitField, type FieldTarget } from './field-commit'

const slime: FieldTarget = { kind: 'entity', level: 'level-1', layer: 'entities', id: 'slime-a' }
const door: FieldTarget = { kind: 'entity', level: 'level-1', layer: 'entities', id: 'door-a' }
const level: FieldTarget = { kind: 'level', level: 'level-1' }

/** The platformer with a slime, a door and an enum level field, as the history's first state. */
function setup(): { history: History<unknown>; edits: NonNullable<ReturnType<typeof projectHistory>> } {
  const target = { level: 'level-1', layer: 'entities' }
  let project = platformerTemplate.create(counterIds())
  project = placeEntity(project, target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
  project = placeEntity(project, target, { id: 'door-a', def: 'door', x: 96, y: 48 })
  project = {
    ...project,
    defs: {
      ...project.defs,
      levelFields: [...project.defs.levelFields, { id: 'weather', type: 'enum', options: ['clear', 'rain'] }],
    },
  }
  const history = createHistory<unknown>(project)
  const edits = projectHistory(history)
  if (edits === undefined) throw new Error('a project was refused')
  return { history, edits }
}

describe('commitField (G-e)', () => {
  const refusals: readonly [string, FieldTarget, string, FieldValue, string][] = [
    ['an int past its max', slime, 'hp', 12, 'hp must be at most 9'],
    ['a bad enum', level, 'weather', 'snow', 'weather has no option "snow"'],
    ['a bad colour', slime, 'tint', 'purple', 'tint must be a #rrggbb color'],
    ['a point list with a non-number', slime, 'patrol', [{ x: 1, y: Number.NaN }], 'patrol'],
    ['a ref with no target', door, 'target', { target: '' }, 'target must be a reference with a target'],
  ]

  for (const [what, target, field, value, message] of refusals) {
    it(`refuses ${what} with the message and leaves the project and history alone`, () => {
      const { history, edits } = setup()
      const before = edits.state
      const result = commitField(edits, target, field, value)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toContain(message)
      expect(edits.state).toBe(before)
      expect(history.undoLabel).toBeUndefined()
    })
  }

  it('makes a valid entity edit one undo step that undoes', () => {
    const { history, edits } = setup()
    const before = edits.state
    expect(commitField(edits, slime, 'hp', 5)).toEqual({ ok: true })
    const stored = (project: Project) =>
      project.levels[0]?.layers.find((layer) => layer.kind === 'entities' && layer.def === 'entities')
    expect(JSON.stringify(stored(edits.state))).toContain('"hp":5')
    expect(history.undoLabel).toBe('Set Hit points')
    history.undo()
    expect(edits.state).toBe(before)
  })

  it('makes a valid level edit one step, and an unchanged value no step', () => {
    const { history, edits } = setup()
    expect(commitField(edits, level, 'weather', 'rain')).toEqual({ ok: true })
    expect(edits.state.levels[0]?.fields.weather).toBe('rain')
    expect(history.undoLabel).toBe('Set weather')
    history.undo()
    expect(commitField(edits, slime, 'hp', 3)).toEqual({ ok: true })
    expect(history.undoLabel).toBeUndefined()
  })
})
