// Round 1's variants (data only: sliders, gait, an outfit item), read by `figure-variants.ts` (`--export ada` and `--export nurse`).
// `before` is the data as round 0 pushed it, rebuilt here from the old numbers; the adopted variant is the cast file itself.
import type { CharacterDef } from '../../../../extensions/character-kit/src/entries/index.ts'
import { ADA, NIGHT_NURSE } from '../../../../games/the-last-light/src/features/figures/cast.ts'
import { OLD_UNCANNY } from '../../../../games/the-last-light/src/features/figures/old-gaits.ts'

interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
}

/** An outfit's items with `trousers` swapped for another item (or the same list). */
const withLegs = (def: CharacterDef, legs: Record<string, unknown>): CharacterDef => ({
  ...def,
  outfits: {
    street: (def.outfits.street ?? []).map((item) =>
      'trousers' in item || 'jeans' in item ? legs : item,
    ) as never,
  },
})

const oldAdaSliders = { fat: 0.2, hips: 0.37, legs: 0.3, chunk: 0.6, muscle: 0.5, shoulders: 0.47 }
const oldAdaGait = { armOut: 0.11, idleElbow: 0.15, hang: 0.04, stance: 0, stanceLead: 0, shift: 0 }

const adaBefore: CharacterDef = withLegs(
  { ...ADA, sliders: { ...ADA.sliders, ...oldAdaSliders }, gaitOverrides: oldAdaGait },
  { trousers: 'denim' },
)
/** Ada as round 0 pushed her, then each change on its own sheet row. */
export const ada: Variant[] = [
  { label: 'BEFORE', note: "round 0: the builder's brisk, trousers, the old sliders", def: adaBefore },
  {
    label: 'A',
    note: "the old brisk gait whole, and the kit's jeans for trousers",
    def: withLegs({ ...adaBefore, gaitOverrides: ADA.gaitOverrides as never }, { jeans: 'denim' }),
  },
  {
    label: 'B (ADOPTED)',
    note: 'A, a leaner build: fat .05, hips .2, legs .6, chunk .2, muscle .3, shoulders .55',
    def: ADA,
  },
  {
    label: 'C',
    note: 'B at 152 cm: the old Ada is 59 rows on the page, ours at 162 cm 64',
    def: { ...ADA, sliders: { ...ADA.sliders, height: 152 } },
  },
]

const nurseBefore: CharacterDef = { ...NIGHT_NURSE, gaitOverrides: { armOut: 0.09 } }
const adopted = { ...OLD_UNCANNY, armOut: 0.09, standOut: 0, standElbow: 0.04 }
export const nurse: Variant[] = [
  { label: 'BEFORE', note: "round 0: the builder's loose gait, her arms out 0.09", def: nurseBefore },
  {
    label: 'A (ADOPTED)',
    note: 'the old uncanny gait whole: slow, dragging, six poses a step, the head leading',
    def: NIGHT_NURSE,
  },
  {
    label: 'B',
    note: "A, her head cocked further: headTilt 28, headPitch .4, posture .3 - it moves her a texel, the stoop is the painter's",
    def: {
      ...NIGHT_NURSE,
      gaitOverrides: adopted,
      sliders: { ...NIGHT_NURSE.sliders, headTilt: 28, posture: 0.3 },
      genes: { headPitch: 0.4 },
    },
  },
  {
    label: 'C',
    note: 'A at 200 cm: the old nurse is 71 rows on the page (she stooped), ours at 210 cm 80',
    def: { ...NIGHT_NURSE, sliders: { ...NIGHT_NURSE.sliders, height: 200 } },
  },
]
