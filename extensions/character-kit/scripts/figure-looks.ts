// The variants of each round of the figures' look, as data over the cast file: the sliders, the gait, an outfit item, a garment's
// options. `figure-variants.ts` draws one list of them side by side (`pnpm --filter @automata/character-kit variants <out-dir> <name>
// <ada|nurse> <look>`). Each look is a round's list for one character, named `round<N>-<id>` (round 2's vest options are `round2-vest`).
// A variant called ADOPTED is the cast file itself, so a change to the cast moves its sheet; the others are patches of it.

import { ADA, NIGHT_NURSE } from '../../../games/the-last-light/src/features/figures/cast.ts'
import { OLD_UNCANNY } from '../../../games/the-last-light/src/features/figures/old-gaits.ts'
import type { CharacterDef } from '../src/entries/index.ts'
import { FASHION_HAIR } from '../src/features/fashion/hair.ts'
import { registerFashion } from '../src/features/fashion/register-fashion.ts'
import { BASE, HAIR_STYLES } from '../src/shared/figure-builder/door.ts'

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

/** `def` with its hair in `style` (the helmet `smoothBob` is what Ada wore before round 3's bob). */
const withHair = (def: CharacterDef, style: string): CharacterDef => ({
  ...def,
  outfits: Object.fromEntries(
    Object.entries(def.outfits).map(([name, items]) => [
      name,
      items.map((item) => ('hair' in item ? { ...item, style } : item)),
    ]),
  ) as never,
})

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
      def: withHair({ ...ADA, face: { ...ADA.face, drawn: true }, gaitOverrides: round2 }, 'smoothBob'),
    },
    {
      label: 'A',
      note: 'the decal face (face.drawn false): two eye dots at play size',
      def: withHair({ ...ADA, face: decal, gaitOverrides: round2 }, 'smoothBob'),
    },
    {
      label: 'B',
      note: 'A and her weight on one leg: stance .04, stanceLead .08, shift .012',
      def: withHair({ ...ADA, face: decal, gaitOverrides: { ...round2, ...stance } }, 'smoothBob'),
    },
    {
      label: 'C (ADOPTED)',
      note: "B and a bent, hung arm: idleElbow .45, hang .12, the old brisk gait's own",
      def: withHair(ADA, 'smoothBob'),
    },
    {
      label: 'D',
      note: 'C with her arms nearer her body (standOut .05) and her head turned more (face.turn .5)',
      def: withHair(
        {
          ...ADA,
          face: { ...decal, turn: 0.5 },
          gaitOverrides: { ...ADA.gaitOverrides, ...stance, ...arm, standOut: 0.05 },
        },
        'smoothBob',
      ),
    },
  ]
  return { ada }
})()

/** Round 3's bob: the kit's hair styles with a fringe and volume at the ear, against the helmet `smoothBob`, on Ada and on the builder's base woman. */
const round3hair = (() => {
  const base = (BASE[1] as { def: CharacterDef }).def
  const auburn = ADA.swatches?.auburn
  const woman: CharacterDef = {
    ...base,
    swatches: { ...base.swatches, ...(auburn === undefined ? {} : { auburn }) },
    default: 'test',
    outfits: {
      test: [
        { tee: 'ribCream', sleeves: 'short' },
        { jeans: 'denim' },
        { eyes: 'eyeBrown' },
        { hair: 'auburn', style: 'smoothBob' },
      ],
    },
  }
  const list = (def: CharacterDef, who: string): Variant[] => [
    { label: 'BEFORE', note: `${who}: the helmet bob (smoothBob)`, def: withHair(def, 'smoothBob') },
    {
      label: 'A',
      note: 'bobFringe: a fringe over the brow, volume at the ear',
      def: withHair(def, 'bobFringe'),
    },
    {
      label: 'B',
      note: 'bobFringeFull: more mass at the ear, a longer line',
      def: withHair(def, 'bobFringeFull'),
    },
    { label: 'C', note: 'bobFringeShort: to the jaw', def: withHair(def, 'bobFringeShort') },
  ]
  return { ada: list(ADA, 'Ada'), woman: list(woman, 'the base woman') }
})()

/**
 * Round 4: Ada's fringe, waistcoat and legs, one change at a time over round 3's adopted Ada.
 */
