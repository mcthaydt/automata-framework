// A clinic's rolling equipment: a gurney, a wheelchair, an IV stand and a monitor cart. Each stands on its wheels with its
// origin at the centre of its base; the gurney lies along x, the others face +z. Sizes are the source's models' boxes, so a
// `fit` to one barely stretches the shape.
import { blob, box, type Generator, merge, part, rbox, rod, type V3 } from '@automata/3d/props-kit'

/** A wheel with its axle along x: a short fat rod whose lowest point is the floor. */
const wheel = (x: number, z: number, radius: number, thick = 0.03): ReturnType<typeof rod> =>
  rod([x - thick / 2, radius, z], [x + thick / 2, radius, z], radius, 10)

/** A gurney: a mattress on a steel frame with a rail along each side, a pillow at the head (−x) and four wheels. */
const gurney: Generator = (p) => {
  const [l, w] = p.size ?? [1.8, 0.62]
  const top = p.height ?? 0.9
  const rail = top + 0.1
  const legs = ([-1, 1] as const).flatMap((sx) =>
    ([-1, 1] as const).map((sz) =>
      box([sx * (l / 2 - 0.16), 0.08, sz * (w / 2 - 0.07)], [0.04, top - 0.34, 0.04]),
    ),
  )
  return {
    pieces: [
      part(rbox([0, top - 0.17, 0], [l, 0.12, w], 0.4), p.mattress ?? 'linen', 'mattress'),
      part(
        merge(
          box([0, top - 0.34, 0], [l - 0.25, 0.04, w - 0.1]),
          rod([-l / 2 + 0.2, rail, w / 2], [l / 2 - 0.2, rail, w / 2], 0.015, 6),
          rod([-l / 2 + 0.2, rail, -w / 2], [l / 2 - 0.2, rail, -w / 2], 0.015, 6),
          box([-l / 2 + 0.03, top - 0.34, 0], [0.04, 0.2, w - 0.1]),
          ...legs,
        ),
        p.frame ?? 'chrome',
        'frame',
      ),
      part(
        merge(
          ...([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sz) => wheel(sx * (l / 2 - 0.16), sz * (w / 2 - 0.07), 0.07)),
          ),
        ),
        p.tyre ?? 'tyre',
        'wheels',
        { noCast: true },
      ),
      part(
        blob([-l / 2 + 0.3, top - 0.08, 0], [0.18, 0.07, w * 0.32], { e: 0.55, lump: 0.04, seed: 2 }),
        p.pillow ?? 'pillowWhite',
        'pillow',
      ),
    ],
  }
}

/** A wheelchair facing +z: a seat and a back on a frame, two big wheels at the sides, two small castors in front, push handles. */
const wheelchair: Generator = (p) => {
  const w = p.width ?? 0.65
  const l = p.length ?? 0.95
  const seatY = 0.48
  const side = w / 2 - 0.03
  return {
    pieces: [
      part(rbox([0, seatY, 0.05], [w - 0.16, 0.05, l * 0.5], 0.3), p.upholstery ?? 'leatherBlack', 'seat'),
      part(rbox([0, seatY, -l * 0.2], [w - 0.16, 0.45, 0.05], 0.3), p.upholstery ?? 'leatherBlack', 'back'),
      part(
        merge(
          rod([-(w / 2 - 0.09), seatY, -l * 0.2], [-(w / 2 - 0.09), 0.2, l * 0.28], 0.015, 6),
          rod([w / 2 - 0.09, seatY, -l * 0.2], [w / 2 - 0.09, 0.2, l * 0.28], 0.015, 6),
          rod([-(w / 2 - 0.09), seatY + 0.45, -l * 0.2], [-(w / 2 - 0.09), seatY + 0.45, -l * 0.5], 0.015, 6),
          rod([w / 2 - 0.09, seatY + 0.45, -l * 0.2], [w / 2 - 0.09, seatY + 0.45, -l * 0.5], 0.015, 6),
          rod(
            [-(w / 2 - 0.09), seatY - 0.02, -l * 0.15],
            [-(w / 2 - 0.09), seatY - 0.02, l * 0.25],
            0.015,
            6,
          ),
          rod([w / 2 - 0.09, seatY - 0.02, -l * 0.15], [w / 2 - 0.09, seatY - 0.02, l * 0.25], 0.015, 6),
        ),
        p.frame ?? 'chrome',
        'frame',
      ),
      part(
        merge(
          wheel(-side, -l * 0.15, 0.3, 0.04),
          wheel(side, -l * 0.15, 0.3, 0.04),
          wheel(-(w / 2 - 0.12), l * 0.38, 0.07),
          wheel(w / 2 - 0.12, l * 0.38, 0.07),
        ),
        p.tyre ?? 'tyre',
        'wheels',
        { noCast: true },
      ),
    ],
  }
}

/** An IV stand: a pole on a five-armed foot of wheels, a hook arm at the top and a bag hanging from it. */
const ivStand: Generator = (p) => {
  const h = p.height ?? 1.8
  const foot = p.foot ?? 0.42
  const arms = Array.from({ length: 5 }, (_, i): V3 => {
    const a = (i / 5) * Math.PI * 2
    return [Math.cos(a) * foot, 0.06, Math.sin(a) * foot]
  })
  return {
    pieces: [
      part(rod([0, 0.06, 0], [0, h, 0], 0.012, 8), p.pole ?? 'chrome', 'pole'),
      part(
        merge(
          ...arms.map((arm) => rod([0, 0.06, 0], arm, 0.012, 6)),
          rod([-0.12, h, 0], [0.12, h, 0], 0.012, 6),
        ),
        p.pole ?? 'chrome',
        'feet',
      ),
      part(merge(...arms.map((arm) => wheel(arm[0], arm[2], 0.03, 0.02))), p.tyre ?? 'tyre', 'wheels', {
        noCast: true,
      }),
      part(rbox([0.12, h - 0.34, 0], [0.12, 0.26, 0.04], 0.6), p.bag ?? 'bottleClear', 'bag', {
        noCast: true,
      }),
    ],
  }
}

/** A monitor cart: a body on four castors with a drawer, a column, and a screen on top facing +z. */
const monitorCart: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.71, 1.1, 0.54]
  return {
    pieces: [
      part(rbox([0, 0.1, 0], [w - 0.1, 0.5, d - 0.05], 0.15), p.body ?? 'pipeSteel', 'body'),
      part(
        merge(
          box([0, 0.6, -d * 0.2], [0.08, h - 0.95, 0.08]),
          rbox([0, h - 0.35, 0], [w - 0.06, 0.3, 0.1], 0.2),
        ),
        p.body ?? 'pipeSteel',
        'column',
      ),
      part(box([0, h - 0.33, 0.055], [w - 0.16, 0.24, 0.01]), p.face ?? 'screenGlow', 'screen'),
      part(
        merge(
          ...([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sz) => wheel(sx * (w / 2 - 0.1), sz * (d / 2 - 0.08), 0.05)),
          ),
        ),
        p.tyre ?? 'tyre',
        'wheels',
        { noCast: true },
      ),
    ],
  }
}

export const MEDICAL: Readonly<Record<string, Generator>> = { gurney, wheelchair, ivStand, monitorCart }
