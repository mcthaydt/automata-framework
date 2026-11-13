// The prop generators for a railway and any place that trains or trams stop at: the track, a platform's edge, a canopy over
// it and a semaphore signal beside it, then (further down) a ticket window, a lever frame and a trunk. They are what the
// things are, not what a game calls them, so any game with a line, a yard or a tram stop can build from them.
//
// Written new for the kit, in the style of its furniture: a prop's origin is the centre of its base on the floor and its front
// faces +z (for the track, +z is the side the near rail is on). Each kind documents the bounds it has with no parameters, and
// the unit test holds it to them within 5%. Every swatch is a parameter with a default, so `{ kind: 'rails' }` draws
// without a preset.
import { box, type Generator, lightOf, merge, part, rbox, rod } from '@automata/3d/props-kit'
import { turnX, turnZ } from '../../shared/turn.ts'

/**
 * A stretch of track along x: ballast, sleepers every 0.6 m across it, and two rails a `gauge` apart. `length` 6 m;
 * `gauge` 1.435 m (standard). The sleepers are 2.6 m long, so the track is as deep as they are.
 * Bounds with the defaults: 6 × 0.3 × 2.6.
 */
const rails: Generator = (p) => {
  const length = p.length ?? 6
  const gauge = p.gauge ?? 1.435
  const count = Math.max(2, Math.round(length / 0.6))
  // The sleepers sit in the bed up to a third of their height and the rails stand on them: foot, web and head, 0.12 m in all.
  const sleepers = merge(
    ...Array.from({ length: count }, (_, i) =>
      box([-length / 2 + ((i + 0.5) * length) / count, 0.06, 0], [0.22, 0.12, 2.6]),
    ),
  )
  const rail = (z: number) =>
    merge(
      box([0, 0.18, z], [length, 0.025, 0.14]),
      box([0, 0.2, z], [length, 0.07, 0.03]),
      box([0, 0.265, z], [length, 0.035, 0.07]),
    )
  return {
    pieces: [
      part(box([0, 0, 0], [length, 0.1, 2.4]), p.bed ?? 'ballast', 'bed'),
      part(sleepers, p.sleeper ?? 'sleeper', 'sleepers'),
      part(merge(rail(-gauge / 2), rail(gauge / 2)), p.rail ?? 'steelGrey', 'rails'),
    ],
  }
}

/**
 * The edge of a platform, seen from the track: a wall of `height` 0.9 m with a coping stone that overhangs it, and, when
 * `line` is true, the white line painted along the coping's edge. `length` 6 m. Bounds with the defaults: 6 × 0.9 × 0.6.
 */
const platformEdge: Generator = (p) => {
  const length = p.length ?? 6
  const height = p.height ?? 0.9
  const coping = 0.1
  return {
    pieces: [
      part(box([0, 0, -0.05], [length, height - coping, 0.5]), p.mat ?? 'concreteWall', 'wall'),
      part(box([0, height - coping, 0], [length, coping, 0.6]), p.coping ?? 'kerbStone', 'coping'),
      ...(p.line === false
        ? []
        : [
            part(box([0, height, 0.2], [length, 0.004, 0.08]), p.paint ?? 'roadPaint', 'line', {
              noCast: true,
            }),
          ]),
    ],
    top: { y: height, size: [length, 0.6] },
  }
}

/** The pitch of a canopy's roof, in degrees: it rises toward the back, where it meets the building. */
const CANOPY_PITCH = 6

/**
 * A canopy over a platform: `posts` along the front edge with a brace each, a flat roof pitched up toward the back
 * (where it meets the building) and a fascia board along the front. `length` 6 m, `depth` 3 m, `height` 3.2 m at the
 * front's underside. Bounds with the defaults: 6 × 3.6 × 3.
 */
