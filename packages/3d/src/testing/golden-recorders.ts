// Records the geometry and the stands of a set of golden outfits, as the text of a golden file. The core goldens
// (scripts/record-goldens.ts) and a wardrobe extension's (examples/3d/wardrobe/scripts/record-goldens.ts) are written
// by the same functions, so both are read by the same checks (testing/golden-checks.ts, testing/motion-goldens.ts).
//
// Numbers are kept to 13 significant digits (geometry) and 12 (motion); the readers allow 1e-9, so a last-bit
// difference between platforms' `Math` functions moves nothing.

import { build } from '../features/figures/figure/build.ts'
import { skeleton } from '../features/figures/figure/figure-skeleton.ts'
import { evaluateMotion } from '../features/figures/motion/hold.ts'
import { standHolds } from '../features/figures/motion/stands.ts'
import type { M } from '../shared/math/math.ts'
import { fingerprint } from './fingerprint.ts'
import type { FixtureFigures } from './fixture-library.ts'
import { figureOf, type GoldenOutfit } from './golden-outfits.ts'
import { motionFingerprint } from './motion-fingerprint.ts'
import { AT_REST } from './motion-states.ts'
import { surfaceOf } from './stand-surface.ts'

/** `x` with every number kept to `digits` significant digits. */
export function round(x: unknown, digits: number): unknown {
  if (typeof x === 'number') return Number(x.toPrecision(digits))
  if (Array.isArray(x)) return x.map((v) => round(v, digits))
  if (x && typeof x === 'object')
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v, digits)]))
  return x
}

/** One entry per line, so a diff names the state that moved. */
export const section = (entries: Record<string, unknown>, indent: string): string[] =>
  Object.entries(entries).map(
    ([key, value], n, all) =>
      `${indent}${JSON.stringify(key)}: ${JSON.stringify(value)}${n < all.length - 1 ? ',' : ''}`,
  )

/** The outfits' geometry: per part its fingerprint, per outfit its anchors and its arms' clearance. */
export function recordDress(outfits: readonly GoldenOutfit[], fixture: FixtureFigures): string {
  const lines = ['{']
  for (const [n, o] of outfits.entries()) {
    const def = figureOf(o.sliders, o.skin, o.garments)
    const built = build(def, skeleton(def), 'golden', null, fixture.library)
    const anchors = built.anchors.map((a) =>
      round({ kind: a.kind, side: a.side ?? null, bone: a.bone, at: a.at, open: a.open }, 13),
    )
    const parts = built.parts.map((p) => round(fingerprint(p), 13))
    // One part per line, so a diff names the part that moved.
    lines.push(
      `  ${JSON.stringify(o.name)}: {`,
      `    "clearance": ${JSON.stringify(round(built.clearance, 13))},`,
      '    "anchors": [',
      ...anchors.map((a, j) => `      ${JSON.stringify(a)}${j < anchors.length - 1 ? ',' : ''}`),
      '    ],',
      '    "parts": [',
      ...parts.map((p, j) => `      ${JSON.stringify(p)}${j < parts.length - 1 ? ',' : ''}`),
      '    ]',
      `  }${n < outfits.length - 1 ? ',' : ''}`,
    )
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** Every stand placed on each outfit's openings and surface, then played in the loose gait: the holds and the pose. */
export function recordStands(
  outfits: readonly GoldenOutfit[],
  fixture: FixtureFigures,
): Record<string, unknown> {
  const print = (world: readonly M[]) => round(motionFingerprint(world), 12)
  const loose = fixture.gaits.loose
  if (!loose) throw new Error('the fixture has no loose gait')
  const stands: Record<string, unknown> = {}
  for (const o of outfits) {
    const def = figureOf(o.sliders, o.skin, o.garments)
    const s = skeleton(def)
    const built = build(def, s, 'golden', null, fixture.library)
    const surface = surfaceOf(s, built)
    for (const [standId, stand] of Object.entries(fixture.stands)) {
      const placed = standHolds(s, stand, surface, built.anchors)
      const world = evaluateMotion(s, loose, { ...AT_REST, stand, holds: placed, clear: [0.1, 0.2] }).world
      stands[`${o.name} ${standId}`] = {
        holds: round(
          placed.map((h) => ({ ...h, anchor: h.anchor ?? null })),
          12,
        ),
        world: print(world),
      }
    }
  }
  return stands
}
