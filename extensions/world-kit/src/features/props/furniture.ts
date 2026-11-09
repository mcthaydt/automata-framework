// The prop generators for furniture: seats, tables, beds, storage, counters and the barrels and crates of a store room.
//
// Ported from the world generator this kit grew out of. Changed: parts are
// `part(mesh, swatch, label)`, a seeded stream is `stream`, and the numbers are the source's.
import {
  at,
  blob,
  box,
  cylinder,
  type Generator,
  limb,
  type MeshData,
  merge,
  type PropPiece,
  part,
  rbox,
  rod,
  stream,
} from '@automata/3d/props-kit'
import { CORNERS } from '../../shared/piece-helpers.ts'
import { turnX, turnY } from '../../shared/turn.ts'

const pick = <T>(list: readonly T[], r: () => number): T => at(list, Math.floor(r() * list.length))

/** A row of seats on one beam: a seat and a back each, 0.5 m apart, two legs. */
const chairRow: Generator = (p) => {
  const n = p.seats ?? 3
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.5)
  const length = n * 0.5
  return {
    pieces: [
      part(
        merge(...xs.map((x) => rbox([x, 0.42, 0], [0.44, 0.07, 0.42], 0.3))),
        p.seat ?? 'leatherBlack',
        'seats',
      ),
      part(
        merge(...xs.map((x) => rbox([x, 0.5, -0.19], [0.44, 0.4, 0.06], 0.3))),
        p.seat ?? 'leatherBlack',
        'backs',
      ),
      part(
        merge(
          box([0, 0.34, 0], [length, 0.05, 0.05]),
          box([-length / 2 + 0.1, 0, 0], [0.05, 0.36, 0.4]),
          box([length / 2 - 0.1, 0, 0], [0.05, 0.36, 0.4]),
        ),
        p.frame ?? 'chrome',
        'frame',
      ),
    ],
  }
}

/** A filing cabinet: a box, its drawer fronts and their handles. */
const filingCabinet: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.47, 1.32, 0.62]
  const n = p.drawers ?? 4
  const seams: MeshData[] = []
  const handles: MeshData[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0) seams.push(box([0, (h * i) / n, d / 2 + 0.002], [w - 0.04, 0.01, 0.006]))
    handles.push(box([0, (h * (i + 0.5)) / n, d / 2 + 0.014], [0.16, 0.025, 0.02]))
  }
  return {
    pieces: [
      part(rbox([0, 0, 0], [w, h, d], 0.08), p.mat ?? 'metalBox', 'body'),
      part(merge(...seams), p.mat ?? 'metalBox', 'seams'),
      part(merge(...handles), p.handle ?? 'chrome', 'handles'),
    ],
    top: { y: h, size: [0.43, 0.58] },
  }
}

/** A shelving unit: four corner posts and `shelves` boards, the top one at the unit's height. */
const shelvingUnit: Generator = (p) => {
  const [w, h, d] = p.size ?? [1, 1.8, 0.45]
  const n = p.shelves ?? 4
  const posts = CORNERS.map(([sx, sz]) => box([sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02)], [0.04, h, 0.04]))
  const boards = Array.from({ length: n }, (_, i) =>
    box([0, 0.1 + (i * (h - 0.12)) / Math.max(1, n - 1), 0], [w, 0.02, d]),
  )
  return {
    pieces: [
      part(merge(...posts), p.mat ?? 'metalBox', 'posts'),
      part(merge(...boards), p.mat ?? 'metalBox', 'shelves'),
    ],
    top: { y: h, size: [w - 0.04, d - 0.04] },
  }
}

/** A plain block: a step, a plinth, a box on the floor. */
const block: Generator = (p) => ({
  pieces: [
    part(p.round === 0 ? box([0, 0, 0], p.size) : rbox([0, 0, 0], p.size, p.round ?? 0.15), p.mat, 'block'),
  ],
})

