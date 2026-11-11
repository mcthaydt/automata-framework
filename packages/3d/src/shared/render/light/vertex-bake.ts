// Baked vertex light for a static mesh (2026-10-16). Kept: each lamp's light per vertex is computed once, with its
// occlusion, because static lamps never move, so a level change is a cheap re-sum; colours are Pure: no Pixi, so it runs
// in Node.
import type { LightSample } from './occlusion.ts'
import type { SceneLighting } from './scene-lighting.schema.ts'
import {
  baseLight,
  type LampLevels,
  levelOf,
  lightChannels,
  lightModel,
  stepLight,
  toLinear,
  vertexLight,
} from './vertex-light.ts'

/** What the bake knows about one mesh beyond its vertices. */
export interface BakeExtras {
  /** Whole steps the mesh's room is darker than normal (negative: brighter): its light is multiplied by `shade` each. */
  readonly shadeSteps?: number | undefined
  /**
   * The mesh's own colour (0xRRGGBB, sRGB). With a `srgb` lighting the vertex colour is the linear multiplier that
   * leaves `albedo × light` on screen, per channel; without one the light itself is written.
   */
  readonly albedo?: number | undefined
  /**
   * The mesh takes its colour from a texture of DUEL colours (the albedo per texel): its vertex colour is the light
   * alone, as the linear multiplier that leaves texel × light on screen (a power of 2.2 for the sRGB curve), and past 1
   * where the light is, since the clamp falls on the product.
   */
  readonly textured?: boolean | undefined
  /**
   * The mesh glows (a bulb, a neon, a lit window): it is drawn at its own step of its swatch's ladder whatever the light,
   * on a white base, and dims with the lamps it belongs to. The light itself is not computed for it.
   */
  readonly glow?: BakeGlow | undefined
}

/** A glowing swatch: its ladder and the step it sits on, and the lamps that dim it (the dimmest of them counts). */
export interface BakeGlow {
  /** The ladder's eight steps as `0xRRGGBB`, dark to light. */
  readonly steps: readonly number[]
  readonly base: number
  /** Ids of the lamps it belongs to. One the room does not light (a street lamp by day) leaves it at full. */
  readonly lamps?: readonly string[] | undefined
}

/** How many whole steps a glow dims under its lamp's level: one under 0.9 of it, two under 0.6. */
export const glowDim = (level: number): number => (level < 0.6 ? 2 : level < 0.9 ? 1 : 0)

/** A static mesh's vertices with their light computed: `write` turns lamp levels into vertex colours. */
export interface VertexBake {
  readonly vertexCount: number
  /** The ids of the lamps that light at least one vertex: a change to any other lamp leaves this mesh alone. */
  readonly reachedBy: ReadonlySet<string>
  /**
   * Writes each vertex's RGBA into `out` (4 floats a vertex) for these levels; returns whether any value changed, so
   * the caller uploads only then.
   */
  write(levels: LampLevels, out: Float32Array): boolean
}

interface LampSlot {
  readonly id: string
  readonly colour: readonly [number, number, number]
  /** This lamp's light at level 1 per vertex, occlusion included. */
  readonly light: Float32Array
}

/** `matrix` (column-major 4 × 4) applied to the point or direction `(x, y, z)`. */
function transform(
  m: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
  w: number,
): [number, number, number] {
  const at = (i: number) => m[i] ?? 0
  return [
    at(0) * x + at(4) * y + at(8) * z + at(12) * w,
    at(1) * x + at(5) * y + at(9) * z + at(13) * w,
    at(2) * x + at(6) * y + at(10) * z + at(14) * w,
  ]
}

/**
 * A light value as the multiplier the shader needs. With the mesh's albedo (an sRGB channel, 0 to 1) the light is the
 * look's: the screen shows `albedo × light`, at most 1. The shader multiplies in linear light, so the multiplier is
 * that product's linear value over the albedo's. Without one, the light is the multiplier.
 */
function onScreen(light: number, albedo: number | undefined): number {
  if (albedo === undefined) return light
  if (albedo <= 0) return 0
  return toLinear(Math.min(1, albedo * light)) / toLinear(albedo)
}

/**
 * Bakes a static mesh's light. `positions` and `normals` hold 3 floats a vertex in the mesh's own space; `matrix`
 * (column-major) places it in the world (normals are turned by it and renormalised, so use a uniform scale). Boxes
 * named in `ignore` never shadow it.
 */
