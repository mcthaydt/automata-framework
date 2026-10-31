import type { Project } from '../../model/project-types'
import { type LinkEnd, linkName, type ProjectLink, projectLinks } from '../../model/refs/ref-links'
import type { Point } from '../../tiles/footprint'
import type { WorldRect } from './world-model'

// The links on the world map (plan ED2D.6c decision 5; 2D editor spec §5.7): one curve per resolved link between two
// placed levels, and the selected level's links as the inspector lists them. Pure; the Pixi map draws the curves and
// jsdom tests read the inspector.

export interface WorldLink {
  readonly from: string
  readonly to: string
  /** What holds the link: the source definition's label, or the level field's. */
  readonly label: string
  /** The source definition's colour; `undefined` for a level field. */
  readonly color: string | undefined
  /** World pixels: the quadratic curve's ends and control point, and its middle, where the label sits. */
  readonly start: Point
  readonly control: Point
  readonly end: Point
  readonly middle: Point
}

/** How far a curve bows to its left, as a share of its length: a link each way between two levels stays apart. */
const BEND = 0.15

function sourceOf(project: Project, link: ProjectLink): { label: string; color: string | undefined } {
  const item = link.from.item
  if (item === undefined) {
    const field = project.defs.levelFields.find((each) => each.id === link.field)
    return { label: field?.label ?? link.field, color: undefined }
  }
  const def = project.defs.entities.find((each) => each.id === item.def)
  return { label: def?.label ?? item.def, color: def?.color }
}

const centre = (rect: WorldRect): Point => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })

/** The middle of the side of `rect` that faces `toward`: left or right when it is mostly across, else top or bottom. */
function facingEdge(rect: WorldRect, toward: Point): Point {
  const c = centre(rect)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: dx >= 0 ? rect.x + rect.w : rect.x, y: c.y }
  return { x: c.x, y: dy >= 0 ? rect.y + rect.h : rect.y }
}

function curve(from: WorldRect, to: WorldRect): Pick<WorldLink, 'start' | 'control' | 'end' | 'middle'> {
  const start = facingEdge(from, centre(to))
  const end = facingEdge(to, centre(from))
  const dx = end.x - start.x
  const dy = end.y - start.y
  const bend = BEND * Math.hypot(dx, dy)
  const length = Math.hypot(dx, dy) || 1
  // The left normal of the direction of travel (screen y points down).
  const control = {
    x: (start.x + end.x) / 2 + (dy / length) * bend,
    y: (start.y + end.y) / 2 - (dx / length) * bend,
  }
  const middle = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  }
  return { start, control, end, middle }
}

/** Every link between two different levels that `rects` places, in the project's link order. */
export function worldLinks(project: Project, rects: readonly WorldRect[]): readonly WorldLink[] {
  const placed = new Map(rects.map((rect) => [rect.id, rect]))
  return projectLinks(project).flatMap((link) => {
    const from = placed.get(link.from.level)
    const to = placed.get(link.to.level)
    if (from === undefined || to === undefined || from === to) return []
    return [{ from: from.id, to: to.id, ...sourceOf(project, link), ...curve(from, to) }]
  })
}

export interface LevelLinks {
  /** What the level links to: the source's id (or the level's for a level field), what holds it, the target's name. */
  readonly out: readonly { readonly source: string; readonly label: string; readonly to: string }[]
  /** The names of the other levels that link to it, in project order. */
  readonly from: readonly string[]
}

const levelName = (project: Project, end: LinkEnd): string =>
  project.levels.find((level) => level.id === end.level)?.name ?? end.level

export function levelLinks(project: Project, level: string): LevelLinks {
  const links = projectLinks(project)
  const out = links
    .filter((link) => link.from.level === level)
    .map((link) => ({
      source: link.from.item?.id ?? level,
      label: sourceOf(project, link).label,
      to: linkName(project, link.to),
    }))
  const from = links
    .filter((link) => link.to.level === level && link.from.level !== level)
    .map((link) => levelName(project, link.from))
  return { out, from: [...new Set(from)] }
}
