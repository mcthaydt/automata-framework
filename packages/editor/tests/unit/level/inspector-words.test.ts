// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Inspector from '#src/features/level/Inspector.svelte'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { placeEntity } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { projectHistory } from '#src/shared/level-2d/model/edit-history.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'

// The drunk grandma test for the words an inspector and the Problems list use: a thing is named by what it is called,
// never by a key, and a missing value says what to do about it.

const target = { level: 'level-1', layer: 'entities' }

/** Where a template's first level keeps its characters and things. */
function firstEntities(project: Project): { level: string; layer: string } {
  const level = project.levels[0]
  const layer = level?.layers.find((each) => each.kind === 'entities')
  if (level === undefined || layer === undefined) throw new Error('no entities layer')
  return { level: level.id, layer: layer.def }
}

function mount(project: Project, id: string): void {
  const history = projectHistory(createHistory<unknown>(project))
  if (history === undefined) throw new Error('a project was refused')
  render(Inspector, {
    project,
    level: firstEntities(project).level,
    selected: [id],
    history,
    ondelete: () => {},
    onduplicate: () => {},
  })
}

describe('a character’s health', () => {
  it('is "Hits to beat it" with its value alone, and its range in the hint', () => {
    const project = placeEntity(platformerTemplate.create(counterIds()), target, {
      id: 'slime-a',
      def: 'slime',
      x: 32,
      y: 48,
    })
    mount(project, 'slime-a')
    expect(screen.getByText('Hits to beat it')).toBeInTheDocument()
    expect(screen.queryByText('Hit points')).toBeNull()
    expect(screen.getByRole('spinbutton', { name: 'Hits to beat it' })).toHaveTextContent(/^3$/)
    expect(screen.getByText('1 to 9')).toBeInTheDocument()
  })

  it('is the same on the top-down Enemy', () => {
    const base = topdownRpgTemplate.create(counterIds())
    const project = placeEntity(base, firstEntities(base), {
      id: 'enemy-a',
      def: 'enemy',
      x: 32,
      y: 48,
    })
    mount(project, 'enemy-a')
    expect(screen.getByText('Hits to beat it')).toBeInTheDocument()
    expect(screen.getByText('1 to 99')).toBeInTheDocument()
  })
})

describe('a thing that needs a value', () => {
  it('says a Door with no Leads to does not lead anywhere, under the field and in Problems', () => {
    const project = placeEntity(platformerTemplate.create(counterIds()), target, {
      id: 'door-a',
      def: 'door',
      x: 96,
      y: 48,
    })
    mount(project, 'door-a')
    const words = "The Door doesn't lead anywhere yet. Choose where it goes."
    expect(screen.getByText(words)).toBeInTheDocument()
    expect(checkProject(project, {}).find((each) => each.code === 'fieldMissing')?.message).toBe(words)
  })

  it('says it with the Warp’s own name on a top-down game', () => {
    const base = topdownRpgTemplate.create(counterIds())
    const project = placeEntity(base, firstEntities(base), {
      id: 'warp-a',
      def: 'warp',
      x: 96,
      y: 48,
    })
    expect(checkProject(project, {}).find((each) => each.code === 'fieldMissing')?.message).toBe(
      "The Warp doesn't lead anywhere yet. Choose where it goes.",
    )
  })

  it('says any other required field is needed, by the thing’s name and the field’s label', () => {
    const base = platformerTemplate.create(counterIds())
    const project: Project = {
      ...base,
      defs: {
        ...base.defs,
        entities: base.defs.entities.map((def) =>
          def.id === 'slime'
            ? {
                ...def,
                fields: [{ id: 'patrol', type: 'point', list: true, label: 'Patrol path', required: true }],
              }
            : def,
        ),
      },
    }
    const placed = placeEntity(project, target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
    expect(checkProject(placed, {}).find((each) => each.code === 'fieldMissing')?.message).toBe(
      'The Slime needs a Patrol path. Fill it in.',
    )
  })

  it('never puts a field’s key in the words', () => {
    const project = placeEntity(platformerTemplate.create(counterIds()), target, {
      id: 'door-a',
      def: 'door',
      x: 96,
      y: 48,
    })
    for (const each of checkProject(project, {})) expect(each.message).not.toMatch(/\btarget\b|is required/)
  })
})
