// Direct light from a lamp at a point. AF's changes: lamps, ambient and occluders come from one `SceneLighting` instead
// of the level module, and `characterTint` is the per-character light of M3R-D4 (the source lit its sprites from normal
// maps instead).
import { contactShade, floorUnder, type LightSample, segmentBlocked } from './occlusion.ts'
import type { Lamp, SceneLighting } from './scene-lighting.schema.ts'

/** A point or direction in world metres. */
type Vec3 = readonly [number, number, number]

/** Lamp levels by lamp id: 0 is off, 1 full. A lamp not listed keeps its content `level`. */
export type LampLevels = Readonly<Record<string, number>>

/** The brightest a light value gets (the source's ceiling): over 1 brightens the base colour, never past 1.6×. */
export const LIGHT_CEILING = 1.6

/** One sRGB channel (0..1) in linear light, the space `@pixi/3d` shades in. */
export const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

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
 * How much of a lamp's light a direction gets: 1 with no cone; else 0 outside the cone, 1 well inside it, soft over a
 * third of its edge. `(dx, dy, dz)` runs from the surface to the lamp. The aim need not be a unit vector.
 */
function coneShare(lamp: Lamp, dx: number, dy: number, dz: number, distance: number): number {
  if (lamp.aim === undefined || lamp.cone === undefined) return 1
  const aim = Math.hypot(lamp.aim[0], lamp.aim[1], lamp.aim[2])
  const edge = Math.cos((lamp.cone * Math.PI) / 180)
  const at = -(lamp.aim[0] * dx + lamp.aim[1] * dy + lamp.aim[2] * dz) / (aim * distance)
  return Math.min(1, Math.max(0, ((at - edge) / (1 - edge)) * 3))
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
  const cone = coneShare(lamp, dx, dy, dz, distance)
  if (cone === 0) return 0
  const sx = sample.x + sample.nx * 0.03
  const sy = sample.y + sample.ny * 0.03
  const sz = sample.z + sample.nz * 0.03
  if (segmentBlocked(sx, sy, sz, lamp.x, lamp.y, lamp.z, occluders, ignore)) return 0
  return diffuse * falloff(lamp, distance) * cone
}

/** Light comes in steps: its brightest channel snapped to the nearest `step`, its hue kept. A step of 0 leaves it. */
export function stepLight(light: Vec3, step: number): Vec3 {
  const peak = Math.max(light[0], light[1], light[2])
  if (step <= 0 || peak <= 0) return light
  const k = (Math.round(peak / step) * step) / peak
  return [light[0] * k, light[1] * k, light[2] * k]
}

/** A colour as the light's channels in its space: linear light, or (for `srgb`) the sRGB value itself. */
export const lightChannels = (colour: number, space: SceneLighting['colorSpace']): Vec3 =>
  space === 'srgb'
    ? [((colour >> 16) & 255) / 255, ((colour >> 8) & 255) / 255, (colour & 255) / 255]
    : channels(colour)

/** A tint: the colour's channels scaled so its brightest is 1 (the tint sets the hue, its level the strength). */
const tintOf = (colour: number, space: SceneLighting['colorSpace']): Vec3 => {
  const c = lightChannels(colour, space)
  const top = Math.max(c[0], c[1], c[2]) || 1
  return [c[0] / top, c[1] / top, c[2] / top]
}

/** The terms of a room's base light, decoded once: the ambient, key, fill and sun, and how a sum is capped and stepped. */
export interface LightModel {
  readonly space: SceneLighting['colorSpace']
  /** The ambient: level, and its tint (`srgb`: the brightest channel 1; `linear`: the colour itself, as it always was). */
  readonly ambient: { readonly level: number; readonly tint: Vec3 }
  readonly key?: { readonly dir: Vec3; readonly level: number } | undefined
  readonly fill?: { readonly level: number; readonly tint: Vec3; readonly fade: Vec3 } | undefined
  /** The sun's unit direction toward it, its colour × level, and whether the occluders shadow it. */
  readonly sun?: { readonly dir: Vec3; readonly rgb: Vec3; readonly shadow: boolean } | undefined
  readonly max: number
  readonly step: number
  readonly shade: number
}

