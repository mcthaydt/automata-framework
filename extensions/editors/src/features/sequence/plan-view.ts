// The cutscene seen from above: the scene's state at the playhead turned into dots, a wedge and walls, fitted to a box.
// It is drawn from the director's state alone, so the preview shows what the game would, without running the game.

import { type ContentLevel, intGridRows, levelContentSchema } from '@automata/content/level-2d'
import type { SceneState } from '@automata/cutscenes/director'
import { openDocument } from '@automata/editor/kit/documents'
import type { SuitePorts } from '@automata/editor/kit/ports'

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

/** The walls of the level in `path`, read from its file; none when the file is missing or does not read. */
export async function levelWalls(ports: SuitePorts, path: string): Promise<Segment[]> {
  const read = await ports.workspace.read(path)
  if (read === undefined) return []
  try {
    const parsed = levelContentSchema.safeParse(openDocument(path, read.text).value())
    return parsed.success ? wallsOfLevel(parsed.data) : []
  } catch {
    return []
  }
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
