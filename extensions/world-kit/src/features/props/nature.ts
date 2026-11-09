// The prop generators for the open air: trees, bushes, rocks, grass, clouds and far hills. Their leaves sway.
//
// Ported from the world generator this kit grew out of: `tree`, `bush`,
// `rock`, `cloud`, `hill`, `tufts`.
import {
  blob,
  type Generator,
  type MeshData,
  merge,
  type PropPiece,
  part,
  rod,
  stream,
} from '@automata/3d/props-kit'

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

export const NATURE: Readonly<Record<string, Generator>> = { bush, rock, tufts, cloud, hill }