export function lightModel(lighting: SceneLighting): LightModel {
  const space = lighting.colorSpace
  const sun = lighting.sun
  const length = sun === undefined ? 1 : Math.hypot(...sun.dir)
  const tint = (colour: number): Vec3 => (space === 'srgb' ? tintOf(colour, space) : channels(colour))
  return {
    space,
    ambient: { level: lighting.ambient, tint: tint(lighting.ambientColor) },
    key: lighting.key === undefined ? undefined : { dir: [...lighting.key.dir], level: lighting.key.level },
    fill:
      lighting.fill === undefined
        ? undefined
        : { level: lighting.fill.level, tint: tint(lighting.fill.color), fade: [...lighting.fill.fade] },
    sun:
      sun === undefined
        ? undefined
        : {
            dir: [sun.dir[0] / length, sun.dir[1] / length, sun.dir[2] / length],
            rgb: lightChannels(sun.color, space).map((c) => c * sun.level) as unknown as Vec3,
            shadow: sun.shadow,
          },
    max: lighting.max,
    step: lighting.step,
    shade: lighting.shade,
  }
}

/** How far apart the sun's shadow samples stand either side of a vertex (metres): about the vertex's own spacing. */
const SUN_SPREAD = 0.175
/** A sun ray's length: past any room. */
const SUN_RAY = 80
/** The first 3 cm of a ray is the surface's own; the rest counts. */
const SUN_NEAR = 0.03 / SUN_RAY

/**
 * The share of the sun that reaches a vertex (0 to 1): a 3 × 3 grid of rays toward it, spread across the vertex's own
 * surface `SUN_SPREAD` either side of it, that nothing blocks. A vertex stands for the ground round it, so a thin caster
 * between vertices (a pole) leaves a soft line across them, not a dot where one happens to fall. The grid lies in the
 * surface, not across the sun's rays: spread across the rays, the samples on one side start below a floor or a wall
 * that is itself a plane occluder, which then shadows what it lights (a third of an open road's sun).
 */
