// Stands: hands placed on the dressed figure's openings, with fallbacks. Ported from FigureBuilder
// (mcthaydt/FigureBuilder) tests/form.test.ts "pocket holds" at a1f7246 onto AF's fixture figures, the golden
// outfits and seeded random characters, and checked against FigureBuilder's `standHolds` and `evaluate`.

import { beforeAll, describe, expect, it } from 'vitest'
import type { AnchorKind } from '../build/anchors'
import { type Built, build } from '../build/build'
import type { FigureDef } from '../figure/figure.schema'
import { skeleton } from '../figure/figure-skeleton'
import type { Garment } from '../figure/garment.schema'
import type { Stand } from '../library/stand.schema'
import { apply, invertRigid, position, sub, type V3 } from '../math/math'
import { GROUP } from '../parts/mesh'
import { reach } from '../parts/reach'
import { at, fk, J, type Skeleton } from '../rig/rig'
import { type FixtureFigures, fixtureFigures } from '../testing/fixture-library'
import { GOLDEN_OUTFITS } from '../testing/golden-outfits'
import { expectClose, expectDigest, MOTION_GOLDENS } from '../testing/motion-goldens'
import { AT_REST } from '../testing/motion-states'
import { randomCharacter } from '../testing/random-character'
import { evaluateMotion } from './hold'
import type { ArmHold } from './motion-state'
import { CHAIN, fits, openings, type Surface, standFor, standHolds } from './stands'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})
const standNamed = (id: string): Stand => {
  const stand = fixture.stands[id]
  if (!stand) throw new Error(`no stand ${id}`)
  return stand
}
const figureOf = (sliders: FigureDef['sliders'], skin: string, garments: readonly Garment[]): FigureDef => ({
  sliders,
  skin,
  gait: 'bounce',
  hand: 'R',
  outfits: { golden: garments },
  default: 'golden',
})
/** The dressed figure's outermost surface, as a hand finds the cloth it rests on (FigureBuilder form.test.ts). */
const surfaceOf = (s: Skeleton, built: Built): Surface => {
  const skip: number[] = [GROUP.head, GROUP.armL, GROUP.armR, GROUP.item]
  const cloth = built.parts.filter((p) => !skip.includes(p.group))
  return (origin, dir) => reach(cloth, s.rest, origin, dir)
}
interface Dressed {
  readonly name: string
  readonly def: FigureDef
  readonly s: Skeleton
  readonly built: Built
  readonly surface: Surface
  /** Each stand's placed hands on this outfit, by stand id. */
  readonly holds: Readonly<Record<string, ArmHold[]>>
}
const dressedCache = new Map<string, Dressed>()
/** A dressed figure, built and its stands placed once for every test here (a build and its placements take
 * about a second and a half: `reach` casts against every triangle of the outfit). */
function dress(name: string, def: FigureDef, outfit: string): Dressed {
  const known = dressedCache.get(name)
  if (known) return known
  const s = skeleton(def)
  const built = build(def, s, outfit, null, fixture.library)
  const surface = surfaceOf(s, built)
  const holds = Object.fromEntries(
    Object.entries(fixture.stands).map(([id, stand]) => [id, standHolds(s, stand, surface, built.anchors)]),
  )
  const made = { name, def, s, built, surface, holds }
  dressedCache.set(name, made)
  return made
}
/** Every dressed figure the tests stand: the fixture figures' outfits, the golden outfits, random characters. */
const dressed = (): Dressed[] => [
  ...Object.entries(fixture.figures).flatMap(([id, def]) =>
    Object.keys(def.outfits).map((outfit) => dress(`${id} ${outfit}`, def, outfit)),
  ),
  ...GOLDEN_OUTFITS.map((o) => dress(o.name, figureOf(o.sliders, o.skin, o.garments), 'golden')),
  ...[...Array(6).keys()].map((i) => {
    const { def } = randomCharacter(2000 + i, fixture.library)
    return dress(`random ${2000 + i}`, def, def.default)
  }),
]
/** The golden outfits that wore FigureBuilder's chain, whose nameplate set crossed arms' height (its `pendant`
 * anchor, cut with the plate, M3.5b decision 9). */
const PENDANT = ['model-moto', 'tall-bomber']

