import { beforeAll, describe, expect, it } from 'vitest'
import { type FixtureMotion, fixtureMotion } from '#src/testing/fixture-motion.ts'
import { eyesIn } from './cell-input.ts'
import { MEMBERS, posedCell } from './posed-cell.ts'

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

// A turned face keeps both eyes wherever the face template shows both: facing the camera and a three-quarter either way,
// at every density the figures are drawn at and under the camera pitches a view can have. (The builder lost the far eye
// of the base man at density 1, where the ear's rim beside it read as shades.)
describe('both eyes draw wherever the face template shows both', () => {
  for (const member of Object.keys(MEMBERS) as (keyof typeof MEMBERS)[])
    for (const density of [1, 2, 4])
      it(`${member} at density ${density}, in the front views at three pitches`, () => {
        for (const pitchDeg of [18, 25, 35])
          for (const view of [0, 1, 7]) {
            const { painted, face } = posedCell(member, fixture.library.gaits, density, pitchDeg, view)
            expect(face, 'a drawn face').not.toBeNull()
            expect(
              eyesIn(painted.colours, painted.width, face as NonNullable<typeof face>, density),
              `${member} D${density} ${pitchDeg}° view ${view}`,
            ).toBe(2)
          }
      })
})
