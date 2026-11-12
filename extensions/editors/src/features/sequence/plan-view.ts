// The cutscene seen from above: the scene's state at the playhead turned into dots, a wedge and walls, fitted to a box.
// It is drawn from the director's state alone, so the preview shows what the game would, without running the game.

import { type AfSector2, readLevel } from '@automataframework/3d/level'
import { type ContentLevel, intGridRows, levelContentSchema } from '@automataframework/content/level-2d'
import type { SceneState } from '@automataframework/cutscenes/director'
import { openDocument } from '@automataframework/editor/kit/documents'
import type { SuitePorts } from '@automataframework/editor/kit/ports'

/** A wall from one point of the plan to another, in metres. */
export type Segment = readonly [number, number, number, number]

export interface PlanActor {
  readonly name: string
  readonly x: number
  readonly y: number
  /** Which way it faces, in degrees on the screen (0 to the right, turning clockwise as the plan is seen). A key stores radians, turning the other way. */
  readonly facing: number
  readonly alpha: number
}

export interface Plan {
  readonly actors: readonly PlanActor[]
  readonly camera: { readonly x: number; readonly y: number; readonly angle: number; readonly spread: number }
  /** The line shown on screen, by its id; the page turns it into words. */
  readonly captionLine?: string
  readonly fade: number
  readonly walls: readonly Segment[]
  /** Pixels of the plan for one metre. */
  readonly scale: number
}

/** What the preview says in a 3D game, which has no 2D level to show walls from. */
export const NO_WALLS_WORDS = 'Walls show for 2D levels only, for now.'

const DEGREES = 180 / Math.PI

/** The four walls of every solid cell of a level's collision layer, one metre a cell. */
export function wallsOfLevel(level: ContentLevel, layer = 'collision'): Segment[] {
  const name = level.layers.some((candidate) => candidate.def === layer && candidate.kind === 'intgrid')
    ? layer
    : level.layers.find((candidate) => candidate.kind === 'intgrid')?.def
  if (name === undefined) return []
  const walls: Segment[] = []
  intGridRows(level, name).forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) return
      walls.push([x, y, x + 1, y], [x + 1, y, x + 1, y + 1], [x + 1, y + 1, x, y + 1], [x, y + 1, x, y])
    })
  })
  return walls
}

const openValue = (text: string, path: string): unknown => {
  try {
    return openDocument(path, text).value()
  } catch {
    return undefined
  }
}

/** A 3D level read from a parsed file, or undefined when it is not an `af-sector` file that reads. */
function level3d(value: unknown): AfSector2 | undefined {
  const format = (value as { format?: unknown } | null | undefined)?.format
  if (typeof format !== 'string' || !format.startsWith('af-sector/')) return undefined
  const read = readLevel(value)
  return read.problems.length === 0 ? read.level : undefined
}

/**
 * The walls of a 3D level as plan segments in metres: every sector edge that is not a portal, and a wall with a door in
 * two pieces either side of it (the door's `at` is its centre along the wall). A window leaves the wall whole.
 */
export function wallsOfSectors(level: AfSector2): Segment[] {
  const walls: Segment[] = []
  for (const sector of level.sectors) {
    for (const [i, corner] of sector.corners.entries()) {
      const next = sector.corners[(i + 1) % sector.corners.length] as readonly number[]
      const wall = corner[2]
      if (wall?.next !== undefined) continue
      const [x0, z0] = corner
      const [x1, z1] = next as readonly [number, number]
      const door = wall?.door
      const length = Math.hypot(x1 - x0, z1 - z0)
      if (door === undefined || length === 0) {
        walls.push([x0, z0, x1, z1])
        continue
      }
      const along = (d: number): [number, number] => [
        x0 + ((x1 - x0) * d) / length,
        z0 + ((z1 - z0) * d) / length,
      ]
      const open = Math.max(0, door.at - door.width / 2)
      const shut = Math.min(length, door.at + door.width / 2)
      if (open > 0) walls.push([x0, z0, ...along(open)])
      if (shut < length) walls.push([...along(shut), x1, z1])
    }
  }
  return walls
}

