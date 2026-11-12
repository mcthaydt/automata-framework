// The waistcoat's default moved (round 2): `fit` 0.6 and `armhole` 0.5 where the cut was a uniform 1.6 clearances with no armhole. The
// legacy cut is `fit: 0, armhole: 0` (a clearance of 1.6 at every ring, the same hem), so this sheet puts it beside the default on
// the figure builder's own base pair, in a cream tee and jeans: the only figures in the kit that wear one.
import {
  BASE,
  type CharacterDef,
} from '../../../../extensions/character-kit/src/shared/figure-builder/door.ts'

interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
  readonly against?: string
}

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

export const pair: Variant[] = BASE.flatMap((member) => [
  {
    label: `${member.def.id} BEFORE`,
    note: 'the legacy cut (fit 0, armhole 0)',
    def: vest(member.def, { fit: 0, armhole: 0 }),
  },
  {
    label: `${member.def.id} NOW`,
    note: 'the default (fit 0.6, armhole 0.5)',
    def: vest(member.def, {}),
    against: `${member.def.id} BEFORE`,
  },
])
