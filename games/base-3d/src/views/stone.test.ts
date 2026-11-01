// The night's stone coloured per vertex (art pass step 12: vertex colour only, no painted texture): Emberwick's moss
// over blue-violet stone, darker toward the walls, down the sides and at a wall's foot; every colour a blend of the
// palette's stone and moss entries; and the same answer every time.
import { DEFAULT_PALETTE } from '@mcthaydt/automata-content/palette'
import { Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { colour } from './palette.ts'
import { floorColour, paintedBox, sideColour, wallColour } from './stone.ts'

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const
const luma = (c: number) => {
  const [r, g, b] = channels(c)
  return 0.299 * r + 0.587 * g + 0.114 * b
}
const greenish = (c: number) => {
  const [r, g, b] = channels(c)
  return g > r + 20 && g > b
}
const room = { min: [-4, 0] as const, max: [4, 12] as const }
const grid = (step: number) => {
  const points: [number, number][] = []
  for (let x = room.min[0]; x <= room.max[0]; x += step)
    for (let z = room.min[1]; z <= room.max[1]; z += step) points.push([x, z])
  return points
}

describe('the night stone colours', () => {
  it('covers about half of a floor in moss, the rest blue-violet stone', () => {
    const colours = grid(0.5).map(([x, z]) => floorColour(x, z, room))
    const moss = colours.filter(greenish).length / colours.length
    expect(moss).toBeGreaterThan(0.35)
    expect(moss).toBeLessThan(0.8)
    const stone = colours.filter((c) => !greenish(c))
    for (const c of stone) {
      const [r, g, b] = channels(c)
      expect(b).toBeGreaterThanOrEqual(r)
      expect(b).toBeGreaterThanOrEqual(g)
    }
  })

  it('darkens a floor toward its edges, and a side and a wall toward their foot', () => {
    const mean = (cs: number[]) => cs.reduce((s, c) => s + luma(c), 0) / cs.length
    const edge = grid(0.5).filter(([x]) => x === room.min[0] || x === room.max[0])
    const middle = grid(0.5).filter(([x]) => Math.abs(x) <= 1)
    expect(mean(edge.map(([x, z]) => floorColour(x, z, room)))).toBeLessThan(
      mean(middle.map(([x, z]) => floorColour(x, z, room))),
    )
    expect(luma(sideColour(1, -2.5, 3))).toBeLessThan(luma(sideColour(1, -0.3, 3)))
    const up = { x: 0, y: 1, z: 0 }
    const face = { x: 1, y: 0, z: 0 }
    expect(luma(wallColour({ x: 2, y: 0.05, z: 3 }, face))).toBeLessThan(
      luma(wallColour({ x: 2, y: 1, z: 3 }, face)),
    )
    // A wall's top catches moss.
    expect(greenish(wallColour({ x: 2, y: 1.2, z: 3 }, up))).toBe(true)
  })

  it('never goes brighter than the lightest stone or moss it blends', () => {
    const ceiling = Math.max(luma(colour('stoneEdge')), luma(colour('moss')), luma(colour('grass')))
    for (const [x, z] of grid(0.37)) expect(luma(floorColour(x, z, room))).toBeLessThanOrEqual(ceiling + 1)
  })

  it("uses only palette entries, so the stone reads as Emberwick's pixel art: flagstones, moss and brick courses", () => {
    const palette = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))
    const up = { x: 0, y: 1, z: 0 }
    const face = { x: 0, y: 0, z: 1 }
    for (const [x, z] of grid(0.37)) {
      expect(palette.has(floorColour(x, z, room))).toBe(true)
      expect(palette.has(sideColour(x, -z / 4, z))).toBe(true)
      expect(palette.has(wallColour({ x, y: z / 10, z }, face))).toBe(true)
      expect(palette.has(wallColour({ x, y: 1, z }, up))).toBe(true)
    }
  })

  it('answers the same every time', () => {
    expect(grid(0.7).map(([x, z]) => floorColour(x, z, room))).toEqual(
      grid(0.7).map(([x, z]) => floorColour(x, z, room)),
    )
  })

  it('builds a box of stone cut into cells, coloured in world space, its material taking the vertex colours', () => {
    const asked: number[] = []
    const mesh = paintedBox({ min: [1, -1, 2], max: [3, 0, 5] }, 0.5, (p) => {
      asked.push(p.y)
      return 0x2a2f4e
    })
    expect(mesh).toBeInstanceOf(Mesh3D)
    expect((mesh.material as PhongMaterial).vertexColors).toBe(true)
    // No painted texture: the default a plain material has.
    expect((mesh.material as PhongMaterial).textures.baseColor).toBe(new PhongMaterial().textures.baseColor)
    // Flat cells: each cell one colour, asked at its centre, with its own four vertices (the box is 4 × 2 × 6 cells).
    expect(mesh.geometry.positions?.length).toBe(2 * (4 * 2 + 2 * 6 + 4 * 6) * 4 * 3)
    expect(Math.min(...asked)).toBeCloseTo(-1)
    expect(Math.max(...asked)).toBeCloseTo(0)
  })
})
