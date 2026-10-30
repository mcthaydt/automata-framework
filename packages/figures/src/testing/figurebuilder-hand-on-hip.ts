// Where FigureBuilder's `handOnHip` stand places a hand on the hip, for Wick's and the keeper's sliders: the
// fixture `hands-on-hips` pose is checked against these (pose-library.test.ts).
//
// Source: FigureBuilder (mcthaydt/FigureBuilder) at a1f7246, src/render/figure/motion.ts `place(s, side, p)`
// with `p` the stand's right hand in library/poses.json (`{ at: "hip", elbow: 0.8, nudge: [0.01, -0.02, -0.12] }`)
// for each side, on `skeleton(measure(sliders).genes)` from its genes.ts and rig.ts, undressed (no surface).
// `place()` returns the wrist in the pelvis bone's rest frame (`hand: wrist − rest[pelvis]`); with the pelvis at
// rest that frame is the root's moved up by the pelvis's rest position, so the values below are
// `(rest[pelvis] + hand) / k` in figure units (k = height / 1.62), printed to 6 decimals. Run once with Node 24
// over FigureBuilder's TypeScript (a resolve hook adding `.ts` to its relative imports); the script is in the
// M3.6b plan's execution log.

import type { Vec3 } from '../solve/targets'

export interface PlacedHands {
  /** The pelvis joint's rest position in figure units, as FigureBuilder's skeleton has it. */
  readonly pelvis: Vec3
  readonly handL: Vec3
  readonly handR: Vec3
}

export const FIGUREBUILDER_HAND_ON_HIP: Readonly<Record<'wick' | 'keeper', PlacedHands>> = {
  wick: {
    pelvis: [0, 0.83745, 0],
    handL: [0.192469, 0.83245, -0.171543],
    handR: [-0.192469, 0.83245, -0.171543],
  },
  keeper: {
    pelvis: [0, 0.914302, 0],
    handL: [0.189087, 0.819302, -0.170765],
    handR: [-0.189087, 0.819302, -0.170765],
  },
}
