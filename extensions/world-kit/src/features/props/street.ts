// The prop generators for outdoors and the street: fixtures, lamps, buildings' faces, vehicles and the machines
// on a wall or at a kerb.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/props.ts at 6d82a52: `bollard`,
// `utilityBox`, `planter`, `signPost`, `cableRun`, `fixture`, `fence`, `streetLamp`, `facade`, `car`, `manhole`,
// `acUnit`, `generatorSet`, `vending`.
import {
  type Built,
  blob,
  box,
  cone,
  cylinder,
  type Generator,
  lightOf,
  type MeshData,
  merge,
  type PropLight,
  type PropPiece,
  part,
  quad,
  rbox,
  rod,
  stream,
  type V3,
} from '@automata/3d/props-kit'
import { letterMesh, setText, sizeOf } from '../../shared/lettering/lettering.ts'
import { lifted } from '../../shared/piece-helpers.ts'
import { turnX } from '../../shared/turn.ts'

/** A bollard: a short post with a rounded cap. */
const bollard: Generator = (p) => ({
  pieces: [
    part(
      merge(cylinder([0, 0, 0], 0.1, 0.9, 12, 0.2), blob([0, 0.9, 0], [0.1, 0.05, 0.1])),
      p.mat ?? 'ironDark',
      'post',
    ),
  ],
})

/** A utility box: a cabinet on a plinth. */
const utilityBox: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.6, 1.1, 0.3]
  return {
    pieces: [
      part(box([0, 0, 0], [w + 0.04, 0.1, d + 0.04]), p.plinth ?? 'ironDark', 'plinth'),
      part(rbox([0, 0.1, 0], [w, h - 0.1, d], 0.1), p.mat ?? 'metalBox', 'body'),
    ],
  }
}

/** A planter: a trough with a lumpy mound of leaves. */
const planter: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.8, 0.45, 0.4]
  return {
    pieces: [
      part(box([0, 0, 0], [w, h, d]), p.mat ?? 'terracotta', 'trough'),
      part(
        blob([0, h + 0.08, 0], [w * 0.46, 0.26, d * 0.46], { lump: 0.3, seed: p.seed ?? 1 }),
        p.leaves ?? 'leafGreen',
        'leaves',
      ),
    ],
  }
}

/** A sign post: a pole to `height` and a panel whose top is at it. */
const signPost: Generator = (p) => {
  const h = p.height ?? 2.4
  return {
    pieces: [
      part(rod([0, 0, 0], [0, h, 0], 0.03, 8), p.pole ?? 'poleTeal', 'pole'),
      part(box([0, h - 0.3, 0.04], [0.45, 0.3, 0.02]), p.panel ?? 'signBlue', 'panel'),
    ],
  }
}

/** A cable run: a thin cable along x at the prop's height (on a wall, or along the ground). */
const cableRun: Generator = (p) => ({
  pieces: [
    part(box([0, p.height ?? 0, 0], [p.length ?? 2, 0.02, 0.02]), p.mat ?? 'cordBlack', 'cable', {
      noCast: true,
    }),
  ],
})

/** A wall fixture: a light `switch` or an `outlet` plate, a `vent` grille, or a `conduit` run up the wall. */
const fixture: Generator = (p) => {
  const variant = p.variant ?? 'switch'
  const [w, h, t, mat]: [number, number, number, string] =
    variant === 'outlet'
      ? [0.09, 0.07, 0.01, 'switchPlate']
      : variant === 'vent'
        ? [0.42, 0.24, 0.02, 'ventGrille']
        : variant === 'conduit'
          ? [0.03, p.height ?? 1.4, 0.02, 'conduit']
          : [0.08, 0.12, 0.01, 'switchPlate']
  return { pieces: [part(box([0, 0, 0], [w, h, t]), p.mat ?? mat, variant, { noCast: true })] }
}

