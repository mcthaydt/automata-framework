// Static model files: a prop's GLB, or its packed `.bin`. Only the static path is kept: one textured primitive, float
// positions, normals and UVs.
import { ModelInvalid } from '@automata/framework'

/** One textured mesh, as both file types read: what `modelGeometry` and the mesh view build from. */
export interface ModelMesh {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array | Uint32Array
  /** The base-colour image's bytes. */
  readonly image: Uint8Array
  readonly mime: string
  readonly min: [number, number, number]
  readonly max: [number, number, number]
}

interface Accessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  min?: number[]
  max?: number[]
}
interface BufferView {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}
interface Primitive {
  attributes: Record<string, number>
  indices?: number
  material?: number
}
interface GltfDocument {
  bufferViews?: BufferView[]
  accessors?: Accessor[]
  meshes?: { primitives?: Primitive[] }[]
  materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
  textures?: { source: number }[]
  images?: { bufferView?: number; mimeType?: string }[]
  skins?: unknown[]
}

const GLB_MAGIC = 0x46546c67 // 'glTF'
const PACK_MAGIC = 0x3150_4c4c // 'LLP1'
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const FLOAT = 5126
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125

/** Thrown inside the readers and turned into `ModelInvalid { reason: 'malformed: …' }` at the edge. */
class Malformed extends Error {}

function malformedOr(file: string, error: unknown): ModelInvalid {
  if (error instanceof ModelInvalid) return error
  if (error instanceof Malformed) return new ModelInvalid({ file, reason: `malformed: ${error.message}` })
  // A RangeError from a DataView or a typed array: the file ends before the data it promises.
  if (error instanceof RangeError) return new ModelInvalid({ file, reason: 'malformed: truncated' })
  // A TypeError: a JSON document of an unexpected shape that the checks above did not name. Still the file's fault.
  if (error instanceof TypeError) return new ModelInvalid({ file, reason: 'malformed: unreadable document' })
  throw error
}

/**
 * The checks both file types must pass, so a view never draws garbage: one normal and one UV per position, whole
 * triangles, and no index past the last vertex.
 */
function checkMesh(mesh: ModelMesh): ModelMesh {
  const vertices = mesh.positions.length / 3
  if (mesh.normals.length / 3 !== vertices)
    throw new Malformed(`NORMAL has ${mesh.normals.length / 3} vertices, POSITION has ${vertices}`)
  if (mesh.uvs.length / 2 !== vertices)
    throw new Malformed(`TEXCOORD_0 has ${mesh.uvs.length / 2} vertices, POSITION has ${vertices}`)
  if (mesh.indices.length % 3 !== 0)
    throw new Malformed(`${mesh.indices.length} indices are not whole triangles`)
  for (const index of mesh.indices)
    if (index >= vertices) throw new Malformed(`index ${index} is past the ${vertices} vertices`)
  return mesh
}

function readDocument(buffer: ArrayBuffer): { doc: GltfDocument; binStart: number } {
  if (buffer.byteLength < 12) throw new Malformed(buffer.byteLength >= 4 ? 'truncated' : 'not a GLB file')
  const header = new DataView(buffer)
  if (header.getUint32(0, true) !== GLB_MAGIC) throw new Malformed('not a GLB file')
  const jsonLength = header.getUint32(12, true)
  if (20 + jsonLength + 8 > buffer.byteLength) throw new Malformed('truncated')
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)))
  } catch {
    throw new Malformed('unreadable JSON chunk')
  }
  // `null`, a number or an array is valid JSON but no document: it has no mesh.
  const doc =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as GltfDocument) : {}
  return { doc, binStart: 20 + jsonLength + 8 }
}

/**
 * Reads a GLB's single textured mesh: float positions, normals and UVs, the triangle indices and the base-colour
 * image's bytes. Throws `ModelInvalid` naming `file` when the file has a skin or cannot be read.
 */
