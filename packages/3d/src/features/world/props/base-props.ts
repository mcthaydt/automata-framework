// The five generators beside core's box and cylinder, the ones the base interior and exterior are made of: a table, a
// bin, a lamp (floor, desk, pendant or wall), a street lamp and a tree. Every other shape, a chair, a shelf, a sign, a
// car, is a generator the world-kit extension registers (`registerPropGenerator`).
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/props.ts at 6d82a52: `table`,
// `bin`, `lamp`, `streetLamp` and `tree`. Changed: parts are `part(mesh, swatch, label)`, a seeded stream is `stream`,
// and the numbers are the source's.
import type { MeshData } from '../../../shared/math/geometry.ts'
import { merge } from '../../../shared/math/geometry.ts'
import { limb } from '../../../shared/math/limb.ts'
import type { V3 } from '../../../shared/math/math.ts'
import { blob, box, cone, cylinder, rbox, rod } from '../mesh.ts'
import { stream } from '../stream.ts'
import { type Generator, lightOf, type PropPiece, part } from './piece.ts'

/** The four corners of a footprint, as signs: where a table's legs stand. */
const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const

/** A table or a desk: a top over four legs. */
const table: Generator = (p) => {
  const [w, h, d] = p.size
  const thick = p.thick ?? 0.05
  const leg = p.leg ?? 0.05
  const inset = p.inset ?? 0.06
  const legs = CORNERS.map(([sx, sz]) =>
    box([sx * (w / 2 - inset), 0, sz * (d / 2 - inset)], [leg, h - thick, leg]),
  )
  return {
    pieces: [
      part(rbox([0, h - thick, 0], [w, thick, d], 0.12), p.top, 'top'),
      part(merge(...legs), p.legs ?? p.top, 'legs'),
    ],
    top: { y: h, size: [w - 0.1, d - 0.1] },
  }
}

/** A bin: a can with a lid. */
const bin: Generator = (p) => {
  const radius = p.radius ?? 0.26
  const height = p.height ?? 0.85
  return {
    pieces: [
      part(cylinder([0, 0, 0], radius, height, 12, 0.3), p.mat, 'can'),
      part(cylinder([0, height - 0.02, 0], radius + 0.02, 0.06, 12, 0.5), p.lid ?? p.mat, 'lid'),
    ],
  }
}

/**
 * A lamp: `floor` (a stand and a shade), `desk`, `pendant` (a cord from the ceiling, a shade, a bulb) or `wall` (a
 * sconce). Its shade glows; its light sits in the shade.
 */
const lamp: Generator = (p) => {
  const variant = p.variant ?? 'floor'
  if (variant === 'pendant') {
    const top = p.ceiling ?? 2.8
    const y = p.height ?? 2.1
    const r = p.radius ?? 0.2
    return {
      pieces: [
        part(rod([0, y + 0.2, 0], [0, top, 0], 0.008, 6), p.cord ?? 'cordBlack', 'cord', { noCast: true }),
        part(cone([0, y, 0], r, r * 0.25, 0.2), p.shade, 'shade', { noCast: true }),
        part(blob([0, y - 0.01, 0], [r * 0.4, r * 0.25, r * 0.4]), p.bulb ?? 'bulbWarm', 'bulb', {
          noCast: true,
        }),
      ],
      lights: [lightOf([0, y - 0.15, 0], p, { kind: 'pendant' })],
    }
  }
  if (variant === 'wall') {
    const y = p.height ?? 1.8
    return {
      pieces: [
        part(rbox([0, y - 0.1, -0.05], [0.08, 0.2, 0.06], 0.3), p.base, 'plate'),
        part(cone([0, y - 0.05, 0.08], 0.11, 0.06, 0.2), p.shade, 'shade', { noCast: true }),
      ],
      lights: [lightOf([0, y, 0.2], p, { kind: 'bulb' })],
    }
  }
  const desk = variant === 'desk'
  const height = p.height ?? (desk ? 0.5 : 1.55)
  const r = p.radius ?? (desk ? 0.13 : 0.24)
  const shade = desk ? 0.18 : 0.32
  return {
    pieces: [
      part(cylinder([0, 0, 0], desk ? 0.08 : 0.16, 0.035), p.base, 'foot'),
      part(rod([0, 0.03, 0], [0, height - shade * 0.6, 0], desk ? 0.012 : 0.018, 6), p.base, 'pole'),
      part(cone([0, height - shade, 0], r, r * 0.62, shade), p.shade, 'shade', { noCast: true }),
    ],
    lights: [lightOf([0, height - shade * 0.5, 0.05], p, { kind: desk ? 'desk' : 'bulb' })],
  }
}

