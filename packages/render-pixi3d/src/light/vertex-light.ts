// Direct light from a lamp at a point. Extracted from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at 92e6704,
// `src/render/indirect-light.ts` (`vertexLight`, `lightAt`), with its tests. AF's changes: lamps, ambient and
// occluders come from one `SceneLighting` instead of the level module, and `characterTint` is the per-character light
// of M3R-D4 (the source lit its sprites from normal maps instead).
import { type LightSample, segmentBlocked } from './occlusion.js'
import type { Lamp, SceneLighting } from './scene-lighting.schema.js'

/** A point or direction in world metres. */
type Vec3 = readonly [number, number, number]

/** Lamp levels by lamp id: 0 is off, 1 full. A lamp not listed keeps its content `level`. */
export type LampLevels = Readonly<Record<string, number>>

/** The brightest a light value gets (the source's ceiling): over 1 brightens the base colour, never past 1.6×. */
export const LIGHT_CEILING = 1.6

/** One sRGB channel (0..1) in linear light, the space `@pixi/3d` shades in. */
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** One linear-light channel (0..1) back to sRGB: the inverse of `toLinear`. */
export const toSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

/**
 * A 0xRRGGBB colour, authored in sRGB like every `@pixi/3d` colour, as linear-light 0..1 channels: lamp and ambient
 * colours multiply a surface's linear base colour, as the shader does.
 */
export const channels = (colour: number): Vec3 => [
  toLinear(((colour >> 16) & 255) / 255),
  toLinear(((colour >> 8) & 255) / 255),
  toLinear((colour & 255) / 255),
]

/** The lamp's level: the sim's when it set one, else the content's. */
export const levelOf = (lamp: Lamp, levels: LampLevels): number => levels[lamp.id] ?? lamp.level

/** The lamp's distance falloff and strength at `distance`: `(1 - d / range)² · strength`, 0 at or past its range. */
const falloff = (lamp: Lamp, distance: number): number => {
  if (distance >= lamp.range) return 0
  const k = 1 - distance / lamp.range
  return k * k * lamp.strength
}

/**
 * The light a lamp gives a surface point at level 1: `max(0, N·L) · (1 - d/range)² · strength`, or 0 when it is out
 * of range, faces away or a box or plane stands between (tested from 3 cm off the surface, so the surface never
 * shadows itself). Boxes named in `ignore` never shadow it.
 */
export function vertexLight(
  sample: LightSample,
  lamp: Lamp,
  occluders: Pick<SceneLighting, 'boxes' | 'planes'>,
  ignore: readonly string[] = [],
): number {
  const dx = lamp.x - sample.x
  const dy = lamp.y - sample.y
  const dz = lamp.z - sample.z
  const distance = Math.hypot(dx, dy, dz)
  if (distance >= lamp.range || distance < 0.0001) return 0
  const diffuse = Math.max(0, (sample.nx * dx + sample.ny * dy + sample.nz * dz) / distance)
  if (diffuse === 0) return 0
  const sx = sample.x + sample.nx * 0.03
  const sy = sample.y + sample.ny * 0.03
  const sz = sample.z + sample.nz * 0.03
  if (segmentBlocked(sx, sy, sz, lamp.x, lamp.y, lamp.z, occluders, ignore)) return 0
  return diffuse * falloff(lamp, distance)
}

/**
 * A moving character's light (M3R-D4): the ambient light plus each lamp in range at its level, as `[r, g, b]`
 * multipliers for the character's base colour, each at most `LIGHT_CEILING`. With a `normal`, a lamp adds N·L of its
 * light; without one, its light from every direction (the source's `lightAt`, for a whole character at once). Walls
 * and boxes between the character and a lamp block it. Recomputed every frame: it is one small sum per lamp.
 */
export function characterTint(
  position: readonly [number, number, number],
  normal: readonly [number, number, number] | undefined,
  lighting: SceneLighting,
  levels: LampLevels = {},
): [number, number, number] {
  const ambient = channels(lighting.ambientColor)
  const out: [number, number, number] = [
    lighting.ambient * ambient[0],
    lighting.ambient * ambient[1],
    lighting.ambient * ambient[2],
  ]
  const [x, y, z] = position
  for (const lamp of lighting.lamps) {
    const level = levelOf(lamp, levels)
    if (level === 0) continue
    let light: number
    if (normal === undefined) {
      const distance = Math.hypot(lamp.x - x, lamp.y - y, lamp.z - z)
      light = falloff(lamp, distance)
      if (light > 0 && segmentBlocked(x, y, z, lamp.x, lamp.y, lamp.z, lighting)) light = 0
    } else {
      light = vertexLight({ x, y, z, nx: normal[0], ny: normal[1], nz: normal[2] }, lamp, lighting)
    }
    if (light === 0) continue
    const colour = channels(lamp.color)
    for (let c = 0; c < 3; c++) out[c] = (out[c] ?? 0) + light * level * (colour[c] ?? 0)
  }
  return [Math.min(LIGHT_CEILING, out[0]), Math.min(LIGHT_CEILING, out[1]), Math.min(LIGHT_CEILING, out[2])]
}