/**
 * The walls of a level file's text, 2D or 3D, or a sentence saying it is not a level. A 2D level gives its solid cells, a 3D
 * level its sector edges that are not portals.
 */
export function wallsOfFile(
  text: string,
  path: string,
): { readonly walls: Segment[] } | { readonly problem: string } {
  const value = openValue(text, path)
  const two = levelContentSchema.safeParse(value)
  if (two.success) return { walls: wallsOfLevel(two.data) }
  const three = level3d(value)
  if (three !== undefined) return { walls: wallsOfSectors(three) }
  return { problem: `${path} is not a level this editor can read walls from` }
}

/** The names a 3D level offers a script's pickers: its lamps, the ids of the doors in its sectors, its props and its things. */
export interface LevelNames {
  readonly lamps: readonly string[]
  readonly doors: readonly string[]
  readonly props: readonly string[]
  readonly things: readonly string[]
}

export function levelNamesOf(text: string, path: string): LevelNames {
  const level = level3d(openValue(text, path))
  if (level === undefined) return { lamps: [], doors: [], props: [], things: [] }
  const doors = level.sectors.flatMap((sector) =>
    sector.corners.flatMap((corner) =>
      corner[2]?.door === undefined ? [] : [corner[2].door.id ?? sector.id],
    ),
  )
  return {
    lamps: (level.lamps ?? []).map((lamp) => lamp.id),
    doors: [...new Set(doors)],
    props: (level.props ?? []).map((prop) => prop.id),
    things: (level.entities ?? []).map((entity) => entity.id),
  }
}

/** The walls of the level in `path`, read from its file; none when the file is missing or does not read. */
export async function levelWalls(ports: SuitePorts, path: string): Promise<Segment[]> {
  const read = await ports.workspace.read(path)
  if (read === undefined) return []
  const walls = wallsOfFile(read.text, path)
  return 'walls' in walls ? walls.walls : []
}

/** Fits the scene at one moment into `size`, with a margin, keeping a metre the same length both ways. */
export function planView(
  state: SceneState,
  walls: readonly Segment[],
  size: { readonly w: number; readonly h: number },
): Plan {
  const actors = Object.entries(state.actors)
  const xs: number[] = [state.camera.pos[0], state.camera.look[0]]
  const zs: number[] = [state.camera.pos[2], state.camera.look[2]]
  for (const [, actor] of actors) {
    xs.push(actor.x)
    zs.push(actor.z)
  }
  for (const [x0, y0, x1, y1] of walls) {
    xs.push(x0, x1)
    zs.push(y0, y1)
  }
  const least = { x: Math.min(...xs), z: Math.min(...zs) }
  const span = { x: Math.max(1, Math.max(...xs) - least.x), z: Math.max(1, Math.max(...zs) - least.z) }
  const margin = Math.min(size.w, size.h) * 0.08
  const scale = Math.min((size.w - 2 * margin) / span.x, (size.h - 2 * margin) / span.z)
  const toX = (x: number): number => margin + (x - least.x) * scale
  const toY = (z: number): number => margin + (z - least.z) * scale
  return {
    actors: actors.map(([name, actor]) => ({
      name,
      x: toX(actor.x),
      y: toY(actor.z),
      facing: Math.round(-actor.facing * DEGREES * 1000) / 1000,
      alpha: actor.alpha,
    })),
    camera: {
      x: toX(state.camera.pos[0]),
      y: toY(state.camera.pos[2]),
      angle:
        Math.atan2(state.camera.look[2] - state.camera.pos[2], state.camera.look[0] - state.camera.pos[0]) *
        DEGREES,
      spread: state.camera.fov,
    },
    ...(state.caption === null ? {} : { captionLine: state.caption.line }),
    fade: state.fade,
    walls: walls.map(([x0, y0, x1, y1]) => [toX(x0), toY(y0), toX(x1), toY(y1)] as const),
    scale,
  }
}
