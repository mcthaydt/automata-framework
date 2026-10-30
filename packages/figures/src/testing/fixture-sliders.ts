// The sliders of the two fixture figures (testing/fixtures/content/figures/*.toml), for tests that need a
// skeleton without compiling content. figures-content.test.ts checks the TOML files say the same.

import type { Sliders } from '../genes/genes'

/** Wick, Emberwick's hero (games/emberwick/src/art/sprites.ts): small, a big head, short legs, a pixel build. */
export const WICK_SLIDERS: Partial<Sliders> = {
  height: 120,
  head: 1,
  chunk: 1,
  frame: 0.4,
  legs: 0.2,
  arms: 0.3,
  shoulders: 0.4,
  hips: 0.45,
  muscle: 0.4,
  fat: 0.3,
  neckLength: 0.1,
  posture: 0.6,
  age: 0.1,
  faceForward: 0.5,
  hands: 0.6,
  feet: 0.6,
}

/** The keeper, an old lamplighter: tall, long legs and arms, a hunch, a slighter pixel build. */
export const KEEPER_SLIDERS: Partial<Sliders> = {
  height: 186,
  frame: 0.2,
  legs: 0.75,
  arms: 0.85,
  shoulders: 0.6,
  head: 0.4,
  neckLength: 0.6,
  posture: 0.2,
  age: 0.85,
  hunch: 0.4,
  chunk: 0.6,
  muscle: 0.3,
  fat: 0.2,
}
