// The variants of each round of the figures' look, as data over the cast file: the sliders, the gait, an outfit item, a garment's
// options. `figure-variants.ts` draws one list of them side by side (`pnpm --filter @automata/character-kit variants <out-dir> <name>
// <ada|nurse> <look>`). Each look is a round's list for one character, named `round<N>-<id>` (round 2's vest options are `round2-vest`).
// A variant called ADOPTED is the cast file itself, so a change to the cast moves its sheet; the others are patches of it.

import { ADA, NIGHT_NURSE } from '../../../games/the-last-light/src/features/figures/cast.ts'
import { OLD_UNCANNY } from '../../../games/the-last-light/src/features/figures/old-gaits.ts'
import type { CharacterDef } from '../src/entries/index.ts'
import { BASE } from '../src/shared/figure-builder/door.ts'

/** One version of a character: what it is called on the sheet, what differs, its data, and optionally the variant it is counted against. */
export interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
  readonly against?: string
}

const round1 = (() => {
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
  const ada: Variant[] = [
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
  const nurse: Variant[] = [
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

  return { ada, nurse }
})()

const round2 = (() => {
  /** Ada with her waistcoat and legs replaced by these items. */
  const dressed = (waistcoat: Record<string, unknown>, legs: Record<string, unknown>): CharacterDef => ({
    ...ADA,
    outfits: {
      street: (ADA.outfits.street ?? []).map((item) =>
        'waistcoat' in item ? waistcoat : 'jeans' in item || 'trousers' in item ? legs : item,
      ) as never,
    },
  })

  const ada: Variant[] = [
    {
      label: 'BEFORE',
      note: 'round 1: the old cut (a tube from shoulder to belt, a pipe to the cuff)',
      def: dressed({ waistcoat: 'maroon', fit: 0, length: 0.35, armhole: 0 }, { jeans: 'denim' }),
    },
    {
      label: 'A',
      note: 'the waistcoat fitted and cropped at the waist, jeans tapered',
      def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.05 }, { jeans: 'denim', taper: 0.7 }),
    },
    {
      label: 'B (ADOPTED)',
      note: 'A with an armhole: the shirt shows at the shoulder',
      def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 }, { jeans: 'denim', taper: 0.7 }),
    },
    {
      label: 'D',
      note: 'B with a brown belt at the waist (an outfit choice: the old street outfit has none)',
      def: {
        ...dressed({ waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 }, { jeans: 'denim', taper: 0.7 }),
        outfits: {
          street: [
            ...((dressed(
              { waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 },
              { jeans: 'denim', taper: 0.7 },
            ).outfits.street ?? []) as never[]),
            { belt: 'bootBrown' },
          ],
        },
      },
    },
    {
      label: 'C',
      note: 'B with the vest to the hip (length 0.6)',
      def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.6, armhole: 1 }, { jeans: 'denim', taper: 1 }),
    },
  ]

  return { ada }
})()

const round2vest = (() => {
  const vest = (def: CharacterDef, options: Record<string, unknown>): CharacterDef => ({
    ...def,
    swatches: {
      ...def.swatches,
      vestRed: { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] },
    },
    default: 'vested',
    outfits: {
      vested: [
        { tee: 'ribCream', sleeves: 'short' },
        { waistcoat: 'vestRed', ...options },
        { jeans: 'denim' },
        { eyes: 'eyeBrown' },
      ],
    },
  })

  const pair: Variant[] = BASE.flatMap((member) => [
    { label: `${member.def.id} BEFORE`, note: 'no option: the legacy cut', def: vest(member.def, {}) },
    {
      label: `${member.def.id} OPTIONS`,
      note: 'fit 1, length .05, armhole 1',
      def: vest(member.def, { fit: 1, length: 0.05, armhole: 1 }),
      against: `${member.def.id} BEFORE`,
    },
  ])

  return { pair }
})()

const round3 = (() => {
  /** The nurse with her skirt's options and her belt replaced (`belt: undefined` takes the belt off). */
  const cut = (skirt: Record<string, unknown>, belt?: Record<string, unknown>): CharacterDef => ({
    ...NIGHT_NURSE,
    outfits: {
      uniform: (NIGHT_NURSE.outfits.uniform ?? []).flatMap((garment): Record<string, unknown>[] => {
        const item = garment as unknown as Record<string, unknown>
        if ('skirt' in item) return [{ ...item, ...skirt }]
        if ('belt' in item) return belt === undefined ? [] : [belt]
        return [item]
      }) as never,
    },
  })

  const nurse: Variant[] = [
    { label: 'BEFORE', note: 'round 1: skirt flare .3, length .42, a belt', def: NIGHT_NURSE },
    { label: 'A', note: 'no belt: the top falls into the skirt', def: cut({}) },
    {
      label: 'B',
      note: 'a straighter skirt (flare .1) a hand longer (length .5)',
      def: cut({ flare: 0.1, length: 0.5 }, { belt: 'wardWhiteShade' }),
    },
    { label: 'C', note: 'B and no belt', def: cut({ flare: 0.1, length: 0.5 }) },
  ]

  return { nurse }
})()

/**
 * Round 3's stand and face for Ada, one change at a time over round 2's: what the old file's own numbers do (it zeroed the weight on a
 * leg, `stance` and `stanceLead` and `shift`, which the brisk gait itself has as 0.04, 0.08 and 0.012; and it bent the idle arm by
 * 0.45 and hung it by 0.12, which her overrides cut to 0.15 and 0.04), and what `face.drawn: false` does at the play size.
 */
const round3ada = (() => {
  /** Round 2's stand: the old file's zeroed stance and shift, its idle elbow and hang, over the adopted gait. */
  const round2 = { ...ADA.gaitOverrides, stance: 0, stanceLead: 0, shift: 0, idleElbow: 0.15, hang: 0.04 }
  const stance = { stance: 0.04, stanceLead: 0.08, shift: 0.012 }
  const arm = { idleElbow: 0.45, hang: 0.12 }
  const decal = { ...ADA.face, drawn: false }
  const ada: Variant[] = [
    {
      label: 'BEFORE',
      note: 'round 2: weight on neither leg, the arm near straight, the drawn face',
      def: { ...ADA, face: { ...ADA.face, drawn: true }, gaitOverrides: round2 },
    },
    {
      label: 'A',
      note: 'the decal face (face.drawn false): two eye dots at play size',
      def: { ...ADA, face: decal, gaitOverrides: round2 },
    },
    {
      label: 'B',
      note: 'A and her weight on one leg: stance .04, stanceLead .08, shift .012',
      def: { ...ADA, face: decal, gaitOverrides: { ...round2, ...stance } },
    },
    {
      label: 'C (ADOPTED)',
      note: "B and a bent, hung arm: idleElbow .45, hang .12, the old brisk gait's own",
      def: ADA,
    },
    {
      label: 'D',
      note: 'C with her arms nearer her body (standOut .05) and her head turned more (face.turn .5)',
      def: {
        ...ADA,
        face: { ...decal, turn: 0.5 },
        gaitOverrides: { ...ADA.gaitOverrides, ...stance, ...arm, standOut: 0.05 },
      },
    },
  ]
  return { ada }
})()

export const LOOKS: Readonly<Record<string, readonly Variant[]>> = {
  'round1-ada': round1.ada,
  'round1-nurse': round1.nurse,
  'round2-ada': round2.ada,
  'round2-vest': round2vest.pair,
  'round3-nurse': round3.nurse,
  'round3-ada': round3ada.ada,
}