const round4ada = (() => {
  registerFashion()
  /**
   * A copy of the kit's bob in `style` with its fringe's lower edge at `fringe` on the skull (round 3's was 0.12) and/or its fall's
   * numbers replaced by `fall` (`length`, `volume`, ...), as a style of its own.
   */
  const restyled = (style: string, tweak: { fringe?: number; fall?: Record<string, unknown> }): string => {
    const name = `${style}@${JSON.stringify(tweak)}`
    const source = FASHION_HAIR[style]
    if (source === undefined) throw new Error(`no hair style ${style}`)
    HAIR_STYLES[name] ??= {
      ...source,
      pieces: source.pieces.map((piece) => {
        const { scalp, fall } = piece as { scalp?: { from: [number, number][] }; fall?: object }
        if (scalp !== undefined && tweak.fringe !== undefined) {
          const from = scalp.from.map(([angle, y], i): [number, number] => [
            angle,
            i < 3 ? (tweak.fringe ?? y) : y,
          ])
          return { scalp: { ...scalp, from } } as typeof piece
        }
        if (fall !== undefined && tweak.fall !== undefined)
          return { fall: { ...fall, ...tweak.fall } } as typeof piece
        return piece
      }),
    }
    return name
  }
  /** Ada with each outfit item that names a kind replaced by `patch[kind]` (merged into it), and her hair style replaced. */
  const dressed = (
    patch: {
      waistcoat?: Record<string, unknown>
      jeans?: Record<string, unknown>
      hair?: string
    },
    def: CharacterDef = ADA,
  ): CharacterDef => ({
    ...def,
    outfits: {
      street: (def.outfits.street ?? []).map((item) => {
        if ('waistcoat' in item && patch.waistcoat !== undefined) return { ...item, ...patch.waistcoat }
        if ('jeans' in item && patch.jeans !== undefined) return { ...item, ...patch.jeans }
        if ('hair' in item && patch.hair !== undefined) return { ...item, style: patch.hair }
        return item
      }) as never,
    },
  })
  /** `def` with its hips slider set to `hips` (0.2 was Ada's before round 4: the legs touch from the hip to the ankle). */
  const withHips = (def: CharacterDef, hips: number): CharacterDef => ({
    ...def,
    sliders: { ...def.sliders, hips },
  })
  /** Round 3's Ada: the fringe at the brow, a V of shirt and the neck closed, jeans tapered .7 with no gap, the hips slider at .2. */
  const before = dressed(
    {
      waistcoat: { open: 0, neckline: 0 },
      jeans: { taper: 0.7, gap: 0 },
      hair: restyled('bobFringeFull', { fringe: 0.12 }),
    },
    withHips(ADA, 0.2),
  )
  const ada: Variant[] = [
    {
      label: 'BEFORE',
      note: 'round 3: fringe on the eyes, a slit of shirt, neck closed, one block of leg',
      def: before,
    },
    {
      label: 'A (ADOPTED)',
      note: 'fringe over the brow (.3), the vest open on a strip of shirt, a lowered neckline, jeans cut to the leg with a gap, hips slider .9',
      def: ADA,
    },
    {
      label: 'B',
      note: 'A with the bob cut blunt at the nape (bobFringeBlunt): no tail down the back',
      def: dressed({ hair: 'bobFringeBlunt' }),
    },
    {
      label: 'C',
      note: 'A with a narrower strip of shirt (chest .3, hem .2)',
      def: dressed({ waistcoat: { chest: 0.3, hem: 0.2 } }),
    },
    {
      label: 'D',
      note: 'A with the legs together as before (hips slider .2): the hip row is 19, not 21, and the floor between the legs shuts',
      def: withHips(ADA, 0.2),
    },
  ]
  return { ada }
})()

/** Round 5: the night nurse, one change at a time over round 1's adopted data (her cut, the skirt and belt, is the Owner's and stays). */
const round5nurse = (() => {
  registerFashion()
  type Item = Record<string, unknown>
  /** The nurse with each outfit item of a kind merged with `patch[kind]`, and her gait overrides patched. */
  const nurse = (patch: Record<string, Item> = {}, gait: Record<string, number> = {}): CharacterDef => ({
    ...NIGHT_NURSE,
    gaitOverrides: { ...NIGHT_NURSE.gaitOverrides, ...gait },
    outfits: {
      uniform: (NIGHT_NURSE.outfits.uniform ?? []).map((garment) => {
        const item = garment as unknown as Item
        const kind = Object.keys(item)[0] as string
        return (patch[kind] === undefined ? item : { ...item, ...patch[kind] }) as never
      }),
    },
  })
  /** The nurse as round 1 left her: the crown cap and the long fall behind. */
  const before = nurse({ hair: { style: 'fallLong' }, cap: { style: 'nurse' } })
  const hidden = { hair: { style: 'fallCurtain' }, cap: { style: 'nurseBrow' } }
  const variants: Variant[] = [
    {
      label: 'BEFORE',
      note: 'round 1: her cap a bowl on the crown, her face a blank mask under it',
      def: before,
    },
    {
      label: 'A (ADOPTED)',
      note: 'her hair over her face to the mouth (fallCurtain), her cap flat and low on the brow (nurseBrow)',
      def: NIGHT_NURSE,
    },
    {
      label: 'B',
      note: 'A with her arms hung closer and forward (armOut .03, standElbow .3)',
      def: nurse(hidden, { armOut: 0.03, standElbow: 0.3 }),
    },
    {
      label: 'C',
      note: 'A with a skirt close at the waist (ease .5): the waist row is 18, not 20 (her cut is for the Owner)',
      def: nurse({ ...hidden, skirt: { ease: 0.5 } }),
    },
    {
      label: 'D',
      note: 'A with only the cap changed back: her hair over her face under a bowl cap',
      def: nurse({ ...hidden, cap: { style: 'nurse' } }),
    },
    {
      label: 'E',
      note: 'A with long sleeves (the old file says short; the old pictures show the sleeve to the wrist and no skin on the forearm)',
      def: nurse({ ...hidden, top: { sleeves: 'long' } }),
    },
  ]
  return { nurse: variants }
})()

export const LOOKS: Readonly<Record<string, readonly Variant[]>> = {
  'round4-ada': round4ada.ada,
  'round5-nurse': round5nurse.nurse,
  'round1-ada': round1.ada,
  'round1-nurse': round1.nurse,
  'round2-ada': round2.ada,
  'round2-vest': round2vest.pair,
  'round3-nurse': round3.nurse,
  'round3-ada': round3ada.ada,
  'round3-hair-ada': round3hair.ada,
  'round3-hair-woman': round3hair.woman,
}
