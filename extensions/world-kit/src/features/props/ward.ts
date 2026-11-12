// The prop generators for a ward and any workplace like it: a sink, a trolley, a wheelchair, a gurney, a monitor cart, a wall
// clock, a key cabinet, a locker and a drip stand. They are what the things are, not what a game calls them, so any game with
// a clinic, an office or a school can furnish from them.
//
// Written new for the kit, in the style of its furniture: a prop's origin is the centre of its base on the floor and its front
// faces +z; a wall prop's back is on the wall (z = 0) at a height of its own. Each kind documents the bounds it has with
// no parameters, and the unit test holds it to them within 5%. Every swatch is a parameter with a default, so
// `{ kind: 'sink' }` draws without a preset.
import {
  blob,
  box,
  cylinder,
  type Generator,
  type MeshData,
  merge,
  type PropPiece,
  part,
  rbox,
  rod,
  type V3,
} from '@automataframework/3d/props-kit'
import { castor, hoop } from '../../shared/piece-helpers.ts'
import { turnX, turnY } from '../../shared/turn.ts'
import { wallMounted } from './wall-mounted.ts'

/** Which way is `degrees` clockwise from twelve o'clock, as the unit vector a hand points along on a wall. */
const clockwise = (degrees: number): [number, number] => [
  Math.sin((degrees * Math.PI) / 180),
  Math.cos((degrees * Math.PI) / 180),
]

/**
 * A ward sink on a pedestal: the basin with a dark bowl, a splashback, two wrist levers and a spout. `width` 0.6 m.
 * Bounds with the defaults: 0.6 × 1.1 × 0.45.
 */
const sink: Generator = (p) => {
  const w = p.width ?? 0.6
  const mat = p.mat ?? 'enamel'
  const metal = p.metal ?? 'chrome'
  const tap = merge(
    cylinder([0, 0.85, -0.15], 0.025, 0.05, 8, 0.4),
    rod([0, 0.9, -0.15], [0, 1.0, -0.15], 0.017, 6),
    rod([0, 1.0, -0.15], [0, 1.0, -0.06], 0.017, 6),
    rod([0, 1.0, -0.06], [0, 0.95, -0.06], 0.014, 6),
    // The two wrist levers, long enough to work with an elbow.
    rod([-0.04, 0.9, -0.15], [-0.15, 0.97, -0.12], 0.011, 5),
    rod([0.04, 0.9, -0.15], [0.15, 0.97, -0.12], 0.011, 5),
  )
  return {
    pieces: [
      part(rbox([0, 0.72, 0.0], [w, 0.13, 0.45], 0.3), mat, 'basin'),
      // The bowl: a dark slab a hair proud of the rim, so the basin reads as hollow from above.
      part(rbox([0, 0.846, 0.025], [w - 0.12, 0.016, 0.32], 0.5), p.bowl ?? 'steelGrey', 'bowl'),
      part(box([0, 0.85, -0.205], [w, 0.25, 0.04]), mat, 'splashback'),
      part(rbox([0, 0, -0.1], [0.2, 0.72, 0.16], 0.4), mat, 'pedestal'),
      part(rbox([0, 0, -0.1], [0.3, 0.03, 0.24], 0.3), mat, 'foot'),
      part(tap, metal, 'tap'),
    ],
    top: { y: 0.85, size: [w - 0.04, 0.4] },
  }
}

/**
 * A dressing or medication trolley: boards on four posts, a rim round the top one, a push handle at the −x end and four
 * castors. `shelves` boards, the top at 0.85 m. Bounds with the defaults (two shelves): 0.75 × 0.95 × 0.45.
 */