/** A rug or a mat: a thin slab with a border. */
const rug: Generator = (p) => {
  const [w, d] = p.size
  const b = p.borderWidth ?? 0.08
  return {
    pieces: [
      part(box([0, 0, 0], [w, 0.012, d]), p.border ?? p.mat, 'border', { noCast: true }),
      part(box([0, 0.012, 0], [w - 2 * b, 0.006, d - 2 * b]), p.mat, 'field', { noCast: true }),
    ],
  }
}

/** A chair: a seat, a back and four legs; a cushion if it has one. */
const chair: Generator = (p) => {
  const seat = p.seat ?? 0.45
  const w = p.width ?? 0.44
  const d = p.depth ?? 0.42
  const back = p.back ?? 0.92
  const legs = CORNERS.map(([sx, sz]) =>
    box([sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03)], [0.04, seat - 0.04, 0.04]),
  )
  const pieces: PropPiece[] = [
    part(rbox([0, seat - 0.05, 0], [w, 0.05, d], 0.15), p.mat, 'seat'),
    part(merge(...legs), p.mat, 'legs'),
    part(rbox([0, seat, -d / 2 + 0.02], [w, back - seat, 0.04], 0.2), p.mat, 'back'),
  ]
  if (p.cushion)
    pieces.push(part(rbox([0, seat, 0.01], [w - 0.04, 0.06, d - 0.06], 0.6), p.cushion, 'cushion'))
  return { pieces }
}

/** A bed, lengthwise along x, its head at −x: a frame, a mattress in its sheet, a blanket over the foot, a pillow. */
const bed: Generator = (p) => {
  const [length, width] = p.size ?? [2, 1]
  const h = p.height ?? 0.32
  const headboard = p.headboard ?? 0.95
  const posts = CORNERS.map(([sx, sz]) =>
    box([sx * (length / 2 - 0.05), 0, sz * (width / 2 - 0.05)], [0.07, 0.08, 0.07]),
  )
  return {
    pieces: [
      part(rbox([0, 0.06, 0], [length, h - 0.06, width], 0.12), p.frame, 'frame'),
      part(merge(...posts), p.frame, 'frame'),
      part(rbox([0, h, 0], [length - 0.06, 0.18, width - 0.04], 0.35), p.sheet, 'sheet'),
      part(rbox([length * 0.14, h + 0.02, 0], [length * 0.7, 0.2, width + 0.06], 0.5), p.blanket, 'blanket'),
      part(
        blob([-length / 2 + 0.3, h + 0.24, 0], [0.18, 0.08, width * 0.36], { e: 0.55, lump: 0.04, seed: 2 }),
        p.pillow,
        'pillow',
      ),
      part(rbox([-length / 2 - 0.02, 0, 0], [0.07, headboard, width + 0.04], 0.2), p.frame, 'head'),
      part(rbox([length / 2 + 0.02, 0, 0], [0.07, h + 0.24, width + 0.04], 0.2), p.frame, 'foot'),
    ],
  }
}

/** A bookcase: sides, top, base, a back and shelves, filled with books in a seeded spread of swatches. */
const shelf: Generator = (p) => {
  const [w, h, d] = p.size
  const t = 0.03
  const n = p.shelves ?? 4
  const r = stream(p.seed ?? 1)
  const books: string[] = p.books ?? []
  const pieces: PropPiece[] = [
    part(
      merge(
        box([-w / 2 + t / 2, 0, 0], [t, h, d]),
        box([w / 2 - t / 2, 0, 0], [t, h, d]),
        box([0, h - t, 0], [w, t, d]),
        box([0, 0, 0], [w, 0.07, d]),
      ),
      p.mat,
      'case',
    ),
    part(box([0, 0, -d / 2 + 0.01], [w - 2 * t, h - t, 0.02]), p.back ?? p.mat, 'back'),
  ]
  const gap = (h - 0.07 - t) / n
  for (let i = 0; i < n; i++) {
    const y = 0.07 + i * gap
    if (i > 0) pieces.push(part(box([0, y - t, 0], [w - 2 * t, t, d - 0.02]), p.mat, 'case'))
    if (books.length === 0) continue
    let x = -w / 2 + t + 0.01
    const end = w / 2 - t - 0.01 - (r() < 0.5 ? r() * w * 0.35 : 0)
    while (x < end) {
      const bw = 0.025 + r() * 0.035
      const bh = gap * (0.62 + r() * 0.28)
      const bd = d * (0.7 + r() * 0.2)
      if (x + bw > end) break
      const tilt = r() < 0.08 && x + bh < end
      const mesh = tilt
        ? turnY(box([0, 0, 0], [bh, bw, bd]), 0, [x + bh / 2, y, -0.01])
        : box([x + bw / 2, y, -0.01], [bw, bh, bd])
      pieces.push(part(mesh, pick(books, r), `book${pieces.length}`))
      x += tilt ? bh + 0.004 : bw + 0.002
    }
  }
  return { pieces, top: { y: h, size: [w - 0.04, d - 0.04] } }
}

