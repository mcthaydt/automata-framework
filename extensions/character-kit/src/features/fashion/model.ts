// The pieces both casts are written with: a cast member, the face every model shares, the eyes and the base pair's proportions.
import type { CharacterDef, Garment } from '../../shared/figure-builder/door.ts'

/** One character of a cast: who, the library stand it holds standing (a key of the builder's `POSES`, where it has one), and a line on it.
 * The showcase's `Model` also names an outfit; here every runway model wears the one called `runway`, so no field says so. */
export interface Model {
  readonly def: CharacterDef
  readonly pose?: string
  readonly about: string
}

export const face = { camera: 0.6, turn: 0.1, blink: 3.7, drawn: true }
export const eyes = (eyes: string, brows: string, lips: string): Garment => ({
  eyes,
  lids: 'lidDeep',
  white: 'eyeWhite',
  brows,
  lips,
})
/** The base pair's JRPG proportions, shared by everyone here unless they push them. */
export const shared = {
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