const trolley: Generator = (p) => {
  const n = Math.max(1, Math.round(p.shelves ?? 2))
  const [w, d] = [0.75, 0.45]
  const mat = p.mat ?? 'vinylTeal'
  const metal = p.metal ?? 'chrome'
  // The boards run from the top deck down to one 0.2 m up, evenly spaced.
  const heights = Array.from({ length: n }, (_, i) => 0.85 - (i * 0.65) / Math.max(1, n - 1))
  const boards = merge(...heights.map((y) => rbox([0, y, 0], [w, 0.03, d], 0.15)))
  const rim = merge(
    box([0, 0.88, d / 2 - 0.01], [w, 0.04, 0.02]),
    box([0, 0.88, -d / 2 + 0.01], [w, 0.04, 0.02]),
    box([w / 2 - 0.01, 0.88, 0], [0.02, 0.04, d - 0.04]),
    box([-w / 2 + 0.01, 0.88, 0], [0.02, 0.04, d - 0.04]),
  )
  const posts = merge(
    ...([-1, 1] as const).flatMap((sx) =>
      ([-1, 1] as const).map((sz) =>
        box([sx * (w / 2 - 0.04), 0.1, sz * (d / 2 - 0.04)], [0.03, 0.78, 0.03]),
      ),
    ),
  )
  // The handle: two uprights at the −x end and a bar across them, its top at 0.95.
  const handle = merge(
    box([-w / 2 + 0.03, 0.85, -0.18], [0.025, 0.09, 0.025]),
    box([-w / 2 + 0.03, 0.85, 0.18], [0.025, 0.09, 0.025]),
    rod([-w / 2 + 0.03, 0.937, -0.18], [-w / 2 + 0.03, 0.937, 0.18], 0.013, 6),
  )
  const feet = merge(
    ...([-1, 1] as const).flatMap((sx) => ([-1, 1] as const).map((sz) => castor(sx * 0.31, sz * 0.17))),
  )
  return {
    pieces: [
      part(boards, mat, 'boards'),
      part(rim, metal, 'rim'),
      part(posts, metal, 'posts'),
      part(handle, metal, 'handle'),
      part(feet, p.tyre ?? 'tyre', 'castors'),
    ],
    top: { y: 0.88, size: [w - 0.06, d - 0.06] },
  }
}

/**
 * A folding wheelchair: a sling seat and back, armrests, two big wheels with push rims, two front castors and footplates.
 * Bounds: 0.65 × 0.95 × 1.05; its front is +z.
 */
const wheelchair: Generator = (p) => {
  const frame = p.frame ?? 'chrome'
  const rear = -0.22
  const tyres: V3[] = [
    [-0.31, 0.312, rear],
    [0.31, 0.312, rear],
  ]
  const wheels = merge(
    ...tyres.flatMap((c) => [
      hoop(c, 0.3, 0.014, 'yz', 18),
      hoop(c, 0.255, 0.007, 'yz', 14),
      ...[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 4
        return rod(
          [c[0], c[1] + Math.cos(a) * 0.29, c[2] + Math.sin(a) * 0.29],
          [c[0], c[1] - Math.cos(a) * 0.29, c[2] - Math.sin(a) * 0.29],
          0.005,
          4,
        )
      }),
      blob(c, [0.03, 0.03, 0.03]),
    ]),
  )
  const sides = ([-1, 1] as const).map((s) =>
    merge(
      // The side tube: from the back post, along under the seat, down to the front castor.
      rod([s * 0.22, 0.45, -0.27], [s * 0.22, 0.45, 0.16], 0.014, 6),
      rod([s * 0.22, 0.45, 0.16], [s * 0.22, 0.3, 0.35], 0.014, 6),
      rod([s * 0.22, 0.45, -0.27], [s * 0.22, 0.9, -0.27], 0.014, 6),
      // The push handle, leaning back from the top of the post.
      rod([s * 0.22, 0.9, -0.27], [s * 0.22, 0.95, -0.4], 0.016, 6),
      // The armrest, on a post.
      rod([s * 0.22, 0.45, -0.05], [s * 0.22, 0.7, -0.05], 0.012, 6),
      box([s * 0.22, 0.7, -0.17], [0.045, 0.03, 0.3]),
      // The footrest hanger and its plate.
      rod([s * 0.2, 0.42, 0.16], [s * 0.14, 0.15, 0.47], 0.012, 6),
      box([s * 0.14, 0.12, 0.47], [0.13, 0.025, 0.12]),
    ),
  )
  return {
    pieces: [
      part(rbox([0, 0.43, -0.05], [0.44, 0.05, 0.42], 0.25), p.sling ?? 'vinylTeal', 'seat'),
      part(rbox([0, 0.5, -0.27], [0.44, 0.4, 0.04], 0.25), p.sling ?? 'vinylTeal', 'back'),
      part(merge(...sides), frame, 'frame'),
      part(rod([-0.31, 0.312, rear], [0.31, 0.312, rear], 0.012, 6), frame, 'axle'),
      part(wheels, p.tyre ?? 'tyre', 'wheels'),
      part(merge(castor(-0.22, 0.35, 0.08), castor(0.22, 0.35, 0.08)), p.tyre ?? 'tyre', 'castors'),
    ],
  }
}