/** A cabinet, a nightstand or a wardrobe: a box with its doors' or drawers' seams and their handles. */
const cabinet: Generator = (p) => {
  const [w, h, d] = p.size
  const rows = p.drawers ?? 0
  const cols = p.doors ?? 0
  const pieces: PropPiece[] = [
    part(rbox([0, 0.04, 0], [w, h - 0.04, d], 0.08), p.mat, 'body'),
    part(box([0, 0, 0], [w - 0.06, 0.05, d - 0.06]), p.base ?? p.mat, 'base'),
  ]
  const front = d / 2 + 0.004
  const seams: MeshData[] = []
  const knobs: MeshData[] = []
  for (let i = 1; i < rows; i++)
    seams.push(box([0, 0.04 + ((h - 0.04) * i) / rows, front], [w - 0.06, 0.012, 0.01]))
  for (let i = 1; i < cols; i++)
    seams.push(box([-w / 2 + (w * i) / cols, 0.06, front], [0.012, h - 0.1, 0.01]))
  for (let i = 0; i < rows; i++)
    knobs.push(blob([0, 0.04 + ((h - 0.04) * (i + 0.5)) / rows, front + 0.015], [0.025, 0.018, 0.015]))
  for (let i = 0; i < cols; i++)
    knobs.push(
      box(
        [-w / 2 + (w * (i + 0.5)) / cols + ((i % 2 ? -1 : 1) * w * 0.18) / cols, h * 0.5, front + 0.01],
        [0.02, 0.12, 0.02],
      ),
    )
  if (seams.length > 0) pieces.push(part(merge(...seams), p.seam ?? p.mat, 'seams'))
  if (knobs.length > 0) pieces.push(part(merge(...knobs), p.knob ?? p.mat, 'knobs'))
  return { pieces, top: { y: h, size: [w - 0.04, d - 0.04] } }
}

/** A counter or a bar: a body, a top that overhangs toward the customer (+z), a kick base and a foot rail. */
const counter: Generator = (p) => {
  const [w, h, d] = p.size ?? [3, 1.05, 0.6]
  const pieces: PropPiece[] = [
    part(box([0, 0.1, 0], [w, h - 0.15, d]), p.body, 'body'),
    part(box([0, 0, -0.03], [w - 0.06, 0.1, d - 0.08]), p.kick ?? 'tyre', 'kick'),
    part(rbox([0, h - 0.05, 0.06], [w + 0.1, 0.06, d + 0.16], 0.15), p.top, 'top'),
  ]
  if (p.panels) {
    const n = Math.round(w / 0.6)
    const seams: MeshData[] = []
    for (let i = 1; i < n; i++) seams.push(box([-w / 2 + (w * i) / n, 0.15, d / 2], [0.03, h - 0.3, 0.02]))
    pieces.push(part(merge(...seams), p.panels, 'panels'))
  }
  if (p.rail)
    pieces.push(
      part(
        rod([-w / 2 + 0.1, 0.22, d / 2 + 0.12], [w / 2 - 0.1, 0.22, d / 2 + 0.12], 0.02, 6),
        p.rail,
        'rail',
      ),
    )
  return { pieces, top: { y: h, size: [w - 0.1, d - 0.1] } }
}

