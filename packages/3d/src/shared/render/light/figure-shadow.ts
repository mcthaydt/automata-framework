// A figure's cast shadow on the floor, as arithmetic: which floor cells the figure darkens. The picture part (the decal that
// shows them, figure-shadow-view.ts) only draws what this finds, so the rule is read and tested without a GPU.
//
// The rule is EnvironmentBuilder's (`stage/cast.ts shadowOf`): every figure has a contact shadow, an ellipse under its feet,
// 0.3 m either side and 0.16 m toward and away from the camera; and under a sun that casts, its silhouette is thrown along the
// sun onto the floor, each texel at its height above the feet. Only floor is darkened: a cell counts when an up-facing plane of
// the room is under it at the feet's height, so a shadow stops at a floor's edge and never climbs a wall.
//
// A figure is a picture standing in the world, so its texel (x, y) has a height and a place across the picture, and nothing
// else is known about it; the shadow is a function of those two, as the builder's is. The grid the cells are in runs along the
// picture's right and toward the camera, the way the picture's rows run down, so a shadow turns with the view.
import type { Container3D } from '@pixi/3d'
import type { OccluderPlane } from './scene-lighting.schema.ts'

type V3 = readonly [number, number, number]
type V2 = readonly [number, number]

/** The shadow's numbers, the builder's own. */
export const FIGURE_SHADOW = {
  /** The contact ellipse's half width (along the picture's right) and half depth, in metres. */
  contact: [0.3, 0.16] as V2,
  /** A sun lower than this share of its own length casts no silhouette (the builder's `key[1] < 0.2`). */
  lowSun: 0.2,
  /** A floor counts under a figure when it is within this many metres of the feet's height (the builder's `onFloor`). */
  floorReach: 0.12,
  /** The most cells along a side of the grid: a long shadow gets coarser cells rather than a larger grid. */
  most: 256,
}

/** A figure's picture as the painter's cell gives it. */
export interface Silhouette {
  /** Names these texels, so a figure that has not changed is not cast again; without it every cast is made afresh. */
  readonly key?: string | undefined
  readonly width: number
  readonly height: number
  /** Four bytes a texel; a texel is the figure's where its alpha is at least 128. */
  readonly rgba: ArrayLike<number>
  /** The texel the figure's root on the ground maps to. */
  readonly anchor: V2
  /** Metres one texel covers across the picture. */
  readonly metresPerTexel: number
  /** The pitch the picture was drawn at, radians: a texel's height is its rows over the feet over `cos(pitch)`. */
  readonly pitch: number
}

/** One figure to cast. */
export interface ShadowCast {
  readonly silhouette: Silhouette
  /** Where the feet are, in world metres. */
  readonly at: V3
  /** The picture's right as a horizontal unit vector (x, z); the camera is a quarter turn from it, toward +z when it is +x. */
  readonly right: V2
  /** The direction toward the sun, any length, when the sun casts; the shadow is the contact ellipse alone without it. */
  readonly sun?: V3 | undefined
}

/** The cells a figure darkens. */
export interface ShadowMark {
  readonly width: number
  readonly height: number
  /** Metres a cell is on a side. */
  readonly texel: number
  /** Metres from the feet to the grid's near corner, along `right` and along `toward`. */
  readonly originRight: number
  readonly originToward: number
  /** The horizontal unit vectors the grid runs along: the picture's right, and toward the camera. */
  readonly right: V2
  readonly toward: V2
  /** One byte a cell, row by row, 1 where the floor is darkened. */
  readonly marks: Uint8Array
  /** How many cells are marked. */
  readonly count: number
}

/** The y of `plane` at (x, z), when it faces up and (x, z) is inside its rectangle. */
function floorY(plane: OccluderPlane, x: number, z: number): number | undefined {
  const [nx, ny, nz] = plane.normal
  if (ny < 0.7) return undefined
  if (Math.abs(x - plane.x) > plane.width / 2 || Math.abs(z - plane.z) > plane.height / 2) return undefined
  return plane.y - (nx * (x - plane.x) + nz * (z - plane.z)) / ny
}

/**
 * The floor cells `cast` darkens. `floors` are the room's planes: with no up-facing plane among them nothing says where the
 * floor is (a floor that is not a rectangle has none), and the shadow falls on the plane at the feet's height; with some, it falls
 * only where one is under it.
 */
