// Stands on the wardrobe's outfits: hands placed on the pockets and hems its garments publish, checked against the
// recorded `standHolds` and `evaluateMotion` (goldens/stands.json, which these outfits had in core's motion goldens),
// and a stand falling back along its fallbacks where an outfit has no opening it wants.

import {
  type Built,
  build,
  CHAIN,
  evaluateMotion,
  fits,
  type Stand,
  skeleton,
  standFor,
  standHolds,
} from '@automata/3d/figures'
import {
  AT_REST,
  type Digest,
  expectClose,
  expectDigest,
  type FixtureFigures,
  figureOf,
  fixtureFigures,
  type GoldenHold,
  surfaceOf,
} from '@automata/3d/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import stands from '../../goldens/stands.json' with { type: 'json' }
import '../../wardrobe.extension.ts'
import { WARDROBE_OUTFITS } from '../../testing/wardrobe-outfits.ts'

const goldens = stands as unknown as Record<string, { holds: GoldenHold[]; world: Digest }>
let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})
const standNamed = (id: string): Stand => {
  const stand = fixture.stands[id]
  if (!stand) throw new Error(`no stand ${id}`)
  return stand
}
/** Each outfit built once: a build and its placements cast `reach` against every triangle, hundreds of times. */
const dressed = new Map<string, { s: ReturnType<typeof skeleton>; built: Built }>()
const dress = (name: string) => {
  const known = dressed.get(name)
  if (known) return known
  const o = WARDROBE_OUTFITS.find((outfit) => outfit.name === name)
  if (!o) throw new Error(`no wardrobe outfit ${name}`)
  const def = figureOf(o.sliders, o.skin, o.garments)
  const s = skeleton(def)
  const made = { s, built: build(def, s, 'golden', null, fixture.library) }
  dressed.set(name, made)
  return made
}

describe('every stand on every wardrobe outfit, on the outfit’s openings and surface', () => {
  it('places the same hands as recorded and plays the same pose', () => {
    const loose = fixture.gaits.loose
    if (!loose) throw new Error('no loose')
    let compared = 0
    for (const o of WARDROBE_OUTFITS) {
      const { s, built } = dress(o.name)
      const surface = surfaceOf(s, built)
      for (const id of Object.keys(fixture.stands)) {
        const key = `${o.name} ${id}`
        const golden = goldens[key]
        if (!golden) throw new Error(`no golden for ${key}`)
        const holds = standHolds(s, standNamed(id), surface, built.anchors)
        expect(
          holds.map((h) => [h.side, h.in, h.anchor ?? null]),
          key,
        ).toEqual(golden.holds.map((h) => [h.side, h.in, h.anchor]))
        for (const [n, h] of holds.entries()) {
          const want = golden.holds[n]
          for (const c of [0, 1, 2] as const) {
            expectClose(h.hand[c], want?.hand[c] ?? Number.NaN, `${key} ${n} hand`)
            expectClose(h.pole[c], want?.pole[c] ?? Number.NaN, `${key} ${n} pole`)
          }
        }
        expectDigest(
          evaluateMotion(s, loose, { ...AT_REST, stand: standNamed(id), holds, clear: [0.1, 0.2] }).world,
          golden.world,
          key,
        )
        compared++
      }
    }
    expect(compared).toBe(WARDROBE_OUTFITS.length * Object.keys(fixture.stands).length)
  }, 120_000)
})

describe('a stand falls back along its fallbacks to one the outfit suits', () => {
  it('the first of the stand and its fallbacks that fits; between the outfits, some stand is given up for a fallback', () => {
    let fellBack = 0
    for (const o of WARDROBE_OUTFITS) {
      const { s, built } = dress(o.name)
      for (const [id, stand] of Object.entries(fixture.stands)) {
        const chain = [id, ...(stand.fallback ?? [])]
        const chosen = standFor(s, built, id, fixture.stands)
        const index = chosen ? chain.indexOf(chosen.id) : chain.length
        expect(index, `${o.name} ${id}`).toBeGreaterThanOrEqual(0)
        for (const earlier of chain.slice(0, index))
          expect(fits(s, built, standNamed(earlier)), `${o.name} ${id}: ${earlier} fits`).toBe(false)
        if (chosen) {
          expect(fits(s, built, chosen.stand), `${o.name} ${id}: ${chosen.id}`).toBe(true)
          // A placed hand that fits finds the opening it wants first.
          for (const [side, hand] of Object.entries(chosen.stand.hands ?? {}))
            if (hand && 'at' in hand && hand.at !== 'crossed')
              expect(
                built.anchors.some((a) => a.kind === CHAIN[hand.at][0] && (a.side ?? side) === side),
                `${o.name} ${chosen.id} ${side}`,
              ).toBe(true)
          if (chosen.id !== id) fellBack++
        }
      }
    }
    expect(fellBack).toBeGreaterThan(0)
  }, 120_000)
})
