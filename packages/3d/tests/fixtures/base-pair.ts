// The base pair: one man and one woman, the figures every character starts from, judged on every change to the body.
// Only sliders (the same numbers as the builder's base pair); a test dresses them with `figureOf`.

import type { Sliders } from '#src/features/figures/body/genes.ts'

/** Shared by both: hero proportions, some six heads tall, a pixel build that keeps wrists and ankles legible. */
const shared: Partial<Sliders> = {
  head: 1.15,
  chunk: 0.85,
  legs: 0.5,
  posture: 0.75,
  age: 0.25,
  headTilt: 0,
  neck: 0.6,
  neckLength: 0.4,
  hands: 0.5,
  feet: 0.55,
  faceForward: 0.6,
}

export const BASE_PAIR: Readonly<Record<'man' | 'woman', Partial<Sliders>>> = {
  man: {
    ...shared,
    frame: 0.1,
    height: 178,
    muscle: 0.55,
    fat: 0.25,
    shoulders: 0.6,
    hips: 0.4,
    arms: 0.5,
    face: {
      width: 0.55,
      jaw: 0.65,
      chin: 0.6,
      cheekHeight: 0.5,
      cheekWidth: 0.5,
      bridge: 0.55,
      nose: 0.5,
      lips: 0.45,
      browArch: 0.2,
      browWeight: 0.65,
      browHeight: 0.3,
      crease: 0.6,
      hood: 0.15,
      liner: 0.5,
    },
  },
  woman: {
    ...shared,
    frame: 0.95,
    height: 166,
    muscle: 0.35,
    fat: 0.35,
    shoulders: 0.3,
    hips: 0.65,
    arms: 0.35,
    face: {
      width: 0.45,
      jaw: 0.3,
      chin: 0.5,
      cheekHeight: 0.7,
      cheekWidth: 0.6,
      bridge: 0.45,
      nose: 0.45,
      lips: 0.7,
      browArch: 0.6,
      browWeight: 0.4,
      browHeight: 0.45,
      crease: 0.4,
      hood: 0.35,
      liner: 0,
    },
  },
}
export const BASE_IDS = ['man', 'woman'] as const
