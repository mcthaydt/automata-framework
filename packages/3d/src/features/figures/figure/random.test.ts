import { beforeAll, describe, expect, it } from 'vitest'
import { type FixtureFigures, fixtureFigures } from '../../../testing/fixture-library.ts'
import { random, randomCharacter } from '../../../testing/random-character.ts'
import { fieldRole, GARMENTS, garmentOf, roleOf, TAKES } from '../outfit/streetwear/registry.ts'
import { build } from './build.ts'
import { skeleton } from './figure-skeleton.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})

describe('random characters (FigureBuilder cast.ts randomCharacter, seeded)', () => {
  it("random(seed) is FigureBuilder's mulberry32: the same seed, the same numbers", () => {
    const r = random(1000)
    // FigureBuilder a1f7246's random(1000), run on Node 24.
    expect([r(), r(), r()]).toEqual([0.7951949068810791, 0.8276879135519266, 0.6915161057841033])
  })
  it('the same seed gives the same character', () => {
    expect(randomCharacter(7, fixture.library)).toEqual(randomCharacter(7, fixture.library))
    expect(randomCharacter(7, fixture.library)).not.toEqual(randomCharacter(8, fixture.library))
  })
  for (let seed = 1000; seed < 1040; seed++)
    it(`random character ${seed} builds with finite vertices and palette materials`, () => {
      const { def, item } = randomCharacter(seed, fixture.library)
      const built = build(def, skeleton(def), def.default, item, fixture.library)
      expect(built.parts.length).toBeGreaterThan(20)
      for (const p of built.parts) {
        expect([...p.mesh.positions, ...p.mesh.normals].every(Number.isFinite), p.material).toBe(true)
        expect(built.materials[p.material], p.material).toBeDefined()
      }
      for (const d of built.decals) expect(built.materials[d.material], d.material).toBeDefined()
    })
})

// FigureBuilder tests/random.test.ts "the registry in the random cast", ported: every swatch a registry
// garment wears is of a kind its role takes, and every outfit offers the openings its dress() found.
describe('the registry in the random cast', () => {
  for (let seed = 3000; seed < 3024; seed++)
    it(`random character ${seed} wears each swatch in a role of its kind, and its outfit has openings`, () => {
      const { def, item } = randomCharacter(seed, fixture.library)
      const swatches = fixture.library.swatches
      const outfit = def.outfits[def.default] ?? []
      for (const g of outfit) {
        const key = garmentOf(g)
        if (!key) continue
        expect(GARMENTS[key]).toBeDefined()
        for (const [f, v] of Object.entries(g)) {
          const kinds = roleOf(g, f)
          const kind = typeof v === 'string' ? swatches[v]?.kind : undefined
          if (kinds && kind) expect(kinds, `${key}.${f} = ${v} (${kind})`).toContain(kind)
          const use = fieldRole(g, f)
          const its = typeof v === 'string' ? swatches[v]?.role : undefined
          if (use && its) expect(TAKES[use], `${key}.${f} = ${v} (a ${its})`).toContain(its)
        }
      }
      const built = build(def, skeleton(def), def.default, item, fixture.library)
      expect(built.anchors.length).toBeGreaterThan(0)
      expect(built.anchors.some((a) => a.kind === 'hip')).toBe(true)
    })
})