export function bakeVertices(
  positions: Float32Array,
  normals: Float32Array,
  matrix: ArrayLike<number>,
  lighting: SceneLighting,
  ignore: readonly string[] = [],
  extras: BakeExtras = {},
): VertexBake {
  const vertexCount = positions.length / 3
  if (extras.glow !== undefined) return bakeGlow(vertexCount, lighting, extras.glow)
  const model = lightModel(lighting)
  const base = new Float32Array(vertexCount * 3)
  const sector = lighting.shade ** (extras.shadeSteps ?? 0)
  const albedo =
    extras.albedo === undefined || lighting.colorSpace !== 'srgb'
      ? undefined
      : lightChannels(extras.albedo, 'srgb')
  const slots: LampSlot[] = lighting.lamps.map((lamp) => ({
    id: lamp.id,
    colour: lightChannels(lamp.color, lighting.colorSpace),
    light: new Float32Array(vertexCount),
  }))
  for (let i = 0; i < vertexCount; i++) {
    const p = i * 3
    const [x, y, z] = transform(matrix, positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0, 1)
    const [nx, ny, nz] = transform(matrix, normals[p] ?? 0, normals[p + 1] ?? 0, normals[p + 2] ?? 0, 0)
    const length = Math.hypot(nx, ny, nz) || 1
    const sample: LightSample = { x, y, z, nx: nx / length, ny: ny / length, nz: nz / length }
    base.set(baseLight(sample, model, lighting), i * 3)
    lighting.lamps.forEach((lamp, j) => {
      const slot = slots[j]
      if (slot !== undefined) slot.light[i] = vertexLight(sample, lamp, lighting, ignore)
    })
  }
  const active = slots.filter((slot) => slot.light.some((v) => v > 0))
  const lamps = new Map(lighting.lamps.map((lamp) => [lamp.id, lamp]))

  return {
    vertexCount,
    reachedBy: new Set(active.map((slot) => slot.id)),
    write(levels, out) {
      const level = active.map((slot) => {
        const lamp = lamps.get(slot.id)
        return lamp === undefined ? 0 : levelOf(lamp, levels)
      })
      let changed = false
      for (let i = 0; i < vertexCount; i++) {
        const o = i * 4
        const sum: [number, number, number] = [0, 0, 0]
        for (let c = 0; c < 3; c++) {
          let light = base[i * 3 + c] ?? 0
          active.forEach((slot, j) => {
            light += (slot.light[i] ?? 0) * (level[j] ?? 0) * (slot.colour[c] ?? 0)
          })
          sum[c] = Math.min(model.max, light * sector)
        }
        const stepped = stepLight(sum, model.step)
        for (let c = 0; c < 3; c++) {
          // Through a Float32Array, so the comparison is against the value the buffer will hold.
          const light = stepped[c] as number
          const value = Math.fround(
            extras.textured === true && lighting.colorSpace === 'srgb'
              ? light ** 2.2
              : onScreen(light, albedo?.[c]),
          )
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

/** A glowing mesh's bake: one colour for every vertex, the swatch's step less what its lamps' levels dim it by. */
function bakeGlow(vertexCount: number, lighting: SceneLighting, glow: BakeGlow): VertexBake {
  const lamps = lighting.lamps.filter((lamp) => glow.lamps?.includes(lamp.id))
  return {
    vertexCount,
    reachedBy: new Set(lamps.map((lamp) => lamp.id)),
    write(levels, out) {
      const level = lamps.length === 0 ? 1 : Math.min(...lamps.map((lamp) => levelOf(lamp, levels)))
      const rgb = glow.steps[Math.max(0, Math.min(glow.steps.length - 1, glow.base - glowDim(level)))] ?? 0
      // On a white base a linear colour is what the screen shows; unlit colours are written as they are.
      const channel = (shift: number): number => {
        const value = ((rgb >> shift) & 255) / 255
        return Math.fround(lighting.colorSpace === 'srgb' ? toLinear(value) : value)
      }
      const colour = [channel(16), channel(8), channel(0)] as const
      let changed = false
      for (let i = 0; i < vertexCount; i++) {
        const o = i * 4
        for (let c = 0; c < 3; c++)
          if (out[o + c] !== colour[c]) {
            out[o + c] = colour[c] as number
            changed = true
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
