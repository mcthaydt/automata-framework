// The kit's props: every preset in the library draws finite, outward-facing meshes with swatches the library has, a lamp a
// prop carries is one the lamp kit accepts, and the draw is the same every run.
import { buildWorld, hasSwatch, isFault, type MeshData, resolveProp } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'
import { levelWith } from '../../fixtures/level.ts'

const props = worldKitLibrary.props as Record<string, Record<string, unknown>>
/** The presets that leave a parameter to the place that uses them. */
const WITH: Record<string, Record<string, unknown>> = { runner: { size: [3, 0.8] } }

const facesAway = (mesh: MeshData): number | undefined => {
  const { positions: pos, normals: nor, indices: idx } = mesh
  const at = (i: number, k: number): number => pos[i * 3 + k] as number
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]] as [number, number, number]
    const u = [0, 1, 2].map((k) => at(b, k) - at(a, k))
    const v = [0, 1, 2].map((k) => at(c, k) - at(a, k))
    const cross = [
      (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
      (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
      (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
    ]
    const facing = [0, 1, 2].map(
      (k) => (nor[a * 3 + k] as number) + (nor[b * 3 + k] as number) + (nor[c * 3 + k] as number),
    )
    if (cross.reduce((sum, x, k) => sum + x * (facing[k] as number), 0) < -1e-9) return t / 3
  }
  return undefined
}

describe('every preset', () => {
  const names = Object.keys(props)

  it('names a generator that is registered', () => {
    for (const name of names) expect(isFault(resolveProp({ use: name }, worldKitLibrary)), name).toBe(false)
  })

  it('builds finite meshes whose triangles wind to their normals, in swatches the library has', () => {
    for (const name of names) {
      const resolved = resolveProp({ use: name, with: WITH[name] }, worldKitLibrary)
      if (isFault(resolved)) throw new Error(`${name} did not resolve`)
      const built = resolved.generator(resolved.params)
      expect(built.pieces.length, name).toBeGreaterThan(0)
      for (const { mesh, label, swatch } of built.pieces) {
        const where = `${name}/${label}`
        expect(mesh.positions.every(Number.isFinite), where).toBe(true)
        expect(mesh.normals.length, where).toBe(mesh.positions.length)
        expect(Math.max(...mesh.indices), where).toBeLessThan(mesh.positions.length / 3)
        expect(facesAway(mesh), `${where}: a triangle faces away from its normals`).toBeUndefined()
        expect(hasSwatch(worldKitLibrary, swatch), `${where} -> ${String(swatch)}`).toBe(true)
      }
    }
  })

  it('carries lights the lamp kit accepts', () => {
    for (const name of names) {
      const resolved = resolveProp({ use: name, with: WITH[name] }, worldKitLibrary)
      if (isFault(resolved)) continue
      const lit = resolved.generator(resolved.params).lights ?? []
      if (lit.length === 0) continue
      const { problems } = buildWorld(
        levelWith([{ id: 'p', use: name, at: [3, 3], ...(WITH[name] ? { with: WITH[name] } : {}) }]),
        worldKitLibrary,
      )
      expect(problems, name).toEqual([])
    }
  })

  it('draws the same twice, and a seed changes the variety', () => {
    const draw = (seed: number): MeshData[] => {
      const r = resolveProp({ kind: 'bookStack', with: { seed, count: 4 } }, worldKitLibrary)
      if (isFault(r)) throw new Error('bookStack is registered by the kit')
      return r.generator(r.params).pieces.map((piece) => piece.mesh)
    }
    expect(draw(3)).toEqual(draw(3))
    expect(draw(3)).not.toEqual(draw(4))
  })
})

describe('resolving a prop', () => {
  it('lays the place over the preset', () => {
    const resolved = resolveProp({ use: 'crate', with: { mat: 'oak' } }, worldKitLibrary)
    if (isFault(resolved)) throw new Error('fault')
    expect(resolved.kind).toBe('crate')
    expect(resolved.params).toMatchObject({ mat: 'oak' })
  })

  it('names what is missing', () => {
    expect(resolveProp({ use: 'throne' }, worldKitLibrary)).toEqual({ code: 'unknown-prop', name: 'throne' })
    expect(resolveProp({ kind: 'spaceship' }, worldKitLibrary)).toEqual({
      code: 'unknown-generator',
      name: 'spaceship',
    })
  })
})

describe('a prop in the world', () => {
  it('stands in its room under core alone', () => {
    const { pieces, problems } = buildWorld(
      levelWith([{ id: 'chair1', use: 'chair.wood', at: [3, 3] }]),
      worldKitLibrary,
    )
    expect(problems).toEqual([])
    expect(pieces.some((p) => p.id.startsWith('hall:prop:chair1.'))).toBe(true)
  })
})
