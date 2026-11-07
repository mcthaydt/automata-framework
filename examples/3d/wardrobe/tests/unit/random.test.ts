// The seeded random cast, wearing the wardrobe: any character it draws builds, and every swatch a garment wears is of
// a kind its role takes (FigureBuilder tests/random.test.ts "the registry in the random cast", ported).

import { build, type FigureLibrary, skeleton } from '@automata/3d/figures'
import { fieldRole, GARMENTS, garmentOf, roleOf, TAKES } from '@automata/3d/figures-kit'
import { fixtureFigures, randomCharacter } from '@automata/3d/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import '../../wardrobe.extension.ts'
import { WARDROBE_DRAWS } from '../../testing/wardrobe-draws.ts'

let library: FigureLibrary
beforeAll(async () => {
  library = (await fixtureFigures()).library
})

describe('random characters in the wardrobe', () => {
  for (let seed = 1000; seed < 1040; seed++)
    it(`random character ${seed} builds with finite vertices and palette materials`, () => {
      const { def, item } = randomCharacter(seed, library, WARDROBE_DRAWS)
      const built = build(def, skeleton(def), def.default, item, library)
      expect(built.parts.length).toBeGreaterThan(20)
      for (const p of built.parts) {
        expect([...p.mesh.positions, ...p.mesh.normals].every(Number.isFinite), p.material).toBe(true)
        expect(built.materials[p.material], p.material).toBeDefined()
      }
      for (const d of built.decals) expect(built.materials[d.material], d.material).toBeDefined()
    })
})

describe('the registry in the random cast', () => {
  for (let seed = 3000; seed < 3024; seed++)
    it(`random character ${seed} wears each swatch in a role of its kind, and its outfit has openings`, () => {
      const { def, item } = randomCharacter(seed, library, WARDROBE_DRAWS)
      const outfit = def.outfits[def.default] ?? []
      for (const g of outfit) {
        const key = garmentOf(g)
        if (!key) continue
        expect(GARMENTS[key]).toBeDefined()
        for (const [f, v] of Object.entries(g)) {
          const kinds = roleOf(g, f)
          const kind = typeof v === 'string' ? library.swatches[v]?.kind : undefined
          if (kinds && kind) expect(kinds, `${key}.${f} = ${v} (${kind})`).toContain(kind)
          const use = fieldRole(g, f)
          const its = typeof v === 'string' ? library.swatches[v]?.role : undefined
          if (use && its) expect(TAKES[use], `${key}.${f} = ${v} (a ${its})`).toContain(its)
        }
      }
      const built = build(def, skeleton(def), def.default, item, library)
      expect(built.anchors.length).toBeGreaterThan(0)
      expect(built.anchors.some((a) => a.kind === 'hip')).toBe(true)
    })
})