/**
 * A hospital gurney, lengthwise along x with its head at −x: castors, a base and two lift columns, the deck and a vinyl
 * mattress, a pillow and a sheet over the foot, head and foot panels and a side rail each side. `length` 1.9 m.
 * Bounds with the defaults: 1.9 × 1.0 × 0.7.
 */
const gurney: Generator = (p) => {
  const length = p.length ?? 1.9
  const frame = p.frame ?? 'chrome'
  const half = length / 2
  const reach = half - 0.15
  const rails = merge(
    ...([-1, 1] as const).flatMap((s) => [
      rod([-0.62, 0.985, s * 0.325], [0.5, 0.985, s * 0.325], 0.014, 6),
      rod([-0.62, 0.9, s * 0.325], [0.5, 0.9, s * 0.325], 0.012, 6),
      rod([-0.62, 0.9, s * 0.325], [-0.62, 0.985, s * 0.325], 0.012, 6),
      rod([0.5, 0.9, s * 0.325], [0.5, 0.985, s * 0.325], 0.012, 6),
    ]),
  )
  const base = merge(
    box([-reach * 0.7, 0.12, 0], [0.06, 0.05, 0.5]),
    box([reach * 0.7, 0.12, 0], [0.06, 0.05, 0.5]),
    ...([-1, 1] as const).map((s) => box([0, 0.12, s * 0.25], [reach * 1.4 + 0.06, 0.05, 0.05])),
    // The two lift columns, from the base up to the deck.
    box([-0.6, 0.17, 0], [0.09, 0.5, 0.09]),
    box([0.6, 0.17, 0], [0.09, 0.5, 0.09]),
  )
  const feet = merge(
    ...([-1, 1] as const).flatMap((sx) =>
      ([-1, 1] as const).map((sz) => castor(sx * reach * 0.7, sz * 0.25, 0.06)),
    ),
  )
  const pieces: PropPiece[] = [
    part(base, frame, 'base'),
    part(feet, p.tyre ?? 'tyre', 'castors'),
    part(rbox([0, 0.62, 0], [length - 0.1, 0.05, 0.56], 0.2), p.deck ?? 'steelGrey', 'deck'),
    part(rbox([0, 0.67, 0], [length, 0.12, 0.62], 0.35), p.mat ?? 'vinylTeal', 'mattress'),
    part(rbox([length * 0.17, 0.79, 0], [length * 0.6, 0.06, 0.64], 0.55), p.sheet ?? 'linen', 'sheet'),
    part(
      blob([-half + 0.28, 0.87, 0], [0.2, 0.065, 0.24], { e: 0.55, lump: 0.04, seed: 3 }),
      p.pillow ?? 'pillowWhite',
      'pillow',
    ),
    part(rbox([-half + 0.02, 0.62, 0], [0.04, 0.3, 0.6], 0.2), p.mat ?? 'vinylTeal', 'head'),
    part(rbox([half - 0.02, 0.62, 0], [0.04, 0.26, 0.6], 0.2), p.mat ?? 'vinylTeal', 'foot'),
    part(rails, frame, 'rails'),
  ]
  return { pieces, top: { y: 0.87, size: [length - 0.2, 0.5] } }
}

/** The beat on a monitor's trace, as [x, y] offsets from the middle of the screen, in metres. */
const BEAT: readonly (readonly [number, number])[] = [
  [-0.14, 0],
  [-0.06, 0],
  [-0.04, 0.045],
  [-0.02, -0.04],
  [0, 0.02],
  [0.02, 0],
  [0.14, 0],
]

/**
 * A patient monitor on a cart: a five-armed base on castors, a pole, a tray and the monitor on top. `on` lights the
 * screen and draws its trace; off, the screen is dark. Bounds: 0.5 × 1.45 × 0.5; the screen faces +z.
 */