/** A street lamp: a footed pole, an arm out, a head whose glass glows under it; a pool of light below. */
const streetLamp: Generator = (p) => {
  const h = p.height ?? 4.2
  const arm = p.arm ?? 0.7
  const side = p.side ?? 1
  return {
    pieces: [
      part(cylinder([0, 0, 0], 0.13, 0.4, 10, 0.3), p.pole, 'pole'),
      part(rod([0, 0.3, 0], [0, h, 0], 0.055, 8), p.pole, 'pole'),
      part(rod([0, h - 0.05, 0], [arm * side, h + 0.1, 0], 0.035, 6), p.pole, 'pole'),
      part(rbox([arm * side, h - 0.06, 0], [0.42, 0.14, 0.26], 0.3), p.head ?? p.pole, 'head'),
      part(rbox([arm * side, h - 0.12, 0], [0.32, 0.07, 0.2], 0.4), p.glass ?? 'bulbWarm', 'glass', {
        noCast: true,
      }),
    ],
    lights: [lightOf([arm * side, h - 0.3, 0], p, { kind: 'sodium' })],
  }
}

/** A tree: `round` (a trunk that forks into a crown of lumpy clumps) or `pine` (tiers of cones). Its crown sways. */
const tree: Generator = (p) => {
  const r = stream(p.seed ?? 3)
  const H = p.height ?? 5
  const kind = p.variant ?? 'round'
  const tr = p.trunkRadius ?? H * 0.035
  const trunkTop = kind === 'pine' ? H * 0.35 : H * 0.55
  const trunk = limb({
    rings: [
      { y: 0, rx: tr * 1.5, rz: tr * 1.5 },
      { y: 0.25, rx: tr, rz: tr },
      { y: trunkTop, rx: tr * 0.7, rz: tr * 0.7 },
    ],
    caps: [0.05, 0],
    seg: 10,
    step: 0.15,
  })
  const pieces: PropPiece[] = [part(trunk, p.trunk, 'trunk')]
  if (kind === 'pine') {
    const tiers = p.tiers ?? 4
    const R = p.crown ?? H * 0.28
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers
      const y = trunkTop * 0.6 + (H - trunkTop * 0.6) * k * 0.82
      const rr = R * (1 - k * 0.7)
      pieces.push(
        part(cone([0, y, 0], rr, rr * 0.08, (H - y) * 0.55 + 0.3, 14), p.leaves, 'crown', {
          sway: (p.sway ?? 0.06) * (0.4 + k),
          phase: (p.seed ?? 0) * 1.7,
        }),
      )
    }
    return { pieces }
  }
  // Branches up into the crown, then the clumps round it: big ones low and round, small ones on top.
  const R = p.crown ?? H * 0.3
  const cy = trunkTop + R * 0.7
  const n = p.clumps ?? 9
  const branches: MeshData[] = []
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2
    branches.push(
      rod([0, trunkTop - 0.3, 0], [Math.cos(a) * R * 0.5, cy, Math.sin(a) * R * 0.4], tr * 0.45, 6),
    )
  }
  pieces.push(part(merge(...branches), p.trunk, 'trunk'))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6
    const up = i === 0 ? 1 : r() * 0.9 - 0.25
    const rr = R * (i === 0 ? 0.75 : 0.45 + r() * 0.25)
    const at: V3 =
      i === 0 ? [0, cy + R * 0.1, 0] : [Math.cos(a) * R * 0.62, cy + up * R * 0.55, Math.sin(a) * R * 0.5]
    pieces.push(
      part(
        blob(at, [rr, rr * 0.82, rr * 0.9], { lump: 0.18, seed: (p.seed ?? 0) * 13 + i, seg: 14 }),
        p.leaves,
        'crown',
        {
          sway: (p.sway ?? 0.05) * (0.6 + ((at[1] - trunkTop) / R) * 0.4),
          phase: (p.seed ?? 0) * 1.7,
        },
      ),
    )
  }
  return { pieces }
}

/** The kinds core registers beyond the box and the cylinder: what the base scenes are made of. */
export const BASE_PROPS: Readonly<Record<string, Generator>> = { table, bin, lamp, streetLamp, tree }
