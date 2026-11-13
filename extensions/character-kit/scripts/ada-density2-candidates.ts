// The candidates of the density-2 Ada study: each is data over the game's cast file (Ada as built), with her face's sliders changed.
import { ADA } from '../../../games/the-last-light/src/features/figures/cast.ts'
import type { CharacterDef } from '../src/entries/index.ts'

const withHead = (head: number): CharacterDef => ({ ...ADA, sliders: { ...ADA.sliders, head } })
const withFace = (face: Record<string, number>): CharacterDef => ({
  ...ADA,
  sliders: { ...ADA.sliders, face: { ...ADA.sliders.face, ...face } },
})

export const CANDIDATES: Record<string, CharacterDef> = {
  ada: ADA,
  // Round 1 of the coordinator's review: the eyes were asleep (eye size .8, hood .05 closed them); these are the sweep.
  asleep: withFace({ eyeSize: 0.8, hood: 0.05, lips: 0.8 }),
  // Her build: six heads (head 1.25) and one between six and five (1.45, the most within .3 of the base woman's 1.15).
  six: withHead(1.25),
  between: withHead(1.45),
  wide: withFace({ eyeSize: 0.65, hood: 0, crease: 0.5, liner: 0.3, lips: 1 }),
}
