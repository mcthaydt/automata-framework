// The headwear a painted `cap` can wear, from the old game's `src/render/figure/library/headwear.json` (92e6704): each is a few
// rounded pieces laid on the head in head units (a width, a height and a depth of the head each, plus a share of the figure's
// height `rk`), and the mark a style may carry on its crown. The pieces are drawn as parts on the head bone; the hair goes under
// them (`coversHair`).

/** One rounded piece of headwear: where it sits and how big, in head units (x by the head's half-width, y by its height, z by its half-depth). */
export interface HeadPiece {
  readonly at: readonly [number, number, number]
  readonly r: readonly [number, number, number]
  /** Extra radius as a share of the figure's height (k), so a thin band keeps a body whatever the head. */
  readonly rk?: readonly [number, number, number]
  readonly e?: readonly [number, number]
  readonly taper?: readonly [number, number]
  /** Pitch about the head's x axis, radians. */
  readonly pitch?: number
}

/** The mark a style carries (a nurse's cross): where, which way it faces, and its sizes in texels. */
export interface HeadMark {
  readonly at: readonly [number, number, number]
  readonly atk?: readonly [number, number, number]
  readonly normal: readonly [number, number, number]
  readonly sizes?: readonly (readonly [number, number])[]
}

export interface Headwear {
  readonly pieces: readonly HeadPiece[]
  readonly mark?: HeadMark
}

export const HEADWEAR: Readonly<Record<string, Headwear>> = {
  // A nurse's cap: a stiff band across the crown, its face to the front. Its cross sits on the top, facing up and forward.
  nurse: {
    pieces: [
      {
        at: [0, 1.02, 0.2],
        r: [1.2, 0, 0.62],
        rk: [0, 0.075, 0],
        e: [0.3, 0.4],
        taper: [1, 0.88],
        pitch: 0.3,
      },
    ],
    mark: {
      at: [0, 1.02, 0.5],
      atk: [0, 0.055, 0],
      normal: [0, 0.9, 0.45],
      sizes: [
        [1, 3],
        [3, 1],
      ],
    },
  },
  // A peaked service cap: a band, a flat crown a little wider than it and a stiff visor over the brow.
  peakedCap: {
    pieces: [
      { at: [0, 0.86, -0.08], r: [1.12, 0.12, 1.06], e: [0.4, 0.6] },
      { at: [0, 0.97, -0.04], r: [1.26, 0.06, 1.2], e: [0.3, 0.6], taper: [1, 0.9] },
      { at: [0, 0.76, 1.02], r: [0.85, 0.028, 0.42], e: [0.3, 0.7], pitch: 0.12 },
    ],
    mark: { at: [0, 0.88, 1.0], normal: [0, 0.2, 1], sizes: [[2, 2]] },
  },
  // A flat cap: the crown, and the peak over the brow.
  flat: {
    pieces: [
      { at: [0, 0.84, -0.1], r: [1.2, 0.19, 1.2], e: [0.55, 0.75], taper: [0.92, 1] },
      { at: [0, 0.76, 1], r: [1, 0.045, 0.5], e: [0.3, 0.7] },
    ],
    mark: { at: [0, 0.9, 1.2], normal: [0, 0.3, 1] },
  },
}