const canopy: Generator = (p) => {
  const length = p.length ?? 6
  const depth = p.depth ?? 3
  const height = p.height ?? 3.2
  const n = Math.max(1, Math.round(p.posts ?? 2))
  const posts = merge(
    ...Array.from({ length: n }, (_, i) =>
      box([-length / 2 + ((i + 0.5) * length) / n, 0, depth / 2 - 0.2], [0.12, height, 0.12]),
    ),
  )
  // The slab turns about its middle, so its front edge drops by half the rise; lifting it by that much puts the front's
  // underside at `height`.
  const sin = Math.sin((CANOPY_PITCH * Math.PI) / 180)
  const roof = turnX(box([0, 0, 0], [length, 0.08, depth]), CANOPY_PITCH, [0, height + (depth / 2) * sin, 0])
  // A knee brace from each post back to the roof's underside, so the roof reads as held up and not as floating.
  const underside = (z: number): number => height + (depth / 2 - z) * Math.tan((CANOPY_PITCH * Math.PI) / 180)
  const braces = merge(
    ...Array.from({ length: n }, (_, i) => {
      const x = -length / 2 + ((i + 0.5) * length) / n
      const z = depth / 2 - 0.2
      return rod([x, height - 0.8, z], [x, underside(z - 0.8), z - 0.8], 0.025, 6)
    }),
  )
  return {
    pieces: [
      part(posts, p.post ?? 'ironDark', 'posts'),
      part(braces, p.post ?? 'ironDark', 'braces'),
      part(roof, p.roof ?? 'corrugated', 'roof'),
      part(box([0, height - 0.22, depth / 2 - 0.02], [length, 0.24, 0.05]), p.trim ?? 'trimWhite', 'fascia'),
    ],
  }
}

/**
 * A semaphore signal: a post on a footing, an arm that points level when the line is closed and `clear` raises, and a
 * lamp below it that is lit (a red glass and a light) when `lit` is true. `height` 5 m. The arm is 1.2 m long: its tail
 * 0.25 m behind the post, its blade 0.95 m out along +x. Bounds with the defaults: 1.2 × 5 × 0.5.
 */
const signal: Generator = (p) => {
  const height = p.height ?? 5
  const pivot: [number, number, number] = [0, height - 0.4, 0.09]
  const lit = p.lit !== false
  const arm = turnZ(box([0.35, -0.09, 0], [1.2, 0.18, 0.03]), p.clear === true ? 40 : 0, pivot)
  return {
    pieces: [
      part(box([0, 0, 0], [0.5, 0.18, 0.5]), p.base ?? 'concreteWall', 'footing'),
      part(box([0, 0.18, 0], [0.12, height - 0.18, 0.12]), p.post ?? 'trimWhite', 'post'),
      part(arm, p.paint ?? 'carRed', 'arm'),
      part(rbox([0, height - 1.2, 0.12], [0.28, 0.42, 0.18], 0.3), p.case ?? 'ironDark', 'case'),
      part(
        box([0, height - 1.0, 0.21], [0.16, 0.16, 0.02]),
        lit ? (p.glow ?? 'neonRed') : (p.glass ?? 'carRed'),
        'lamp',
        {
          noCast: true,
        },
      ),
    ],
    ...(lit
      ? { lights: [lightOf([0, height - 0.92, 0.4], p, { kind: 'neon', color: '#ff3b2f', range: 3 })] }
      : {}),
  }
}

/**
 * A ticket window: a counter with a partition above it, an opening in the partition and a glass sash that slides up over
 * the header when `open` is true and covers the opening when it is false. `width` 1.6 m. The sash is in front of the
 * partition, so it adds no depth: the counter is as deep as the whole. Bounds with the defaults: 1.6 × 2.1 × 0.5.
 */
