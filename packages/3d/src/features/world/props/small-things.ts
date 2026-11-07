// The prop generators for the small things in a room: the lamp, the plant, the picture, the curtains, the clutter on a table and the fixtures on a wall.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/props.ts at 6d82a52. Changed: parts are
// `part(mesh, swatch, label)`, a seeded stream is `stream`, and the numbers are the source's.
import type { MeshData } from '../../../shared/math/geometry.ts'
import { merge, tube } from '../../../shared/math/geometry.ts'
import { at } from '../../../shared/math/math.ts'
import { blob, box, cone, cylinder, quad, rbox, rod, turnY } from '../mesh.ts'
import { stream } from '../stream.ts'
import { type Generator, lightOf, type PropPiece, part } from './piece.ts'

const pick = <T>(list: readonly T[], r: () => number): T => at(list, Math.floor(r() * list.length))

/** A sheet of paper on a surface: a 2 mm slab, turned by its seed (±25°). */
const paper: Generator = (p) => {
  const [w, d] = p.size ?? [0.21, 0.3]
  const turn = (stream(p.seed ?? 1)() - 0.5) * 50
  return {
    pieces: [
      part(turnY(box([0, 0, 0], [w, 0.002, d]), turn), p.mat ?? 'posterPaper', 'sheet', { noCast: true }),
    ],
  }
}

/** A stack of books: slabs 0.2 × 0.035 × 0.15, each nudged ±0.02 m by the seed, each its own swatch from `books`. */
const bookStack: Generator = (p) => {
  const r = stream(p.seed ?? 1)
  const books: string[] = p.books ?? [
    'bookRed',
    'bookBlue',
    'bookGreen',
    'bookGold',
    'bookLilac',
    'bookCream',
  ]
  return {
    pieces: Array.from({ length: p.count ?? 3 }, (_, i) =>
      part(
        box([(r() - 0.5) * 0.04, i * 0.035, (r() - 0.5) * 0.04], [0.2, 0.035, 0.15]),
        pick(books, r),
        `book${i}`,
      ),
    ),
  }
}

/** A cup: a short cylinder. */
const cup: Generator = (p) => ({
  pieces: [part(cylinder([0, 0, 0], 0.04, 0.09, 10, 0.3), p.mat ?? 'potWhite', 'cup')],
})

/** A radiator: a row of fins (0.05 m apart) on two feet, 0.08 m deep. */
const radiator: Generator = (p) => {
  const w = p.width ?? 1
  const h = p.height ?? 0.6
  const n = Math.max(2, Math.round(w / 0.05))
  const fins: MeshData[] = []
  for (let i = 0; i < n; i++)
    fins.push(box([-w / 2 + 0.025 + (i * (w - 0.05)) / (n - 1), 0.1, 0], [0.035, h - 0.1, 0.08]))
  const feet = merge(
    box([-w / 2 + 0.06, 0, 0], [0.05, 0.1, 0.06]),
    box([w / 2 - 0.06, 0, 0], [0.05, 0.1, 0.06]),
  )
  return {
    pieces: [part(merge(...fins), p.mat ?? 'trimWhite', 'fins'), part(feet, p.mat ?? 'trimWhite', 'feet')],
  }
}

/** A notice board: a framed panel 0.03 m deep with 3–6 slips pinned to it, by the seed. */
const noticeboard: Generator = (p) => {
  const [w, h] = p.size ?? [0.9, 0.6]
  const r = stream(p.seed ?? 1)
  const n = 3 + Math.floor(r() * 4)
  const slips: MeshData[] = []
  for (let i = 0; i < n; i++)
    slips.push(
      box(
        [(r() - 0.5) * (w - 0.2), 0.04 + 0.08 + r() * (h - 0.2), 0.022],
        [0.1 + r() * 0.06, 0.14 + r() * 0.06, 0.004],
      ),
    )
  return {
    pieces: [
      part(box([0, 0, 0], [w + 0.08, h + 0.08, 0.03]), p.frame ?? 'oak', 'frame', { noCast: true }),
      part(box([0, 0.04, 0.012], [w, h, 0.01]), p.board ?? 'crateWood', 'board', { noCast: true }),
      part(merge(...slips), 'posterPaper', 'slips', { noCast: true }),
    ],
  }
}

/** A water cooler: a body with a bottle on top. */
const waterCooler: Generator = (p) => ({
  pieces: [
    part(rbox([0, 0, 0], [0.3, 1, 0.3], 0.15), p.body ?? 'potWhite', 'body'),
    part(cylinder([0, 1, 0], 0.12, 0.3, 12, 0.4), p.bottle ?? 'bottleClear', 'bottle', { noCast: true }),
  ],
})

/** A mop bucket: a bucket with a mop handle leaning on it, 15° off upright. */
const mopBucket: Generator = (p) => ({
  pieces: [
    part(cylinder([0, 0, 0], 0.18, 0.3, 12, 0.3), p.bucket ?? 'binGreen', 'bucket'),
    part(
      rod(
        [0.05, 0.12, 0],
        [0.05 + 0.9 * Math.sin(Math.PI / 12), 0.12 + 0.9 * Math.cos(Math.PI / 12), 0],
        0.013,
        6,
      ),
      p.handle ?? 'oak',
      'handle',
    ),
  ],
})

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

