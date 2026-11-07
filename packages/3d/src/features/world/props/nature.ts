// The prop generators for the open air: trees, bushes, rocks, grass, clouds and far hills. Their leaves sway.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/props.ts at 6d82a52: `tree`, `bush`,
// `rock`, `cloud`, `hill`, `tufts`.
import type { MeshData } from '../../../shared/math/geometry.ts'
import { merge } from '../../../shared/math/geometry.ts'
import { limb } from '../../../shared/math/limb.ts'
import type { V3 } from '../../../shared/math/math.ts'
import { blob, cone, rod } from '../mesh.ts'
import { stream } from '../stream.ts'
import { type Generator, type PropPiece, part } from './piece.ts'

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

/** A bush: a few lumpy clumps on the ground. */
const bush: Generator = (p) => {
  const r = stream(p.seed ?? 5)
  const R = p.radius ?? 0.5
  const n = p.clumps ?? 4
  const pieces: PropPiece[] = []
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const d = i ? R * 0.5 : 0
    const rr = R * (i ? 0.55 + r() * 0.2 : 0.75)
    pieces.push(
      part(
        blob([Math.cos(a) * d, rr * 0.75, Math.sin(a) * d * 0.6], [rr, rr * 0.8, rr * 0.85], {
          lump: 0.2,
          seed: (p.seed ?? 0) * 7 + i,
          seg: 12,
        }),
        p.leaves,
        'bush',
        { sway: p.sway ?? 0.015, phase: (p.seed ?? 0) * 2.3 },
      ),
    )
  }
  return { pieces }
}

/** A rock: one lumpy, faceted stone on its flat side. */
const rock: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.8, 0.5, 0.6]
  return {
    pieces: [
      part(
        blob([0, h * 0.4, 0], [w / 2, h * 0.6, d / 2], {
          e: 0.7,
          lump: 0.25,
          seed: p.seed ?? 1,
          seg: 12,
          flat: 0.66,
        }),
        p.mat,
        'rock',
      ),
    ],
  }
}

/** Grass tufts: a scatter of blades over an area of the ground, swaying. */
const tufts: Generator = (p) => {
  const r = stream(p.seed ?? 21)
  const [w, d] = p.area ?? [4, 2]
  const n = p.count ?? 20
  const blades: MeshData[] = []
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * w
    const z = (r() - 0.5) * d
    const k = 3 + Math.floor(r() * 3)
    const h = (p.height ?? 0.22) * (0.6 + r() * 0.6)
    for (let j = 0; j < k; j++) {
      const a = (j / (k - 1) - 0.5) * 1.4 + (r() - 0.5) * 0.3
      blades.push(rod([x, 0, z], [x + Math.sin(a) * h * 0.45, h * Math.cos(a * 0.5), z], 0.012, 4))
    }
  }
  return { pieces: [part(merge(...blades), p.mat, 'tufts', { noCast: true, sway: 0.02 })] }
}

/** Clouds: flattened clumps far back (they cast nothing). */
const cloud: Generator = (p) => {
  const r = stream(p.seed ?? 4)
  const W = p.width ?? 6
  const n = p.clumps ?? 5
  const pieces: PropPiece[] = []
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (W * (i + 0.5)) / n + (r() - 0.5) * 0.6
    const rr = W * (0.12 + r() * 0.1) * (1 - Math.abs(x) / W)
    pieces.push(
      part(
        blob([x, rr * 0.5, 0], [rr * 1.4, rr * 0.75, rr * 0.5], { lump: 0.15, seed: i, seg: 12 }),
        p.mat ?? 'cloud',
        'cloud',
        {
          noCast: true,
        },
      ),
    )
  }
  return { pieces }
}

/** A hill or a ridge far back: a few long low humps of different heights, so its skyline rolls. */
const hill: Generator = (p) => {
  const [w, h, d] = p.size ?? [30, 6, 8]
  const r = stream(p.seed ?? 1)
  const n = p.humps ?? 3
  const pieces: PropPiece[] = []
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n + (((r() - 0.5) * w) / n) * 0.5
    const hh = h * (0.65 + r() * 0.5)
    pieces.push(
      part(
        blob([x, 0, (r() - 0.5) * d * 0.3], [(w / n) * 0.75, hh, d / 2], {
          e: 0.9,
          lump: 0.1,
          seed: (p.seed ?? 1) * 5 + i,
          seg: 18,
        }),
        p.mat,
        'hill',
        {
          noCast: true,
        },
      ),
    )
  }
  return { pieces }
}

export const NATURE: Readonly<Record<string, Generator>> = { tree, bush, rock, tufts, cloud, hill }