const monitorCart: Generator = (p) => {
  const on = p.on ?? true
  const metal = p.metal ?? 'chrome'
  const arms = Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 5
    return [Math.cos(a) * 0.24, Math.sin(a) * 0.24] as const
  })
  const base = merge(
    cylinder([0, 0.07, 0], 0.045, 0.05, 8, 0.4),
    ...arms.map(([x, z]) => rod([0, 0.09, 0], [x, 0.09, z], 0.018, 6)),
  )
  const feet = merge(...arms.map(([x, z]) => castor(x, z, 0.04)))
  // The trace on the lit screen: a flat line with one beat, drawn dark over the glow.
  const trace = merge(
    ...BEAT.slice(1).map((to, i) => {
      const from = BEAT[i] as readonly [number, number]
      return rod([from[0], 1.17 + from[1], 0.058], [to[0], 1.17 + to[1], 0.058], 0.004, 4)
    }),
  )
  const pieces: PropPiece[] = [
    part(base, metal, 'base'),
    part(feet, p.tyre ?? 'tyre', 'castors'),
    part(rod([0, 0.09, 0], [0, 1.02, 0], 0.022, 8), metal, 'pole'),
    part(rbox([0, 0.78, 0.04], [0.36, 0.025, 0.24], 0.2), p.tray ?? 'enamel', 'tray'),
    part(rbox([0, 1.17, 0], [0.4, 0.28, 0.1], 0.3), p.casing ?? 'ironDark', 'monitor'),
    part(box([0, 1.02, -0.01], [0.08, 0.04, 0.05]), metal, 'neck'),
    part(box([0, 1.07, 0.052], [0.34, 0.2, 0.006]), on ? 'screenGlow' : 'soot', 'screen', { noCast: true }),
  ]
  if (on) pieces.push(part(trace, 'soot', 'trace', { noCast: true }))
  return { pieces, top: { y: 0.79, size: [0.34, 0.22] } }
}

/**
 * A round wall clock at `height` (2.2 m by default), its back on the wall: a dark bezel, a white face, twelve ticks and two
 * hands set to `hour` and `minute` (a twelve-hour dial: 16 reads as 4). Bounds: 0.32 × 0.32 × 0.06.
 */
const wallClock: Generator = (p) => {
  const y = p.height ?? 2.2
  const hour = (((p.hour ?? 8) % 12) + 12) % 12
  const minute = p.minute ?? 0
  const hourAngle = (hour + minute / 60) * 30
  const minuteAngle = minute * 6
  const hand = (angle: number, length: number, tail: number, z: number, thick: number) => {
    const [dx, dy] = clockwise(angle)
    return rod([-dx * tail, y - dy * tail, z], [dx * length, y + dy * length, z], thick, 5)
  }
  const ticks = merge(
    ...Array.from({ length: 12 }, (_, i) => {
      const [dx, dy] = clockwise(i * 30)
      const long = i % 3 === 0
      const inner = long ? 0.105 : 0.12
      return rod(
        [dx * inner, y + dy * inner, 0.037],
        [dx * 0.135, y + dy * 0.135, 0.037],
        long ? 0.006 : 0.004,
        4,
      )
    }),
  )
  return {
    pieces: [
      part(turnX(cylinder([0, 0, 0], 0.16, 0.03, 16, 0.4), 90, [0, y, 0]), p.rim ?? 'ironDark', 'rim', {
        noCast: true,
      }),
      part(
        merge(turnX(cylinder([0, 0, 0], 0.145, 0.006, 16, 0.2), 90, [0, y, 0.03]), ticks),
        p.face ?? 'trimWhite',
        'face',
        { noCast: true },
      ),
      // The hour hand lies under the minute hand, as on a real dial.
      part(
        merge(hand(hourAngle, 0.07, 0.025, 0.04, 0.007), hand(minuteAngle, 0.11, 0.03, 0.047, 0.0055)),
        p.hands ?? 'ironDark',
        'hands',
        { noCast: true },
      ),
      part(blob([0, y, 0.05], [0.012, 0.012, 0.01]), p.hands ?? 'ironDark', 'pin', { noCast: true }),
    ],
  }
}

/**
 * A wall cabinet for keys at `height` (1.4 m by default), its back on the wall: a hollow case with two rows of hooks and
 * keys, a door on the left hinge (shut, or `open` swung out) and a keypad with a small display on the right. Bounds shut:
 * 0.4 × 0.5 × 0.12; open, the door reaches 0.28 m out.
 */
