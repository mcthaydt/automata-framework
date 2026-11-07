// Writes small model files for tests: a GLB (glTF 2.0 binary) and a packed `.bin` (The Last Light's `LLP1` layout,
// `scripts/pack-models.py`) from the same mesh, so the parsers can be checked against known values.

/** A 1 × 1 white PNG, so a browser test can decode the texture. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0xfc, 0xff, 0x9f, 0xa1, 0x1e, 0x00, 0x07, 0x82, 0x02, 0x7f,
  0x3d, 0xc8, 0x48, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

export interface FixtureMesh {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

/**
 * A box from `min` to `max` with one face per side (24 vertices). Every value sits on the pack's quantisation grid
 * (positions at the bounds, unit axis normals, UVs of 0 and 1), so its `.glb` and `.bin` read back identically.
 */
export function fixtureBox(
  min: readonly [number, number, number] = [-0.5, 0, -0.25],
  max: readonly [number, number, number] = [0.5, 1, 0.25],
): FixtureMesh {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const pick = (axis: number, high: boolean): number => (high ? max : min)[axis] as number
  for (let axis = 0; axis < 3; axis++) {
    for (const high of [false, true]) {
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3
      const base = positions.length / 3
      for (const [a, b] of [
        [false, false],
        [true, false],
        [true, true],
        [false, true],
      ] as const) {
        const corner = [0, 0, 0]
        corner[axis] = pick(axis, high)
        corner[u] = pick(u, a)
        corner[v] = pick(v, b)
        positions.push(...corner)
        const normal = [0, 0, 0]
        normal[axis] = high ? 1 : -1
        normals.push(...normal)
        uvs.push(a ? 1 : 0, b ? 1 : 0)
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    min,
    max,
  }
}

const pad4 = (length: number): number => (4 - (length % 4)) % 4

export interface GlbExtras {
  /** Adds a `skins` entry and `JOINTS_0`/`WEIGHTS_0` attributes, as a rigged glTF has. */
  readonly skinned?: boolean
  /** Replaces the JSON document before it is written (to break it). */
  readonly edit?: (doc: Record<string, unknown>) => void
  /** The base-colour image's bytes; default a 1 × 1 white PNG. */
  readonly image?: Uint8Array
}

/** The mesh as a GLB: one primitive with POSITION, NORMAL, TEXCOORD_0, indices and an embedded PNG texture. */
export function encodeGlb(mesh: FixtureMesh, extras: GlbExtras = {}): ArrayBuffer {
  const parts = [mesh.positions, mesh.normals, mesh.uvs, mesh.indices, extras.image ?? PNG]
  const views: { byteOffset: number; byteLength: number }[] = []
  let length = 0
  for (const part of parts) {
    views.push({ byteOffset: length, byteLength: part.byteLength })
    length += part.byteLength + pad4(part.byteLength)
  }
  const bin = new Uint8Array(length)
  parts.forEach((part, index) => {
    bin.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), views[index]!.byteOffset)
  })
  const count = mesh.positions.length / 3
  const attributes: Record<string, number> = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }
  const doc: Record<string, unknown> = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: length }],
    bufferViews: views.map((view) => ({ buffer: 0, ...view })),
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: [...mesh.min], max: [...mesh.max] },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: mesh.indices.length, type: 'SCALAR' },
    ],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes, indices: 3, material: 0 }] }],
  }
  if (extras.skinned) {
    attributes.JOINTS_0 = 1
    attributes.WEIGHTS_0 = 1
    doc.skins = [{ joints: [0] }]
  }
  extras.edit?.(doc)
  let json = JSON.stringify(doc)
  json += ' '.repeat(pad4(json.length))
  const jsonBytes = new TextEncoder().encode(json)
  const out = new ArrayBuffer(12 + 8 + jsonBytes.length + 8 + bin.length)
  const view = new DataView(out)
  view.setUint32(0, 0x46546c67, true) // 'glTF'
  view.setUint32(4, 2, true)
  view.setUint32(8, out.byteLength, true)
  view.setUint32(12, jsonBytes.length, true)
  view.setUint32(16, 0x4e4f534a, true) // 'JSON'
  new Uint8Array(out, 20).set(jsonBytes)
  view.setUint32(20 + jsonBytes.length, bin.length, true)
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true) // 'BIN'
  new Uint8Array(out, 28 + jsonBytes.length).set(bin)
  return out
}

/**
 * A 2 × 2 m quad standing on the floor at z = 0, facing +z (towards a camera in front of it), with glTF's UVs:
 * (0, 0) is the image's top-left corner, at the quad's top-left.
 */
export function fixtureQuad(): FixtureMesh {
  return {
    positions: new Float32Array([-1, 2, 0, 1, 2, 0, 1, 0, 0, -1, 0, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 3, 2, 0, 2, 1]),
    min: [-1, 0, 0],
    max: [1, 2, 0],
  }
}

/**
 * The mesh as a packed `.bin` (`LLP1`): uint16 positions across the bounds, int8 normals, uint16 UVs across their
 * range, uint16 indices, then the PNG, as `scripts/pack-models.py` writes it.
 */
export function encodePack(mesh: FixtureMesh): ArrayBuffer {
  const vertices = mesh.positions.length / 3
  const uvMin = [
    Math.min(...mesh.uvs.filter((_, i) => i % 2 === 0)),
    Math.min(...mesh.uvs.filter((_, i) => i % 2 === 1)),
  ]
  const uvMax = [
    Math.max(...mesh.uvs.filter((_, i) => i % 2 === 0)),
    Math.max(...mesh.uvs.filter((_, i) => i % 2 === 1)),
  ]
  let size = 56 + vertices * 6 + vertices * 4 + vertices * 4 + mesh.indices.length * 2
  const imageAt = size + pad4(size)
  size = imageAt + PNG.length
  const out = new ArrayBuffer(size)
  const view = new DataView(out)
  view.setUint32(0, 0x3150_4c4c, true) // 'LLP1'
  view.setUint32(4, vertices, true)
  view.setUint32(8, mesh.indices.length, true)
  view.setUint32(12, PNG.length, true)
  const header = [...mesh.min, ...mesh.max, ...uvMin, ...uvMax]
  header.forEach((value, i) => {
    view.setFloat32(16 + i * 4, value as number, true)
  })
  let at = 56
  const span = (c: number): number => (mesh.max[c] as number) - (mesh.min[c] as number)
  for (let i = 0; i < vertices * 3; i++, at += 2)
    view.setUint16(
      at,
      Math.round((((mesh.positions[i] as number) - (mesh.min[i % 3] as number)) / span(i % 3)) * 65535),
      true,
    )
  for (let i = 0; i < vertices; i++, at += 4)
    for (let c = 0; c < 3; c++) view.setInt8(at + c, Math.round((mesh.normals[i * 3 + c] as number) * 127))
  for (let i = 0; i < vertices * 2; i++, at += 2) {
    const c = i % 2
    const range = (uvMax[c] as number) - (uvMin[c] as number)
    view.setUint16(at, Math.round((((mesh.uvs[i] as number) - (uvMin[c] as number)) / range) * 65535), true)
  }
  for (const index of mesh.indices) {
    view.setUint16(at, index, true)
    at += 2
  }
  new Uint8Array(out, imageAt).set(PNG)
  return out
}
