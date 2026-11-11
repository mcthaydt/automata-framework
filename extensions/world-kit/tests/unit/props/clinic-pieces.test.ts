// The pieces a run-down clinic is dressed with: light that falls through a window and pools under a lamp, a puddle, grime,
// a run of pipe, a cable, a ceiling tile, a notice, a plaque, and the presets over the kit's screen, curtains and shelving.
// Light, puddles and grime are translucent parts; everything else is solid.
import { isFault, type MeshData, resolveProp } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const draw = (use: string, withParams?: Record<string, unknown>) => {
  const resolved = resolveProp({ use, ...(withParams ? { with: withParams } : {}) }, worldKitLibrary)
  if (isFault(resolved)) throw new Error(`${use}: ${resolved.code}`)
  return resolved.generator(resolved.params)
}
const bounds = (mesh: MeshData) => {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k] as number, mesh.positions[i + k] as number)
      hi[k] = Math.max(hi[k] as number, mesh.positions[i + k] as number)
    }
  return { lo, hi }
}

describe('the clinic pieces', () => {
  it('has every one of the twelve as a preset the kit can draw', () => {
    for (const name of [
      'moon-shaft',
      'light-pool',
      'puddle',
      'pipe-run',
      'grime',
      'screen',
      'plaque',
      'curtain',
      'shelving',
      'ceiling-tile',
      'cable',
      'wall-notice',
    ])
      expect(draw(name).pieces.length, name).toBeGreaterThan(0)
  })

  it('a moon shaft runs from the window to a patch on the floor, and adds its light', () => {
    const built = draw('moon-shaft', { height: 3.4, foot: [1.2, 2], topHalf: 0.4, footHalf: 0.8 })
    const beam = built.pieces.find((piece) => piece.label === 'beam')
    const patch = built.pieces.find((piece) => piece.label === 'patch')
    expect(beam?.veil?.add).toBe(true)
    expect(patch?.veil?.add).toBe(true)
    const { lo, hi } = bounds(beam?.mesh as MeshData)
    expect(hi[1]).toBeCloseTo(3.4, 6)
    expect(lo[1]).toBeLessThan(0.05)
    expect(hi[2]).toBeGreaterThan(2)
    expect(bounds(patch?.mesh as MeshData).hi[1]).toBeLessThan(0.05)
  })

  it('a light pool lies on the floor within its radius, brighter at the middle', () => {
    const built = draw('light-pool', { radius: 1.4 })
    expect(built.pieces.map((piece) => piece.veil?.add)).toEqual([true, true])
    const [outer, inner] = built.pieces.map((piece) => bounds(piece.mesh))
    expect((outer?.hi[0] as number) - (outer?.lo[0] as number)).toBeCloseTo(2.8, 1)
    expect((inner?.hi[0] as number) - (inner?.lo[0] as number)).toBeLessThan(2.8)
    expect(outer?.hi[1]).toBeLessThan(0.05)
    const [a, b] = built.pieces.map((piece) => piece.veil?.opacity as number)
    expect(b).toBeGreaterThan(a as number)
  })

  it('a puddle and grime are blended, not added, and flat on the floor; the puddle also has a sheen that adds', () => {
    for (const name of ['puddle', 'grime']) {
      const body = draw(name).pieces[0]
      expect(body?.veil, name).toBeDefined()
      expect(body?.veil?.add, name).not.toBe(true)
      expect(bounds(body?.mesh as MeshData).hi[1], name).toBeLessThan(0.05)
    }
    expect(draw('puddle').pieces.find((piece) => piece.label === 'sheen')?.veil?.add).toBe(true)
  })

  it('a puddle is the same every draw and another with another seed', () => {
    expect(draw('puddle', { seed: 3 }).pieces[0]?.mesh).toEqual(draw('puddle', { seed: 3 }).pieces[0]?.mesh)
    expect(draw('puddle', { seed: 3 }).pieces[0]?.mesh).not.toEqual(
      draw('puddle', { seed: 4 }).pieces[0]?.mesh,
    )
  })

  it('a pipe run reaches each of its points, and a cable lies along the floor through its own', () => {
    const run = draw('pipe-run', {
      points: [
        [0, 3, 0],
        [2, 3, 0],
        [2, 3, 1.5],
      ],
      radius: 0.04,
    })
    const pipe = bounds(run.pieces[0]?.mesh as MeshData)
    expect(pipe.hi[0]).toBeGreaterThanOrEqual(2)
    expect(pipe.hi[2]).toBeGreaterThanOrEqual(1.5)
    const cable = bounds(
      draw('cable', {
        points: [
          [0, 0],
          [1, 0.4],
          [1.2, 1],
        ],
      }).pieces[0]?.mesh as MeshData,
    )
    expect(cable.hi[0]).toBeGreaterThanOrEqual(1.2)
    expect(cable.hi[1]).toBeLessThan(0.05)
  })

  it('a ceiling tile hangs from the ceiling and goes with it', () => {
    const built = draw('ceiling-tile', { ceiling: 2.9 })
    expect(built.pieces.every((piece) => piece.ceiling === true)).toBe(true)
    expect(bounds(built.pieces[0]?.mesh as MeshData).hi[1]).toBeLessThanOrEqual(2.9)
  })

  it('a notice and a plaque face +z, flat to the wall, and a lit plaque glows', () => {
    const notice = draw('wall-notice', { y: 1.5 }).pieces[0]
    const { lo, hi } = bounds(notice?.mesh as MeshData)
    expect((hi[2] as number) - (lo[2] as number)).toBeLessThan(0.02)
    const plaque = draw('plaque', { y: 2, lit: true })
    expect(plaque.pieces.some((piece) => piece.swatch === 'plaqueLit')).toBe(true)
    expect(draw('plaque', { y: 2, lit: false }).pieces.some((piece) => piece.swatch === 'plaqueLit')).toBe(
      false,
    )
  })
})
