import { describe, expect, it } from 'vitest'
import { exportContent } from '../../profiles/level-project/content-export'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { withDefs, withLevel, withNewLevel, withWorld } from '../../testing/project-edit'
import { counterIds } from '../ids'
import type { Placement, Project } from '../project-types'
import { setWorldLayout } from './world-layout'

/** The platformer's `level-1` (512 × 288) at the origin and four more, in a free world. */
function fiveLevels(): Project {
  let project = platformerTemplate.create(counterIds())
  const spots: [string, number, number][] = [
    ['b', 519, 3],
    ['c', 7, 293],
    ['d', 1030, -6],
    ['e', 518, 292],
  ]
  for (const [id, x, y] of spots) project = withNewLevel(project, id, { x, y })
  return project
}

const placements = (project: Project, world = 'main'): readonly Placement[] =>
  project.worlds.find((found) => found.id === world)?.placements ?? []
const at = (project: Project): Record<string, [number, number]> =>
  Object.fromEntries(placements(project).map((p) => [p.level, [p.x, p.y]]))
const errors = (project: Project): string[] =>
  checkProject(project, {})
    .filter((d) => d.severity === 'error')
    .map((d) => d.code)

describe('setWorldLayout: grid', () => {
  it('snaps every placement to the nearest grid point and keeps the levels as they are (G-h)', () => {
    const before = fiveLevels()
    const after = setWorldLayout(before, 'main', 'grid', { w: 16, h: 16 })
    expect(after.worlds[0]).toMatchObject({ layout: 'grid', grid: { w: 16, h: 16 } })
    expect(at(after)).toEqual({ 'level-1': [0, 0], b: [512, 0], c: [0, 288], d: [1024, 0], e: [512, 288] })
    expect(after.levels).toBe(before.levels)
    expect(errors(after)).toEqual([])
  })

  it('makes the neighbours appear in the export, and the old project is unchanged for undo', () => {
    const before = fiveLevels()
    const snapshot = structuredClone(placements(before))
    const world = (p: Project) => exportContent(p).find((file) => file.path === 'world.toml')?.contents ?? ''
    expect(world(before)).not.toContain('neighbours')
    const after = setWorldLayout(before, 'main', 'grid', { w: 16, h: 16 })
    expect(world(after)).toContain('[[worlds.neighbours]]')
    expect(placements(before)).toEqual(snapshot)
    expect(before.worlds[0]?.layout).toBe('free')
  })

  it("defaults the grid to the least common multiple of the layers' cells, so every layer lines up", () => {
    const project = withDefs(fiveLevels(), (defs) => ({
      ...defs,
      layers: defs.layers.map((layer, i) => (i === 1 && 'grid' in layer ? { ...layer, grid: 24 } : layer)),
    }))
    expect(setWorldLayout(project, 'main', 'grid').worlds[0]?.grid).toEqual({ w: 48, h: 48 })
  })

  it('defaults to 16 px when no layer has cells', () => {
    const project = withDefs(fiveLevels(), (defs) => ({ ...defs, layers: [] }))
    expect(setWorldLayout(project, 'main', 'grid').worlds[0]?.grid).toEqual({ w: 16, h: 16 })
  })

  it('re-snaps for a new grid size, keeps the grid it has when none is given, and rounds half up', () => {
    const grid = setWorldLayout(fiveLevels(), 'main', 'grid', { w: 16, h: 16 })
    const coarse = setWorldLayout(grid, 'main', 'grid', { w: 256, h: 96 })
    expect(at(coarse)).toEqual({ 'level-1': [0, 0], b: [512, 0], c: [0, 288], d: [1024, 0], e: [512, 288] })
    expect(setWorldLayout(grid, 'main', 'grid')).toBe(grid)
    const taller = setWorldLayout(grid, 'main', 'grid', { w: 16, h: 160 })
    expect(taller.worlds[0]?.grid).toEqual({ w: 16, h: 160 })
    expect(at(taller).c).toEqual([0, 320])
    const half = withWorld(fiveLevels(), 'main', (w) => ({
      ...w,
      placements: [{ level: 'level-1', x: 8, y: -8, depth: 0 }],
    }))
    expect(at(setWorldLayout(half, 'main', 'grid', { w: 16, h: 16 }))['level-1']).toEqual([16, 0])
  })

  it('returns the same project for the layout and grid it already has', () => {
    const grid = setWorldLayout(fiveLevels(), 'main', 'grid', { w: 16, h: 16 })
    expect(setWorldLayout(grid, 'main', 'grid', { w: 16, h: 16 })).toBe(grid)
    const free = fiveLevels()
    expect(setWorldLayout(free, 'main', 'free')).toBe(free)
  })

  it('refuses a grid outside the guard rails', () => {
    expect(() => setWorldLayout(fiveLevels(), 'main', 'grid', { w: 0, h: 16 })).toThrow(RangeError)
    expect(() => setWorldLayout(fiveLevels(), 'main', 'grid', { w: 16, h: 1.5 })).toThrow(RangeError)
    expect(() => setWorldLayout(fiveLevels(), 'main', 'grid', { w: 16385, h: 16 })).toThrow(RangeError)
  })
})

