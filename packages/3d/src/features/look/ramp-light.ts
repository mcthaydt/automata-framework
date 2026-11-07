// Ramp light, on the CPU: light moves a palette colour whole steps along its own DUEL ramp (the pixel artist's ramp
// light). Light 1 leaves a colour as it is; each step of the look's `steps` below 1 is one ramp step darker and each
// above it one lighter, stopping at the ramp's ends. The material's lighting bit cuts light into the same steps on the
// GPU, so a texture's colour and a lit surface agree (`ramp-light-material.ts`).

import { step } from '@automata/content/palette'
import type { Look } from './look.schema.ts'

/** How far light is from 1, in whole steps: the look cuts 0 to 1 into `steps - 1` intervals. */
export const lightSteps = (light: number, look: Look): number => Math.round((light - 1) * (look.steps - 1))

/** The palette index of `index` under `light`. */
export function rampLit(index: number, light: number, look: Look): number {
  return step(index, lightSteps(light, look))
}
