// What the Plan view paints, in canvas pixels (ED3D.5d, ED3D spec §6): the scene's fills and walls, the things, the
// links between them, the grid and the rulers. Plain numbers and colours, so a renderer only strokes and fills what it
// is given and every rule here is a unit test: a hidden layer is not painted (a locked one is), a selection is outlined
// in the accent, a group keeps its fill wherever it is. No Pixi, no DOM.
import type { Point as ScreenPoint, Viewport2D } from '@automata/editor/kit/core'
import { entitySelection } from '../../../shared/checks/check'
import type { ThingLink } from '../../../shared/level-session/thing-links'
import type { ThingDef } from '../../../shared/things/thing-def.schema'
import type { EntityKit, Thing } from '../../../shared/things/things'
import { FLOOR_TINT, GROUP_FILLS, mixColor, PLAN_COLORS, parseHex } from './plan-colors'
import type { PlanFill, PlanScene, PlanWall, WallKind } from './plan-scene'
import { gridLines, toScreen } from './plan-viewport'
import { halfFootprint, isThingLayerOff } from './thing-pick'

export interface PlanPaintInput {
  readonly scene: PlanScene
  readonly kit: EntityKit
  readonly links: readonly ThingLink[]
  /** The definition whose things the links join. */
  readonly linkDef?: string | undefined
  readonly viewport: Viewport2D
  /** The grid's base step in metres; the drawn step doubles until lines are 16 px apart. */
  readonly grid: number
  /** The hidden layers: `things` and `things:<definition>` leave things out (the scene has already left out the rest). */
  readonly hidden: readonly string[]
  /** The selection ids. */
  readonly selected: ReadonlySet<string>
  /** The game's colour for a material by name: a room whose floor has one is tinted with it. */
  readonly colours?: ((texture: string) => number | undefined) | undefined
}

export interface PaintFill {
  readonly sector: string
  /** The outline as x, y pairs. */
  readonly points: readonly number[]
  readonly holes: readonly (readonly number[])[]
  readonly color: number
  readonly selected: boolean
}

/** A word on the plan at a screen point: "Pit" at the middle of a room that is one. */
export interface PaintMark {
  readonly text: string
  readonly at: ScreenPoint
}

export interface PaintStroke {
  readonly a: ScreenPoint
  readonly b: ScreenPoint
  readonly color: number
  readonly width: number
  readonly dashed: boolean
}

export type PaintThing = {
  readonly id: string
  readonly color: number
  readonly selected: boolean
} & (
  | { readonly shape: 'disc'; readonly x: number; readonly y: number }
  | {
      readonly shape: 'rect'
      readonly x: number
      readonly y: number
      readonly w: number
      readonly h: number
      readonly dashed: boolean
    }
)

export interface PaintLine {
  readonly a: ScreenPoint
  readonly b: ScreenPoint
  readonly color: number
}

export interface PaintGridLine {
  readonly a: ScreenPoint
  readonly b: ScreenPoint
  readonly major: boolean
}

export interface RulerTick {
  /** The pixel along the ruler. */
  readonly at: number
  readonly label: string
}

export interface PlanPaint {
  readonly background: number
  /** The selection's colour. */
  readonly accent: number
  /** The grid lines' colour; they are drawn faint. */
  readonly gridColor: number
  readonly grid: readonly PaintGridLine[]
  readonly fills: readonly PaintFill[]
  /** Words laid over the fills. */
  readonly marks: readonly PaintMark[]
  readonly walls: readonly PaintStroke[]
  readonly links: readonly PaintLine[]
  readonly things: readonly PaintThing[]
  readonly rulers: { readonly x: readonly RulerTick[]; readonly z: readonly RulerTick[] }
}

/** The fill of a zone or style, the same in every level: the group's name picks it. No group is the neutral fill. */
export function groupColor(group: string): number {
  if (group === '') return PLAN_COLORS.fill
  let hash = 0
  for (const char of group) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) | 0
  return GROUP_FILLS[Math.abs(hash) % GROUP_FILLS.length] ?? PLAN_COLORS.fill
}

/** A room's fill: its floor's own colour in the game, softened; else the colour its zone or style picks. */
function fillColor(fill: PlanFill, colours: PlanPaintInput['colours']): number {
  const floor = fill.floorTexture === undefined ? undefined : colours?.(fill.floorTexture)
  return floor === undefined ? groupColor(fill.group) : mixColor(PLAN_COLORS.fill, floor, FLOOR_TINT)
}

const STROKES: Readonly<Record<WallKind, { color: number; width: number; dashed: boolean }>> = {
  solid: { color: PLAN_COLORS.wall, width: 2.5, dashed: false },
  portal: { color: PLAN_COLORS.portal, width: 1.75, dashed: true },
  door: { color: PLAN_COLORS.door, width: 5, dashed: false },
  window: { color: PLAN_COLORS.window, width: 4, dashed: false },
}

/** A wall's line, and for a door or a window the thick piece over its span drawn on a solid line. */
function wallStrokes(wall: PlanWall, viewport: Viewport2D): PaintStroke[] {
  const a = toScreen(viewport, wall.a)
  const b = toScreen(viewport, wall.b)
  if (wall.span === undefined) return [{ a, b, ...STROKES[wall.kind] }]
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
  const along = (metres: number) => {
    const t = length > 0 ? metres / length : 0
    return toScreen(viewport, {
      x: wall.a.x + (wall.b.x - wall.a.x) * t,
      z: wall.a.z + (wall.b.z - wall.a.z) * t,
    })
  }
  return [
    { a, b, ...STROKES.solid },
    { a: along(wall.span[0]), b: along(wall.span[1]), ...STROKES[wall.kind] },
  ]
}

const numberValue = (value: unknown): number => (typeof value === 'number' ? value : 0)

