// The candidates of the density-2 Ada study: each is data over the base woman (the painter's clean build and her face), with only
// what makes her Ada changed: her skin, her hair, her clothes. The adopted one is what the game's cast file takes.
import { ADA } from '../../../games/the-last-light/src/features/figures/cast.ts'
import type { CharacterDef } from '../src/entries/index.ts'
import { registerFashion } from '../src/features/fashion/register-fashion.ts'
import { BASE, HAIR_STYLES } from '../src/shared/figures/door.ts'

registerFashion()
const baseWoman = (BASE[1] as { def: CharacterDef }).def
const painterBob = HAIR_STYLES.bobFringe as { pieces: unknown[] }
/** The painter's bob with the fringe's lower edge at height `h` (the painter's own is 0.5 at the front, and sits on the brows). */
const fringeAt = (h: number) => ({
  ...painterBob,
  pieces: painterBob.pieces.map((p) =>
    typeof p === 'object' && p !== null && 'fringe' in p
      ? {
          fringe: {
            ...(p as { fringe: object }).fringe,
            from: [
              [0, h],
              [0.7, h - 0.05],
              [1.1, 0.3],
            ],
          },
        }
      : p,
  ),
})
;(HAIR_STYLES as Record<string, unknown>).study55 = fringeAt(0.55)

const clothes = (ADA.outfits.street ?? []).filter((i) => !('hair' in i) && !('eyeMarks' in i))
const face = (brows: string) => ({
  eyes: 'eyeBrown',
  lids: 'lidDeep',
  white: 'eyeWhite',
  brows,
  lips: 'lipsWarm',
})
const asAda = (
  sliders: Record<string, unknown>,
  faceSliders: Record<string, number>,
  brows: string,
  hair: string,
  jeans: Record<string, unknown> = {},
): CharacterDef =>
  ({
    ...baseWoman,
    id: 'ada',
    name: 'Ada Voss',
    skin: 'skinWarm',
    swatches: {
      ...ADA.swatches,
      browDark: { ramp: 2, base: 3, flat: true, paint: ['#372423', '#2b1a1c', '#2b1a1c', '#2b1a1c'] },
    },
    gait: 'brisk',
    gaitOverrides: ADA.gaitOverrides,
    hair: ADA.hair,
    default: 'street',
    sliders: {
      ...baseWoman.sliders,
      height: 160,
      ...sliders,
      face: { ...baseWoman.sliders.face, ...faceSliders },
    },
    outfits: {
      street: [
        ...clothes.map((i) => ('jeans' in i ? { ...i, ...jeans } : i)),
        { hair: 'auburn', style: hair },
        face(brows),
      ],
    },
  }) as CharacterDef

const BOLD = { browWeight: 0.75, crease: 0.6, hood: 0.05, liner: 0.5, eyeSize: 0.8, lips: 0.8 }

export const CANDIDATES: Record<string, CharacterDef> = {
  today: ADA,
  /** The base woman's own face, her bob's fringe as the painter has it (it sits on the brows), brows auburn. */
  base: asAda({}, {}, 'auburn', 'bobFringe'),
  /** The base man's lids and brows (crease .6, hood .15, liner .5), a darker brow, the fringe a little higher. */
  bold: asAda({}, { ...BOLD, hood: 0.15, browWeight: 0.8, eyeSpacing: 0.55 }, 'browDark', 'study55'),
  adopted: asAda({ fat: 0.25, hips: 0.55, arms: 0.3, chunk: 0.6, muscle: 0.3 }, BOLD, 'browDark', 'study55', {
    taper: 1,
    gap: 0.6,
  }),
}