export function castShadow(cast: ShadowCast, floors: readonly OccluderPlane[] = []): ShadowMark {
  const { silhouette: s, at, right, sun } = cast
  // Toward the camera: the right turned a quarter (picture right +x, camera at +z).
  const toward: V2 = [-right[1], right[0]]
  const [rx, rz] = FIGURE_SHADOW.contact
  const rows = s.anchor[1]
  const metres = s.metresPerTexel
  const cos = Math.cos(s.pitch) || 1
  // The sun's throw: metres on the floor, along the right and toward the camera, for each metre of height.
  const casts = sun !== undefined && sun[1] / Math.hypot(sun[0], sun[1], sun[2]) >= FIGURE_SHADOW.lowSun
  const lean: V2 =
    casts && sun !== undefined
      ? [
          (-sun[0] * right[0] - sun[2] * right[1]) / sun[1],
          (-sun[0] * toward[0] - sun[2] * toward[1]) / sun[1],
        ]
      : [0, 0]

  // The silhouette's cells: each opaque texel is a short segment, from its height to the next row's, so a throw longer than a
  // cell leaves no gap between rows.
  const segments: number[] = []
  if (casts) {
    for (let y = 0; y < s.height; y++)
      for (let x = 0; x < s.width; x++) {
        if ((s.rgba[(y * s.width + x) * 4 + 3] ?? 0) < 128) continue
        const across = (x + 0.5 - s.anchor[0]) * metres
        const low = Math.max(0, (rows - y - 1) * metres) / cos
        const high = Math.max(0, (rows - y) * metres) / cos
        segments.push(across + low * lean[0], low * lean[1], across + high * lean[0], high * lean[1])
      }
  }

  // The grid's extent: the contact ellipse and every segment's ends.
  let minR = -rx
  let maxR = rx
  let minT = -rz
  let maxT = rz
  for (let k = 0; k < segments.length; k += 2) {
    minR = Math.min(minR, segments[k] ?? 0)
    maxR = Math.max(maxR, segments[k] ?? 0)
    minT = Math.min(minT, segments[k + 1] ?? 0)
    maxT = Math.max(maxT, segments[k + 1] ?? 0)
  }
  const texel = Math.max(metres, (maxR - minR) / FIGURE_SHADOW.most, (maxT - minT) / FIGURE_SHADOW.most)
  const width = Math.max(1, Math.ceil((maxR - minR) / texel))
  const height = Math.max(1, Math.ceil((maxT - minT) / texel))
  const marks = new Uint8Array(width * height)
  const hasFloors = floors.some((plane) => plane.normal[1] >= 0.7)
  let count = 0
  const mark = (a: number, b: number): void => {
    const i = Math.floor((a - minR) / texel)
    const j = Math.floor((b - minT) / texel)
    if (i < 0 || j < 0 || i >= width || j >= height || marks[j * width + i] === 1) return
    if (hasFloors) {
      const x = at[0] + a * right[0] + b * toward[0]
      const z = at[2] + a * right[1] + b * toward[1]
      const onFloor = floors.some((plane) => {
        const y = floorY(plane, x, z)
        return y !== undefined && Math.abs(y - at[1]) < FIGURE_SHADOW.floorReach
      })
      if (!onFloor) return
    }
    marks[j * width + i] = 1
    count += 1
  }

  // The contact ellipse, by the cells whose centres it holds.
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const a = minR + (i + 0.5) * texel
      const b = minT + (j + 0.5) * texel
      if ((a / rx) ** 2 + (b / rz) ** 2 <= 1) mark(a, b)
    }
  // The silhouette: each segment sampled at the cell's pitch, from its low end to its high.
  for (let k = 0; k < segments.length; k += 4) {
    const [a0, b0, a1, b1] = [
      segments[k] ?? 0,
      segments[k + 1] ?? 0,
      segments[k + 2] ?? 0,
      segments[k + 3] ?? 0,
    ]
    const steps = Math.max(1, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / texel))
    for (let n = 0; n <= steps; n++) mark(a0 + ((a1 - a0) * n) / steps, b0 + ((b1 - b0) * n) / steps)
  }
  return { width, height, texel, originRight: minR, originToward: minT, right, toward, marks, count }
}

/** What a figure gives to be cast: its silhouette, its feet and the way its picture faces; the room supplies the sun and floor. */
export type FigureShadowInput = Omit<ShadowCast, 'sun'>

/** One figure's shadow, drawn on the floor. */
export interface FigureShadow {
  /** Casts the figure as it stands now. Cheap to repeat for a figure that has not changed (its silhouette's `key`). */
  cast(input: FigureShadowInput): void
  /** Takes the shadow off the floor (a figure that is hidden casts none). */
  hide(): void
  /** The cells last cast; for tests. */
  readonly mark: ShadowMark | undefined
  destroy(): void
}

/** A room's figure shadows: the sun that casts, the floors it falls on and how dark it is. */
export interface FigureShadows {
  /** What a shadow multiplies the floor's light by (the look's `figureShadow`). */
  readonly strength: number
  /** A shadow for one figure, a child of `parent`: a node standing at the feet, neither turned nor scaled. */
  add(parent: Container3D): FigureShadow
}