describe("stands match FigureBuilder's (goldens, a1f7246)", () => {
  it("every stand on Wick's and the keeper's bodies, on the body's own openings", () => {
    const bounce = fixture.gaits.bounce
    if (!bounce) throw new Error('no bounce')
    for (const [body, sliders] of [
      ['wick', at(GOLDEN_OUTFITS, 0).sliders],
      ['keeper', at(GOLDEN_OUTFITS, 1).sliders],
    ] as const) {
      const s = skeleton({ sliders })
      for (const id of Object.keys(fixture.stands)) {
        const golden = MOTION_GOLDENS.bodies[body]?.[`stand ${id}`]
        if (!golden) throw new Error(`no golden for ${body} stand ${id}`)
        expectDigest(
          evaluateMotion(s, bounce, { ...AT_REST, t: 0.4, stand: standNamed(id) }).world,
          golden,
          `${body} ${id}`,
        )
      }
    }
  })
  it("every stand on every golden outfit, on the outfit's openings and surface", () => {
    const loose = fixture.gaits.loose
    if (!loose) throw new Error('no loose')
    let compared = 0
    for (const o of GOLDEN_OUTFITS) {
      const { s, holds: placed } = dress(o.name, figureOf(o.sliders, o.skin, o.garments), 'golden')
      for (const id of Object.keys(fixture.stands)) {
        const key = `${o.name} ${id}`
        const golden = MOTION_GOLDENS.stands[key]
        if (!golden) throw new Error(`no golden for ${key}`)
        // Crossed arms under a nameplate the port does not make: they keep to the chest's height instead.
        if (id === 'arms-crossed' && PENDANT.includes(o.name)) continue
        const stand = standNamed(id)
        const holds = placed[id] ?? []
        expect(
          holds.map((h) => [h.side, h.in, h.anchor ?? null]),
          key,
        ).toEqual(golden.holds.map((h) => [h.side, h.in, h.anchor]))
        for (const [n, h] of holds.entries()) {
          const want = at(golden.holds, n)
          for (const c of [0, 1, 2] as const) {
            expectClose(h.hand[c], want.hand[c], `${key} ${n} hand`)
            expectClose(h.pole[c], want.pole[c], `${key} ${n} pole`)
            expectClose(h.aim?.[0][c] ?? Number.NaN, want.aim?.[0][c] ?? Number.NaN, `${key} ${n} fingers`)
            expectClose(h.aim?.[1][c] ?? Number.NaN, want.aim?.[1][c] ?? Number.NaN, `${key} ${n} palm`)
          }
        }
        const world = evaluateMotion(s, loose, { ...AT_REST, stand, holds, clear: [0.1, 0.2] }).world
        expectDigest(world, golden.world, key)
        compared++
      }
    }
    expect(compared).toBe(GOLDEN_OUTFITS.length * 7 - PENDANT.length)
  }, 120_000)
})

/** Openings a hand drops into from above: its forearm falls to them, within 45° of plumb on screen. A belly
 * pocket opens at its sides, so the forearm comes in across the body as hands in a kangaroo pocket do (short
 * of level: BELLY); a jacket's slash pocket takes the hand at a slant from an elbow out and back (SLASH). */
const DOWN: AnchorKind[] = ['frontPocket', 'thighPocket', 'hem']
const BELLY = 85
const SLASH = 80
const PITCH = (18 * Math.PI) / 180
/** A hand at the front of the hips keeps out of the fly: its wrist at least FLY of the hip's half-width out
 * from the pelvis's middle, so it never reads as a hand on the crotch. */
const FLY = 0.45
const FRONT: AnchorKind[] = ['frontPocket', 'jacketPocket', 'hem']