const keyCabinet: Generator = (p) => {
  const y = p.height ?? 1.4
  const open = p.open ?? false
  const [w, h, depth] = [0.4, 0.5, 0.1]
  const t = 0.012
  const doorW = 0.28
  const hinge: V3 = [-w / 2 + t, y + t, depth + 0.006]
  // The door is built hanging from its hinge (x from 0), then swung, so shut and open are one shape.
  const swing = (mesh: MeshData): MeshData => turnY(mesh, open ? -100 : 0, hinge)
  const door = merge(
    box([doorW / 2, 0, 0], [doorW, h - 2 * t, 0.012]),
    box([doorW - 0.035, (h - 2 * t) / 2 - 0.03, 0.012], [0.015, 0.06, 0.008]),
  )
  const keys = merge(
    ...[0, 1].flatMap((row) =>
      Array.from({ length: 6 }, (_, i) =>
        box([-0.14 + i * 0.045, y + 0.12 + row * 0.18 - 0.03, 0.04], [0.012, 0.06, 0.006]),
      ),
    ),
  )
  const tags = merge(
    ...[0, 1].flatMap((row) =>
      Array.from({ length: 6 }, (_, i) =>
        box([-0.14 + i * 0.045, y + 0.12 + row * 0.18 - 0.075, 0.04], [0.022, 0.03, 0.006]),
      ),
    ),
  )
  const buttons = merge(
    ...[0, 1, 2, 3].flatMap((r) =>
      [0, 1, 2].map((c) =>
        box([0.14 + (c - 1) * 0.03, y + 0.045 + (3 - r) * 0.034, depth + 0.009], [0.024, 0.024, 0.01]),
      ),
    ),
  )
  return {
    pieces: [
      part(
        merge(
          box([0, y, t / 2], [w, h, t]),
          box([-w / 2 + t / 2, y, depth / 2], [t, h, depth]),
          box([w / 2 - t / 2, y, depth / 2], [t, h, depth]),
          box([0, y + h - t, depth / 2], [w, t, depth]),
          box([0, y, depth / 2], [w, t, depth]),
          // The strip of front beside the door, which holds the keypad.
          box([w / 2 - 0.06, y, depth - 0.006], [0.12, h, 0.012]),
        ),
        p.mat ?? 'steelGrey',
        'body',
      ),
      part(box([-0.06, y + t, t], [w - 0.15, h - 2 * t, 0.004]), 'soot', 'inside', { noCast: true }),
      part(keys, p.key ?? 'brass', 'keys', { noCast: true }),
      part(tags, p.tag ?? 'carRed', 'tags', { noCast: true }),
      part(swing(door), p.door ?? 'vinylTeal', 'door'),
      part(box([w / 2 - 0.06, y + 0.04, depth + 0.002], [0.095, 0.2, 0.004]), 'ironDark', 'plate'),
      part(buttons, p.keypad ?? 'trimWhite', 'keypad', { noCast: true }),
      part(box([w / 2 - 0.06, y + 0.205, depth + 0.004], [0.07, 0.025, 0.004]), 'screenGlow', 'display', {
        noCast: true,
      }),
    ],
  }
}

/**
 * A steel locker, a column of `doors` compartments 0.3 m wide each: a hollow case on a kick plinth with a shelf in each,
 * and a louvred door with a handle on its left hinge; `open` swings the first door out. Bounds with two doors:
 * 0.6 × 1.8 × 0.5.
 */
