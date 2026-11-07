// The base pair's sliders, from core's pair (`@automata/3d/base`): the bodies the tests judge every change to the body on.
// A test dresses them with `figureOf`.

import type { Sliders } from '#src/features/figures/body/genes.ts'
import { BASE_PAIR as PAIR } from '#src/features/figures/base/base-pair.ts'

export const BASE_PAIR: Readonly<Record<'man' | 'woman', Partial<Sliders>>> = {
  man: PAIR.man.sliders,
  woman: PAIR.woman.sliders,
}
export const BASE_IDS = ['man', 'woman'] as const
