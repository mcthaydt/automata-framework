import { describe, expect, it } from 'vitest'
import { encodeGlb, encodePack, fixtureBox } from '../../../testing/model/model-fixtures.ts'
import { modelGeometry } from './model-geometry.ts'
import { parseGlb, parsePack } from './parse-glb.ts'

/** Every vertex and index buffer of a geometry, as bytes. */
const buffersOf = (geometry: ReturnType<typeof modelGeometry>): number[][] =>
  geometry.buffers.map((buffer) => [
    ...new Uint8Array(buffer.data.buffer, buffer.data.byteOffset, buffer.data.byteLength),
  ])

describe('modelGeometry', () => {
  it('D3-c: a .bin prop and the same prop as .glb produce identical vertex buffers', () => {
    const box = fixtureBox()
    const fromGlb = modelGeometry(parseGlb(encodeGlb(box), 'crate.glb'))
    const fromBin = modelGeometry(parsePack(encodePack(box), 'crate.bin'))
    expect(fromGlb.vertexCount).toBe(24)
    expect(buffersOf(fromBin)).toEqual(buffersOf(fromGlb))
    expect(
      buffersOf(fromGlb)
        .flat()
        .some((byte) => byte !== 0),
    ).toBe(true)
  })

  it('keeps the file bounds as the geometry bounds', () => {
    const geometry = modelGeometry(parseGlb(encodeGlb(fixtureBox([-1, 0, -2], [1, 3, 2])), 'b.glb'))
    const { min, max } = geometry.bounds3D
    expect([min.x, min.y, min.z]).toEqual([-1, 0, -2])
    expect([max.x, max.y, max.z]).toEqual([1, 3, 2])
  })
})