const locker: Generator = (p) => {
  const n = Math.max(1, Math.round(p.doors ?? 2))
  const open = p.open ?? false
  const [cell, h, d] = [0.3, 1.8, 0.5]
  const w = n * cell
  const t = 0.02
  const plinth = 0.1
  const doorH = h - plinth - 0.02
  const hingeOf = (i: number): V3 => [-w / 2 + i * cell + 0.004, plinth + 0.01, d / 2 - 0.01]
  const dividers = Array.from({ length: n - 1 }, (_, i) =>
    box([-w / 2 + (i + 1) * cell, plinth, 0], [t, h - plinth, d - 0.02]),
  )
  const shelves = Array.from({ length: n }, (_, i) =>
    box([-w / 2 + (i + 0.5) * cell, 1.35, -0.01], [cell - t, 0.015, d - 0.04]),
  )
  // Each door is built hanging from its hinge: the plate with its louvre ribs, a handle, a vent slot. Door 0 may be open.
  const doorParts = (i: number) => {
    const swing = (mesh: MeshData): MeshData => turnY(mesh, open && i === 0 ? -100 : 0, hingeOf(i))
    const dw = cell - 0.012
    const plate = merge(
      box([dw / 2, 0, 0], [dw, doorH, 0.02]),
      ...[0, 1, 2].map((k) => box([dw / 2, doorH - 0.2 - k * 0.04, 0.014], [dw - 0.08, 0.012, 0.008])),
    )
    const handle = box([dw - 0.045, doorH * 0.5, 0.02], [0.02, 0.12, 0.018])
    const slots = merge(
      ...[0, 1, 2].map((k) => box([dw / 2, doorH - 0.215 - k * 0.04, 0.0185], [dw - 0.1, 0.014, 0.004])),
    )
    return { plate: swing(plate), handle: swing(handle), slots: swing(slots) }
  }
  const doors = Array.from({ length: n }, (_, i) => doorParts(i))
  return {
    pieces: [
      part(
        merge(
          box([0, plinth, -d / 2 + t / 2], [w, h - plinth, t]),
          box([-w / 2 + t / 2, plinth, 0], [t, h - plinth, d]),
          box([w / 2 - t / 2, plinth, 0], [t, h - plinth, d]),
          box([0, h - t, 0], [w, t, d]),
          box([0, plinth, 0], [w, t, d]),
          ...dividers,
          ...shelves,
        ),
        p.mat ?? 'steelGrey',
        'body',
      ),
      part(box([0, plinth, -d / 2 + t], [w - 2 * t, h - plinth - t, 0.004]), 'soot', 'inside', {
        noCast: true,
      }),
      part(box([0, 0, -0.02], [w - 0.04, plinth, d - 0.08]), 'soot', 'plinth'),
      part(merge(...doors.map((x) => x.plate)), p.door ?? 'vinylTeal', 'door'),
      part(merge(...doors.map((x) => x.slots)), 'soot', 'vents', { noCast: true }),
      part(merge(...doors.map((x) => x.handle)), p.handle ?? 'chrome', 'handles'),
    ],
  }
}

/**
 * An IV drip stand: a five-armed base on castors, a pole with a crown of two hooks, a bag of fluid with its tube and the
 * drip chamber on it. Bounds: 0.6 × 1.9 × 0.6.
 */
const dripStand: Generator = (p) => {
  const metal = p.metal ?? 'chrome'
  const arms = Array.from({ length: 5 }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 5
    return [Math.cos(a) * 0.3, Math.sin(a) * 0.3] as const
  })
  const base = merge(
    cylinder([0, 0.07, 0], 0.04, 0.05, 8, 0.4),
    ...arms.map(([x, z]) => rod([0, 0.09, 0], [x, 0.09, z], 0.016, 6)),
  )
  const feet = merge(...arms.map(([x, z]) => castor(x, z, 0.035)))
  const crown = merge(
    rod([0, 1.84, 0], [-0.13, 1.87, 0], 0.01, 5),
    rod([0, 1.84, 0], [0.13, 1.87, 0], 0.01, 5),
    rod([-0.13, 1.87, 0], [-0.13, 1.82, 0], 0.008, 5),
    rod([0.13, 1.87, 0], [0.13, 1.82, 0], 0.008, 5),
  )
  const fluid = p.fluid ?? 'bottleClear'
  return {
    pieces: [
      part(base, metal, 'base'),
      part(feet, p.tyre ?? 'tyre', 'castors'),
      part(rod([0, 0.09, 0], [0, 1.9, 0], 0.013, 6), metal, 'pole'),
      part(cylinder([0, 1.1, 0], 0.024, 0.07, 8, 0.3), 'ironDark', 'clamp'),
      part(crown, metal, 'crown'),
      // The bag hangs from the right hook, its tube falling to the drip chamber and away.
      part(blob([0.13, 1.65, 0], [0.075, 0.12, 0.03], { e: 0.6, lump: 0.03, seed: 5 }), fluid, 'bag', {
        noCast: true,
      }),
      part(
        merge(
          rod([0.13, 1.53, 0], [0.13, 1.4, 0.0], 0.005, 4),
          cylinder([0.13, 1.28, 0], 0.014, 0.12, 6, 0.4),
          rod([0.13, 1.28, 0], [0.05, 1.0, 0.04], 0.004, 4),
        ),
        fluid,
        'tube',
        { noCast: true },
      ),
    ],
  }
}

export const WARD: Readonly<Record<string, Generator>> = {
  sink,
  trolley,
  wheelchair,
  gurney,
  monitorCart,
  wallClock: wallMounted(wallClock),
  keyCabinet: wallMounted(keyCabinet),
  locker,
  dripStand,
}
