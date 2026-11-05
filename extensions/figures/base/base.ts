/**
 * The base pair: one man and one woman, the figure every character starts from. Each is only data (sliders and names
 * from the library). They wear no garments: a top and shorts painted on the body (modest blocks of two plain greys,
 * with no cloth of their own), barefoot, so the body, the face and the painter are judged and not the clothes. Every
 * visual change is judged on these two.
 */
import type { CharacterDef } from '../src/features/figure/cast';
import type { Garment } from '../src/features/outfit/garments';

/** A base figure: its character file, and the library stand its lookbook hero is drawn in (library/poses.json; none:
 * the gait's relaxed stand). */
export interface BaseFigure { def: CharacterDef; pose?: string }

/** Shared by both: JRPG hero proportions, some six heads tall (a large head, a pixel build that keeps wrists and ankles
 * legible), a proud posture, an average age. */
const shared = { head: 1.15, chunk: 0.85, legs: 0.5, posture: 0.75, age: 0.25, headTilt: 0, neck: 0.6, neckLength: 0.4, hands: 0.5, feet: 0.55, faceForward: 0.6 };
const face = { camera: 0.6, turn: 0.1, blink: 3.7, drawn: true };
/** The blocks both wear: a top over the chest and the waist, shorts over the hips and thighs, painted on. */
const blocks: Garment[] = [{ top: 'flatGrey', sleeves: 'none' }, { shorts: 'charcoal' }];

export const BASE: BaseFigure[] = [
  {
    def: {
      id: 'base-m', name: 'BASE M', skin: 'skinWarm', gait: 'loose', hand: 'R', face, default: 'base',
      sliders: {
        ...shared, frame: 0.1, height: 178, muscle: 0.55, fat: 0.25, shoulders: 0.6, hips: 0.4, arms: 0.5,
        face: { width: 0.55, jaw: 0.65, chin: 0.6, cheekHeight: 0.5, cheekWidth: 0.5, bridge: 0.55, nose: 0.5, lips: 0.45, browArch: 0.2, browWeight: 0.65, browHeight: 0.3, crease: 0.4, hood: 0.35, liner: 0 },
      },
      outfits: { base: [
        ...blocks,
        { hair: 'hairBlack', style: 'shortFade' },
        { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsWarm' },
      ] },
    },
    pose: 'armsCrossed',
  },
  {
    def: {
      id: 'base-f', name: 'BASE F', skin: 'skinBrown', gait: 'bounce', hand: 'R', face, default: 'base',
      sliders: {
        ...shared, frame: 0.95, height: 166, muscle: 0.35, fat: 0.35, shoulders: 0.3, hips: 0.65, arms: 0.35,
        face: { width: 0.45, jaw: 0.3, chin: 0.5, cheekHeight: 0.7, cheekWidth: 0.6, bridge: 0.45, nose: 0.45, lips: 0.7, browArch: 0.6, browWeight: 0.4, browHeight: 0.45, crease: 0.6, hood: 0.15, liner: 0.5 },
      },
      outfits: { base: [
        ...blocks,
        { hair: 'hairBraid', style: 'boxBraidPony' },
        { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsBrown' },
      ] },
      hair: { stiff: 55, damp: 8, trail: 0.35, bounce: 0.08 },
    },
    pose: 'handOnHip',
  },
];
