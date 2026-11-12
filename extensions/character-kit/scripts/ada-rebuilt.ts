// Ada rebuilt from the ground up (round 8): the builder's base woman, set to the generated images' look spec (`ada-look-spec.md`), not
// today's cast entry. Data only: sliders, genes, a face shape, hair, an outfit and swatches. It is a study: the game's cast file is
// unchanged, and the Owner picks whether this replaces it.
import { ADA_SWATCHES } from '../../../games/the-last-light/src/features/figures/old-swatches.ts'
import { BASE, type CharacterDef } from '../src/shared/figure-builder/door.ts'

type Swatches = NonNullable<CharacterDef['swatches']>

/** The base woman's own character file: the figure every character starts from. */
export const BASE_WOMAN: CharacterDef = (BASE[1] as { def: CharacterDef }).def

/** The reference's cloths in DUEL steps: the turnaround's oxblood waistcoat and its greyer, fainter denim (the old swatches are brighter). */
export const REF_SWATCHES: Swatches = {
  ...ADA_SWATCHES,
  oxblood: { ramp: 19, base: 1, lift: 0, paint: ['#662b29', '#49251c', '#372423', '#2e1026'] },
  washedDenim: { ramp: 7, base: 1, paint: ['#626871', '#48474d', '#2e3d47', '#181f2f'] },
}

export const patch = (...parts: Partial<CharacterDef>[]): CharacterDef =>
  Object.assign({}, ...parts) as CharacterDef

/** The base woman with Ada's name, her skin, her swatches and her clothes, and nothing else changed: the starting point of the rebuild. */
export const FROM_BASE: CharacterDef = patch(BASE_WOMAN, {
  id: 'ada',
  name: 'Ada Voss',
  skin: 'fair',
  swatches: REF_SWATCHES,
  outfits: {
    street: [
      { top: 'cream', sleeves: 'long', cuffs: 'cream' },
      { waistcoat: 'oxblood', fit: 1, length: 0.05, armhole: 1, open: 1, chest: 0.4, hem: 0.3, neckline: 1 },
      { jeans: 'washedDenim', taper: 1, gap: 1 },
      { shoes: 'bootBrown', sole: 'bootSole', boots: true },
      { hair: 'auburn', style: 'bobFringeFull' },
      { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'auburn', lips: 'lipsWarm' },
    ],
  },
  default: 'street',
})

/** One version of Ada: what it is called on the sheet, what differs, and its data. */
export interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
}

/** `FROM_BASE` with these sliders, genes and face laid over its own. */
export function adaOf(
  sliders: Record<string, number>,
  rest: {
    genes?: Record<string, number>
    face?: Record<string, number>
    gait?: Record<string, number>
    more?: Partial<CharacterDef>
  } = {},
): CharacterDef {
  return patch(FROM_BASE, rest.more ?? {}, {
    sliders: { ...FROM_BASE.sliders, ...sliders, face: { ...(FROM_BASE.sliders.face ?? {}), ...rest.face } },
    genes: { ...FROM_BASE.genes, ...rest.genes },
    gaitOverrides: { ...(FROM_BASE.gaitOverrides ?? {}), ...rest.gait },
  })
}

/** The first reading: the base woman set to the spec's proportions (7 heads, legs half her height, a slim adult), the face still the base's. */
export const ADA_PROPORTIONS = {
  height: 162,
  fat: 0.1,
  chunk: 0,
  muscle: 0.3,
  legs: 0.38,
  head: 0.45,
  hips: 0.3,
  frame: 0.95,
  neckLength: 0.25,
  posture: 0.9,
  shoulders: 0.4,
}

/** The face of the turnaround: a small oval, a soft chin, big almond eyes under a thin soft brow with a dark upper lash line, a small nose and mouth. */
export const REF_FACE = {
  width: 0.5,
  jaw: 0.2,
  chin: 0.4,
  cheekHeight: 0.6,
  cheekWidth: 0.4,
  bridge: 0.4,
  nose: 0.3,
  lips: 0.45,
  browArch: 0.5,
  browWeight: 0.2,
  browHeight: 0.5,
  crease: 0.3,
  hood: 0.1,
  liner: 0.45,
  eyeSize: 0.7,
  eyeSpacing: 0.5,
  eyeTilt: 0.5,
}

/** The outfit of the turnaround: a cream shirt with its sleeves rolled (a short sleeve and a thick cuff), the oxblood waistcoat with a V of shirt. */
export const REF_OUTFIT = [
  { top: 'cream', sleeves: 'short', cuffs: 'cream' },
  { waistcoat: 'oxblood', fit: 1, length: 0.05, armhole: 1, open: 1, chest: 0.5, hem: 0.1, neckline: 0.5 },
  { jeans: 'washedDenim', taper: 1, gap: 1 },
  { shoes: 'bootBrown', sole: 'bootSole', boots: true },
  { hair: 'auburn', style: 'bobFringeFull' },
  { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'auburn', lips: 'lipsWarm' },
]

const dressed = { outfits: { street: REF_OUTFIT as never } }

export const LOOKS: Readonly<Record<string, readonly Variant[]>> = {
  'round8-ada': [
    {
      label: 'A',
      note: "the base woman at the spec's proportions, the base's face and the first outfit",
      def: adaOf(ADA_PROPORTIONS),
    },
    {
      label: 'B',
      note: "A with the turnaround's face (a small oval, big almond eyes, thin brows, a dark lash line), rolled sleeves and a V-fronted waistcoat (an open strip, wide at the neck, narrowing to a point)",
      def: adaOf(ADA_PROPORTIONS, { face: REF_FACE, more: dressed }),
    },
    {
      label: 'C',
      note: 'B with a smaller head (head slider .3: more of her is body, 7.4 heads)',
      def: adaOf({ ...ADA_PROPORTIONS, head: 0.3 }, { face: REF_FACE, more: dressed }),
    },
    {
      label: 'D (ADOPTED)',
      note: "B after the coordinator's read: lighter faded denim (DUEL steps #828b98, #626871 over the old #626871, #48474d), the tail-less bob (`bobFringeBlunt`), no lip mark, the arms closer (`armOut` and `standOut` .03), an ankle boot (the kit's new `shaft` .25), a short V (the kit's new `vend` .45)",
      def: adaOf(ADA_PROPORTIONS, {
        face: REF_FACE,
        gait: { armOut: 0.03, standOut: 0.03 },
        more: {
          swatches: {
            ...REF_SWATCHES,
            washedDenim: { ramp: 7, base: 1, paint: ['#828b98', '#626871', '#434549', '#2e3d47'] },
          },
          outfits: {
            street: REF_OUTFIT.map((item) =>
              'hair' in item
                ? { hair: 'auburn', style: 'bobFringeBlunt' }
                : 'waistcoat' in item
                  ? { ...item, vend: 0.45 }
                  : 'shoes' in item
                    ? { ...item, shaft: 0.25 }
                    : 'eyes' in item
                      ? { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'auburn' }
                      : item,
            ) as never,
          },
        },
      }),
    },
  ],
}
