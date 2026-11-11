// The clinic's wall and ceiling fittings and its folding screen: a sink, an extinguisher cabinet, a strip light, a coat on its
// hooks and a privacy screen. Each stands on y = 0 with its origin at the centre of its base, faces +z, and is about the
// size of the source game's model (its own frame: width, up, depth), so a `fit` to that box barely stretches it.
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

// [preset, width, up, depth] of the source's model box, and the part labels each must have.
const CASES: [string, [number, number, number], string[]][] = [
  ['sink', [0.51, 0.8, 0.45], ['bowl', 'tap', 'splash']],
  ['cabinet.extinguisher', [0.42, 0.75, 0.17], ['body', 'glass']],
  ['light.strip', [1.25, 0.1, 0.3], ['housing', 'tube']],
  ['coat.hooks', [0.51, 1.15, 0.24], ['board', 'hooks', 'coat']],
  ['screen.privacy', [1.25, 1.6, 0.45], ['panels', 'frame']],
]

describe('the clinic’s fittings', () => {
  for (const [use, size, labels] of CASES) {
    it(`${use}: its parts, on y = 0 at about the source's size, centred on its origin`, () => {
      const built = draw(use)
      for (const label of labels)
        expect(
          built.pieces.map((piece) => piece.label),
          use,
        ).toContain(label)
      const { lo, hi, extent } = bounds(built.pieces.map((piece) => piece.mesh))
      expect(lo[1], 'base').toBeCloseTo(0, 2)
      for (const k of [0, 1, 2]) {
        expect(extent[k] as number, `${use} ${'xyz'[k]}`).toBeGreaterThan((size[k] as number) * 0.8)
        expect(extent[k] as number, `${use} ${'xyz'[k]}`).toBeLessThan((size[k] as number) * 1.2)
      }
      expect(((lo[0] as number) + (hi[0] as number)) / 2).toBeCloseTo(0, 1)
      expect(((lo[2] as number) + (hi[2] as number)) / 2).toBeCloseTo(0, 1)
    })
  }

  it('the strip light’s tube glows and its housing does not', () => {
    const swatch = (label: string) =>
      draw('light.strip').pieces.find((piece) => piece.label === label)?.swatch
    expect(swatch('tube')).toBe('bulbCool')
    expect(swatch('housing')).not.toBe('bulbCool')
  })

  it('the extinguisher cabinet’s glass faces +z, in front of its body', () => {
    const built = draw('cabinet.extinguisher')
    const z = (label: string) =>
      bounds(built.pieces.filter((piece) => piece.label === label).map((piece) => piece.mesh)).hi[2] as number
    expect(z('glass')).toBeGreaterThan(z('body') - 0.001)
  })
})
