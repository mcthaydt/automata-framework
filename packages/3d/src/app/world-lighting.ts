// A world's light as the look has it: the lamps the kit gives, the walls, floors and ceilings as planes that block and
// darken, the props as boxes, and the time of day's ambient, fill and sun as the light model the bake reads. It lives in
// `app/` because it reads the world builder's pieces and the look and the time of day, which no feature may do together.
import type { Look } from '../features/look/look.schema.ts'
import type { WorldPiece } from '../features/world/build.ts'
import type { WorldLamp } from '../features/world/place-props.ts'
import type { LightModel } from '../shared/render/light/light-model.ts'
import type {
  OccluderBox,
  OccluderPlane,
  SceneLighting,
} from '../shared/render/light/scene-lighting.schema.ts'
import { rgb01 } from '../shared/render/texel.ts'
import { FIGURE_KEY } from '../shared/time-of-day/time-of-day.schema.ts'
import type { TimeOfDay } from '../shared/time-of-day/time-of-day.ts'
import { sceneLamps } from './world-view.ts'

type V3 = readonly [number, number, number]

/** The pitch below the horizon (rad) of the diorama camera, which the sun of a baked room is seen from. */
export const DIORAMA_PITCH: number = (18 * Math.PI) / 180

const normalized = (v: V3): V3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

/** The times a street lamp is lit at: the lamps of a level come on after the day and the golden hour. */
export const isNight = (time: TimeOfDay): boolean => !(time.name === 'day' || time.name === 'golden')

/** The key toward its source in a view pitched down by `pitch` (rad), as world space: `viewToWorld` of the time's key. */
export function sunDirection(time: TimeOfDay, pitch: number): V3 {
  const [x, y, z] = normalized(time.figure.key ?? FIGURE_KEY)
  const [c, s] = [Math.cos(pitch), Math.sin(pitch)]
  return normalized([x, y * c + z * s, -y * s + z * c])
}

/** The light model of a time of day under a look: its ambient, fill, sun and steps, in the colours as drawn. */
export function lightModelOf(time: TimeOfDay, look: Look, pitch: number, floor = 0): LightModel {
  const { ambient, fill, sun, shadow } = time.scene.light
  return {
    step: look.light.step,
    max: look.light.max,
    strength: look.light.strength,
    ambient: { level: ambient.level, tint: rgb01(ambient.tint) },
    fill: { level: fill.level, tint: rgb01(fill.tint), fade: look.light.fade },
    key: look.light.key,
    sun:
      sun === undefined
        ? undefined
        : {
            dir: sunDirection(time, pitch),
            rgb: rgb01(sun.colour).map((c) => c * sun.level) as unknown as V3,
            shadows: shadow,
          },
    floor,
  }
}

interface Bounds {
  readonly low: [number, number, number]
  readonly high: [number, number, number]
}

function boundsOf(positions: readonly number[]): Bounds {
  const low: [number, number, number] = [Infinity, Infinity, Infinity]
  const high: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3)
    for (const axis of [0, 1, 2] as const) {
      low[axis] = Math.min(low[axis], positions[i + axis] as number)
      high[axis] = Math.max(high[axis], positions[i + axis] as number)
    }
  return { low, high }
}

/** A flat piece as the plane it lies in, or `undefined` when its normals do not agree (a rounded thing is a box instead). */
function planeOf(piece: WorldPiece): OccluderPlane | undefined {
  const { positions, normals } = piece.mesh
  if (positions.length === 0) return undefined
  const normal: V3 = [normals[0] as number, normals[1] as number, normals[2] as number]
  for (let i = 3; i < normals.length; i += 3)
    if (
      (normals[i] as number) * normal[0] +
        (normals[i + 1] as number) * normal[1] +
        (normals[i + 2] as number) * normal[2] <
      0.99
    )
      return undefined
  const { low, high } = boundsOf(positions)
  const centre = [0, 1, 2].map((a) => ((low[a] as number) + (high[a] as number)) / 2) as unknown as V3
  const size = [0, 1, 2].map((a) => (high[a] as number) - (low[a] as number)) as unknown as V3
  const flat = Math.abs(normal[1]) > 0.9
  // A floor or ceiling is wide along x and deep along z; a wall is as long as it runs and as high as it stands.
  const width = flat ? size[0] : Math.hypot(size[0], size[2])
  const height = flat ? size[2] : size[1]
  return {
    x: centre[0],
    y: centre[1],
    z: centre[2],
    normal,
    width: Math.max(width, 0.01),
    height: Math.max(height, 0.01),
  }
}

function boxOf(piece: WorldPiece): OccluderBox {
  const { low, high } = boundsOf(piece.mesh.positions)
  return {
    id: piece.id,
    x: (low[0] + high[0]) / 2,
    y: low[1],
    z: (low[2] + high[2]) / 2,
    width: Math.max(high[0] - low[0], 0.01),
    height: Math.max(high[1] - low[1], 0.01),
    depth: Math.max(high[2] - low[2], 0.01),
  }
}

export interface WorldLightingInput {
  readonly pieces: readonly WorldPiece[]
  readonly lamps: readonly WorldLamp[]
  readonly time: TimeOfDay
  readonly look: Look
  /** The camera's pitch below the horizon (rad): the sun is the time's key seen from it. */
  readonly pitch: number
  readonly night?: boolean | undefined
}

/** The scene light of a world: its lamps and occluders, with the look's light model for its time. */
export function worldLighting(input: WorldLightingInput): SceneLighting {
  const planes: OccluderPlane[] = []
  const boxes: OccluderBox[] = []
  for (const piece of input.pieces) {
    if (piece.part === 'floor' || piece.part === 'ceiling' || piece.part === 'wall') {
      const plane = planeOf(piece)
      if (plane !== undefined) planes.push(plane)
      else boxes.push(boxOf(piece))
    } else boxes.push(boxOf(piece))
  }
  return {
    ambient: 0,
    ambientColor: 0xffffff,
    lamps: sceneLamps(input.lamps, input.night ?? true),
    boxes,
    planes,
    model: lightModelOf(input.time, input.look, input.pitch),
  }
}
