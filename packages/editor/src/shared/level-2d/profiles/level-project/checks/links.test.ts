import { describe, expect, it } from 'vitest'
import { entity, withDefs, withEntities, withNewLevel } from '../../../../../testing/level-2d/project-edit'
import { counterIds } from '../../../model/ids'
import type { Project } from '../../../model/project-types'
import type { Diagnostic } from '../../profile'
import { checkProject } from '../project-checks'
import { platformerTemplate } from '../templates/platformer'

/** Two levels: a door in `level-1` and a spawn in `level-2`. */
function twoLevels(): Project {
  const second = withNewLevel(platformerTemplate.create(counterIds()), 'level-2', { x: 600, y: 0 })
  return withEntities(second, 'level-2', [entity('spawn-2', 'player-start', 32, 256)])
}

const doorTo = (target: unknown, container?: string): ReturnType<typeof entity> =>
  entity('door-1', 'door', 200, 256, {
    target: container === undefined ? { target } : { target, container },
  } as never)

const only = (project: Project, code: string): Diagnostic[] =>
  checkProject(project, {}).filter((d) => d.code === code)

const DOOR_TARGET = 'levels[level-1].layers[entities].items[door-1].fields.target'

describe('link checks', () => {
  it('accepts a door that points at a spawn in another level', () => {
    const project = withEntities(twoLevels(), 'level-1', [doorTo('spawn-2', 'level-2')])
    expect(only(project, 'brokenRef')).toEqual([])
    expect(only(project, 'refWrongKind')).toEqual([])
  })

  it('accepts a target with no container: instance ids are unique in the project', () => {
    const project = withEntities(twoLevels(), 'level-1', [doorTo('spawn-2')])
    expect(only(project, 'brokenRef')).toEqual([])
  })

  describe('brokenRef', () => {
    it('is an error when the target is gone (G-g), with the choose-target fix', () => {
      const project = withEntities(twoLevels(), 'level-1', [doorTo('deleted-1', 'level-2')])
      expect(only(project, 'brokenRef')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: DOOR_TARGET,
          fix: 'choose-target',
          message: expect.stringContaining('deleted-1'),
        }),
      ])
    })

    it('is an error when the target is in another level than the container says', () => {
      const project = withEntities(twoLevels(), 'level-1', [doorTo('spawn-2', 'level-1')])
      expect(only(project, 'brokenRef').map((d) => d.path)).toEqual([DOOR_TARGET])
    })

    it('is an error when the container is not a level', () => {
      const project = withEntities(twoLevels(), 'level-1', [doorTo('spawn-2', 'nowhere')])
      expect(only(project, 'brokenRef').map((d) => d.path)).toEqual([DOOR_TARGET])
    })
  })

  describe('refWrongKind', () => {
    it('is an error when the target is a definition the field does not allow', () => {
      const project = withEntities(
        withEntities(twoLevels(), 'level-2', [entity('slime-9', 'slime', 80, 256)]),
        'level-1',
        [doorTo('slime-9', 'level-2')],
      )
      expect(only(project, 'refWrongKind')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: DOOR_TARGET,
          message: expect.stringMatching(/slime.*door, checkpoint, player-start/),
        }),
      ])
      expect(only(project, 'brokenRef')).toEqual([])
    })
  })

  describe('a field that points at levels', () => {
    const withExit = (project: Project): Project =>
      withDefs(project, (defs) => ({
        ...defs,
        entities: defs.entities.map((def) =>
          def.id === 'door'
            ? { ...def, fields: [...def.fields, { id: 'exit', type: 'ref' as const, to: ['$level'] }] }
            : def,
        ),
      }))
    const door = (exit: unknown): ReturnType<typeof entity> =>
      entity('door-1', 'door', 200, 256, {
        target: { target: 'spawn-2', container: 'level-2' },
        exit: { target: exit },
      } as never)

    it('resolves $level to a level id', () => {
      const project = withEntities(withExit(twoLevels()), 'level-1', [door('level-2')])
      expect(only(project, 'brokenRef')).toEqual([])
    })

    it('is broken when the id names no level', () => {
      const project = withEntities(withExit(twoLevels()), 'level-1', [door('level-9')])
      expect(only(project, 'brokenRef').map((d) => d.path)).toEqual([
        'levels[level-1].layers[entities].items[door-1].fields.exit',
      ])
    })
  })

  it('reports the member of a ref list that is bad, by position', () => {
    const project = withEntities(
      withDefs(twoLevels(), (defs) => ({
        ...defs,
        entities: defs.entities.map((def) =>
          def.id === 'checkpoint'
            ? { ...def, fields: [{ id: 'next', type: 'ref' as const, list: true, to: ['player-start'] }] }
            : def,
        ),
      })),
      'level-1',
      [
        entity('check-1', 'checkpoint', 90, 256, {
          next: [{ target: 'spawn-2' }, { target: 'missing-1' }],
        } as never),
      ],
    )
    expect(only(project, 'brokenRef').map((d) => d.path)).toEqual([
      'levels[level-1].layers[entities].items[check-1].fields.next[1]',
    ])
  })

  it('checks a ref in a level field the same way', () => {
    const project = withDefs(twoLevels(), (defs) => ({
      ...defs,
      levelFields: [...defs.levelFields, { id: 'next', type: 'ref', to: ['$level'] }],
    }))
    const broken = {
      ...project,
      levels: project.levels.map((level) =>
        level.id === 'level-1' ? { ...level, fields: { next: { target: 'level-7' } } } : level,
      ),
    }
    expect(only(broken, 'brokenRef').map((d) => d.path)).toEqual(['levels[level-1].fields.next'])
  })
})

describe('the list of diagnostics', () => {
  it('lists errors, then warnings, then info, and is the same on every call', () => {
    const base = withEntities(twoLevels(), 'level-1', [
      doorTo('gone-1', 'level-2'),
      entity('coin-1', 'coin', 900, 20),
    ])
    const first = checkProject(base, {})
    expect(checkProject(base, {})).toEqual(first)
    const severities = first.map((d) => d.severity)
    expect(severities).toEqual(
      [...severities].sort((a, b) => 'ewi'.indexOf(a[0] ?? '') - 'ewi'.indexOf(b[0] ?? '')),
    )
    expect(severities).toContain('error')
    expect(severities).toContain('warning')
    expect(severities).toContain('info')
  })
})
