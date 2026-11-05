import { lerp } from '../../lib/math';
import type { Genes } from './rig';
/**
 * Gene sliders: a figure is designed from a few normalised sliders, and one generator turns them into a skeleton and
 * a body, so every character gets sound proportions and a new one is a handful of numbers. Sliders run 0–1; a little past either end is allowed, for the
 * figures that are meant to look wrong.
 */
export interface Sliders {
  /** 0 masculine … 1 feminine. */
  frame: number;
  /** Standing height in centimetres. */
  height: number;
  muscle: number; fat: number;
  shoulders: number; hips: number;
  legs: number; arms: number;
  head: number;
  /** Neck thickness, and (an extra slider) its length. */
  neck: number; neckLength: number;
  hands: number; feet: number;
  /** 0 slouch … 1 proud. */
  posture: number;
  /** 0 young … 1 old: a stoop and a slower gait. */
  age: number;
  /** The head's tilt to one side, in degrees. */
  headTilt: number;
  /** 0 a life-drawn build … 1 a pixel-art build: the head a little bigger, the neck shorter, limbs, hands and feet a
   * little thicker, so the figure still reads at 60 texels tall. */
  chunk: number;
  /** 0 the face flush with the cranium … 1 the face well forward of it (half the head's half-depth), as a profile shows. */
  faceForward: number;
  /** 0 square shoulders … 1 a hunch: the shoulders up and rounded forward, the head sunk forward between them. */
  hunch: number;
  /** The head's own structure (HeadShape); left out, an average head. */
  face?: Partial<HeadShape>;
}
/**
 * The head's structure, 0–1 each (0.5 the average): the bones and features that make four heads four people. Eyes are
 * never among them: every face's eyes are one size and drawn one way, differing only in the lid line.
 */
export interface HeadShape {
  /** The face's width under the cranium (0 narrow … 1 broad), and the jaw's at its angle (0 tapered … 1 square). */
  width: number; jaw: number;
  /** 0 a short, soft chin … 1 a long, strong one. */
  chin: number;
  /** The cheekbones: how high on the face (0 low … 1 high) and how far they stand out (0 flat … 1 prominent). */
  cheekHeight: number; cheekWidth: number;
  /** The nose: the bridge's height in profile (0 low … 1 high), and its width at the nostrils (0 narrow … 1 broad). */
  bridge: number; nose: number;
  /** The lips: 0 fine … 1 full. */
  lips: number;
  /** The brows: their arch (0 straight … 1 arched), weight (0 fine … 1 heavy) and height over the eye (0 low … 1 high). */
  browArch: number; browWeight: number; browHeight: number;
  /** The upper lid: its crease (0 a smooth lid … 1 a deep crease), how heavy it sits (0 open … 1 hooded), and liner (0
   * none … 1 a flick past the outer corner). */
  crease: number; hood: number; liner: number;
}
export const DEFAULT_HEAD: HeadShape = {
  width: 0.5, jaw: 0.5, chin: 0.5, cheekHeight: 0.5, cheekWidth: 0.5, bridge: 0.5, nose: 0.5, lips: 0.5,
  browArch: 0.4, browWeight: 0.5, browHeight: 0.5, crease: 0.5, hood: 0.3, liner: 0,
};
export const DEFAULT_SLIDERS: Sliders = {
  frame: 0.5, height: 170, muscle: 0.5, fat: 0.4, shoulders: 0.5, hips: 0.5, legs: 0.5, arms: 0.5, head: 0.6,
  neck: 0.5, neckLength: 0.4, hands: 0.5, feet: 0.5, posture: 0.5, age: 0.3, headTilt: 0, chunk: 1, faceForward: 0.7, hunch: 0,
};
/** Everything the body and the garments need, in metres. */
export interface Measure {
  sliders: Sliders;
  /** The rig's genes (src/features/body/rig.ts). */
  genes: Genes;
  /** Height over the reference height, 1.62 m: how the small fixed details scale. */
  k: number;
  /** Limb, torso-depth, chest-width, waist and hand factors. */
  thick: number; depth: number; chest: number; waist: number; hand: number;
  /** The pixel-art build's extra thickness of the arms and the legs, and the feet's size (the chunk slider). */
  arm: number; leg: number; foot: number;
  /** The head's structure. */
  face: HeadShape;
}
export function measure(input: Partial<Sliders>): Measure {
  const s = { ...DEFAULT_SLIDERS, ...input }, H = s.height / 100, f = s.frame, k = H / 1.62, c = s.chunk;
  const genes: Genes = {
    height: H,
    // Sprite heads: a little larger than life, so a face reads at 10 texels, but a model's: some six and a half heads tall.
    head: H * lerp(0.11, 0.16, s.head) * lerp(1, 1.05, c), headWidth: lerp(0.76, 0.68, f) * (1 + 0.08 * s.fat) * lerp(1, 1.06, c), headDepth: 0.84,
    // A neck that shows between the jaw and the collarbones.
    neck: H * lerp(0.02, 0.07, s.neckLength) * lerp(1, 0.9, c),
    shoulders: H * lerp(0.07, 0.104, s.shoulders) * lerp(1.05, 0.95, f) * (1 + 0.1 * s.muscle) * lerp(1, 1.12, c),
    hips: H * lerp(0.045, 0.065, s.hips) * lerp(0.95, 1.08, f),
    // Long legs: a model's hip joint sits past half her height.
    legs: lerp(0.48, 0.56, s.legs) * lerp(1, 0.98, c),
    arms: H * lerp(0.29, 0.42, s.arms), forearm: 0.47,
    ankle: 0.075 * k * lerp(1, 1.1, c), foot: H * lerp(0.13, 0.165, s.feet) * lerp(1, 1.08, c),
    build: lerp(0.82, 1.18, s.muscle) * (1 + 0.25 * s.fat) * lerp(1.04, 0.96, f),
    posture: lerp(0.22, -0.05, s.posture) + 0.12 * s.age,
    headTilt: s.headTilt * Math.PI / 180,
    headPitch: lerp(0.15, -0.04, s.posture) + 0.08 * s.age,
    faceAhead: lerp(0, 0.5, s.faceForward),
    hunch: s.hunch,
  };
  return {
    sliders: s, genes, k,
    thick: genes.build, depth: (1 + 0.35 * s.fat) * lerp(1, 1.12, f), chest: lerp(1.0, 0.95, f) * (1 + 0.1 * s.muscle),
    waist: lerp(1.05, 0.9, f) * (1 + 0.4 * s.fat) * lerp(1, 1.06, c), hand: lerp(0.85, 1.3, s.hands) * lerp(1, 1.12, c),
    // The pixel build thickens limbs only as far as a wrist and an ankle still read at 64 texels; their shape is the body's.
    arm: lerp(1, 1.3, c), leg: lerp(1, 1.2, c), foot: lerp(1, 1.25, c),
    face: { ...DEFAULT_HEAD, ...s.face },
  };
}