describe('setWorldLayout: free', () => {
  it('drops the grid and keeps every position', () => {
    const grid = setWorldLayout(fiveLevels(), 'main', 'grid', { w: 16, h: 16 })
    const free = setWorldLayout(grid, 'main', 'free')
    expect(free.worlds[0]).toEqual({ ...grid.worlds[0], layout: 'free', grid: undefined })
    expect('grid' in (free.worlds[0] ?? {})).toBe(false)
    expect(at(free)).toEqual(at(grid))
  })

  it('refuses a grid size for a layout that has none', () => {
    expect(() => setWorldLayout(fiveLevels(), 'main', 'free', { w: 16, h: 16 })).toThrow(RangeError)
  })
})

describe('setWorldLayout: horizontal and vertical', () => {
  it('lays the levels left to right in the order of their x, touching, from the origin', () => {
    const after = setWorldLayout(fiveLevels(), 'main', 'horizontal')
    expect(placements(after).map((p) => p.level)).toEqual(['level-1', 'c', 'e', 'b', 'd'])
    expect(at(after)).toEqual({ 'level-1': [0, 0], c: [512, 0], e: [1024, 0], b: [1536, 0], d: [2048, 0] })
    expect(after.worlds[0]?.grid).toBeUndefined()
  })

  it('lays the levels top to bottom in the order of their y, using each level its own size', () => {
    const project = withLevel(fiveLevels(), 'd', (level) => ({ ...level, size: { w: 64, h: 100 } }))
    const after = setWorldLayout(project, 'main', 'vertical')
    expect(placements(after).map((p) => p.level)).toEqual(['d', 'level-1', 'b', 'e', 'c'])
    expect(at(after)).toEqual({ d: [0, 0], 'level-1': [0, 100], b: [0, 388], e: [0, 676], c: [0, 964] })
  })

  it('breaks a tie by the other axis, then by id, and keeps each depth', () => {
    let project = platformerTemplate.create(counterIds())
    project = withNewLevel(project, 'z', { x: 0, y: 0, depth: 2 })
    project = withNewLevel(project, 'a', { x: 0, y: 0 })
    project = withNewLevel(project, 'up', { x: 0, y: -5 })
    const after = setWorldLayout(project, 'main', 'horizontal')
    expect(placements(after).map((p) => [p.level, p.depth])).toEqual([
      ['up', 0],
      ['a', 0],
      ['level-1', 0],
      ['z', 2],
    ])
  })

  it('switching from one sequence to the other re-sorts along the new axis', () => {
    const horizontal = setWorldLayout(fiveLevels(), 'main', 'horizontal')
    const vertical = setWorldLayout(horizontal, 'main', 'vertical')
    expect(placements(vertical).map((p) => p.level)).toEqual(['level-1', 'c', 'e', 'b', 'd'])
    expect(placements(vertical).map((p) => p.y)).toEqual([0, 288, 576, 864, 1152])
    expect(setWorldLayout(vertical, 'main', 'vertical')).toBe(vertical)
  })

  it('leaves a placement of a missing level where it is and gives it no length', () => {
    const project = withWorld(fiveLevels(), 'main', (world) => ({
      ...world,
      placements: [{ level: 'ghost', x: 300, y: 9, depth: 0 }, ...world.placements],
    }))
    const after = setWorldLayout(project, 'main', 'horizontal')
    expect(at(after).ghost).toEqual([300, 9])
    expect(at(after)['level-1']).toEqual([0, 0])
    expect(at(after).c).toEqual([512, 0])
  })
})

describe('setWorldLayout: errors', () => {
  it('throws RangeError for an unknown world', () => {
    expect(() => setWorldLayout(fiveLevels(), 'nowhere', 'grid')).toThrow(/no world "nowhere"/)
  })
})
