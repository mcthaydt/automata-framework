// A room's light on `@pixi/3d`: static meshes baked once at load and rebaked only when a lamp that reaches them changes;
// characters tinted per frame from the same lamps (M3R-D4).
import { type Container3D, Geometry3D, type Mesh3D } from '@pixi/3d'
import type { FigureShadows } from './figure-shadow.ts'
import type { SceneLighting } from './scene-lighting.schema.ts'
import { type BakeExtras, bakeVertices, type VertexBake } from './vertex-bake.ts'
import { type LampLevels, levelOf, prepareLighting, tintInto } from './vertex-light.ts'

/** What the scene's bakes ask of `bakeVertices` beyond the caller's own extras. */
const engine = (options: BakeOptions): BakeExtras => ({ ...options, engineColours: true })

export interface BakeOptions extends BakeExtras {
  /** Occluder boxes (by `id`) that never shadow this mesh: its own broad collider, say. */
  readonly ignore?: readonly string[] | undefined
}

/** The light of one room: what the renderer gives `scene` and the entity views when `Pixi3dOptions.lighting` is set. */
export interface SceneLight {
  readonly lighting: SceneLighting
  /**
   * A figure's cast shadow on the floor: present when the look's `shadow` switch is on, absent otherwise. A view that draws
   * a figure with a silhouette (a painted figure) asks it for one shadow, under the figure's node, and casts it each frame.
   */
  readonly shadows?: FigureShadows | undefined
  /**
   * Bakes vertex light into a static mesh, at its place now: its own position, rotation and scale and its parents'
   * (up to the view's root, which does not move). It must not move afterwards. Its geometry is replaced by a dynamic copy with a colour per vertex (the
   * original is left alone: it may be shared) and its material's `vertexColors` is turned on. Use a `FlatMaterial`,
   * so that only this light reaches it.
   */
  bake(mesh: Mesh3D, options?: BakeOptions): void
  /**
   * Takes a baked mesh's light again where it stands now: for a mesh a state has moved (a prop). Its colours are written
   * into the same buffers, so nothing is reallocated. A mesh that was not baked is left alone.
   */
  rebake(mesh: Mesh3D): void
  /** Stops rebaking a baked mesh and destroys its baked geometry and buffers: call it once the mesh is destroyed. */
  release(mesh: Mesh3D): void
  /**
   * The levels the sim sets, by lamp id; a lamp left out goes back to its content `level`. Rebakes only the meshes a
   * changed lamp reaches, and uploads a mesh's colours only when one changed.
   */
  setLevels(levels: LampLevels): void
  /** A lamp's level now. */
  level(id: string): number
  /**
   * A character's light at a point now (`characterTint`): multiply its base colour by it, each frame. Pass `out` to
   * have it written there, so a frame allocates nothing.
   */
  tint(
    x: number,
    y: number,
    z: number,
    normal?: readonly [number, number, number],
    out?: [number, number, number],
  ): [number, number, number]
  /**
   * The luma (0 to 1) of the floor's shown colour at (x, z): what the screen shows of a baked floor there, its albedo times
   * the light (the sun, key and fill, the lamps at their levels now, shadows, whole steps), computed for that one point, so it
   * needs no frame and no readback. A floor is a baked, flat, up-facing mesh under the point; with `y` the one at or just
   * under that height, without it the highest. A floor whose colour is a texture shows light alone unless its bake named
   * an `albedo` (a mean colour). `undefined` where no baked floor lies under the point.
   */
  groundLuma(x: number, z: number, y?: number): number | undefined
  /** How many mesh rebakes lamp changes have caused (the bake at load is not counted). */
  readonly rebakes: number
}

interface Baked {
  readonly mesh: Mesh3D
  bake: VertexBake
  readonly geometry: Geometry3D
  /** What the bake reads, kept so the mesh can be baked again where it has moved to. */
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly options: BakeOptions
  /** Where this mesh is a flat, up-facing floor in the world (its rectangle and height), for `groundLuma`; absent otherwise. */
  floor: Floor | undefined
}

/** A baked mesh that is a floor: the rectangle it covers in the world, at one height. */
interface Floor {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly y: number
}

