import type { ContentNeighbours } from '@automataframework/automata-content/level-2d'
import type { Project, World } from '../project-types.ts'

// Neighbours for room-scrolling games: in a `grid` world, the levels whose edge touches
// a level's edge. A touch needs a span of positive length, so two levels that meet only at a corner are not neighbours.
// Depth is ignored: a world that stacks levels at different depths is not a room map. The export writes these into
// `world.toml` and the World view shows them, so both read this one rule.

/** One level's neighbours, each side ordered by position and then id: the shape `world.toml` holds. */
export type LevelNeighbours = ContentNeighbours

interface Box {
  readonly level: string
  readonly x: number
  readonly y: number
  readonly right: number
  readonly bottom: number
}

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  Math.min(aEnd, bEnd) > Math.max(aStart, bStart)

const byColumnThenRow = (a: Box, b: Box): number => a.x - b.x || a.y - b.y || (a.level < b.level ? -1 : 1)
const byRowThenColumn = (a: Box, b: Box): number => a.y - b.y || a.x - b.x || (a.level < b.level ? -1 : 1)

/** For every placed level of `world`, the levels that touch it (a placement of a missing level is skipped). */
export function worldNeighbours(project: Project, world: World): LevelNeighbours[] {
  const boxes: Box[] = world.placements.flatMap((placement) => {
    const level = project.levels.find((candidate) => candidate.id === placement.level)
    if (level === undefined) return []
    return [
      {
        level: level.id,
        x: placement.x,
        y: placement.y,
        right: placement.x + level.size.w,
        bottom: placement.y + level.size.h,
      },
    ]
  })
  return boxes.map((box) => {
    const others = boxes.filter((other) => other !== box)
    const ids = (found: Box[], order: (a: Box, b: Box) => number): string[] =>
      found.sort(order).map((other) => other.level)
    return {
      level: box.level,
      north: ids(
        others.filter((o) => o.bottom === box.y && overlap(box.x, box.right, o.x, o.right)),
        byColumnThenRow,
      ),
      east: ids(
        others.filter((o) => o.x === box.right && overlap(box.y, box.bottom, o.y, o.bottom)),
        byRowThenColumn,
      ),
      south: ids(
        others.filter((o) => o.y === box.bottom && overlap(box.x, box.right, o.x, o.right)),
        byColumnThenRow,
      ),
      west: ids(
        others.filter((o) => o.right === box.x && overlap(box.y, box.bottom, o.y, o.bottom)),
        byRowThenColumn,
      ),
    }
  })
}