describe('pocket holds (FigureBuilder form.test.ts, a1f7246)', () => {
  it("every stand's hands go to openings it has, the forearm plumb to a pocket, the hand outside the cloth", () => {
    for (const { name, s, built, surface, holds: placed } of dressed()) {
      const k = s.genes.height / 1.62
      const gait = fixture.gaits.bounce
      if (!gait) throw new Error('no bounce')
      for (const [id, stand] of Object.entries(fixture.stands)) {
        const holds = placed[id] ?? []
        const { pose } = evaluateMotion(s, gait, { ...AT_REST, stand, holds, clear: built.clearance })
        // Seen three-quarter, from the sheets' pitch; and square on, for the fly.
        const world = fk(s, { ...pose, yaw: Math.PI / 4 })
        const square = fk(s, { ...pose, yaw: 0 })
        const pelvis = invertRigid(at(square, J.pelvis))
        for (const h of holds) {
          const where = `${name} ${id} ${h.side} ${h.anchor}`
          const d = sub(position(at(world, J[`hand.${h.side}`])), position(at(world, J[`foreArm.${h.side}`])))
          const sx = d[0]
          const sy = d[1] * Math.cos(PITCH) - d[2] * Math.sin(PITCH)
          const lean = (Math.atan2(Math.abs(sx), -sy) * 180) / Math.PI
          if (h.anchor && DOWN.includes(h.anchor)) expect(lean, where).toBeLessThanOrEqual(45)
          if (h.anchor === 'bellyPocket') expect(lean, where).toBeLessThanOrEqual(BELLY)
          if (h.anchor === 'jacketPocket') expect(lean, where).toBeLessThanOrEqual(SLASH)
          // The hip's half-width: the outfit's hip opening, else the body's (as place() takes it).
          const hip =
            built.anchors.find((a) => a.kind === 'hip' && (a.side ?? h.side) === h.side) ??
            openings(s, surface).find((a) => a.kind === 'hip' && a.side === h.side)
          const palm = apply(pelvis, position(at(square, J[`hand.${h.side}`])))
          if (h.anchor && FRONT.includes(h.anchor) && palm[1] < s.hipY + 0.16 * k - at(s.rest, J.pelvis)[1])
            expect(Math.abs(palm[0]), `${where} fly`).toBeGreaterThanOrEqual(
              FLY * Math.abs(hip?.at[0] ?? Number.NaN),
            )
          // The arm reaches its place: the wrist where the hold put it, not short of it with the arm stretched.
          const want = apply(at(world, h.in ?? J.chest), h.hand)
          const got = position(at(world, J[`hand.${h.side}`]))
          expect(Math.hypot(...sub(want, got)), `${where} reach`).toBeLessThan(0.015 * k)
          // The wrist's place (rest space) no further in from the bone's axis than the cloth's surface there.
          const bone = at(s.rest, h.in ?? J.chest)
          const wrist: V3 = [bone[0] + h.hand[0], bone[1] + h.hand[1], bone[2] + h.hand[2]]
          const o: V3 = [bone[0], wrist[1], bone[2]]
          const out = sub(wrist, o)
          const r = Math.hypot(...out)
          expect(r, where).toBeGreaterThanOrEqual(surface(o, [out[0] / r, out[1] / r, out[2] / r]) - 0.02 * k)
        }
      }
    }
  }, 120_000)
})

describe('a stand falls back along its fallbacks to one the outfit suits', () => {
  it('the first of the stand and its fallbacks that fits, else the relaxed idle (null)', () => {
    let fellBack = 0
    let relaxedIdle = 0
    for (const { name, s, built } of dressed()) {
      for (const [id, stand] of Object.entries(fixture.stands)) {
        const chain = [id, ...(stand.fallback ?? [])]
        const chosen = standFor(s, built, id, fixture.stands)
        const index = chosen ? chain.indexOf(chosen.id) : chain.length
        expect(index, `${name} ${id}`).toBeGreaterThanOrEqual(0)
        for (const earlier of chain.slice(0, index))
          expect(fits(s, built, standNamed(earlier)), `${name} ${id}: ${earlier} fits`).toBe(false)
        if (chosen) {
          expect(chosen.stand).toBe(standNamed(chosen.id))
          expect(fits(s, built, chosen.stand), `${name} ${id}: ${chosen.id}`).toBe(true)
          // A placed hand that fits finds the opening it wants first.
          for (const [side, hand] of Object.entries(chosen.stand.hands ?? {}))
            if (hand && 'at' in hand && hand.at !== 'crossed')
              expect(
                built.anchors.some((a) => a.kind === CHAIN[hand.at][0] && (a.side ?? side) === side),
                `${name} ${chosen.id} ${side}`,
              ).toBe(true)
        }
        if (chosen && chosen.id !== id) fellBack++
        if (!chosen) relaxedIdle++
      }
    }
    // Between them the outfits exercise both: a stand given up for a fallback, and a chain that ends relaxed.
    expect(fellBack).toBeGreaterThan(0)
    expect(relaxedIdle).toBeGreaterThan(0)
  }, 120_000)
  it('names an unknown stand', () => {
    const def = figureOf({}, 'fair', at(GOLDEN_OUTFITS, 2).garments)
    const s = skeleton(def)
    const built = build(def, s, 'golden', null, fixture.library)
    expect(() => standFor(s, built, 'no-such-stand', fixture.stands)).toThrow(/no-such-stand/)
  })
})
