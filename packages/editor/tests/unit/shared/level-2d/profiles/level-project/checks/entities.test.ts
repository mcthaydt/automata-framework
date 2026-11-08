import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import type { Diagnostic } from '#src/shared/level-2d/profiles/profile.ts'
import { entity, withDefs, withEntities, withLayer, withLevel } from '#src/testing/level-2d/project-edit.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const only = (project: Project, code: string): Diagnostic[] =>
  checkProject(project, {}).filter((d) => d.code === code)

const SLIME = (hp: number): ReturnType<typeof entity> => entity('slime-1', 'slime', 120, 256, { hp })

describe('entity checks', () => {
  it('accepts instances that satisfy their definition, with or without optional fields', () => {
    const project = withEntities(platformer(), 'level-1', [
      entity('slime-1', 'slime', 120, 256, {
        hp: 5,
        patrol: [
          { x: 100, y: 256 },
          { x: 160, y: 256 },
        ],
      }),
      entity('slime-2', 'slime', 150, 256),
    ])
    expect(only(project, 'fieldInvalid')).toEqual([])
    expect(only(project, 'fieldMissing')).toEqual([])
  })

  describe('fieldMissing', () => {
    it('is an error for a required field with no value, at the field', () => {
      const project = withEntities(platformer(), 'level-1', [entity('door-1', 'door', 200, 256)])
      expect(only(project, 'fieldMissing')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'levels[level-1].layers[entities].items[door-1].fields.target',
          message: "The Door doesn't lead anywhere yet. Choose where it goes.",
        }),
      ])
    })

    it('covers a required level field', () => {
      const project = withDefs(platformer(), (defs) => ({
        ...defs,
        levelFields: [...defs.levelFields, { id: 'title', type: 'text', required: true }],
      }))
      expect(only(project, 'fieldMissing').map((d) => d.path)).toEqual(['levels[level-1].fields.title'])
    })
  })

  describe('fieldInvalid', () => {
    it('is an error for a value the definition refuses, with the kit message', () => {
      const project = withEntities(platformer(), 'level-1', [SLIME(12)])
      expect(only(project, 'fieldInvalid')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'levels[level-1].layers[entities].items[slime-1].fields.hp',
          message: expect.stringMatching(/9/),
        }),
      ])
    })

    it('also reports a value under a field the definition does not have', () => {
      const project = withEntities(platformer(), 'level-1', [entity('coin-1', 'coin', 20, 20, { shine: 3 })])
      expect(only(project, 'fieldInvalid').map((d) => d.path)).toEqual([
        'levels[level-1].layers[entities].items[coin-1].fields.shine',
      ])
    })

    it('covers the level fields', () => {
      const project = withLevel(platformer(), 'level-1', (level) => ({ ...level, fields: { music: 5 } }))
      expect(only(project, 'fieldInvalid').map((d) => d.path)).toEqual(['levels[level-1].fields.music'])
    })

    it('leaves instances of an unknown definition to unknownEntityDef', () => {
      const project = withEntities(platformer(), 'level-1', [entity('ghost-1', 'ghost', 5, 5, { a: 1 })])
      expect(only(project, 'fieldInvalid')).toEqual([])
    })
  })

  describe('singleExceeded', () => {
    it('is an error at each instance after the first in a level, across entity layers', () => {
      const project = withEntities(platformer(), 'level-1', [
        entity('start-2', 'player-start', 100, 256),
        entity('start-3', 'player-start', 140, 256),
      ])
      expect(only(project, 'singleExceeded')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'levels[level-1].layers[entities].items[start-2]',
        }),
        expect.objectContaining({ path: 'levels[level-1].layers[entities].items[start-3]' }),
      ])
    })

    it('counts per level, so one start in each of two levels is fine', () => {
      const base = platformer()
      const second = {
        ...base,
        levels: [
          ...base.levels,
          { ...(base.levels[0] as never as Project['levels'][number]), id: 'level-2' },
        ],
      }
      expect(only(second, 'singleExceeded')).toEqual([])
    })
  })

  describe('minNotMet', () => {
    it('reports a project with no player start, at the definition', () => {
      const project = withLayer(platformer(), 'level-1', 'entities', (layer) =>
        layer.kind === 'entities' ? { ...layer, items: [] } : layer,
      )
      expect(only(project, 'minNotMet')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'defs.entities[player-start]',
          message: expect.stringMatching(/project needs at least 1 "Player start" and has none/),
        }),
      ])
    })

    it('is satisfied by one instance anywhere in the project', () => {
      expect(only(platformer(), 'minNotMet')).toEqual([])
    })

    it('checks a per-level minimum in every level', () => {
      const project = withDefs(platformer(), (defs) => ({
        ...defs,
        entities: defs.entities.map((def) =>
          def.id === 'coin' ? { ...def, min: { per: 'level' as const, count: 2 } } : def,
        ),
      }))
      const withOne = withEntities(project, 'level-1', [entity('coin-1', 'coin', 20, 20)])
      expect(only(withOne, 'minNotMet')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'levels[level-1]',
          message: expect.stringMatching(/2.*Coin.*has 1/),
        }),
      ])
      const withTwo = withEntities(withOne, 'level-1', [entity('coin-2', 'coin', 40, 20)])
      expect(only(withTwo, 'minNotMet')).toEqual([])
    })
  })
})