const ticketWindow: Generator = (p) => {
  const w = p.width ?? 1.6
  const mat = p.mat ?? 'oak'
  const opening = w - 0.6
  const partition = merge(
    // The header above the opening and a pillar either side of it, the partition's back on the counter's back.
    box([0, 1.55, -0.22], [w, 0.55, 0.06]),
    box([-w / 2 + 0.15, 1.04, -0.22], [0.3, 0.51, 0.06]),
    box([w / 2 - 0.15, 1.04, -0.22], [0.3, 0.51, 0.06]),
  )
  return {
    pieces: [
      part(box([0, 0, 0], [w, 1, 0.5]), mat, 'counter'),
      part(box([0, 1, 0], [w, 0.04, 0.5]), p.counterTop ?? mat, 'counterTop'),
      part(partition, p.frame ?? 'panelPainted', 'partition'),
      // Raised by the height of the opening, the sash stands over the header, clear of the opening.
      part(
        box([0, p.open === false ? 1.03 : 1.58, -0.18], [opening + 0.04, 0.54, 0.03]),
        p.glass ?? 'glassDay',
        'sash',
        { noCast: true },
      ),
    ],
    top: { y: 1.04, size: [w, 0.5] },
  }
}

/** Where each lever of a frame leans, in degrees about x: upright-ish (toward +z) at rest, well back (toward −z) pulled. */
const LEVER_REST = 10
const LEVER_PULLED = -35

/**
 * A signal box's lever frame: a frame on the floor with a row of `levers` 0.25 m apart, each a piece of its own so a
 * lever that is `pulled` (its index in the list, counted from the −x end) is the only piece that changes. A pulled lever
 * lies back toward −z. `levers` 4. Bounds with the defaults: 1.2 × 1.3 × 0.6.
 */
const leverFrame: Generator = (p) => {
  const n = Math.max(1, Math.round(p.levers ?? 4))
  const pulled: readonly number[] = Array.isArray(p.pulled) ? p.pulled : []
  const w = n * 0.25 + 0.2
  const xs = Array.from({ length: n }, (_, i) => -w / 2 + 0.1 + (i + 0.5) * 0.25)
  const frame = merge(
    box([0, 0, 0], [w, 0.3, 0.6]),
    // The back plate the levers pivot on, with a pin at each pivot.
    box([0, 0.3, -0.25], [w, 0.55, 0.04]),
    ...xs.map((x) => rod([x, 0.32, -0.2], [x, 0.32, 0.2], 0.02, 6)),
  )
  const lever = (x: number, down: boolean) =>
    turnX(
      merge(rod([0, 0, 0], [0, 0.98, 0], 0.018, 6), rbox([0, 0.94, 0], [0.05, 0.07, 0.05], 0.5)),
      down ? LEVER_PULLED : LEVER_REST,
      [x, 0.32, 0],
    )
  return {
    pieces: [
      part(frame, p.frame ?? 'ironDark', 'frame'),
      ...xs.map((x, i) =>
        part(
          lever(x, pulled.includes(i)),
          pulled.includes(i) ? (p.pulledLever ?? 'carRed') : (p.lever ?? 'steelGrey'),
          `lever${i}`,
        ),
      ),
    ],
  }
}

/**
 * A travelling trunk: a box with an arched lid, `straps` bands over it and a clasp on the front. `width` 0.9 m. Bounds with
 * the defaults: 0.9 × 0.5 × 0.5.
 */
const trunk: Generator = (p) => {
  const w = p.width ?? 0.9
  const n = Math.max(0, Math.round(p.straps ?? 2))
  const straps = merge(
    ...Array.from({ length: n }, (_, i) => box([-w / 2 + ((i + 0.5) * w) / n, 0, 0], [0.05, 0.495, 0.505])),
  )
  return {
    pieces: [
      part(rbox([0, 0, 0], [w, 0.34, 0.5], 0.15), p.mat ?? 'crateWood', 'body'),
      part(rbox([0, 0.34, 0], [w, 0.16, 0.5], 0.5), p.mat ?? 'crateWood', 'lid'),
      part(straps, p.strap ?? 'ironDark', 'straps'),
      part(box([-0.03, 0.3, 0.24], [0.06, 0.1, 0.03]), p.clasp ?? 'brass', 'clasp'),
    ],
  }
}

export const RAILWAY: Readonly<Record<string, Generator>> = {
  rails,
  platformEdge,
  canopy,
  signal,
  ticketWindow,
  leverFrame,
  trunk,
}