/** How far a floor's vertices may stray from one height (metres) and how upright its normals must be, to count as flat and up-facing. */
const FLAT_TOLERANCE = 0.02
const UP_FACING = 0.7
/** A floor counts under a point asked at height `y` when it is no higher than this far over it (a step's riser, a foot's sink). */
const FLOOR_REACH = 0.12
/** The most points `groundLuma` remembers at once; a figure that walks fills it with new points and it starts over. */
const GROUND_CACHE = 256
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const

type Attribute = {
  readonly buffer: { readonly data: ArrayLike<number> }
  readonly format?: string
  readonly stride?: number
  readonly offset?: number
}

/** Bytes a tightly packed vertex takes in each readable format. */
const TIGHT: Readonly<Record<string, number>> = { float32x2: 8, float32x3: 12, snorm16x4: 8 }

/** A tightly packed attribute (its own buffer, offset 0): the only layout the bake reads. */
function tight(attribute: Attribute, what: string): void {
  const stride = TIGHT[attribute.format ?? 'float32x3']
  const packed =
    (attribute.offset ?? 0) === 0 && (attribute.stride === undefined || attribute.stride === stride)
  if (!packed)
    throw new Error(`bake: ${what} are interleaved (stride ${attribute.stride}, offset ${attribute.offset})`)
}

/**
 * An attribute's values as 3 floats a vertex: plain `float32x3`, or the `snorm16x4` that `@pixi/3d` packs normals
 * in, tightly packed. An interleaved geometry is refused rather than misread.
 */
