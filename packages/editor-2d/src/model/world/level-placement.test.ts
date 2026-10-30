import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { withLevel, withNewLevel, withWorld } from '../../testing/project-edit'
import { counterIds } from '../ids'
import type { Placement, Project } from '../project-types'
import { moveLevelInWorld, placeLevel, setLevelDepth } from './level-placement'
import { setWorldLayout } from './world-layout'

/** `level-1` (512 × 288) at the origin and `b`, `c` beside it, in the free world `main`, plus an empty world `side`. */
function project(): Project {
  let p = platformerTemplate.create(counterIds())
  p = withNewLevel(p, 'b', { x: 512, y: 0 })
  p = withNewLevel(p, 'c', { x: 1024, y: 0 })
  return { ...p, worlds: [...p.worlds, { id: 'side', layout: 'free', placements: [] }] }
}

const placementsOf = (p: Project, world = 'main'): readonly Placement[] =>
  p.worlds.find((found) => found.id === world)?.placements ?? []
const spot = (p: Project, level: string, world = 'main'): Placement | undefined =>
  placementsOf(p, world).find((placement) => placement.level === level)
const codes = (p: Project): string[] => checkProject(p, {}).map((d) => d.code)

describe('moveLevelInWorld', () => {
  it('moves to whole pixels in a free world and leaves the other placements as they are', () => {
    const before = project()
    const after = moveLevelInWorld(before, 'b', 600.4, -20.6)
    expect(spot(after, 'b')).toEqual({ level: 'b', x: 600, y: -21, depth: 0 })
    expect(spot(after, 'c')).toBe(spot(before, 'c'))
    expect(after.levels).toBe(before.levels)
    expect(spot(before, 'b')).toMatchObject({ x: 512, y: 0 })
    expect(spot(moveLevelInWorld(before, 'b', 512, 40), 'b')).toMatchObject({ x: 512, y: 40 })
  })

  it("snaps to the world's grid in a grid world", () => {
    const grid = setWorldLayout(project(), 'main', 'grid', { w: 32, h: 32 })
    expect(spot(moveLevelInWorld(grid, 'b', 600, 47), 'b')).toMatchObject({ x: 608, y: 32 })
  })

  it('returns the same project when the level is already there, after rounding or snapping', () => {
    const before = project()
    expect(moveLevelInWorld(before, 'b', 512.3, 0)).toBe(before)
    const grid = setWorldLayout(project(), 'main', 'grid', { w: 32, h: 32 })
    expect(moveLevelInWorld(grid, 'b', 520, 10)).toBe(grid)
  })

  it('reorders a sequence where the level centre falls among the others, then lays it out again', () => {
    const line = setWorldLayout(project(), 'main', 'horizontal')
    // Dragged left so its centre (−100 + 256) is before level-1's centre (256): first.
    const first = moveLevelInWorld(line, 'c', -100, 40)
    expect(placementsOf(first).map((p) => [p.level, p.x, p.y])).toEqual([
      ['c', 0, 0],
      ['level-1', 512, 0],
      ['b', 1024, 0],
    ])
    // Its centre just past b's centre (768): last again, which is where it was, so nothing changes.
    expect(moveLevelInWorld(line, 'c', 513, 0)).toBe(line)
    // Between level-1 and b.
    const middle = moveLevelInWorld(line, 'c', 300, 0)
    expect(placementsOf(middle).map((p) => p.level)).toEqual(['level-1', 'c', 'b'])
  })

  it('compares centres, not left edges, so a level of another size is passed at its middle', () => {
    const narrow = withLevel(project(), 'level-1', (level) => ({ ...level, size: { w: 64, h: 288 } }))
    const line = setWorldLayout(narrow, 'main', 'horizontal')
    // c's left edge (−200) is before level-1's (0), but its centre (56) is past level-1's (32).
    const moved = moveLevelInWorld(line, 'c', -200, 0)
    expect(placementsOf(moved).map((p) => p.level)).toEqual(['level-1', 'c', 'b'])
  })

  it('reorders a vertical sequence by y', () => {
    const column = setWorldLayout(project(), 'main', 'vertical')
    const moved = moveLevelInWorld(column, 'level-1', 0, 400)
    expect(placementsOf(moved).map((p) => [p.level, p.y])).toEqual([
      ['b', 0],
      ['level-1', 288],
      ['c', 576],
    ])
  })

  it('throws RangeError for an unknown level and for a level no world places', () => {
    expect(() => moveLevelInWorld(project(), 'nope', 0, 0)).toThrow(/no level "nope"/)
    const unplaced = withWorld(project(), 'main', (w) => ({
      ...w,
      placements: w.placements.filter((p) => p.level !== 'b'),
    }))
    expect(() => moveLevelInWorld(unplaced, 'b', 0, 0)).toThrow(/level "b" is not placed/)
  })
})

