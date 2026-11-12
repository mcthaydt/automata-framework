// The runway's hair: one finish (H4, `registerFinish`) and twelve styles built only from the builder's own pieces (scalp
// shells, rows, tails, falls, a bun: no piece of the kit's own, so H3 is not used). Data only. Ported from FigureBuilder's
// `claude/runway-video` (`demo/runway/library.ts`, `cb4aa9f`), which is `claude/demo-characters` `8fb0242` plus the styles
// that hang.
import type { HairFinish, HairStyle } from '../../shared/figure-builder/door.ts'

/** A smooth finish: straight hair with a gloss, the key reaching down its form further than a coil's. */
export const SILK: HairFinish = { tones: [0.6, 0.15, -0.55], matte: false }

/** The hairline round the head (angle from the front, height on the skull): a natural one at the brow and temples. */
const line = [
  [0, 0.62],
  [0.5, 0.58],
  [0.8, 0.4],
  [1.15, 0.0],
  [1.3, -0.12],
  [1.5, 0.1],
  [1.9, 0.0],
  [2.5, -0.45],
  [3.1416, -0.6],
]
/** The line the hair that hangs starts from, and the crown it all shares. */
const hang = [
  [0, 0.62],
  [0.7, 0.4],
  [1.5, 0.0],
  [2.3, -0.35],
  [3.1416, -0.5],
]
/** Where a fringe's lower edge sits on the skull: over the eye row, a row of the brow's skin between (0.2 sat on a texel's edge, and a sub-texel move of the head put hair back on the eyes). Lower (0.12) and the fringe's dark band sits on the eyes at the
 *  play size, so the front view reads as a brow band with no eyes; 0.4 and over leaves it a few texels of the front. */
const FRINGE = 0.3
/** A hairline with a fringe: the brow's height (0.62) brought down across the front to `FRINGE`, the sides and the back as the natural line has them. */
const fringeLine = [
  [0, FRINGE],
  [0.5, FRINGE],
  [0.85, FRINGE],
  [1.15, 0.0],
  [1.3, -0.12],
  [1.5, 0.1],
  [1.9, 0.0],
  [2.5, -0.45],
  [3.1416, -0.6],
]
/** The line the hair that hangs starts from, lifted at the back: the fall ends at the nape, in a blunt hem, instead of hanging down it in a tail. */
const hangHigh = [
  [0, 0.62],
  [0.7, 0.4],
  [1.5, 0.0],
  [2.3, -0.2],
  [3.1416, -0.2],
]
/** A hairline that comes down over the face: the front at the mouth (-0.55), the sides and the back as the natural line has them. */
const curtainLine = [
  [0, -0.55],
  [0.5, -0.55],
  [0.85, -0.55],
  [1.15, 0.0],
  [1.3, -0.12],
  [1.5, 0.1],
  [1.9, 0.0],
  [2.5, -0.45],
  [3.1416, -0.6],
]
const crown = {
  scalp: {
    from: line,
    lift: 0.06,
    edge: 0.4,
    crown: 0.03,
    comb: 'back',
    sheen: { count: 12, from: 0.4, to: 0.95 },
  },
}