function thingMark(definition: ThingDef, thing: Thing, input: PlanPaintInput): PaintThing {
  const { viewport } = input
  const color = parseHex(definition.color ?? '') ?? PLAN_COLORS.box
  const selected = input.selected.has(entitySelection(thing.def, thing.id))
  const base = { id: thing.id, color, selected }
  if (definition.area !== undefined) {
    const [x0, z0, x1, z1] = definition.area.map((field) => numberValue(thing.values[field]))
    const from = toScreen(viewport, { x: Math.min(x0 ?? 0, x1 ?? 0), z: Math.min(z0 ?? 0, z1 ?? 0) })
    const to = toScreen(viewport, { x: Math.max(x0 ?? 0, x1 ?? 0), z: Math.max(z0 ?? 0, z1 ?? 0) })
    return { ...base, shape: 'rect', x: from.x, y: from.y, w: to.x - from.x, h: to.y - from.y, dashed: true }
  }
  const at = toScreen(viewport, { x: thing.x, z: thing.z })
  if (definition.shape === 'point') return { ...base, shape: 'disc', x: at.x, y: at.y }
  const half = halfFootprint(definition, thing)
  const from = toScreen(viewport, { x: thing.x - half.x, z: thing.z - half.z })
  const to = toScreen(viewport, { x: thing.x + half.x, z: thing.z + half.z })
  return { ...base, shape: 'rect', x: from.x, y: from.y, w: to.x - from.x, h: to.y - from.y, dashed: false }
}

/** Metres on a ruler: whole numbers bare, the minus sign a real one. */
const metres = (value: number): string => {
  const text = String(Math.round(value * 100) / 100 + 0)
  return text.startsWith('-') ? `−${text.slice(1)}` : text
}

export function planPaint(input: PlanPaintInput): PlanPaint {
  const { scene, viewport, kit } = input
  const fills = scene.fills.map((fill) => ({
    sector: fill.sector,
    points: fill.outline.flatMap((point) => {
      const at = toScreen(viewport, point)
      return [at.x, at.y]
    }),
    holes: fill.holes.map((hole) =>
      hole.flatMap((point) => {
        const at = toScreen(viewport, point)
        return [at.x, at.y]
      }),
    ),
    color: fill.pit === true ? PLAN_COLORS.pit : fillColor(fill, input.colours),
    selected: fill.selection !== undefined && input.selected.has(fill.selection),
  }))
  // The middle of the outline's box: a pit's word sits inside it for any room that is not a crescent.
  const marks = scene.fills.flatMap((fill): PaintMark[] => {
    if (fill.pit !== true || fill.outline.length === 0) return []
    const xs = fill.outline.map((point) => point.x)
    const zs = fill.outline.map((point) => point.z)
    const middle = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
    return [{ text: 'Pit', at: toScreen(viewport, middle) }]
  })
  const selectedSectors = new Set(fills.filter((fill) => fill.selected).map((fill) => fill.sector))
  const walls = scene.walls.flatMap((wall) => wallStrokes(wall, viewport))
  // The accent goes over everything else: a selected wall, and the walls of a selected sector.
  const accents = scene.walls
    .filter(
      (wall) =>
        selectedSectors.has(wall.sector) ||
        (wall.selection !== undefined && input.selected.has(wall.selection)),
    )
    .map((wall) => ({
      a: toScreen(viewport, wall.a),
      b: toScreen(viewport, wall.b),
      color: PLAN_COLORS.accent,
      width: 3.5,
      dashed: false,
    }))

  const hiddenOnly = { hidden: input.hidden, locked: [] }
  const definitions = new Map(kit.definitions.map((definition) => [definition.id, definition]))
  const shown = kit.things.filter(
    (thing) => definitions.has(thing.def) && !isThingLayerOff(hiddenOnly, thing.def),
  )
  const things = shown.map((thing) => thingMark(definitions.get(thing.def) as ThingDef, thing, input))

  const linkDef = input.linkDef
  const linked = linkDef === undefined ? undefined : definitions.get(linkDef)
  const ends = new Map(shown.filter((thing) => thing.def === linkDef).map((thing) => [thing.id, thing]))
  const links: PaintLine[] = []
  if (linked !== undefined) {
    const color = parseHex(linked.color ?? '') ?? PLAN_COLORS.box
    for (const link of input.links) {
      const a = ends.get(link.a)
      const b = ends.get(link.b)
      if (a === undefined || b === undefined) continue
      links.push({ a: toScreen(viewport, a), b: toScreen(viewport, b), color })
    }
  }

  const lines = gridLines(viewport, input.grid)
  const { w, h } = viewport.size
  const grid: PaintGridLine[] = [
    ...lines.xs.map((line) => {
      const x = toScreen(viewport, { x: line.m, z: 0 }).x
      return { a: { x, y: 0 }, b: { x, y: h }, major: line.major }
    }),
    ...lines.zs.map((line) => {
      const y = toScreen(viewport, { x: 0, z: line.m }).y
      return { a: { x: 0, y }, b: { x: w, y }, major: line.major }
    }),
  ]
  const rulers = {
    x: lines.xs
      .filter((line) => line.major)
      .map((line) => ({ at: toScreen(viewport, { x: line.m, z: 0 }).x, label: metres(line.m) })),
    z: lines.zs
      .filter((line) => line.major)
      .map((line) => ({ at: toScreen(viewport, { x: 0, z: line.m }).y, label: metres(line.m) })),
  }

  return {
    background: PLAN_COLORS.background,
    accent: PLAN_COLORS.accent,
    gridColor: PLAN_COLORS.grid,
    grid,
    fills,
    marks,
    walls: [...walls, ...accents],
    links,
    things,
    rulers,
  }
}
