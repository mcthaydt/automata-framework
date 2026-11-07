import { worldContentSchema } from '@automata/content/level-2d'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { exportContent } from '#src/shared/level-2d/profiles/level-project/content-export.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { withLevel, withNewLevel, withWorld } from '#src/testing/level-2d/project-edit.ts'

const neighboursOf = (project: Project): Record<string, Record<string, readonly string[]>> | undefined => {
  const file = exportContent(project).find((f) => f.path === 'world.toml')
  const world = worldContentSchema.parse(parse(file?.contents ?? ''))
  const found = world.worlds[0]?.neighbours
  return found
    ? Object.fromEntries(
        found.map((entry) => [
          entry.level,
          { north: entry.north, east: entry.east, south: entry.south, west: entry.west },
        ]),
      )
    : undefined
}

/** Levels are 512 × 288 px (the platformer's), in a grid world snapped to 16 px. */
function gridWorld(...placements: [id: string, x: number, y: number][]): Project {
  let project = platformerTemplate.create(counterIds())
  for (const [id, x, y] of placements.slice(1)) project = withNewLevel(project, id, { x, y })
  const [first] = placements
  const moved = withWorld(project, 'main', (world) => ({
    ...world,
    layout: 'grid',
    grid: { w: 16, h: 16 },
    placements: world.placements.map((placement, index) =>
      index === 0 && first ? { ...placement, level: 'level-1', x: first[1], y: first[2] } : placement,
    ),
  }))
  return moved
}

describe('neighbours in a grid world', () => {
  it('lists the levels whose edge touches, by compass side', () => {
    // level-1 at the origin, one to its east, one below it.
    const project = gridWorld(['level-1', 0, 0], ['east', 512, 0], ['south', 0, 288])
    expect(neighboursOf(project)).toEqual({
      'level-1': { north: [], east: ['east'], south: ['south'], west: [] },
      east: { north: [], east: [], south: [], west: ['level-1'] },
      south: { north: ['level-1'], east: [], south: [], west: [] },
    })
  })

  it('does not count a touch at a corner', () => {
    const project = gridWorld(['level-1', 0, 0], ['diagonal', 512, 288])
    expect(neighboursOf(project)).toEqual({
      'level-1': { north: [], east: [], south: [], west: [] },
      diagonal: { north: [], east: [], south: [], west: [] },
    })
  })

  it('counts every level along a shared edge, in position order', () => {
    const project = gridWorld(['level-1', 0, 0], ['high', 512, -96], ['low', 512, 96])
    expect(neighboursOf(project)?.['level-1']?.east).toEqual(['high', 'low'])
    expect(neighboursOf(project)?.high?.west).toEqual(['level-1'])
  })

  it('works with levels of different sizes', () => {
    const base = gridWorld(['level-1', 0, 0], ['narrow', 512, 0])
    const project = withLevel(base, 'narrow', (level) => ({ ...level, size: { w: 128, h: 576 } }))
    expect(neighboursOf(project)?.narrow).toEqual({ north: [], east: [], south: [], west: ['level-1'] })
    expect(neighboursOf(project)?.['level-1']?.east).toEqual(['narrow'])
  })

  it('leaves out a world that is not a grid: no neighbours key, and no guess from positions', () => {
    const project = withWorld(gridWorld(['level-1', 0, 0], ['east', 512, 0]), 'main', (world) => ({
      ...world,
      layout: 'free',
      grid: undefined,
    }))
    expect(neighboursOf(project)).toBeUndefined()
  })
})