function threeFloats(attribute: Attribute | undefined, what: string): Float32Array {
  if (attribute === undefined) throw new Error(`bake: the mesh has no ${what}`)
  tight(attribute, what)
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

/** The world rectangle and height of `positions` (3 floats a vertex) placed by `matrix`, when it is one flat floor facing up. */
function floorOf(
  positions: Float32Array,
  normals: Float32Array,
  matrix: ArrayLike<number>,
): Floor | undefined {
  const m = (i: number): number => matrix[i] ?? 0
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  let lowest = Number.POSITIVE_INFINITY
  let highest = Number.NEGATIVE_INFINITY
  for (let p = 0; p < positions.length; p += 3) {
    const [x, y, z] = [positions[p] ?? 0, positions[p + 1] ?? 0, positions[p + 2] ?? 0]
    const [nx, ny, nz] = [normals[p] ?? 0, normals[p + 1] ?? 0, normals[p + 2] ?? 0]
    // The normal turned by the matrix's rotation, its y over its length.
    const turned = [
      m(0) * nx + m(4) * ny + m(8) * nz,
      m(1) * nx + m(5) * ny + m(9) * nz,
      m(2) * nx + m(6) * ny + m(10) * nz,
    ]
    if ((turned[1] ?? 0) / (Math.hypot(...turned) || 1) < UP_FACING) return undefined
    const [wx, wy, wz] = [
      m(0) * x + m(4) * y + m(8) * z + m(12),
      m(1) * x + m(5) * y + m(9) * z + m(13),
      m(2) * x + m(6) * y + m(10) * z + m(14),
    ]
    minX = Math.min(minX, wx)
    maxX = Math.max(maxX, wx)
    minZ = Math.min(minZ, wz)
    maxZ = Math.max(maxZ, wz)
    lowest = Math.min(lowest, wy)
    highest = Math.max(highest, wy)
  }
  if (positions.length === 0 || highest - lowest > FLAT_TOLERANCE) return undefined
  return { minX, maxX, minZ, maxZ, y: highest }
}

/** The luma a shown colour carries (Rec. 709 weights on the channels as the screen has them). */
const lumaOf = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Creates a room's light from its content. */
export function createSceneLight(lighting: SceneLighting, shadows?: FigureShadows): SceneLight {
  let baked: Baked[] = []
  let levels: LampLevels = {}
  let rebakes = 0
  // A point's ground luma until the lamps or the floors change: a figure that stands still asks the same points every frame.
  const grounds = new Map<string, number | undefined>()
  const lamps = new Map(lighting.lamps.map((lamp) => [lamp.id, lamp]))
  const prepared = prepareLighting(lighting)
  const effective = (id: string, from: LampLevels): number => {
    const lamp = lamps.get(id)
    return lamp === undefined ? 0 : levelOf(lamp, from)
  }

  return {
    lighting,
    shadows,
    bake(mesh, options = {}) {
      const source = mesh.geometry
      const attributes = source.attributes as Record<string, Attribute | undefined>
      const positions = threeFloats(attributes.aPosition, 'positions')
      const normals = threeFloats(attributes.aNormal, 'normals')
      const bake = bakeVertices(
        positions,
        normals,
        placement(mesh),
        lighting,
        options.ignore,
        engine(options),
      )
      const colors = new Float32Array(bake.vertexCount * 4)
      bake.write(levels, colors)
      // The baked copy keeps positions, normals, UVs and indices. Anything else on the source (tangents, joints and
      // weights, its own COLOR_0) is dropped: a static mesh's light is its vertex colours, and it is not skinned.
      if (attributes.aUV !== undefined) tight(attributes.aUV, 'uvs')
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
      baked.push({
        mesh,
        bake,
        geometry,
        positions,
        normals,
        options,
        floor: floorOf(positions, normals, placement(mesh)),
      })
      grounds.clear()
    },
    rebake(mesh) {
      const entry = baked.find((candidate) => candidate.mesh === mesh)
      if (entry === undefined) return
      const { positions, normals, options } = entry
      const matrix = placement(mesh)
      entry.bake = bakeVertices(positions, normals, matrix, lighting, options.ignore, engine(options))
      entry.floor = floorOf(positions, normals, matrix)
      grounds.clear()
      const buffer = entry.geometry.attributes.aColor?.buffer
      if (buffer === undefined) return
      rebakes += 1
      if (entry.bake.write(levels, buffer.data as Float32Array)) buffer.update()
    },
    release(mesh) {
      // `true`: the baked copy owns its buffers (no one shares them), so they are freed now, not at Pixi's GC.
      for (const entry of baked) if (entry.mesh === mesh) entry.geometry.destroy(true)
      baked = baked.filter((entry) => entry.mesh !== mesh)
      grounds.clear()
    },
    setLevels(next) {
      const changed = lighting.lamps
        .map((lamp) => lamp.id)
        .filter((id) => effective(id, next) !== effective(id, levels))
      levels = { ...next }
      if (changed.length === 0) return
      grounds.clear()
      for (const { bake, geometry } of baked) {
        if (!changed.some((id) => bake.reachedBy.has(id))) continue
        const buffer = geometry.attributes.aColor?.buffer
        if (buffer === undefined) continue
        rebakes += 1
        if (bake.write(levels, buffer.data as Float32Array)) buffer.update()
      }
    },
    groundLuma(x, z, y) {
      const key = `${x},${z},${y}`
      if (grounds.has(key)) return grounds.get(key)
      let floor: Baked | undefined
      for (const entry of baked) {
        const f = entry.floor
        if (f === undefined || x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue
        if (y !== undefined && f.y > y + FLOOR_REACH) continue
        if (floor === undefined || (floor.floor?.y ?? 0) < f.y) floor = entry
      }
      let luma: number | undefined
      if (floor?.floor !== undefined) {
        // One vertex on the floor, facing up, lit as the floor's own are: the bake itself gives the shown colour. A textured floor
        // shows light alone in its vertices (the texture multiplies it), so its mean colour, when named, is applied here instead.
        const { options } = floor
        const at = new Float32Array([x, floor.floor.y, z])
        const shown = bakeVertices(at, new Float32Array([0, 1, 0]), IDENTITY, lighting, options.ignore, {
          ...options,
          textured: false,
        })
        const out = new Float32Array(4)
        shown.write(levels, out)
        luma = lumaOf(out[0] ?? 0, out[1] ?? 0, out[2] ?? 0)
      }
      if (grounds.size >= GROUND_CACHE) grounds.clear()
      grounds.set(key, luma)
      return luma
    },
    level: (id) => effective(id, levels),
    tint: (x, y, z, normal, out = [0, 0, 0]) => tintInto(out, x, y, z, normal, prepared, levels),
    get rebakes() {
      return rebakes
    },
  }
}
