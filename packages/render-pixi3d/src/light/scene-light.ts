// A room's light on `@pixi/3d` (M3 spec §4.3, §5): static meshes baked once at load and rebaked only when a lamp
// that reaches them changes; characters tinted per frame from the same lamps (M3R-D4). Extracted in part from The
// Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at 92e6704 `src/render/indirect-light.ts` (`bakeGeometry`: the
// dynamic copy with vertex colours; the material's `vertexColors`); the light itself is `vertex-bake.ts`.
import { type Container3D, Geometry3D, type Mesh3D } from '@pixi/3d'
import type { SceneLighting } from './scene-lighting.schema.js'
import { bakeVertices, type VertexBake } from './vertex-bake.js'
import { characterTint, type LampLevels, levelOf } from './vertex-light.js'

export interface BakeOptions {
  /** Occluder boxes (by `id`) that never shadow this mesh: its own broad collider, say. */
  readonly ignore?: readonly string[] | undefined
}

/** The light of one room: what the renderer gives `scene` and the entity views when `Pixi3dOptions.lighting` is set. */
export interface SceneLight {
  readonly lighting: SceneLighting
  /**
   * Bakes vertex light into a static mesh, at its place now: its own position, rotation and scale and its parents'
   * (up to the view's root, which does not move). It must not move afterwards. Its geometry is replaced by a dynamic copy with a colour per vertex (the
   * original is left alone: it may be shared) and its material's `vertexColors` is turned on. Use a `FlatMaterial`,
   * so that only this light reaches it.
   */
  bake(mesh: Mesh3D, options?: BakeOptions): void
  /** Stops rebaking a baked mesh and destroys its baked geometry: call it when the mesh goes away. */
  release(mesh: Mesh3D): void
  /**
   * The levels the sim sets, by lamp id; a lamp left out goes back to its content `level`. Rebakes only the meshes a
   * changed lamp reaches, and uploads a mesh's colours only when one changed.
   */
  setLevels(levels: LampLevels): void
  /** A lamp's level now. */
  level(id: string): number
  /** A character's light at a point now (`characterTint`): multiply its base colour by it, each frame. */
  tint(x: number, y: number, z: number, normal?: readonly [number, number, number]): [number, number, number]
  /** How many mesh rebakes lamp changes have caused (the bake at load is not counted). */
  readonly rebakes: number
}

interface Baked {
  readonly mesh: Mesh3D
  readonly bake: VertexBake
  readonly geometry: Geometry3D
}

type Attribute = { readonly buffer: { readonly data: ArrayLike<number> }; readonly format?: string }

/** An attribute's values as 3 floats a vertex: plain `float32x3`, or the `snorm16x4` that `@pixi/3d` packs normals in. */
function threeFloats(attribute: Attribute | undefined, what: string): Float32Array {
  if (attribute === undefined) throw new Error(`bake: the mesh has no ${what}`)
  const data = attribute.buffer.data
  if (attribute.format === 'float32x3' || attribute.format === undefined) return Float32Array.from(data)
  if (attribute.format === 'snorm16x4') {
    const out = new Float32Array((data.length / 4) * 3)
    for (let i = 0, o = 0; i < data.length; i += 4, o += 3)
      for (let c = 0; c < 3; c++) out[o + c] = Math.max(-1, (data[i + c] ?? 0) / 32767)
    return out
  }
  throw new Error(`bake: ${what} stored as ${attribute.format} cannot be read`)
}

/** `a × b` for column-major 4 × 4 matrices. */
function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float64Array {
  const out = new Float64Array(16)
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0)
      out[column * 4 + row] = sum
    }
  return out
}

/** The node's placement in its scene: its local transform composed with every ancestor's. */
function placement(node: Container3D): Float64Array {
  node.updateLocalTransform()
  let matrix: Float64Array = Float64Array.from(node.localTransform.elements)
  for (let parent = node.parent; parent !== null; parent = parent.parent) {
    parent.updateLocalTransform()
    matrix = multiply(parent.localTransform.elements, matrix)
  }
  return matrix
}

/** Creates a room's light from its content. */
export function createSceneLight(lighting: SceneLighting): SceneLight {
  let baked: Baked[] = []
  let levels: LampLevels = {}
  let rebakes = 0
  const lamps = new Map(lighting.lamps.map((lamp) => [lamp.id, lamp]))
  const effective = (id: string, from: LampLevels): number => {
    const lamp = lamps.get(id)
    return lamp === undefined ? 0 : levelOf(lamp, from)
  }

  return {
    lighting,
    bake(mesh, options = {}) {
      const source = mesh.geometry
      const attributes = source.attributes as Record<string, Attribute | undefined>
      const positions = threeFloats(attributes.aPosition, 'positions')
      const normals = threeFloats(attributes.aNormal, 'normals')
      const bake = bakeVertices(positions, normals, placement(mesh), lighting, options.ignore)
      const colors = new Float32Array(bake.vertexCount * 4)
      bake.write(levels, colors)
      const uvs = attributes.aUV?.buffer.data
      const indices = source.indexBuffer?.data
      const geometry = new Geometry3D({
        positions,
        normals,
        ...(uvs === undefined ? {} : { uvs: Float32Array.from(uvs) }),
        ...(indices === undefined ? {} : { indices: (indices as Uint16Array | Uint32Array).slice() }),
        colors,
        quantizeNormals: false,
        dynamic: true,
      })
      mesh.geometry = geometry
      mesh.material.vertexColors = true
      baked.push({ mesh, bake, geometry })
    },
    release(mesh) {
      for (const entry of baked) if (entry.mesh === mesh) entry.geometry.destroy()
      baked = baked.filter((entry) => entry.mesh !== mesh)
    },
    setLevels(next) {
      const changed = lighting.lamps
        .map((lamp) => lamp.id)
        .filter((id) => effective(id, next) !== effective(id, levels))
      levels = { ...next }
      if (changed.length === 0) return
      for (const { bake, geometry } of baked) {
        if (!changed.some((id) => bake.reachedBy.has(id))) continue
        const buffer = geometry.attributes.aColor?.buffer
        if (buffer === undefined) continue
        rebakes += 1
        if (bake.write(levels, buffer.data as Float32Array)) buffer.update()
      }
    },
    level: (id) => effective(id, levels),
    tint: (x, y, z, normal) => characterTint([x, y, z], normal, lighting, levels),
    get rebakes() {
      return rebakes
    },
  }
}