function sunShare(
  sample: LightSample,
  dir: Vec3,
  occluders: Pick<SceneLighting, 'boxes' | 'planes'>,
): number {
  const normal: Vec3 = [sample.nx, sample.ny, sample.nz]
  const up: Vec3 = Math.abs(normal[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const u0 = cross(up, normal)
  const size = Math.hypot(...u0)
  const u: Vec3 = [u0[0] / size, u0[1] / size, u0[2] / size]
  const v = cross(normal, u)
  const ox = sample.x + sample.nx * 0.03
  const oy = sample.y + sample.ny * 0.03
  const oz = sample.z + sample.nz * 0.03
  let lit = 0
  for (const i of [-1, 0, 1])
    for (const j of [-1, 0, 1]) {
      const [du, dv] = [i * SUN_SPREAD, j * SUN_SPREAD]
      const [x, y, z] = [ox + u[0] * du + v[0] * dv, oy + u[1] * du + v[1] * dv, oz + u[2] * du + v[2] * dv]
      const blocked = segmentBlocked(
        x,
        y,
        z,
        x + dir[0] * SUN_RAY,
        y + dir[1] * SUN_RAY,
        z + dir[2] * SUN_RAY,
        occluders,
        [],
        [SUN_NEAR, 1],
      )
      if (!blocked) lit++
    }
  return lit / 9
}

/**
 * The light that does not move, at a surface point: the ambient with its small key on the normal and the fill on
 * upright surfaces (fading with height over the floor), both × the contact darkening; plus the sun × N·L × the share of
 * it that reaches the point.
 */
export function baseLight(
  sample: LightSample,
  model: LightModel,
  occluders: Pick<SceneLighting, 'boxes' | 'planes'>,
): Vec3 {
  const { ambient, key, fill, sun } = model
  const normal: Vec3 = [sample.nx, sample.ny, sample.nz]
  const keyed = ambient.level + (key === undefined ? 0 : Math.max(0, dot(normal, key.dir)) * key.level)
  let fillK = 0
  if (fill !== undefined) {
    const [f0, f1, f2] = fill.fade
    const height = sample.y - floorUnder(occluders, sample.x, sample.y, sample.z)
    fillK = (1 - Math.abs(sample.ny)) * fill.level * Math.max(f2, Math.min(1, f0 - height / f1))
  }
  const open = contactShade(sample, occluders)
  const out = [0, 1, 2].map(
    (c) => open * (keyed * (ambient.tint[c] as number) + fillK * ((fill?.tint[c] as number) ?? 0)),
  ) as [number, number, number]
  if (sun !== undefined) {
    const nl = dot(normal, sun.dir)
    const share = nl > 0 ? (sun.shadow ? sunShare(sample, sun.dir, occluders) : 1) : 0
    if (share > 0)
      for (let c = 0; c < 3; c++) out[c] = (out[c] as number) + (sun.rgb[c] as number) * nl * share
  }
  return out
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** A `SceneLighting` with its colours decoded once: what a per-frame tint reads, so a frame allocates nothing. */
export interface PreparedLighting {
  readonly lighting: SceneLighting
  /** The ambient light in linear channels, already scaled by `ambient`. */
  readonly ambient: Vec3
  /** Each lamp's colour in linear channels, in `lighting.lamps` order. */
  readonly colours: readonly Vec3[]
}

export function prepareLighting(lighting: SceneLighting): PreparedLighting {
  const [r, g, b] = channels(lighting.ambientColor)
  return {
    lighting,
    ambient: [r * lighting.ambient, g * lighting.ambient, b * lighting.ambient],
    colours: lighting.lamps.map((lamp) => channels(lamp.color)),
  }
}

// One sample reused by every normal-lit tint: nothing is allocated per frame.
const scratch = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 }

/**
 * A character's light (M3R-D4) written into `out`: the ambient light plus each lamp in range at its level, each
 * channel at most `LIGHT_CEILING`. With a `normal`, a lamp adds N·L of its light; without one, its light from every
 * direction (the source's `lightAt`, for a whole character at once). Walls and boxes between block it. Allocates
 * nothing, so it can run for every character every frame.
 */
export function tintInto(
  out: [number, number, number],
  x: number,
  y: number,
  z: number,
  normal: readonly [number, number, number] | undefined,
  prepared: PreparedLighting,
  levels: LampLevels,
): [number, number, number] {
  const { lighting, ambient, colours } = prepared
  out[0] = ambient[0]
  out[1] = ambient[1]
  out[2] = ambient[2]
  // A plain loop, not forEach: no closure is made per call.
  for (let index = 0; index < lighting.lamps.length; index++) {
    const lamp = lighting.lamps[index]
    if (lamp === undefined) continue
    const level = levelOf(lamp, levels)
    if (level === 0) continue
    let light: number
    if (normal === undefined) {
      light = falloff(lamp, Math.hypot(lamp.x - x, lamp.y - y, lamp.z - z))
      if (light > 0 && segmentBlocked(x, y, z, lamp.x, lamp.y, lamp.z, lighting)) light = 0
    } else {
      scratch.x = x
      scratch.y = y
      scratch.z = z
      scratch.nx = normal[0]
      scratch.ny = normal[1]
      scratch.nz = normal[2]
      light = vertexLight(scratch, lamp, lighting)
    }
    const colour = colours[index]
    if (light === 0 || colour === undefined) continue
    out[0] += light * level * colour[0]
    out[1] += light * level * colour[1]
    out[2] += light * level * colour[2]
  }
  out[0] = Math.min(LIGHT_CEILING, out[0])
  out[1] = Math.min(LIGHT_CEILING, out[1])
  out[2] = Math.min(LIGHT_CEILING, out[2])
  return out
}

/**
 * A moving character's light (M3R-D4): the ambient light plus each lamp in range at its level, as `[r, g, b]`
 * multipliers for the character's base colour, each at most `LIGHT_CEILING` (see `tintInto`). This one decodes the
 * colours and allocates its result: for one-off use. Per frame, use `SceneLight.tint` with an output array.
 */
export function characterTint(
  position: readonly [number, number, number],
  normal: readonly [number, number, number] | undefined,
  lighting: SceneLighting,
  levels: LampLevels = {},
): [number, number, number] {
  return tintInto([0, 0, 0], position[0], position[1], position[2], normal, prepareLighting(lighting), levels)
}
