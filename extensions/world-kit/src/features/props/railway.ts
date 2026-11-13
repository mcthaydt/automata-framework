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

export const RAILWAY: Readonly<Record<string, Generator>> = { rails, platformEdge, canopy, signal }
