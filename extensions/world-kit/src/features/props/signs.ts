// The prop generators that carry words: a neon sign in a shape, neon and panel lettering, a street-name plate. The
// words are the level's `text`, or a made-up name from the seed.
//
// Ported from the world generator this kit grew out of: `neon`,
// `signboard`, `neonText`, `streetPlate`.
import {
  blob,
  type Generator,
  lightOf,
  merge,
  type PropPiece,
  part,
  rbox,
  rod,
  type V3,
} from '@automata/3d/props-kit'
import {
  letterMesh,
  setText,
  shopName,
  sizeOf,
  streetName,
  tubeMesh,
} from '../../shared/lettering/lettering.ts'
import { lifted } from '../../shared/piece-helpers.ts'

type Point = readonly [number, number]

/**
 * A neon sign: glowing tubes bent into a shape (`rect`, `ring`, `glass` a cocktail glass, `bars`, `arrow`, `heart`), on
 * an optional dark backing; it lights the wall round it in its own colour.
 */
const neon: Generator = (p) => {
  const s = p.scale ?? 1
  const thick = (p.thick ?? 0.018) * s
  const shape: string = p.shape ?? 'rect'
  const z = 0.04
  const segs: [V3, V3][] = []
  const poly = (points: readonly Point[], closed = false): void => {
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
      const a = points[i] as Point
      const b = points[(i + 1) % points.length] as Point
      segs.push([
        [a[0] * s, a[1] * s, z],
        [b[0] * s, b[1] * s, z],
      ])
    }
  }
  const circle = (cx: number, cy: number, r: number, n = 14, a0 = 0, a1 = Math.PI * 2): void =>
    poly(
      Array.from({ length: n + 1 }, (_, i): Point => {
        const a = a0 + ((a1 - a0) * i) / n
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.95]
      }),
    )
  if (shape === 'rect')
    poly(
      [
        [-0.5, 0],
        [0.5, 0],
        [0.5, 0.5],
        [-0.5, 0.5],
      ],
      true,
    )
  if (shape === 'ring') circle(0, 0.3, 0.28, 18)
  if (shape === 'glass') {
    poly([
      [-0.25, 0.6],
      [0, 0.32],
      [0.25, 0.6],
      [-0.25, 0.6],
    ])
    poly([
      [0, 0.32],
      [0, 0.08],
    ])
    poly([
      [-0.14, 0.06],
      [0.14, 0.06],
    ])
    circle(0.2, 0.62, 0.06, 8)
  }
  if (shape === 'bars')
    for (let i = 0; i < 3; i++)
      poly([
        [-0.4, 0.1 + i * 0.16],
        [0.4, 0.1 + i * 0.16],
      ])
  if (shape === 'arrow')
    poly([
      [-0.45, 0.25],
      [0.3, 0.25],
      [0.15, 0.42],
      [0.45, 0.25],
      [0.15, 0.08],
      [0.3, 0.25],
    ])
  if (shape === 'heart') {
    circle(-0.12, 0.42, 0.13, 8, 0, Math.PI)
    circle(0.12, 0.42, 0.13, 8, 0, Math.PI)
    poly([
      [-0.25, 0.42],
      [0, 0.08],
      [0.25, 0.42],
    ])
  }
  const tubes = merge(
    ...segs.map(([a, b]) => merge(rod(a, b, thick, 6), blob(a, [thick, thick, thick], { seg: 6 }))),
  )
  const pieces: PropPiece[] = [part(tubes, p.tube ?? 'neonPink', 'tube', { noCast: true })]
  if (p.backing)
    pieces.push(
      part(
        rbox([0, (p.backY ?? 0) * s - 0.05, 0], [(p.backW ?? 1.1) * s, (p.backH ?? 0.8) * s, 0.03], 0.1),
        p.backing,
        'backing',
        {
          noCast: true,
        },
      ),
    )
  return { pieces, lights: [lightOf([0, 0.3 * s, 0.35], p, { kind: 'neon', range: 2.2 * s })] }
}

/**
 * A shop's signboard: a panel with raised letters (its `text`, or a generated shop name), a texel `px` metres, the
 * panel sized to the words with a margin. Its front at z = 0 of its own space; hang it on a wall.
 */
const signboard: Generator = (p) => {
  const rows = setText(p.text ?? shopName(p.seed ?? 1))
  const [W, H] = sizeOf(rows)
  const px = p.px ?? 0.06
  const w = (W + 4) * px
  const h = (H + 3) * px
  return {
    pieces: [
      part(rbox([0, 0, -0.04], [w, h, 0.08], 0.15), p.panel ?? 'signCream', 'panel'),
      lifted(
        part(letterMesh(rows, px, 0.003), p.ink ?? 'posterInkBlack', 'letters', { noCast: true }),
        1.5 * px,
      ),
    ],
  }
}

/** Neon lettering: glowing tubes along the letters (its `text`, or a generated name), on an optional dark backing. */
const neonText: Generator = (p) => {
  const rows = setText(p.text ?? shopName(p.seed ?? 2).slice(-1))
  const [W, H] = sizeOf(rows)
  const px = p.px ?? 0.09
  const pieces: PropPiece[] = [
    part(tubeMesh(rows, px, 0.04, p.thick ?? px * 0.17), p.tube ?? 'neonPink', 'tube', { noCast: true }),
  ]
  if (p.backing)
    pieces.push(
      part(rbox([0, -px, 0], [(W + 2) * px, (H + 2) * px, 0.03], 0.1), p.backing, 'backing', {
        noCast: true,
      }),
    )
  return {
    pieces,
    lights: [lightOf([0, (H * px) / 2, 0.4], p, { kind: 'neon', range: Math.max(1.6, W * px * 0.9) })],
  }
}

/** A street-name plate: white letters on a coloured plate, on a post (`post` metres tall) or flat on a wall. */
const streetPlate: Generator = (p) => {
  const rows = setText(p.text ?? streetName(p.seed ?? 3))
  const [W, H] = sizeOf(rows)
  const px = p.px ?? 0.04
  const w = (W + 4) * px
  const h = (H + 4) * px
  const y = p.post ?? 0
  const pieces: PropPiece[] = [
    part(rbox([0, y, 0], [w, h, 0.03], 0.2), p.plate ?? 'signBlue', 'plate'),
    lifted(part(letterMesh(rows, px, 0.017), 'posterPaper', 'letters', { noCast: true }), y + 2 * px),
  ]
  if (y) pieces.push(part(rod([0, 0, -0.03], [0, y + h, -0.03], 0.03, 6), p.pole ?? 'poleTeal', 'pole'))
  return { pieces }
}

export const SIGNS: Readonly<Record<string, Generator>> = { neon, signboard, neonText, streetPlate }