/** A fence along x: posts and rails (a picket fence with `pickets`). */
const fence: Generator = (p) => {
  const length = p.length ?? 4
  const h = p.height ?? 1
  const n = Math.max(1, Math.round(length / (p.spacing ?? 1.6)))
  const posts: MeshData[] = []
  const rails: MeshData[] = []
  for (let i = 0; i <= n; i++)
    posts.push(rbox([-length / 2 + (length * i) / n, 0, 0], [0.09, h + 0.08, 0.09], 0.25))
  for (const y of p.rails ?? [h * 0.35, h * 0.8]) rails.push(box([0, y, 0.06], [length, 0.07, 0.03]))
  if (p.pickets)
    for (let x = -length / 2 + 0.12; x < length / 2 - 0.05; x += 0.16)
      rails.push(cone([x, 0.04, 0.085], 0.04, 0.012, h * 0.95, 4))
  return { pieces: [part(merge(...posts), p.mat, 'posts'), part(merge(...rails), p.rail ?? p.mat, 'rails')] }
}

/**
 * A building's face (its front at z = 0, its mass running back): a wall over a base course, floors of windows in a
 * grid (a seeded share lit at night), a shopfront at street level (a wide window, a door, an awning, a sign) and a
 * cornice. Its windows are recessed, framed and silled, so each reads at a glance.
 */
