// The runway golden's own shape. There is one md5 per cell for every machine: the cell the Macs' arm64 painted differently
// (`nia` on the thin body, direction 0) was the builder's hair-grid poles, decided by the last bit of `Math.sin` and `Math.cos`,
// and the builder's rule (c8-lit) makes it the same everywhere; `ulp.test.ts` nudges the maths to prove it. A platform that still
// differs is diffed by `tests/fixtures/cell-miss.ts`.
import { describe, expect, it } from 'vitest'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { RUNWAY_GOLDEN } from '../../fixtures/runway-golden.ts'

const MD5 = /^[0-9a-f]{32}$/

describe('the runway golden', () => {
  it('holds an md5 for each of the eight models in each direction, on its own body', () => {
    expect(Object.keys(RUNWAY_GOLDEN.cells)).toEqual(RUNWAY_CAST.map((m) => m.def.id))
    for (const [id, directions] of Object.entries(RUNWAY_GOLDEN.cells)) {
      expect(Object.keys(directions), id).toEqual(RUNWAY_GOLDEN.directions.map(String))
      for (const md5 of Object.values(directions)) expect(md5).toMatch(MD5)
    }
  })

  it('holds an md5 for each model on each of the fit check’s bodies, in each of its directions', () => {
    for (const { def } of RUNWAY_CAST) {
      expect(Object.keys(RUNWAY_GOLDEN.fit[def.id] ?? {}), def.id).toEqual(Object.keys(RUNWAY_GOLDEN.bodies))
      for (const body of Object.keys(RUNWAY_GOLDEN.bodies)) {
        const directions = RUNWAY_GOLDEN.fit[def.id]?.[body] ?? {}
        expect(Object.keys(directions), `${def.id} on ${body}`).toEqual(
          RUNWAY_GOLDEN.fitDirections.map(String),
        )
        for (const md5 of Object.values(directions)) expect(md5).toMatch(MD5)
      }
    }
  })

  it('has, for nia on the thin body, direction 0, the md5 the Macs painted: it is everyone’s now', () => {
    expect(RUNWAY_GOLDEN.fit.nia?.thin?.['0']).toBe('259c7a376180713d893c1fdf5ac99b3e')
  })
})
