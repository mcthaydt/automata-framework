// The bake of a room with a light model (`light-model.ts`): the base light and the sun are kept per vertex, each lamp's reach
// kept apart so a lamp's level re-sums only what it reaches, and the sum is shaded, held under the ceiling and cut into
// steps as it is written. The colours are as drawn, so a texel multiplies by them directly.
import { baseLight, finishLight, type LightModel, sunLight } from './light-model.ts'
import { contactShade, type LightSample, segmentBlocked } from './occlusion.ts'
import type { SceneLighting } from './scene-lighting.schema.ts'
import type { VertexBake } from './vertex-bake.ts'
import { type LampLevels, levelOf, vertexLight } from './vertex-light.ts'

/** How far the sun is taken to be: past anything a room is built of. */
const SUN_DISTANCE = 400
/** The sun's ray starts this far off the surface along its normal: clear of a window's frame or a curb that stands proud of it. */
const SUN_LIFT = 0.1
/**
 * The sun's ray counts all the way out, so a near occluder is never skipped; only the first few millimetres are not, so a
 * point on a floor's own plane (a curb's wall foot) is not shadowed by the plane it stands on, whatever its rounding.
 */
const SUN_ENDS = { near: 1e-5, far: 1 } as const

const drawn = (colour: number): [number, number, number] => [
  ((colour >> 16) & 255) / 255,
  ((colour >> 8) & 255) / 255,
  (colour & 255) / 255,
]

/** `matrix` (column-major 4 × 4) applied to the point or direction `(x, y, z)`. */
function transform(
  m: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
  w: number,
): [number, number, number] {
  const at = (i: number): number => m[i] ?? 0
  return [
    at(0) * x + at(4) * y + at(8) * z + at(12) * w,
    at(1) * x + at(5) * y + at(9) * z + at(13) * w,
    at(2) * x + at(6) * y + at(10) * z + at(14) * w,
  ]
}

export function bakeModelled(
  positions: Float32Array,
  normals: Float32Array,
  matrix: ArrayLike<number>,
  lighting: SceneLighting,
  model: LightModel,
  ignore: readonly string[],
): VertexBake {
  const vertexCount = positions.length / 3
  const base = new Float32Array(vertexCount * 3)
  const lamps = lighting.lamps.map((lamp) => ({
    id: lamp.id,
    colour: drawn(lamp.color),
    light: new Float32Array(vertexCount),
  }))
  for (let i = 0; i < vertexCount; i++) {
    const p = i * 3
    const [x, y, z] = transform(matrix, positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0, 1)
    const [nx, ny, nz] = transform(matrix, normals[p] ?? 0, normals[p + 1] ?? 0, normals[p + 2] ?? 0, 0)
    const length = Math.hypot(nx, ny, nz) || 1
    const sample: LightSample = { x, y, z, nx: nx / length, ny: ny / length, nz: nz / length }
    const normal: [number, number, number] = [sample.nx, sample.ny, sample.nz]
    const lit = baseLight(model, y, normal, contactShade(sample, lighting))
    const sun = model.sun
    const reaches =
      sun !== undefined &&
      sun.dir[0] * normal[0] + sun.dir[1] * normal[1] + sun.dir[2] * normal[2] > 0 &&
      (!sun.shadows ||
        !segmentBlocked(
          x + normal[0] * SUN_LIFT,
          y + normal[1] * SUN_LIFT,
          z + normal[2] * SUN_LIFT,
          x + (sun.dir[0] ?? 0) * SUN_DISTANCE,
          y + (sun.dir[1] ?? 0) * SUN_DISTANCE,
          z + (sun.dir[2] ?? 0) * SUN_DISTANCE,
          lighting,
          ignore,
          SUN_ENDS,
        ))
    const sunny = reaches ? sunLight(model, normal) : [0, 0, 0]
    for (let c = 0; c < 3; c++) base[p + c] = (lit[c] ?? 0) + (sunny[c] ?? 0)
    lighting.lamps.forEach((lamp, j) => {
      const slot = lamps[j]
      if (slot !== undefined) slot.light[i] = vertexLight(sample, lamp, lighting, ignore)
    })
  }
  const active = lamps.filter((slot) => slot.light.some((v) => v > 0))
  const byId = new Map(lighting.lamps.map((lamp) => [lamp.id, lamp]))
  return {
    vertexCount,
    reachedBy: new Set(active.map((slot) => slot.id)),
    write(levels: LampLevels, out: Float32Array): boolean {
      const gain = active.map((slot) => {
        const lamp = byId.get(slot.id)
        return lamp === undefined ? 0 : levelOf(lamp, levels) * lamp.strength * model.strength
      })
      let changed = false
      const sum: [number, number, number] = [0, 0, 0]
      for (let i = 0; i < vertexCount; i++) {
        for (let c = 0; c < 3; c++) {
          let light = base[i * 3 + c] ?? 0
          active.forEach((slot, j) => {
            light += (slot.light[i] ?? 0) * (gain[j] ?? 0) * (slot.colour[c] ?? 0)
          })
          sum[c] = light
        }
        const done = finishLight(model, sum, 1)
        const o = i * 4
        for (let c = 0; c < 3; c++) {
          // Through a Float32Array, so the comparison is against the value the buffer will hold.
          const value = Math.fround(done[c] ?? 0)
          if (out[o + c] !== value) {
            out[o + c] = value
            changed = true
          }
        }
        if (out[o + 3] !== 1) {
          out[o + 3] = 1
          changed = true
        }
      }
      return changed
    },
  }
}
