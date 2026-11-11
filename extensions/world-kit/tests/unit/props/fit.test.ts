// A prop at a size: any generator of the kit, turned and scaled to fill a box, standing on its base and centred on its origin.
import { isFault, type MeshData, resolveProp } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const draw = (withParams: Record<string, unknown>) => {
  const resolved = resolveProp({ kind: 'fit', with: withParams }, worldKitLibrary)
  if (isFault(resolved)) throw new Error(`fit: ${resolved.code}`)
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

describe('fit', () => {
  it('fills the box it is given, standing on its base and centred on its origin', () => {
    const built = draw({
      of: 'cabinet',
      with: { size: [1.1, 0.85, 0.48], drawers: 3, mat: 'walnut', knob: 'brass' },
      size: [0.75, 0.88, 0.45],
    })
    const { lo, hi, extent } = bounds(built.pieces.map((piece) => piece.mesh))
    expect(extent[0]).toBeCloseTo(0.75, 6)
    expect(extent[1]).toBeCloseTo(0.88, 6)
    expect(extent[2]).toBeCloseTo(0.45, 6)
    expect(lo[1]).toBeCloseTo(0, 6)
    expect((lo[0] as number) + (hi[0] as number)).toBeCloseTo(0, 6)
    expect((lo[2] as number) + (hi[2] as number)).toBeCloseTo(0, 6)
  })

  it('keeps the parts and their swatches as the generator made them', () => {
    const plain = resolveProp(
      { kind: 'cabinet', with: { size: [1, 1, 0.5], mat: 'walnut', knob: 'brass' } },
      worldKitLibrary,
    )
    if (isFault(plain)) throw new Error('cabinet')
    const own = plain.generator(plain.params).pieces
    const fitted = draw({
      of: 'cabinet',
      with: { size: [1, 1, 0.5], mat: 'walnut', knob: 'brass' },
      size: [2, 2, 2],
    }).pieces
    expect(fitted.map((piece) => [piece.label, piece.swatch])).toEqual(
      own.map((piece) => [piece.label, piece.swatch]),
    )
  })

  it('turns the prop before it fits: a bed built along x lies along z at a quarter turn', () => {
    const params = {
      of: 'bed',
      with: { size: [2, 1], frame: 'oak', sheet: 'linen', blanket: 'quiltBlue', pillow: 'pillowWhite' },
    }
    const along = bounds(
      draw({ ...params, size: [1.05, 0.95, 2.05], turn: -90 }).pieces.map((piece) => piece.mesh),
    )
    expect(along.extent[0]).toBeCloseTo(1.05, 6)
    expect(along.extent[2]).toBeCloseTo(2.05, 6)
    // Turned the other way the head is at the other end: the pillow (the highest part off the frame) moves from one z to the other.
    const pillow = (turn: number) => {
      const built = draw({ ...params, size: [1.05, 0.95, 2.05], turn })
      const part = built.pieces.find((piece) => piece.label === 'pillow')
      const b = bounds([(part as { mesh: MeshData }).mesh])
      return ((b.lo[2] as number) + (b.hi[2] as number)) / 2
    }
    expect(pillow(-90)).toBeLessThan(0)
    expect(pillow(90)).toBeGreaterThan(0)
  })

  it('keeps every normal a unit vector, however it is stretched', () => {
    const built = draw({ of: 'filingCabinet', with: {}, size: [0.52, 1.34, 0.63] })
    for (const { mesh } of built.pieces)
      for (let i = 0; i < mesh.normals.length; i += 3)
        expect(
          Math.hypot(mesh.normals[i] as number, mesh.normals[i + 1] as number, mesh.normals[i + 2] as number),
        ).toBeCloseTo(1, 6)
  })

  it('carries a prop’s light to the same place on the fitted prop', () => {
    const preset = worldKitLibrary.props?.['lamp.desk'] as Record<string, unknown>
    const own = resolveProp({ use: 'lamp.desk' }, worldKitLibrary)
    if (isFault(own)) throw new Error('lamp.desk')
    const base = own.generator(own.params)
    expect(base.lights?.length, 'the desk lamp has a light').toBeGreaterThan(0)
    const fitted = draw({ of: 'lamp', with: { ...preset, kind: undefined }, size: [0.35, 0.42, 0.21] })
    expect(fitted.lights?.length).toBe(base.lights?.length)
    const light = fitted.lights?.[0]
    const { hi } = bounds(fitted.pieces.map((piece) => piece.mesh))
    // The bulb is inside the lamp's box, near its top.
    expect((light?.at[1] as number) <= (hi[1] as number) + 1e-6).toBe(true)
    expect((light?.at[1] as number) > 0.2).toBe(true)
  })

  it('says which generator it could not find', () => {
    expect(() => draw({ of: 'no-such-thing', with: {}, size: [1, 1, 1] })).toThrow(/no-such-thing/)
  })
})