const facade: Generator = (p) => {
  const W = p.width ?? 8
  const H = p.height ?? 9
  const D = p.depth ?? 4
  const r = stream(p.seed ?? 7)
  const floors = p.floors ?? 3
  const ground = p.groundHeight ?? 3.2
  const cols = p.cols ?? 3
  const pieces: PropPiece[] = [
    part(box([0, 0, -D / 2], [W, H, D]), p.wall, 'wall'),
    part(box([0, 0, 0.02], [W + 0.04, 0.45, 0.08]), p.base ?? p.trim, 'base'),
    part(box([0, H - 0.35, 0.08], [W + 0.25, 0.35, 0.2]), p.trim, 'cornice'),
    part(box([0, ground - 0.15, 0.04], [W + 0.06, 0.18, 0.12]), p.trim, 'band'),
  ]
  const floorHeight = (H - ground - 0.6) / floors
  const ww = p.windowWidth ?? 1
  const wh = Math.min(floorHeight * 0.62, p.windowHeight ?? 1.5)
  for (let f = 0; f < floors; f++)
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + (W * (c + 0.5)) / cols
      const y = ground + f * floorHeight + (floorHeight - wh) * 0.55
      const lit = r() < (p.lit ?? 0.5)
      const glass = lit ? (p.glassLit ?? 'windowLit') : (p.glass ?? 'windowDark')
      pieces.push(
        part(quad([x - ww / 2, y, 0.005], [ww, 0, 0], [0, wh, 0], 2, 2), glass, `glass${f}.${c}`, {
          noCast: true,
        }),
      )
      const frame = merge(
        box([x - ww / 2 - 0.05, y - 0.05, 0.03], [0.1, wh + 0.1, 0.06]),
        box([x + ww / 2 + 0.05, y - 0.05, 0.03], [0.1, wh + 0.1, 0.06]),
        box([x, y + wh, 0.03], [ww + 0.2, 0.1, 0.06]),
        box([x, y + wh * 0.5 - 0.02, 0.02], [ww, 0.04, 0.03]),
        box([x, y - 0.03, 0.03], [0.04, wh, 0.03]),
      )
      pieces.push(part(frame, p.frame ?? p.trim, `frame${f}.${c}`))
      pieces.push(part(box([x, y - 0.1, 0.07], [ww + 0.3, 0.08, 0.16]), p.trim, `sill${f}.${c}`))
      if (lit && p.blinds && r() < 0.5)
        pieces.push(
          part(
            quad(
              [x - ww / 2 + 0.02, y + wh * (0.45 + r() * 0.4), 0.01],
              [ww - 0.04, 0, 0],
              [0, wh * 0.15, 0],
            ),
            p.blinds,
            `blind${f}.${c}`,
            {
              noCast: true,
            },
          ),
        )
    }
  // The shopfront: a wide window and a door, under an awning, with a sign over it.
  const shop = p.shop ?? {}
  const doorX = shop.door ?? W * 0.28
  const sw = shop.width ?? W * 0.45
  if (p.shop !== false) {
    const frameSwatch = shop.frame ?? p.frame ?? p.trim
    pieces.push(
      part(
        quad([-sw / 2 - W * 0.12, 0.5, 0.005], [sw, 0, 0], [0, ground - 1.05, 0], 2, 2),
        shop.glass ?? p.glassLit ?? 'windowLit',
        'shopGlass',
        {
          noCast: true,
        },
      ),
    )
    pieces.push(
      part(
        merge(
          box([-sw / 2 - W * 0.12 - 0.06, 0.45, 0.04], [0.12, ground - 0.9, 0.08]),
          box([sw / 2 - W * 0.12 + 0.06, 0.45, 0.04], [0.12, ground - 0.9, 0.08]),
          box([-W * 0.12, ground - 0.6, 0.04], [sw + 0.24, 0.1, 0.08]),
        ),
        frameSwatch,
        'shopFrame',
      ),
    )
    pieces.push(part(box([doorX, 0, 0.0], [1.0, 2.15, 0.06]), shop.doorMat ?? p.door ?? 'doorWood', 'door'))
    pieces.push(
      part(
        merge(
          box([doorX - 0.56, 0, 0.03], [0.12, 2.3, 0.1]),
          box([doorX + 0.56, 0, 0.03], [0.12, 2.3, 0.1]),
          box([doorX, 2.2, 0.03], [1.24, 0.12, 0.1]),
        ),
        frameSwatch,
        'doorFrame',
      ),
    )
    pieces.push(part(blob([doorX + 0.35, 1.05, 0.05], [0.03, 0.03, 0.025]), 'brass', 'knob'))
    if (shop.awning) {
      const aw = shop.awningWidth ?? sw + 0.6
      const ay = ground - 0.35
      pieces.push(
        part(
          turnX(rbox([0, -0.04, 0], [aw, 0.08, 1.1], 0.15), -22, [-W * 0.12, ay, 0.5]),
          shop.awning,
          'awning',
        ),
      )
      pieces.push(
        part(
          turnX(quad([-aw / 2, 0, 0], [aw, 0, 0], [0, -0.25, 0]), 0, [-W * 0.12, ay - 0.2, 1.02]),
          shop.awningEdge ?? shop.awning,
          'awningEdge',
          {
            noCast: true,
          },
        ),
      )
    }
    if (shop.sign)
      pieces.push(
        part(
          rbox([-W * 0.12, ground - 0.45 + (shop.awning ? 0.6 : 0), 0.06], [sw * 0.7, 0.42, 0.08], 0.2),
          shop.sign,
          'sign',
        ),
      )
  }
  if (p.roof)
    pieces.push(part(turnX(box([0, 0, 0], [W + 0.3, 0.12, D * 0.7]), 28, [0, H, -D * 0.25]), p.roof, 'roof'))
  return { pieces }
}

/**
 * A car-ish block: a body, a glasshouse with a roof, wheels in their arches, lamps front and back. Along x, its nose
 * at +x. Its lamps glow; `lights` lights the road ahead.
 */