export const FASHION_HAIR: Readonly<Record<string, HairStyle>> = {
  sleekPony: {
    about:
      'Long straight hair drawn smoothly back from a soft hairline into a low tail that falls past the shoulder blades, glossy in a band along the comb.',
    finish: 'silk',
    pieces: [
      {
        scalp: {
          from: line,
          lift: 0.07,
          edge: 0.4,
          crown: 0.04,
          comb: 'back',
          sheen: { count: 12, from: 0.35, to: 0.9 },
        },
      },
      {
        tail: {
          at: [0, 0.7, -0.7],
          count: 7,
          rope: { r: 0.2, flat: 0.5, ridges: [3, 0.03], tip: 'point', taper: 0.7 },
          rise: 0.12,
          length: 0.9,
          spread: [0.25, 0.5],
          tie: 'chromeDark',
        },
      },
    ],
  },
  receding: {
    about:
      'Thin, receding hair: a bald crown and brow, a horseshoe of short hair left round the sides and the back, cut close.',
    finish: 'coil',
    pieces: [
      {
        scalp: {
          from: [
            [0, 0.9],
            [0.9, 0.5],
            [1.15, 0.0],
            [1.3, -0.12],
            [1.6, 0.0],
            [2.4, -0.3],
            [3.1416, -0.5],
          ],
          to: [
            [0, 0.9],
            [0.9, 0.52],
            [1.2, 0.3],
            [1.8, 0.25],
            [2.5, 0.2],
            [3.1416, 0.2],
          ],
          lift: 0.025,
          edge: 0.3,
        },
      },
    ],
  },
  crop: {
    about: 'A short, even crop all over, a little texture along the comb.',
    finish: 'coil',
    pieces: [
      { scalp: { from: line, lift: 0.035, edge: 0.4, crown: 0.02, ridges: [10, 0.05], comb: 'back' } },
    ],
  },
  bun: {
    about: 'Hair swept back from the face to a small low knot at the nape.',
    finish: 'silk',
    pieces: [
      {
        scalp: {
          from: line,
          lift: 0.05,
          edge: 0.45,
          crown: 0.02,
          comb: 'back',
          sheen: { count: 10, from: 0.4, to: 0.9 },
        },
      },
      {
        tail: {
          at: [0, 0.25, -0.98],
          count: 4,
          rope: { r: 0.3, flat: 0.8, tip: 'round', taper: 0.4 },
          rise: 0.05,
          length: -0.75,
          spread: [0.25, 0.3],
          tie: true,
        },
      },
    ],
  },
  shag: {
    about: 'Longer, unstyled hair grown over the ears and the collar, falling in loose hanks.',
    finish: 'silk',
    pieces: [
      {
        scalp: {
          from: [
            [0, 0.5],
            [0.6, 0.4],
            [1.0, -0.1],
            [1.4, -0.5],
            [2.2, -0.6],
            [3.1416, -0.75],
          ],
          lift: 0.08,
          edge: 0.6,
          crown: 0.05,
          ridges: [8, 0.1],
          comb: 'back',
        },
      },
    ],
  },
  fallLong: {
    about: 'Long straight loose hair to the shoulder blades.',
    finish: 'silk',
    pieces: [
      crown,
      { fall: { from: hang, part: 0, count: 20, length: 1, curl: 0, volume: 0.1, rope: { r: 0.14 } } },
    ],
  },
  // Long hair with its front hairline brought down over the face to the mouth, so from the front the face is a panel of hair and from the side
  // a curtain at the cheek (the old game's `curtain`, as far as a scalp shell can: it does not hang free of the face).
  fallCurtain: {
    about: 'Long straight hair hanging over the face to the mouth, and down the back to the shoulder blades.',
    finish: 'silk',
    pieces: [
      { scalp: { ...crown.scalp, from: curtainLine, lift: 0.14 } },
      { fall: { from: hang, part: 0, count: 20, length: 1, curl: 0, volume: 0.1, rope: { r: 0.14 } } },
    ],
  },
  // The curtain over the face, and the rest of the hair loose: a wide fan of fat ropes from the nape that spreads below the shoulders (a fall
  // narrows toward the spine below the jaw by design, so it can only be a tail; a tail piece with a wide spread is the builder's one way to hang
  // hair wide). From the back it covers the neck and the upper back; from the front it shows beside the neck, over the shoulders.
  curtainLoose: {
    about:
      'Long loose hair over the face to the mouth, fanned wide down the back below the shoulders and showing beside the neck.',
    finish: 'silk',
    pieces: [
      { scalp: { ...crown.scalp, from: curtainLine, lift: 0.14 } },
      {
        tail: {
          at: [0, 0.1, -0.95],
          hang: 'down',
          count: 22,
          rope: { r: 0.35, flat: 0.4 },
          rise: 0,
          length: 1.3,
          spread: [1.2, 2.0],
        },
      },
    ],
  },
  fallWavy: {
    about: 'Wavy loose hair to the chest.',
    finish: 'curl',
    pieces: [
      crown,
      { fall: { from: hang, part: 0, count: 20, length: 0.8, curl: 0.4, volume: 0.25, rope: { r: 0.14 } } },
    ],
  },
  afro: {
    about: 'A round curly afro.',
    finish: 'curl',
    pieces: [
      crown,
      { fall: { from: hang, part: 0, count: 40, length: 0, curl: 1, volume: 1, rope: { r: 0.2 } } },
    ],
  },
  bunKnot: {
    about: 'A bun low at the nape.',
    finish: 'silk',
    pieces: [crown, { bun: { at: [0, -0.35, -1], r: 0.5, rope: { r: 0.18 }, tie: true } }],
  },
  lowPony: {
    about: 'A low pony down the back.',
    finish: 'silk',
    pieces: [
      crown,
      {
        tail: {
          at: [0, 0.15, -0.98],
          hang: 'down',
          count: 6,
          rope: { r: 0.2 },
          rise: 0,
          length: 0.8,
          spread: [0.25, 0.4],
          tie: true,
        },
      },
    ],
  },
  napePony: {
    about: 'A low pony tied at the nape, hanging down the back.',
    finish: 'smooth',
    pieces: [
      crown,
      {
        tail: {
          at: [0, -0.3, -0.95],
          hang: 'down',
          count: 5,
          rope: { r: 0.18 },
          rise: 0,
          length: 1.2,
          spread: [0.2, 0.3],
          tie: true,
        },
      },
    ],
  },
  smoothBob: {
    about: 'A smooth chin-length bob.',
    finish: 'smooth',
    pieces: [
      crown,
      { fall: { from: hang, part: 0.3, count: 22, length: 0.35, curl: 0, volume: 0.2, rope: { r: 0.15 } } },
    ],
  },
  // A bob with a fringe: the shell lifted off the skull and brought down over the brow, the hair falling to the chin with its mass standing
  // out at the ear (the old game's bob; the helmet `smoothBob` has neither).
  bobFringe: {
    about: 'A chin-length bob with a fringe over the brow and volume at the ear.',
    finish: 'smooth',
    pieces: [
      { scalp: { ...crown.scalp, from: fringeLine, lift: 0.1 } },
      { fall: { from: hang, part: 0.3, count: 28, length: 0.35, curl: 0, volume: 0.38, rope: { r: 0.17 } } },
    ],
  },
  bobFringeFull: {
    about: 'A fuller bob with a fringe: more mass at the ear and a longer line.',
    finish: 'smooth',
    pieces: [
      { scalp: { ...crown.scalp, from: fringeLine, lift: 0.12 } },
      {
        fall: { from: hang, part: 0.3, count: 34, length: 0.42, curl: 0.1, volume: 0.55, rope: { r: 0.19 } },
      },
    ],
  },
  // The same bob with its back line lifted and the fall cut short: from behind it ends at the nape with no tail, the neck showing under it
  // (the fuller bob's fall is a long, low tail there). It still narrows to the nape: a hem as wide as the ears is the painter's.
  bobFringeBlunt: {
    about: 'A fuller bob with a fringe, cut straight across at the nape.',
    finish: 'smooth',
    pieces: [
      { scalp: { ...crown.scalp, from: fringeLine, lift: 0.12 } },
      {
        fall: {
          from: hangHigh,
          part: 0.3,
          count: 34,
          length: 0.1,
          curl: 0.1,
          volume: 0.55,
          rope: { r: 0.19 },
        },
      },
    ],
  },
  bobFringeShort: {
    about: 'A short bob with a fringe, to the jaw.',
    finish: 'smooth',
    pieces: [
      { scalp: { ...crown.scalp, from: fringeLine, lift: 0.1 } },
      { fall: { from: hang, part: 0.3, count: 28, length: 0.2, curl: 0, volume: 0.38, rope: { r: 0.17 } } },
    ],
  },
}
