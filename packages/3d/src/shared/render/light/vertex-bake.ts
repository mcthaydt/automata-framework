// Baked vertex light for a static mesh (M3 spec §4.3; 2026-10-16 spec §4.4). Extracted from The Last Light
// (`mcthaydt/PixiJS3D_Experiment_001`) at 92e6704, `src/render/indirect-light.ts` (`bakeGeometry`,
// `createVertexLighting`), with its tests. Kept: each lamp's light per vertex is computed once, with its occlusion,
// because static lamps never move, so a level change is a cheap re-sum; colours are written only when one changed.
// Dropped: the moving player lamp, its touch deadband and bounding-sphere cull, the authored bounce pools, wall fill
// and shade-table steps (The Last Light's look, not AF's contract). Pure: no Pixi, so it runs in Node.
import { contactShade, type LightSample } from './occlusion.ts'
import type { SceneLighting } from './scene-lighting.schema.ts'
import { channels, type LampLevels, LIGHT_CEILING, levelOf, vertexLight } from './vertex-light.ts'

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
): VertexBake {
  const vertexCount = positions.length / 3
  const ambient = channels(lighting.ambientColor).map((c) => c * lighting.ambient)
  const shade = new Float32Array(vertexCount)
  const slots: LampSlot[] = lighting.lamps.map((lamp) => ({
    id: lamp.id,
    colour: channels(lamp.color),
    light: new Float32Array(vertexCount),
  }))
  for (let i = 0; i < vertexCount; i++) {
    const p = i * 3
    const [x, y, z] = transform(matrix, positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0, 1)
    const [nx, ny, nz] = transform(matrix, normals[p] ?? 0, normals[p + 1] ?? 0, normals[p + 2] ?? 0, 0)
    const length = Math.hypot(nx, ny, nz) || 1
    const sample: LightSample = { x, y, z, nx: nx / length, ny: ny / length, nz: nz / length }
    shade[i] = contactShade(sample, lighting)
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
        for (let c = 0; c < 3; c++) {
          let light = ambient[c] ?? 0
          active.forEach((slot, j) => {
            light += (slot.light[i] ?? 0) * (level[j] ?? 0) * (slot.colour[c] ?? 0)
          })
          // Through a Float32Array, so the comparison is against the value the buffer will hold.
          const value = Math.fround(Math.min(LIGHT_CEILING, light * (shade[i] ?? 1)))
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