const car: Generator = (p) => {
  const L = p.length ?? 4
  const W = p.width ?? 1.75
  const wheel = 0.32
  const pieces: PropPiece[] = [
    part(rbox([0, 0.22, 0], [L, 0.62, W], 0.22, 16), p.body, 'body'),
    part(rbox([-L * 0.06, 0.8, 0], [L * 0.52, 0.5, W * 0.86], 0.3, 14), p.glass ?? 'carGlass', 'glass'),
    part(rbox([-L * 0.07, 1.26, 0], [L * 0.44, 0.07, W * 0.84], 0.2), p.body, 'roof'),
  ]
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      pieces.push(
        part(
          turnX(cylinder([0, -0.11, 0], wheel, 0.22, 14, 0.35), 90, [
            sx * L * 0.32,
            wheel,
            sz * (W / 2 - 0.08),
          ]),
          p.tyre ?? 'tyre',
          'wheel',
        ),
      )
  pieces.push(
    part(
      merge(
        rbox([L / 2 - 0.02, 0.58, W * 0.32], [0.06, 0.1, 0.26], 0.4),
        rbox([L / 2 - 0.02, 0.58, -W * 0.32], [0.06, 0.1, 0.26], 0.4),
      ),
      p.headlight ?? 'bulbCool',
      'headlights',
      { noCast: true },
    ),
    part(
      merge(
        rbox([-L / 2 + 0.02, 0.6, W * 0.34], [0.06, 0.09, 0.22], 0.4),
        rbox([-L / 2 + 0.02, 0.6, -W * 0.34], [0.06, 0.09, 0.22], 0.4),
      ),
      p.taillight ?? 'neonRed',
      'taillights',
      { noCast: true },
    ),
    part(box([0, 0.12, 0], [L * 0.9, 0.12, W * 0.9]), 'tyre', 'under'),
  )
  const lights: PropLight[] = p.lights
    ? [lightOf([L / 2 + 0.8, 0.5, 0], p, { kind: 'neon', color: '#c7d6ff' })]
    : []
  return { pieces, lights }
}

/** An air-conditioning unit on a wall bracket: a metal box, a round fan grille, cooling fins, a drip pipe. */
const acUnit: Generator = (p) => {
  const w = p.width ?? 0.8
  const h = p.height ?? 0.55
  const d = 0.35
  const fins: MeshData[] = []
  for (let i = 0; i < 7; i++)
    fins.push(box([w * 0.28, 0.06 + (i * (h - 0.12)) / 6, d / 2], [w * 0.36, 0.015, 0.01]))
  const ring = (radius: number): MeshData => {
    const points: V3[] = []
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2
      points.push([-w * 0.18 + Math.cos(a) * radius, h / 2 + Math.sin(a) * radius, d / 2 + 0.01])
    }
    return merge(...points.slice(1).map((q, i) => rod(points[i] as V3, q, 0.008, 4)))
  }
  const grille = merge(
    ring(h * 0.36),
    ring(h * 0.24),
    ring(h * 0.12),
    rod([-w * 0.18 - h * 0.36, h / 2, d / 2 + 0.01], [-w * 0.18 + h * 0.36, h / 2, d / 2 + 0.01], 0.008, 4),
    rod([-w * 0.18, h / 2 - h * 0.36, d / 2 + 0.01], [-w * 0.18, h / 2 + h * 0.36, d / 2 + 0.01], 0.008, 4),
  )
  return {
    pieces: [
      part(rbox([0, 0, 0], [w, h, d], 0.1), p.mat ?? 'metalBox', 'body'),
      part(grille, 'ventGrille', 'grille'),
      part(merge(...fins), 'ventGrille', 'fins'),
      part(
        merge(
          box([-w * 0.35, -0.04, -d * 0.1], [0.04, 0.04, d * 1.1]),
          box([w * 0.35, -0.04, -d * 0.1], [0.04, 0.04, d * 1.1]),
        ),
        'ironDark',
        'bracket',
      ),
      part(rod([w * 0.4, 0, d * 0.3], [w * 0.4, -0.6, d * 0.3], 0.012, 4), 'conduit', 'drip'),
    ],
  }
}

