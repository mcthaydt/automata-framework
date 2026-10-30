// The Last Light's parse cases (tests/props.test.ts at 92e6704, "GLB reader" and "packed models"), ported onto one
// of its props, plus the static-only rule AF adds: a skinned or malformed file is ModelInvalid naming the file.
import { readFileSync } from 'node:fs'
import { ModelInvalid } from '@mcthaydt/automata-runtime'
import { describe, expect, it } from 'vitest'
import { parseGlb, parsePack } from './parse-glb.js'
import { encodeGlb, encodePack, fixtureBox } from './testing/model-fixtures.js'

const bytesOf = (name: string): ArrayBuffer => {
  const data = readFileSync(new URL(`./testing/fixtures/${name}`, import.meta.url))
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

/** The GLB's own position bounds, read from its JSON chunk as the source test does. */
function glbBounds(buffer: ArrayBuffer): { min: number[]; max: number[] } {
  const length = new DataView(buffer).getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)))
  const primitive = doc.meshes[0].primitives[0]
  const position = doc.accessors[primitive.attributes.POSITION]
  return { min: position.min, max: position.max }
}

const isPng = (image: Uint8Array): boolean =>
  [...image.slice(1, 4)].map((c) => String.fromCharCode(c)).join('') === 'PNG'

/** The ModelInvalid a call throws. */
function refusal(run: () => unknown): ModelInvalid {
  try {
    run()
  } catch (error) {
    if (error instanceof ModelInvalid) return error
    throw error
  }
  throw new Error('expected ModelInvalid')
}

describe('parseGlb (The Last Light)', () => {
  it('reads a prop mesh: positions, normals and UVs per vertex, triangles in range, a PNG texture', () => {
    const buffer = bytesOf('nightstand.glb')
    const mesh = parseGlb(buffer, 'nightstand.glb')
    const vertices = mesh.positions.length / 3
    expect(mesh.normals.length).toBe(vertices * 3)
    expect(mesh.uvs.length).toBe(vertices * 2)
    expect(Math.max(...mesh.indices)).toBeLessThan(vertices)
    expect(vertices).toBeLessThan(65536)
    expect(isPng(mesh.image)).toBe(true)
    expect(mesh.min).toEqual(glbBounds(buffer).min)
    expect(mesh.max).toEqual(glbBounds(buffer).max)
  })

  it('reads the fixture box exactly', () => {
    const box = fixtureBox()
    const mesh = parseGlb(encodeGlb(box), 'box.glb')
    expect(mesh.positions).toEqual(box.positions)
    expect(mesh.normals).toEqual(box.normals)
    expect(mesh.uvs).toEqual(box.uvs)
    expect([...mesh.indices]).toEqual([...box.indices])
    expect(mesh.mime).toBe('image/png')
  })
})

describe('parsePack (The Last Light)', () => {
  it('reads a packed prop: in range, with the GLB bounds, unit normals and a PNG', () => {
    const mesh = parsePack(bytesOf('nightstand.pack'), 'nightstand.bin')
    const vertices = mesh.positions.length / 3
    const bounds = glbBounds(bytesOf('nightstand.glb'))
    expect(mesh.indices.length / 3).toBeLessThanOrEqual(2600)
    expect(Math.max(...mesh.indices)).toBeLessThan(vertices)
    expect(mesh.min).toEqual(bounds.min.map((v) => expect.closeTo(v, 5)))
    for (let i = 0; i < mesh.normals.length; i += 3)
      expect(Math.hypot(mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!)).toBeGreaterThan(0.95)
    expect(isPng(mesh.image)).toBe(true)
  })

  it('reads the fixture box exactly (its values sit on the pack grid)', () => {
    const box = fixtureBox()
    const mesh = parsePack(encodePack(box), 'box.bin')
    expect(mesh.positions).toEqual(box.positions)
    expect(mesh.normals).toEqual(box.normals)
    expect(mesh.uvs).toEqual(box.uvs)
  })
})

