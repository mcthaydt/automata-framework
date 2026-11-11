// The pieces a run-down clinic is dressed with that the kit lacked: the light that falls through a window and pools under a
// lamp, a puddle, grime, a run of pipe, a cable, a ceiling tile, a notice pinned to a wall and a lit plaque. The light, the
// puddle and the grime are translucent parts (`veil`): the builder draws them unlit and shadowless over what is behind them.
// Numbers here are the kit's own: a preset in `library/props.json` names each.
import {
  axisAngle,
  box,
  cylinder,
  type Generator,
  type MeshData,
  merge,
  part,
  placed,
  quad,
  rbox,
  rod,
  stream,
  type V3,
} from '@automata/3d/props-kit'

/** One flat piece of a mesh from four corners in order (a trapezoid, which `quad` cannot make); the normal follows the winding. */
function facet(a: V3, b: V3, c: V3, d: V3): MeshData {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
  const n = [
    (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
    (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
    (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
  ]
  const length = Math.hypot(...(n as [number, number, number])) || 1
  const normal = n.map((x) => x / length)
  return {
    positions: [...a, ...b, ...c, ...d],
    normals: [...normal, ...normal, ...normal, ...normal],
    indices: [0, 1, 2, 0, 2, 3],
  }
}

/** A flat disc or blob on the floor at height `y`: `n` points round the centre at `radius`, each nudged by `wobble` of it. */
function flat(
  rx: number,
  rz: number,
  y: number,
  n: number,
  wobble: number,
  r: () => number,
  at: [number, number] = [0, 0],
): MeshData {
  const positions: number[] = [at[0], y, at[1]]
  const normals: number[] = [0, 1, 0]
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    const k = 1 + (r() - 0.5) * 2 * wobble
    positions.push(at[0] + Math.cos(angle) * rx * k, y, at[1] + Math.sin(angle) * rz * k)
    normals.push(0, 1, 0)
  }
  // Seen from above (+y), the points run clockwise in x then z, so the winding is centre, next, this.
  for (let i = 0; i < n; i++) indices.push(0, 1 + ((i + 1) % n), 1 + i)
  return { positions, normals, indices }
}

/**
 * Light through a window: a shaft from the window's top (`height` up the wall, `topHalf` either side of the origin) to a
 * patch on the floor `foot` metres out from the wall (x along it, z into the room), `footHalf` wide; both add their light.
 */
const moonShaft: Generator = (p) => {
  const y = p.height ?? 3.4
  const [fx, fz] = (p.foot as [number, number] | undefined) ?? [0, 2]
  const th = p.topHalf ?? 0.4
  const fh = p.footHalf ?? 0.8
  const depth = p.footDepth ?? fh * 1.6
  const floor = 0.02
  const top: V3[] = [
    [-th, y, 0],
    [th, y, 0],
    [th, y, 0.04],
    [-th, y, 0.04],
  ]
  const foot: V3[] = [
    [fx - fh, floor, fz],
    [fx + fh, floor, fz],
    [fx + fh, floor, fz + depth],
    [fx - fh, floor, fz + depth],
  ]
  const sides = [0, 1, 2, 3].map((i) =>
    facet(top[i] as V3, top[(i + 1) % 4] as V3, foot[(i + 1) % 4] as V3, foot[i] as V3),
  )
  return {
    pieces: [
      part(merge(...sides), p.mat ?? 'moonBeam', 'beam', { veil: { opacity: p.opacity ?? 0.1, add: true } }),
      part(quad([fx - fh, floor, fz + depth], [2 * fh, 0, 0], [0, 0, -depth]), p.mat ?? 'moonBeam', 'patch', {
        veil: { opacity: p.patch ?? 0.22, add: true },
      }),
    ],
  }
}

/** A pool of lamplight on the floor: a wide dim disc and a narrower, brighter one over it; both add their light. */
const lightPool: Generator = (p) => {
  const radius = p.radius ?? 1.4
  const opacity = p.opacity ?? 0.22
  const r = stream(1)
  return {
    pieces: [
      part(flat(radius, radius, 0.014, 24, 0, r), p.mat ?? 'lampPool', 'pool', {
        veil: { opacity, add: true },
      }),
      part(flat(radius * 0.55, radius * 0.55, 0.016, 20, 0, r), p.mat ?? 'lampPool', 'core', {
        veil: { opacity: Math.min(1, opacity * 1.6), add: true },
      }),
    ],
  }
}

/** A puddle: a dark glossy blob on the floor, its edge wobbled by the seed, with a small bright sheen on it. */
const puddle: Generator = (p) => {
  const [w, d] = p.size ?? [0.9, 0.6]
  const r = stream(p.seed ?? 1)
  return {
    pieces: [
      part(flat(w / 2, d / 2, 0.018, 14, 0.18, r), p.mat ?? 'puddleDark', 'water', {
        veil: { opacity: p.opacity ?? 0.6 },
      }),
      part(
        flat(w * 0.2, d * 0.18, 0.02, 10, 0.1, r, [w * 0.08, -d * 0.08]),
        p.sheen ?? 'puddleSheen',
        'sheen',
        {
          veil: { opacity: 0.3, add: true },
        },
      ),
    ],
  }
}

/** Grime on the floor: `blots` soft dark blobs spread over `size`, by the seed. */
const grime: Generator = (p) => {
  const [w, d] = p.size ?? [1.4, 2.2]
  const r = stream(p.seed ?? 1)
  const blots = Array.from({ length: p.blots ?? 3 }, () =>
    flat(w * (0.25 + 0.2 * r()), d * (0.15 + 0.15 * r()), 0.012, 12, 0.25, r, [
      (r() - 0.5) * w * 0.5,
      (r() - 0.5) * d * 0.5,
    ]),
  )
  return {
    pieces: [part(merge(...blots), p.mat ?? 'grimeDark', 'blots', { veil: { opacity: p.opacity ?? 0.3 } })],
  }
}

/** A run of pipe through `points` (x, y, z from the origin), with a bracket every `bracket` metres along it. */
const pipeRun: Generator = (p) => {
  const points: V3[] = p.points ?? [
    [0, 3, 0],
    [2, 3, 0],
  ]
  const radius = p.radius ?? 0.035
  const every = p.bracket ?? 0.9
  const pipes: MeshData[] = []
  const brackets: MeshData[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i] as V3
    const b = points[i + 1] as V3
    pipes.push(rod(a, b, radius, 8))
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    for (let at = every / 2; at < length; at += every) {
      const t = at / length
      const c: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      brackets.push(box([c[0], c[1] - radius * 1.6, c[2]], [radius * 2.4, radius * 3.2, radius * 2.4]))
    }
  }
  return {
    pieces: [
      part(merge(...pipes), p.mat ?? 'pipeSteel', 'pipe', { noCast: true }),
      ...(brackets.length > 0
        ? [part(merge(...brackets), p.bracketMat ?? p.mat ?? 'pipeSteel', 'brackets', { noCast: true })]
        : []),
    ],
  }
}

/** A cable laid on the floor through `points` (x, z from the origin). */
const cable: Generator = (p) => {
  const points: [number, number][] = p.points ?? [
    [0, 0],
    [1, 0.4],
  ]
  const radius = p.radius ?? 0.008
  const y = p.y ?? 0.009
  const lengths = points
    .slice(1)
    .map(([x, z], i) =>
      rod([(points[i] as [number, number])[0], y, (points[i] as [number, number])[1]], [x, y, z], radius, 5),
    )
  return { pieces: [part(merge(...lengths), p.mat ?? 'cableBlack', 'cable', { noCast: true })] }
}

/**
 * A ceiling tile in its grid: the tile and the bars round it, `ceiling` metres up. `drop` turns it down about its back
 * edge by that many degrees, for a tile that has come loose.
 */
const ceilingTile: Generator = (p) => {
  const [w, d] = p.size ?? [0.6, 0.6]
  const top = p.ceiling ?? 2.9
  const thick = 0.02
  const tile = box([0, top - thick, 0], [w - 0.02, thick, d - 0.02])
  const dropped =
    p.drop === undefined || p.drop === 0
      ? tile
      : placed(
          placed(tile, [0, -(top - thick), d / 2], [0, 0, 0, 1]),
          [0, top - thick, -d / 2],
          axisAngle([1, 0, 0], ((p.drop as number) * Math.PI) / 180),
        )
  const bars = merge(
    box([0, top - 0.03, -d / 2], [w, 0.03, 0.025]),
    box([0, top - 0.03, d / 2], [w, 0.03, 0.025]),
    box([-w / 2, top - 0.03, 0], [0.025, 0.03, d]),
    box([w / 2, top - 0.03, 0], [0.025, 0.03, d]),
  )
  return {
    pieces: [
      part(dropped, p.mat ?? 'ceilingTilePale', 'tile', { ceiling: true, noCast: true }),
      part(bars, p.bars ?? 'pipeSteel', 'grid', { ceiling: true, noCast: true }),
    ],
  }
}

/** A notice pinned to a wall: a sheet of paper (`size`, turned `roll` degrees) at height `y`, facing +z, and its pin. */
const wallNotice: Generator = (p) => {
  const [w, h] = p.size ?? [0.22, 0.3]
  const y = p.y ?? 1.5
  const roll = ((p.roll ?? 0) * Math.PI) / 180
  const c = Math.cos(roll)
  const s = Math.sin(roll)
  const sheet = quad(
    [(-w / 2) * c + (h / 2) * s, y + (-w / 2) * s - (h / 2) * c, 0.004],
    [w * c, w * s, 0],
    [-h * s, h * c, 0],
  )
  return {
    pieces: [
      part(sheet, p.mat ?? 'noticePaper', 'sheet', { noCast: true, ...(p.cut ? { cut: p.cut } : {}) }),
      part(cylinder([0, y + h / 2 - 0.03, 0.004], 0.008, 0.012, 6, 0.3), p.pin ?? 'pipeSteel', 'pin', {
        noCast: true,
      }),
    ],
  }
}

/** A plaque on a wall: a frame and its face at height `y`; `lit` makes the face glow. */
const plaque: Generator = (p) => {
  const [w, h] = p.size ?? [0.42, 0.2]
  const y = p.y ?? 2
  const f = p.frameWidth ?? 0.02
  return {
    pieces: [
      part(rbox([0, y, 0], [w + 2 * f, h + 2 * f, 0.03], 0.1), p.frame ?? 'plaqueFrame', 'frame', {
        noCast: true,
      }),
      part(
        quad([-w / 2, y + f, 0.032], [w, 0, 0], [0, h, 0]),
        p.lit === false ? (p.face ?? 'plaqueFace') : 'plaqueLit',
        'face',
        {
          noCast: true,
        },
      ),
    ],
  }
}

export const CLINIC: Readonly<Record<string, Generator>> = {
  moonShaft,
  lightPool,
  puddle,
  grime,
  pipeRun,
  cable,
  ceilingTile,
  wallNotice,
  plaque,
}
