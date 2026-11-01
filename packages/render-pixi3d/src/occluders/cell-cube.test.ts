import { describe, expect, it } from 'vitest'
import { cellCubeData } from './cell-cube.js'

/** A channel of 0xRRGGBB as the linear value the vertex colours hold. */
const linear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

describe('cellCube: a unit cube cut into cells, coloured per vertex', () => {
  it('cuts each face into cells of at most `cell` metres once scaled to the size', () => {
    const data = cellCubeData({ x: 6, y: 2, z: 0.4 }, 0.5, () => 0xffffff)
    // ±z faces: 12 × 4 cells; ±x faces: 1 × 4 (0.4 m is one cell); ±y faces: 12 × 1.
    const vertices = 2 * (13 * 5) + 2 * (2 * 5) + 2 * (13 * 2)
    expect(data.positions.length).toBe(vertices * 3)
    expect(data.colors.length).toBe(vertices * 4)
    expect(data.indices.length).toBe(6 * (2 * 48 + 2 * 4 + 2 * 12))
    expect(Math.max(...data.positions)).toBe(0.5)
    expect(Math.min(...data.positions)).toBe(-0.5)
  })

  it("asks colorAt with each vertex's offset from the centre in metres and its face normal, and stores linear RGBA", () => {
    const seen: string[] = []
    const data = cellCubeData({ x: 2, y: 1, z: 1 }, 1, (p, n) => {
      seen.push(`${p.x},${p.y},${p.z}|${n.x},${n.y},${n.z}`)
      return p.y > 0 ? 0x80ff00 : 0x000000
    })
    expect(seen).toContain('1,0.5,0.5|0,0,1')
    expect(seen).toContain('-1,0.5,-0.5|0,1,0')
    const top = [...Array(data.positions.length / 3).keys()].find((i) => data.normals[i * 3 + 1] === 1) ?? -1
    expect([...data.colors.subarray(top * 4, top * 4 + 4)]).toEqual(
      [linear(0x80), 1, 0, 1].map((v) => Math.fround(v)),
    )
  })

  it("flat: gives each cell its own four vertices in one colour, asked at the cell's centre", () => {
    const asked: string[] = []
    const data = cellCubeData(
      { x: 2, y: 1, z: 1 },
      1,
      (p, n) => {
        asked.push(`${p.x},${p.y},${p.z}|${n.y}`)
        return p.x > 0 ? 0xffffff : 0
      },
      { flat: true },
    )
    // 2 + 2 + 1 + 1 + 2 + 2 cells, four vertices and two triangles each.
    expect(data.positions.length).toBe(10 * 4 * 3)
    expect(data.indices.length).toBe(10 * 6)
    expect(asked).toContain('0.5,0.5,0|1')
    expect(asked).toHaveLength(10)
    for (let cell = 0; cell < 10; cell++) {
      const first = data.colors[cell * 16]
      for (let k = 1; k < 4; k++) expect(data.colors[cell * 16 + k * 4]).toBe(first)
    }
  })

  for (const flat of [false, true])
    it(`winds every triangle counter-clockwise seen from outside (flat: ${flat})`, () => {
      const data = cellCubeData({ x: 3, y: 2, z: 1 }, 0.7, () => 0, { flat })
      const at = (i: number) => [0, 1, 2].map((k) => data.positions[i * 3 + k] as number)
      for (let t = 0; t < data.indices.length / 3; t++) {
        const [i0, i1, i2] = [0, 1, 2].map((k) => data.indices[t * 3 + k] as number) as [
          number,
          number,
          number,
        ]
        const [p0, p1, p2] = [at(i0), at(i1), at(i2)] as [number[], number[], number[]]
        const e1 = p1.map((c, k) => c - (p0[k] as number))
        const e2 = p2.map((c, k) => c - (p0[k] as number))
        const cross = [
          (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number),
          (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number),
          (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number),
        ]
        const n = [0, 1, 2].map((k) => data.normals[i0 * 3 + k] as number)
        expect(cross.reduce((sum, c, k) => sum + c * (n[k] as number), 0)).toBeGreaterThan(0)
      }
    })
})