describe('static only: what is refused (M3 spec §6)', () => {
  it('refuses a GLB with a skin, naming the file', () => {
    const error = refusal(() => parseGlb(encodeGlb(fixtureBox(), { skinned: true }), 'models/hero.glb'))
    expect(error).toMatchObject({ _tag: 'ModelInvalid', file: 'models/hero.glb', reason: 'skinned' })
  })

  it('refuses a primitive with joint weights even without a skins entry', () => {
    const glb = encodeGlb(fixtureBox(), {
      edit: (doc) => {
        const meshes = doc.meshes as { primitives: { attributes: Record<string, number> }[] }[]
        meshes[0]!.primitives[0]!.attributes.JOINTS_0 = 1
      },
    })
    expect(refusal(() => parseGlb(glb, 'a.glb')).reason).toBe('skinned')
  })

  it.each([
    [
      'not a GLB',
      () => new TextEncoder().encode('hello world, not a model').buffer,
      'malformed: not a GLB file',
    ],
    ['truncated', () => encodeGlb(fixtureBox()).slice(0, 30), 'malformed: truncated'],
    [
      'JSON that is not JSON',
      () => {
        const glb = new Uint8Array(encodeGlb(fixtureBox()))
        glb[20] = 0x7d // '}' where '{' was
        return glb.buffer
      },
      'malformed: unreadable JSON chunk',
    ],
    [
      'no mesh',
      () => encodeGlb(fixtureBox(), { edit: (doc) => void delete doc.meshes }),
      'malformed: no mesh',
    ],
    [
      'an accessor past the end of the data',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            // A bufferView that claims more bytes than the file holds, and an accessor that fills it.
            ;(doc.bufferViews as { byteLength: number }[])[0]!.byteLength = 12_000_000
            ;(doc.accessors as { count: number }[])[0]!.count = 1_000_000
          },
        }),
      'malformed: accessor 0 runs past the binary chunk',
    ],
    [
      'no base-colour texture',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            doc.materials = [{}]
          },
        }),
      'malformed: no base-colour texture',
    ],
    // Review of #241: what the static path reads must agree with itself.
    [
      'fewer normals than positions',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            ;(doc.accessors as { count: number }[])[1]!.count = 3
          },
        }),
      'malformed: NORMAL has 3 vertices, POSITION has 24',
    ],
    [
      'fewer UVs than positions',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            ;(doc.accessors as { count: number }[])[2]!.count = 4
          },
        }),
      'malformed: TEXCOORD_0 has 4 vertices, POSITION has 24',
    ],
    [
      'an index past the vertices',
      () => {
        const box = fixtureBox()
        const indices = new Uint16Array(box.indices)
        indices[5] = 500
        return encodeGlb({ ...box, indices })
      },
      'malformed: index 500 is past the 24 vertices',
    ],
    [
      'indices that are not whole triangles',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            ;(doc.accessors as { count: number }[])[3]!.count = 35
          },
        }),
      'malformed: 35 indices are not whole triangles',
    ],
    [
      'an accessor past the end of its own bufferView',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            ;(doc.accessors as { byteOffset?: number }[])[0]!.byteOffset = 12
          },
        }),
      'malformed: accessor 0 runs past its bufferView',
    ],
    [
      'a primitive with no attributes',
      () =>
        encodeGlb(fixtureBox(), {
          edit: (doc) => {
            const meshes = doc.meshes as { primitives: { attributes?: unknown }[] }[]
            delete meshes[0]!.primitives[0]!.attributes
          },
        }),
      'malformed: the primitive has no attributes',
    ],
    [
      'a JSON chunk that is null',
      () => {
        const glb = new Uint8Array(encodeGlb(fixtureBox()))
        const length = new DataView(glb.buffer).getUint32(12, true)
        glb.set(new TextEncoder().encode('null'.padEnd(length, ' ')), 20)
        return glb.buffer
      },
      'malformed: no mesh',
    ],
  ])('refuses a GLB with %s', (_case, make, reason) => {
    expect(refusal(() => parseGlb(make() as ArrayBuffer, 'bad.glb'))).toMatchObject({
      file: 'bad.glb',
      reason,
    })
  })

  it.each([
    ['not a pack', () => encodeGlb(fixtureBox()), 'malformed: not a packed model'],
    ['truncated', () => encodePack(fixtureBox()).slice(0, 100), 'malformed: truncated'],
    [
      'indexing past its vertices',
      () => {
        const box = fixtureBox()
        const indices = new Uint16Array(box.indices)
        indices[0] = 900
        return encodePack({ ...box, indices })
      },
      'malformed: index 900 is past the 24 vertices',
    ],
    [
      'not whole triangles',
      () => {
        const box = fixtureBox()
        return encodePack({ ...box, indices: box.indices.slice(0, 34) })
      },
      'malformed: 34 indices are not whole triangles',
    ],
  ])('refuses a pack that is %s', (_case, make, reason) => {
    expect(refusal(() => parsePack(make(), 'bad.bin'))).toMatchObject({ file: 'bad.bin', reason })
  })
})