/** A bar stool: a round seat on a pole, a foot ring, a disc base. */
const stool: Generator = (p) => {
  const h = p.height ?? 0.75
  const metal = p.metal ?? 'chrome'
  return {
    pieces: [
      part(cylinder([0, h - 0.07, 0], 0.19, 0.08, 14, 0.5), p.seat, 'seat'),
      part(rod([0, 0.02, 0], [0, h - 0.06, 0], 0.025, 6), metal, 'pole'),
      part(cylinder([0, h * 0.35, 0], 0.15, 0.02, 12, 0.5), metal, 'ring'),
      part(cylinder([0, 0, 0], 0.2, 0.03, 12, 0.4), metal, 'base'),
    ],
  }
}

/** A bench: slats on two legs. */
const bench: Generator = (p) => {
  const w = p.width ?? 1.6
  const slats: MeshData[] = []
  for (let i = 0; i < 3; i++) slats.push(rbox([0, 0.44, -0.15 + i * 0.13], [w, 0.04, 0.1], 0.2))
  for (let i = 0; i < 2; i++)
    slats.push(turnX(rbox([0, 0, 0], [w, 0.04, 0.09], 0.2), -12, [0, 0.62 + i * 0.16, -0.24]))
  const legs = merge(
    box([-w * 0.4, 0, -0.1], [0.06, 0.44, 0.4]),
    box([w * 0.4, 0, -0.1], [0.06, 0.44, 0.4]),
    box([-w * 0.4, 0.44, -0.27], [0.06, 0.45, 0.05]),
    box([w * 0.4, 0.44, -0.27], [0.06, 0.45, 0.05]),
  )
  return { pieces: [part(merge(...slats), p.mat, 'slats'), part(legs, p.legs ?? 'ironDark', 'legs')] }
}

/** A wooden crate: a box with slats across its faces. */
const crate: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.6, 0.5, 0.6]
  const s = 0.06
  const slats: MeshData[] = []
  for (const y of [0.05, h - 0.05 - s])
    slats.push(box([0, y, d / 2], [w + 0.01, s, 0.02]), box([w / 2, y, 0], [0.02, s, d + 0.01]))
  const diagonal = (length: number): MeshData =>
    rod([-length / 2, 0.08, d / 2 + 0.01], [length / 2, h - 0.08, d / 2 + 0.01], 0.022, 4)
  slats.push(diagonal(w * 0.8))
  return {
    pieces: [
      part(rbox([0, 0, 0], [w, h, d], 0.08), p.mat, 'box'),
      part(merge(...slats), p.slat ?? p.mat, 'slats'),
    ],
  }
}

/** A barrel: a bellied stave body with darker hoops. */
const barrel: Generator = (p) => {
  const r = p.radius ?? 0.3
  const h = p.height ?? 0.85
  const body = limb({
    rings: [
      { y: 0, rx: r * 0.86, rz: r * 0.86 },
      { y: h / 2, rx: r, rz: r },
      { y: h, rx: r * 0.86, rz: r * 0.86 },
    ],
    caps: [0.02, 0.02],
    round: [0.2, 0.2],
    seg: 14,
    step: 0.08,
  })
  const hoops = [0.12, h - 0.12, h * 0.38, h * 0.62].map((y) =>
    cylinder([0, y - 0.02, 0], r * (y > 0.2 && y < h - 0.2 ? 1.0 : 0.92) + 0.008, 0.04, 14, 0.4),
  )
  return { pieces: [part(body, p.mat, 'body'), part(merge(...hoops), p.hoop ?? 'ironDark', 'hoops')] }
}

export const FURNITURE: Readonly<Record<string, Generator>> = {
  chairRow,
  filingCabinet,
  shelvingUnit,
  block,
  rug,
  chair,
  bed,
  shelf,
  cabinet,
  counter,
  stool,
  bench,
  crate,
  barrel,
}