export function parseGlb(buffer: ArrayBuffer, file: string): ModelMesh {
  try {
    const { doc, binStart } = readDocument(buffer)
    const primitive = doc.meshes?.[0]?.primitives?.[0]
    if (primitive === undefined) throw new Malformed('no mesh')
    if (typeof primitive.attributes !== 'object' || primitive.attributes === null)
      throw new Malformed('the primitive has no attributes')
    if (
      (doc.skins?.length ?? 0) > 0 ||
      'JOINTS_0' in primitive.attributes ||
      'WEIGHTS_0' in primitive.attributes
    )
      throw new ModelInvalid({ file, reason: 'skinned' })
    const views = doc.bufferViews ?? []
    const accessors = doc.accessors ?? []

    const read = (index: number | undefined): Float32Array | Uint16Array | Uint32Array => {
      const accessor = index === undefined ? undefined : accessors[index]
      const view = accessor === undefined ? undefined : views[accessor.bufferView]
      const size = accessor === undefined ? undefined : COMPONENTS[accessor.type]
      if (accessor === undefined || view === undefined || size === undefined)
        throw new Malformed(`accessor ${index ?? 'for indices'} is missing`)
      const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
      const bytesPer = accessor.componentType === UNSIGNED_SHORT ? 2 : 4
      const stride = view.byteStride ?? size * bytesPer
      const span = (accessor.count - 1) * stride + size * bytesPer
      if (accessor.count > 0 && (accessor.byteOffset ?? 0) + span > view.byteLength)
        throw new Malformed(`accessor ${index} runs past its bufferView`)
      const end = start + span
      if (accessor.count > 0 && end > buffer.byteLength)
        throw new Malformed(`accessor ${index} runs past the binary chunk`)
      if (accessor.componentType === UNSIGNED_INT)
        return new Uint32Array(buffer.slice(start, start + accessor.count * 4))
      if (accessor.componentType === UNSIGNED_SHORT)
        return new Uint16Array(buffer.slice(start, start + accessor.count * 2))
      if (accessor.componentType !== FLOAT)
        throw new Malformed(`unsupported component type ${accessor.componentType}`)
      const out = new Float32Array(accessor.count * size)
      const data = new DataView(buffer)
      for (let i = 0; i < accessor.count; i++)
        for (let c = 0; c < size; c++) out[i * size + c] = data.getFloat32(start + i * stride + c * 4, true)
      return out
    }
    const floats = (index: number | undefined, name: string): Float32Array => {
      const values = read(index)
      if (!(values instanceof Float32Array)) throw new Malformed(`${name} is not float`)
      return values
    }

    const position = accessors[primitive.attributes.POSITION ?? -1]
    const material = doc.materials?.[primitive.material ?? 0]
    const textureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index
    const texture = textureIndex === undefined ? undefined : doc.textures?.[textureIndex]
    const image = texture === undefined ? undefined : doc.images?.[texture.source]
    const imageView = image?.bufferView === undefined ? undefined : (doc.bufferViews ?? [])[image.bufferView]
    if (imageView === undefined) throw new Malformed('no base-colour texture')
    const imageStart = binStart + (imageView.byteOffset ?? 0)
    if (imageStart + imageView.byteLength > buffer.byteLength) throw new Malformed('truncated')
    if (position?.min?.length !== 3 || position.max?.length !== 3) throw new Malformed('no position bounds')
    const indices = read(primitive.indices)
    if (indices instanceof Float32Array) throw new Malformed('indices are not integers')
    return checkMesh({
      positions: floats(primitive.attributes.POSITION, 'POSITION'),
      normals: floats(primitive.attributes.NORMAL, 'NORMAL'),
      uvs: floats(primitive.attributes.TEXCOORD_0, 'TEXCOORD_0'),
      indices,
      image: new Uint8Array(buffer, imageStart, imageView.byteLength),
      mime: image?.mimeType ?? 'image/png',
      min: position.min as [number, number, number],
      max: position.max as [number, number, number],
    })
  } catch (error) {
    throw malformedOr(file, error)
  }
}

/**
 * Reads a packed prop (served as `.bin`): the GLB decimated and
 * quantised for the bundle. uint16 positions across the original bounds, int8 normals, uint16 UVs across their
 * range, uint16 indices and a small PNG. Throws `ModelInvalid` naming `file` when it cannot be read.
 */
export function parsePack(buffer: ArrayBuffer, file: string): ModelMesh {
  try {
    if (buffer.byteLength < 56)
      throw new Malformed(buffer.byteLength >= 4 ? 'truncated' : 'not a packed model')
    const view = new DataView(buffer)
    if (view.getUint32(0, true) !== PACK_MAGIC) throw new Malformed('not a packed model')
    const vertices = view.getUint32(4, true)
    const count = view.getUint32(8, true)
    const imageLength = view.getUint32(12, true)
    const f = (i: number): number => view.getFloat32(16 + i * 4, true)
    const min: [number, number, number] = [f(0), f(1), f(2)]
    const max: [number, number, number] = [f(3), f(4), f(5)]
    const uvMin = [f(6), f(7)] as const
    const uvMax = [f(8), f(9)] as const
    let at = 56
    const imageAt = at + vertices * 14 + count * 2
    if (imageAt + ((4 - (imageAt % 4)) % 4) + imageLength > buffer.byteLength)
      throw new Malformed('truncated')
    const q = new Uint16Array(buffer.slice(at, at + vertices * 6))
    at += vertices * 6
    const n = new Int8Array(buffer.slice(at, at + vertices * 4))
    at += vertices * 4
    const t = new Uint16Array(buffer.slice(at, at + vertices * 4))
    at += vertices * 4
    const indices = new Uint16Array(buffer.slice(at, at + count * 2))
    at += count * 2
    at += (4 - (at % 4)) % 4
    const positions = new Float32Array(vertices * 3)
    const normals = new Float32Array(vertices * 3)
    const uvs = new Float32Array(vertices * 2)
    for (let i = 0; i < vertices; i++) {
      for (let c = 0; c < 3; c++) {
        const low = min[c] as number
        positions[i * 3 + c] = low + ((q[i * 3 + c] as number) / 65535) * ((max[c] as number) - low)
        normals[i * 3 + c] = (n[i * 4 + c] as number) / 127
      }
      for (let c = 0; c < 2; c++)
        uvs[i * 2 + c] = uvMin[c]! + ((t[i * 2 + c] as number) / 65535) * (uvMax[c]! - uvMin[c]!)
    }
    return checkMesh({
      positions,
      normals,
      uvs,
      indices,
      image: new Uint8Array(buffer, at, imageLength),
      mime: 'image/png',
      min,
      max,
    })
  } catch (error) {
    throw malformedOr(file, error)
  }
}