/** Bottles in a row (on a shelf or a counter): a seeded spread of heights and glass swatches. */
const bottles: Generator = (p) => {
  const r = stream(p.seed ?? 11)
  const n = p.count ?? 8
  const w = p.width ?? 1.2
  const glass: string[] = p.glass ?? ['bottleGreen', 'bottleAmber']
  const pieces: PropPiece[] = []
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n + (r() - 0.5) * 0.03
    const h = 0.18 + r() * 0.14
    const radius = 0.035 + r() * 0.015
    const mesh = merge(
      cylinder([x, 0, 0], radius, h * 0.62, 10, 0.35),
      cone([x, h * 0.6, 0], radius, radius * 0.35, h * 0.22, 8),
      cylinder([x, h * 0.8, 0], radius * 0.32, h * 0.2, 6, 0.3),
    )
    pieces.push(part(mesh, pick(glass, r), `bottle${i}`, { noCast: true }))
  }
  return { pieces }
}

/** A wall shelf: a board on brackets (bottles or pots stand on it as their own props). */
const ledge: Generator = (p) => {
  const w = p.width ?? 1.6
  const d = p.depth ?? 0.22
  const brackets = merge(
    box([-w * 0.38, -0.12, -d / 2 + 0.03], [0.03, 0.12, 0.05]),
    box([w * 0.38, -0.12, -d / 2 + 0.03], [0.03, 0.12, 0.05]),
  )
  return {
    pieces: [
      part(box([0, 0, 0], [w, 0.035, d]), p.mat, 'board'),
      part(brackets, p.bracket ?? p.mat, 'brackets'),
    ],
  }
}

/** A potted plant: a pot and a few clumps of leaves (or `fronds`: blades fanning out). */
const plant: Generator = (p) => {
  const r = stream(p.seed ?? 9)
  const h = p.height ?? 0.9
  const pot = p.pot ?? 0.17
  const pieces: PropPiece[] = [
    part(cone([0, 0, 0], pot * 0.75, pot, pot * 1.6, 12), p.potMat ?? 'terracotta', 'pot'),
  ]
  if (p.fronds) {
    const blades: MeshData[] = []
    for (let i = 0; i < (p.fronds as number); i++) {
      const a = r() * Math.PI * 2
      const out = 0.25 + r() * 0.35
      blades.push(
        rod(
          [0, pot * 1.5, 0],
          [Math.cos(a) * out * h * 0.6, h * (0.6 + r() * 0.4), Math.sin(a) * out * h * 0.3],
          0.035,
          4,
        ),
      )
    }
    pieces.push(part(merge(...blades), p.leaves, 'leaves', { sway: 0.03 }))
  } else
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2
      const rr = h * (0.22 + r() * 0.1)
      pieces.push(
        part(
          blob(
            [Math.cos(a) * rr * 0.5, pot * 1.6 + h * 0.35 + r() * h * 0.3, Math.sin(a) * rr * 0.4],
            [rr, rr * 0.8, rr],
            { lump: 0.25, seed: i + (p.seed ?? 0), seg: 10 },
          ),
          p.leaves,
          'leaves',
          { sway: 0.02 },
        ),
      )
    }
  return { pieces }
}

/** A framed picture or a poster on the wall: a frame and its canvas (its swatch's pattern is the picture). */
const picture: Generator = (p) => {
  const [w, h] = p.size ?? [0.6, 0.45]
  const f = p.frameWidth ?? 0.04
  return {
    pieces: [
      part(rbox([0, 0, 0], [w + 2 * f, h + 2 * f, 0.03], 0.1), p.frame ?? 'oakDark', 'frame', {
        noCast: true,
      }),
      part(quad([-w / 2, f, 0.032], [w, 0, 0], [0, h, 0]), p.canvas, 'canvas', { noCast: true }),
    ],
  }
}

/** Curtains: two hanging folds of cloth on a rail, drawn back to either side of a window. */
const curtains: Generator = (p) => {
  const w = p.width ?? 1.6
  const h = p.height ?? 1.6
  const panel = p.panel ?? 0.38
  const pieces: PropPiece[] = [
    part(
      rod([-w / 2 - 0.1, h + 0.05, 0.05], [w / 2 + 0.1, h + 0.05, 0.05], 0.015, 6),
      p.rail ?? 'brass',
      'rail',
    ),
  ]
  for (const side of [-1, 1])
    pieces.push(
      part(
        tube([h, panel / 2, 0.05, 0.05], [0.03, panel / 2 + 0.06, 0.07, 0.07], {
          x: side * (w / 2 - panel / 2 + 0.05),
          arc: [0, Math.PI],
          folds: [9, 0.22],
          seg: 18,
          rings: 6,
        }),
        p.mat,
        `panel${side}`,
        { noCast: true },
      ),
    )
  return { pieces }
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

/** A screen (a TV, a monitor, a vending panel): a dark body with a glowing face. */
const screen: Generator = (p) => {
  const [w, h] = p.size ?? [0.9, 0.55]
  const y = p.y ?? 0
  return {
    pieces: [
      part(rbox([0, y, 0], [w, h, 0.06], 0.15), p.body ?? 'tyre', 'body'),
      part(
        quad([-w / 2 + 0.04, y + 0.04, 0.032], [w - 0.08, 0, 0], [0, h - 0.08, 0]),
        p.face ?? 'screenGlow',
        'face',
        {
          noCast: true,
        },
      ),
    ],
    lights: p.light ? [lightOf([0, y + h / 2, 0.4], p, { kind: 'neon', color: '#88d6ff' })] : [],
  }
}

export const SMALL_THINGS: Readonly<Record<string, Generator>> = {
  paper,
  bookStack,
  cup,
  radiator,
  noticeboard,
  waterCooler,
  mopBucket,
  lamp,
  bottles,
  ledge,
  plant,
  picture,
  curtains,
  bin,
  screen,
}