describe('placeLevel', () => {
  it('moves a level to another world, at its depth, and closes the sequence it left', () => {
    const line = setWorldLayout(project(), 'main', 'horizontal')
    const depth = setLevelDepth(line, 'level-1', 3)
    const after = placeLevel(depth, 'level-1', 'side', { x: 10, y: 20 })
    expect(placementsOf(after, 'side')).toEqual([{ level: 'level-1', x: 10, y: 20, depth: 3 }])
    expect(placementsOf(after).map((p) => [p.level, p.x])).toEqual([
      ['b', 0],
      ['c', 512],
    ])
  })

  it("places a level no world holds, which clears levelOutsideWorld, using the target's layout", () => {
    const unplaced = withWorld(project(), 'main', (w) => ({
      ...w,
      placements: w.placements.filter((p) => p.level !== 'b'),
    }))
    expect(codes(unplaced)).toContain('levelOutsideWorld')
    const grid = setWorldLayout(unplaced, 'side', 'grid', { w: 64, h: 64 })
    const after = placeLevel(grid, 'b', 'side', { x: 100, y: 100 })
    expect(placementsOf(after, 'side')).toEqual([{ level: 'b', x: 128, y: 128, depth: 0 }])
    expect(codes(after)).not.toContain('levelOutsideWorld')
  })

  it('keeps one placement of a level placed twice', () => {
    const twice = withWorld(project(), 'side', (w) => ({
      ...w,
      placements: [{ level: 'b', x: 0, y: 0, depth: 0 }],
    }))
    expect(codes(twice)).toContain('levelOutsideWorld')
    const after = placeLevel(twice, 'b', 'main', { x: 2000, y: 0 })
    expect(placementsOf(after, 'side')).toEqual([])
    expect(spot(after, 'b')).toMatchObject({ x: 2000, y: 0 })
    expect(codes(after)).not.toContain('levelOutsideWorld')
  })

  it('inserts into a sequence by position', () => {
    const line = setWorldLayout(project(), 'side', 'horizontal')
    const one = placeLevel(line, 'c', 'side', { x: 0, y: 0 })
    const two = placeLevel(one, 'b', 'side', { x: -400, y: 0 })
    expect(placementsOf(two, 'side').map((p) => [p.level, p.x])).toEqual([
      ['b', 0],
      ['c', 512],
    ])
  })

  it('returns the same project when the level is already there', () => {
    const before = project()
    expect(placeLevel(before, 'b', 'main', { x: 512, y: 0 })).toBe(before)
  })

  it('throws RangeError for an unknown level or world', () => {
    expect(() => placeLevel(project(), 'nope', 'main', { x: 0, y: 0 })).toThrow(RangeError)
    expect(() => placeLevel(project(), 'b', 'nowhere', { x: 0, y: 0 })).toThrow(/no world "nowhere"/)
  })
})

describe('setLevelDepth', () => {
  it('stores a whole depth and changes nothing else', () => {
    const before = project()
    const after = setLevelDepth(before, 'b', -2)
    expect(spot(after, 'b')).toEqual({ level: 'b', x: 512, y: 0, depth: -2 })
    expect(setLevelDepth(after, 'b', -2)).toBe(after)
  })

  it('refuses a depth that is not whole, an unknown level and an unplaced one', () => {
    expect(() => setLevelDepth(project(), 'b', 0.5)).toThrow(RangeError)
    expect(() => setLevelDepth(project(), 'nope', 1)).toThrow(RangeError)
    const unplaced = withWorld(project(), 'main', (w) => ({ ...w, placements: [] }))
    expect(() => setLevelDepth(unplaced, 'b', 1)).toThrow(/not placed/)
  })

  it('separates overlapping levels in a free world for the Checks', () => {
    const overlap = moveLevelInWorld(project(), 'b', 100, 0)
    expect(codes(overlap)).toContain('levelsOverlap')
    expect(codes(setLevelDepth(overlap, 'b', 1))).not.toContain('levelsOverlap')
  })
})
