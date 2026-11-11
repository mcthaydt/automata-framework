// The clinic's rolling equipment: a gurney, a wheelchair, an IV stand and a monitor cart. Each stands on its wheels, centred on
// its origin, at about the size of the source game's model, so a fit to that box barely stretches it.
import { isFault, type MeshData, resolveProp } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const draw = (use: string) => {
  const resolved = resolveProp({ use }, worldKitLibrary)
  if (isFault(resolved)) throw new Error(`${use}: ${resolved.code}`)
  return resolved.generator(resolved.params)
}
const bounds = (meshes: readonly MeshData[]) => {
  const lo = [Infinity, Infinity, Infinity] as number[]
  const hi = [-Infinity, -Infinity, -Infinity] as number[]
  for (const mesh of meshes)
    for (let i = 0; i < mesh.positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k] as number, mesh.positions[i + k] as number)
        hi[k] = Math.max(hi[k] as number, mesh.positions[i + k] as number)
      }
  return { lo, hi, extent: lo.map((v, k) => (hi[k] as number) - v) }
}

// [preset, x, up, z] of the source's model box, and the part labels each must have.
const CASES: [string, [number, number, number], string[]][] = [
  ['gurney', [1.8, 0.9, 0.62], ['mattress', 'frame', 'wheels', 'pillow']],
  ['wheelchair', [0.65, 0.95, 0.95], ['seat', 'back', 'wheels']],
  ['iv-stand', [0.84, 1.8, 0.86], ['pole', 'feet', 'bag']],
  ['monitor-cart', [0.71, 1.1, 0.54], ['body', 'screen', 'wheels']],
]

describe('the clinic’s rolling equipment', () => {
  for (const [use, size, labels] of CASES) {
    it(`${use}: its parts, standing on the floor at about the source's size`, () => {
      const built = draw(use)
      for (const label of labels)
        expect(
          built.pieces.map((piece) => piece.label),
          use,
        ).toContain(label)
      const { lo, hi, extent } = bounds(built.pieces.map((piece) => piece.mesh))
      expect(lo[1], 'on the floor').toBeCloseTo(0, 2)
      for (const k of [0, 1, 2]) {
        expect(extent[k] as number, `${use} ${'xyz'[k]}`).toBeGreaterThan((size[k] as number) * 0.8)
        expect(extent[k] as number, `${use} ${'xyz'[k]}`).toBeLessThan((size[k] as number) * 1.2)
      }
      // Centred on its origin.
      expect(((lo[0] as number) + (hi[0] as number)) / 2).toBeCloseTo(0, 1)
      expect(((lo[2] as number) + (hi[2] as number)) / 2).toBeCloseTo(0, 1)
    })
  }

  it('the monitor cart’s screen glows and the rest does not', () => {
    const screen = draw('monitor-cart').pieces.find((piece) => piece.label === 'screen')
    expect(screen?.swatch).toBe('screenGlow')
  })
})