/** A generator set: a long box on skids with panels, a fuel cap, an exhaust stack and a lettered plate. */
const generatorSet: Generator = (p) => {
  const L = p.length ?? 1.5
  const H = p.height ?? 0.95
  const D = p.depth ?? 0.75
  const rows = setText(['POWER'])
  const px = 0.03
  return {
    pieces: [
      part(rbox([0, 0.08, 0], [L, H, D], 0.12), p.mat ?? 'metalPanel', 'body'),
      part(
        merge(box([-L * 0.3, 0, 0], [0.12, 0.08, D * 1.05]), box([L * 0.3, 0, 0], [0.12, 0.08, D * 1.05])),
        'ironDark',
        'skids',
      ),
      part(
        merge(
          box([-L * 0.2, 0.25, D / 2 + 0.005], [L * 0.32, H * 0.55, 0.01]),
          box([L * 0.2, 0.25, D / 2 + 0.005], [L * 0.32, H * 0.55, 0.01]),
        ),
        p.panel ?? 'ventGrille',
        'panels',
      ),
      part(rod([L * 0.35, H + 0.08, -D * 0.2], [L * 0.35, H + 0.6, -D * 0.2], 0.05, 8), 'conduit', 'exhaust'),
      part(
        rbox([0, H * 0.75, D / 2 + 0.01], [(sizeOf(rows)[0] + 4) * px, 9 * px, 0.01], 0.1),
        'posterInkYellow',
        'plate',
      ),
      lifted(
        part(letterMesh(rows, px, D / 2 + 0.018), 'posterInkBlack', 'letters', { noCast: true }),
        H * 0.75 + 2 * px,
      ),
    ],
  }
}

/**
 * A vending machine: a tall cabinet with a glowing front of product rows, a lit header with its word, a coin panel
 * and a tray; it lights the ground in front.
 */
const vending: Generator = (p) => {
  const r = stream(p.seed ?? 5)
  const W = 0.9
  const H = 1.9
  const D = 0.8
  const rows = setText([p.text ?? 'COLD'])
  const px = 0.05
  const cans: MeshData[][] = [[], [], []]
  const inks = ['posterInkRed', 'posterInkBlue', 'posterInkYellow'] as const
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 5; i++)
      cans[Math.floor(r() * 3)]?.push(
        rbox([-W * 0.38 + i * 0.11 + 0.05, 0.55 + j * 0.22, D / 2 + 0.01], [0.07, 0.14, 0.02], 0.4),
      )
  return {
    pieces: [
      part(rbox([0, 0, 0], [W, H, D], 0.08), p.body ?? 'carRed', 'cabinet'),
      part(quad([-W * 0.42, 0.5, D / 2 + 0.002], [W * 0.62, 0, 0], [0, 1.15, 0]), 'screenGlow', 'window', {
        noCast: true,
      }),
      ...cans.map((meshes, i) => part(merge(...meshes), inks[i] as string, `cans${i}`, { noCast: true })),
      part(quad([-W * 0.44, 1.6, D / 2 + 0.003], [W * 0.88, 0, 0], [0, 0.29, 0]), 'bulbCool', 'header', {
        noCast: true,
      }),
      lifted(part(letterMesh(rows, px, D / 2 + 0.008), 'posterInkRed', 'word', { noCast: true }), 1.62),
      part(rbox([W * 0.32, 0.9, D / 2], [0.16, 0.5, 0.03], 0.2), 'metalBox', 'coins'),
      part(box([-W * 0.1, 0.15, D / 2], [W * 0.6, 0.2, 0.04]), 'tyre', 'tray'),
    ],
    lights: [lightOf([0, 1.0, D / 2 + 0.5], p, { kind: 'neon', color: '#88d6ff' })],
  } satisfies Built
}

/** A manhole cover in the road (steam rises from it: the level's emitters). */
const manhole: Generator = (p) => ({
  pieces: [
    part(cylinder([0, 0, 0], p.radius ?? 0.35, 0.02, 14, 0.3), p.mat ?? 'ironDark', 'cover', {
      noCast: true,
    }),
  ],
})

export const STREET: Readonly<Record<string, Generator>> = {
  bollard,
  utilityBox,
  planter,
  signPost,
  cableRun,
  fixture,
  fence,
  facade,
  car,
  acUnit,
  generatorSet,
  vending,
  manhole,
}
