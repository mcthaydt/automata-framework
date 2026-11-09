// Every slider at either end of its range, and the face's, still builds a whole figure with finite vertices and a
// pose that stands. It pushes every slider to either end, on the golden outfits.

import { beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_HEAD,
  DEFAULT_SLIDERS,
  type HeadShape,
  type Sliders,
} from '#src/features/figures/body/genes.ts'
import { build } from '#src/features/figures/figure/build.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { base } from '#src/features/figures/motion/base.ts'
import { type FixtureFigures, fixtureFigures } from '#src/testing/fixture-library.ts'
import { figureOf, GOLDEN_OUTFITS } from '#src/testing/golden-outfits.ts'
import { AT_REST } from '#src/testing/motion-states.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})

/** The ends where a slider's range is not 0 to 1. */
const ENDS: Partial<Record<keyof Sliders, readonly [number, number]>> = {
  height: [150, 200],
  headTilt: [-10, 10],
  chunk: [0, 1.5],
  bodyAsymmetry: [-1, 1],
}
const finite = (list: ArrayLike<number>) => [...Array.from(list)].every(Number.isFinite)

describe('the sliders at their ends', () => {
  const outfit = GOLDEN_OUTFITS[0]
  const cases: [string, Partial<Sliders>][] = []
  for (const key of Object.keys(DEFAULT_SLIDERS) as (keyof Sliders)[]) {
    if (key === 'face') continue
    for (const end of ENDS[key] ?? [0, 1]) cases.push([`${key} ${end}`, { [key]: end }])
  }
  for (const key of Object.keys(DEFAULT_HEAD) as (keyof HeadShape)[]) {
    const ends = key === 'asymmetry' ? [-1, 1] : [0, 1]
    for (const end of ends) cases.push([`face.${key} ${end}`, { face: { [key]: end } }])
  }

  it.each(cases)('%s builds and stands', (_name, sliders) => {
    if (!outfit) throw new Error('no golden outfit')
    const def = figureOf({ ...outfit.sliders, ...sliders }, outfit.skin, outfit.garments)
    const s = skeleton(def)
    const built = build(def, s, 'golden', null, fixture.library)
    for (const p of built.parts)
      expect(finite([...p.mesh.positions, ...p.mesh.normals]), p.material).toBe(true)
    const gait = fixture.gaits.bounce
    if (!gait) throw new Error('no gait bounce')
    const pose = base(s, gait, { ...AT_REST, moving: true, phase: 0.3 })
    expect(pose.world.every((m) => finite(m))).toBe(true)
  })
})
