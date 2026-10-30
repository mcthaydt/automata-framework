// Copied from The Last Light (mcthaydt/PixiJS3D_Experiment_001) src/render/glb.ts at 92e6704: `parseGlb` only (the
// static path M3 keeps; `parsePack` is left out, M3-D8), unchanged apart from formatting.
/**
 * Reads the single textured mesh of a prop GLB (src/render/models, see docs/art/props-3d): float
 * positions, normals and UVs, the triangle indices and the base-colour image's bytes. The renderer
 * bakes these into its own vertex-coloured geometry, so the props are lit like the rest of the room.
 */
export interface GlbMesh {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint16Array | Uint32Array
  image: Uint8Array
  mime: string
  min: [number, number, number]
  max: [number, number, number]
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
interface View {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}
const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
export function parseGlb(buffer: ArrayBuffer): GlbMesh {
  const header = new DataView(buffer)
  if (header.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB file')
  const jsonLength = header.getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)))
  const binStart = 20 + jsonLength + 8
  const views: View[] = doc.bufferViews,
    accessors: Accessor[] = doc.accessors
  const read = (index: number) => {
    const a = accessors[index],
      view = views[a.bufferView],
      n = SIZE[a.type],
      start = binStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
    if (a.componentType === 5125) return new Uint32Array(buffer.slice(start, start + a.count * 4))
    if (a.componentType === 5123) return new Uint16Array(buffer.slice(start, start + a.count * 2))
    if (a.componentType !== 5126) throw new Error(`unsupported component type ${a.componentType}`)
    const stride = view.byteStride ?? n * 4,
      out = new Float32Array(a.count * n),
      data = new DataView(buffer)
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < n; c++) out[i * n + c] = data.getFloat32(start + i * stride + c * 4, true)
    return out
  }
  const primitive = doc.meshes[0].primitives[0],
    position = accessors[primitive.attributes.POSITION]
  const texture =
    doc.textures[doc.materials[primitive.material ?? 0].pbrMetallicRoughness.baseColorTexture.index]
  const image = doc.images[texture.source],
    imageView = views[image.bufferView]
  return {
    positions: read(primitive.attributes.POSITION) as Float32Array,
    normals: read(primitive.attributes.NORMAL) as Float32Array,
    uvs: read(primitive.attributes.TEXCOORD_0) as Float32Array,
    indices: read(primitive.indices) as Uint16Array | Uint32Array,
    image: new Uint8Array(buffer, binStart + (imageView.byteOffset ?? 0), imageView.byteLength),
    mime: image.mimeType ?? 'image/png',
    min: position.min as [number, number, number],
    max: position.max as [number, number, number],
  }
}
