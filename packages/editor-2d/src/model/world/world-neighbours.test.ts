import { describe, expect, it } from 'vitest'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { withLevel, withNewLevel, withWorld } from '../../testing/project-edit'
import { counterIds } from '../ids'
import type { Project, World } from '../project-types'
import { worldNeighbours } from './world-neighbours'

/** Levels are 512 × 288 px (the platformer's); `level-1` is the template's and the rest are added. */
function world(...placements: [id: string, x: number, y: number][]): Project {
  let project = platformerTemplate.create(counterIds())
  for (const [id, x, y] of placements) {
    if (id === 'level-1') {
      project = withWorld(project, 'main', (found) => ({
        ...found,
        placements: found.placements.map((p) => (p.level === 'level-1' ? { ...p, x, y } : p)),
      }))
    } else project = withNewLevel(project, id, { x, y })
  }
  return project
}

const mainOf = (project: Project): World => {
  const found = project.worlds[0]
  if (found === undefined) throw new Error('no world')
  return found
}
const byLevel = (project: Project) =>
  Object.fromEntries(worldNeighbours(project, mainOf(project)).map(({ level, ...sides }) => [level, sides]))

describe('worldNeighbours', () => {
  it('lists the levels whose edge touches, by compass side', () => {
    expect(byLevel(world(['level-1', 0, 0], ['east', 512, 0], ['south', 0, 288]))).toEqual({
      'level-1': { north: [], east: ['east'], south: ['south'], west: [] },
      east: { north: [], east: [], south: [], west: ['level-1'] },
      south: { north: ['level-1'], east: [], south: [], west: [] },
    })
  })

  it('does not count a touch at a corner, or levels apart', () => {
    expect(byLevel(world(['level-1', 0, 0], ['diagonal', 512, 288], ['far', 2000, 0]))).toEqual({
      'level-1': { north: [], east: [], south: [], west: [] },
      diagonal: { north: [], east: [], south: [], west: [] },
      far: { north: [], east: [], south: [], west: [] },
    })
  })

  it('orders a side by position, then id', () => {
    const found = byLevel(world(['level-1', 0, 0], ['low', 512, 96], ['high', 512, -96]))
    expect(found['level-1']?.east).toEqual(['high', 'low'])
    const tied = byLevel(world(['level-1', 0, 0], ['b', 0, -288], ['a', 0, -288]))
    expect(tied['level-1']?.north).toEqual(['a', 'b'])
  })

  it('uses each level its own size', () => {
    const base = world(['level-1', 0, 0], ['narrow', 512, 0])
    const project = withLevel(base, 'narrow', (level) => ({ ...level, size: { w: 128, h: 576 } }))
    expect(byLevel(project).narrow).toEqual({ north: [], east: [], south: [], west: ['level-1'] })
  })

  it('skips a placement of a level that does not exist', () => {
    const project = withWorld(world(['level-1', 0, 0]), 'main', (found) => ({
      ...found,
      placements: [...found.placements, { level: 'ghost', x: 512, y: 0, depth: 0 }],
    }))
    expect(byLevel(project)).toEqual({ 'level-1': { north: [], east: [], south: [], west: [] } })
  })
})
