// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check
import {
  type ActorScript,
  BASE,
  type Backdrop,
  type CameraPose,
  cellOf,
  gameplay,
  type Lighting,
  lookAt,
  member,
  project,
  ScriptedActor,
  SPRITE_PITCH,
  type SpriteLighting,
  STAGE_VERSION,
  type StageFrame,
  stageFrame,
  TIMES,
  type V3,
} from '../src/entries'
import { type SheetKind, sheetFigures } from './sheets'

/**
 * The named check frames, shared by the viewer's `?case=` page (which draws one through `StageView`) and by
 * `scripts/view-check.ts` (which compares the GPU's readback with `compose` of the same frame). Every actor is a base
 * figure and every script a fixed literal here, so `stageFrame`'s determinism makes the page and the script build the
 * same frame. It imports only `../src` and `./sheets`: it runs in the browser and in Node, with no Pixi.
 *
 * The stage paints at D2 and the renders' pitch (18°) and is crisp by default (whole pixels a texel), so a case without
 * `crisp: false` is crisp; the `…/true/…` cases say `crisp: false`. Claims: `bytes`: the readback equals `compose(frame)`, every byte. `palette`: every opaque pixel is a colour some
 * sprite's cell holds, alpha 0 or 255 only (a perspective quad is resampled, so no byte claim).
 */
export interface Case {
  frame: () => StageFrame
  claim: 'bytes' | 'palette'
  /** A wall drawn in the scene beside the figures (a quad in the world), which the figures depth-test against. */
  wall?: Wall
  /** The camera's near and far, as a host with scene geometry beyond the figures gives them (`new StageView(size, range)`). */
  range?: { near: number; far: number }
}

/** A vertical wall quad in the world: the plane `z`, spanning `x` and `y`, one solid colour, facing +z. The page draws it as
 * a mesh in the scene; `wallBackdrop` is the same wall for `compose`. */
export interface Wall {
  z: number
  x: [number, number]
  y: [number, number]
  rgba: [number, number, number, 255]
}

/** The wall as `compose`'s backdrop: at a pixel centre, the ray's hit on the plane and its depth along the view. */
export function wallBackdrop(pose: CameraPose, wall: Wall): Backdrop {
  const [w, h] = pose.size,
    cx = pose.cx ?? w / 2,
    cy = pose.cy ?? h / 2 // a perspective pose's principal point, as `project` has it
  return (px, py) => {
    // the ray's origin on the plane through the eye square to `fwd` and its direction (fwd component 1, so t is the depth)
    const a = pose.f !== undefined ? 0 : (px - w / 2) / pose.pixelsPerMetre!,
      b = pose.f !== undefined ? 0 : -(py - h / 2) / pose.pixelsPerMetre!
    const dir: V3 = [0, 1, 2].map(
      (c) =>
        pose.fwd[c] +
        (pose.f !== undefined ? ((px - cx) / pose.f) * pose.right[c] - ((py - cy) / pose.f) * pose.up[c] : 0),
    ) as V3
    const o: V3 = [0, 1, 2].map((c) => pose.eye[c] + a * pose.right[c] + b * pose.up[c]) as V3
    if (dir[2] === 0) return null
    const t = (wall.z - o[2]) / dir[2]
    const x = o[0] + t * dir[0],
      y = o[1] + t * dir[1]
    return t > 0 && x >= wall.x[0] && x <= wall.x[1] && y >= wall.y[0] && y <= wall.y[1]
      ? { depth: t, rgba: wall.rgba }
      : null
  }
}

const PITCH = SPRITE_PITCH,
  DENSITIES = [1, 2] as const

/** An orthographic pose at the sheets' 18°, `zoom` pixels per D1 texel, round `look`, 20 m back. */
const ortho = (
  zoom: number,
  size: [number, number],
  look: [number, number, number] = [0, 1, 0],
): CameraPose =>
  lookAt(
    [look[0], look[1] + 20 * Math.sin(PITCH), look[2] + 20 * Math.cos(PITCH)],
    look,
    { pixelsPerMetre: (zoom * 96) / 2.6 },
    size,
  )

/** The sheets' frames of a base member at a density, one one-sprite frame each (the cell copied, as the figure's next
 * draw overwrites its buffers): `turn0`…`turn7`, `walk0`…, `hero`. Cached by sheet, so Node builds each walk once. */
const sheets = new Map<string, Map<string, StageFrame>>()
function sheetFrame(who: string, density: number, kind: SheetKind, name: string): StageFrame {
  const key = `${who}/D${density}/${kind}`
  if (!sheets.has(key)) {
    const b = BASE.find((c) => c.def.id === who)!,
      cast = member(b.def, density),
      camera = ortho(density, cast.cell),
      frames = new Map<string, StageFrame>()
    sheetFigures(
      cast,
      PITCH,
      (k, i, figure) => {
        const cell = cellOf(figure),
          px = cell.rgba.slice()
        frames.set(`${k === 'hero' ? 'hero' : k + i}`, {
          version: STAGE_VERSION,
          camera,
          sprites: [
            {
              name: who,
              cell: {
                ...cell,
                rgba: px,
                painted: px,
                normals: cell.normals.slice(),
                depth: cell.depth.slice(),
              },
              at: [0, 0, 0],
              screen: [0, 0],
              scale: 1,
              depth: project(camera, [0, 0, 0])[2],
            },
          ],
        })
      },
      b.pose,
      kind,
    )
    sheets.set(key, frames)
  }
  return sheets.get(key)!.get(name)!
}

/** Four base figures on crossing paths, overlapping in depth near x = 0 at t = 1.3. */
const scene4 = (): ScriptedActor[] =>
  (
    [
      { who: 'base-m', at: [-1.7, -1.2], path: [{ at: [1.6, -1.2] }] },
      { who: 'base-f', at: [1.5, -0.4], path: [{ at: [-1.6, -0.4] }] },
      { who: 'base-m', at: [-1.6, 0.4], path: [{ at: [1.7, 0.4] }] },
      { who: 'base-f', at: [1.8, 1.2], path: [{ at: [-1.5, 1.2] }] },
    ] satisfies ActorScript[]
  ).map((s) => new ScriptedActor(s))
const T4 = 1.3,
  SCENE_POSE = () => ortho(2, [480, 320])
const NIGHT: Lighting = {
  time: TIMES.night,
  lamps: [{ at: [-1.2, 1.5, 0.8], color: '#ffbc4e', steps: 3, radius: 3.2 }],
}
/** Three base figures before the orbit at z = 2, 0 and −2 (about 14.6, 16.3 and 18.0 m along the view). */
const trio = () =>
  [
    ['base-m', -0.8, 2],
    ['base-f', 0, 0],
    ['base-m', 0.8, -2],
  ].map(([who, x, z]) => new ScriptedActor({ who: who as string, at: [x as number, z as number] }))

export const CASES: Record<string, Case> = {}
for (const b of BASE)
  for (const D of DENSITIES) {
    const id = b.def.id,
      cast = member(b.def, D)
    for (let d = 0; d < 8; d++)
      CASES[`sheet/${id}/turn${d}/D${D}`] = {
        frame: () => sheetFrame(id, D, 'turn', `turn${d}`),
        claim: 'bytes',
      }
    for (let i = 0; i < cast.gait.walkPoses; i++)
      CASES[`sheet/${id}/walk${i}/D${D}`] = {
        frame: () => sheetFrame(id, D, 'walk', `walk${i}`),
        claim: 'bytes',
      }
    CASES[`sheet/${id}/hero/D${D}`] = { frame: () => sheetFrame(id, D, 'hero', 'hero'), claim: 'bytes' }
  }
for (const z of [1, 2, 3, 4, 8])
  CASES[`zoom/${z}`] = {
    frame: () =>
      stageFrame([new ScriptedActor({ who: 'base-m', at: [0, 0] })], 0, ortho(z, [64 * z, 96 * z]), {
        density: 'auto',
      }),
    claim: 'bytes',
  }
// Two figures at one distance: the later in cast order is on top, as compose has it (the GPU's tie rule).
CASES.tie = {
  frame: () =>
    stageFrame(
      [new ScriptedActor({ who: 'base-m', at: [0, 0] }), new ScriptedActor({ who: 'base-f', at: [0, 0] })],
      0,
      ortho(1, [64, 96]),
      { density: 1 },
    ),
  claim: 'bytes',
}
// Two figures that tie at every texel (one cell's depths, two colourings): the later in the frame is on top.
CASES['tie/same'] = {
  frame: () => {
    const fr = stageFrame([new ScriptedActor({ who: 'base-f', at: [0, 0] })], 0, ortho(2, [128, 192])),
      s = fr.sprites[0],
      inverse = s.cell.rgba.slice()
    for (let i = 0; i < inverse.length; i += 4)
      if (inverse[i + 3]) {
        inverse[i] ^= 255
        inverse[i + 1] ^= 255
        inverse[i + 2] ^= 255
      }
    return {
      ...fr,
      sprites: [s, { ...s, name: 'inverse', cell: { ...s.cell, rgba: inverse, key: `${s.cell.key}!` } }],
    }
  },
  claim: 'bytes',
}
// Per-texel order, not per-quad: the standing man, and a woman walking past him a hand's breadth behind, her swung arm
// nearer the camera than his body (view-check's unit test counts the pixels where the two orders differ).
CASES.overlap = {
  frame: () =>
    stageFrame(
      [
        new ScriptedActor({ who: 'base-m', at: [0, 0], facing: 90 }),
        new ScriptedActor({ who: 'base-f', at: [-0.9, -0.05], path: [{ at: [1.1, -0.05] }] }),
      ],
      0.4,
      ortho(2, [240, 200]),
    ),
  claim: 'bytes',
}
// A wall quad in the scene cutting through a figure at the knees: its legs hide behind it and show in front of it.
const KNEE_WALL: Wall = { z: 0.083, x: [-0.93, 0.97], y: [0.02, 0.53], rgba: [90, 140, 70, 255] }
CASES.wall = {
  frame: () => stageFrame([new ScriptedActor({ who: 'base-m', at: [0, 0] })], 0, ortho(2, [256, 192])),
  claim: 'bytes',
  wall: KNEE_WALL,
}
// Under the gameplay camera, face on (a wall wider than the frame, so its slanted side edges are off screen: a quad's edge pixels are
// the one place the GPU's fixed-point rasteriser and compose's exact rays may disagree by a pixel).
CASES['gameplay/wall/0'] = {
  frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0])),
  claim: 'bytes',
  wall: { z: 0.043, x: [-50, 50], y: [0.0251, 0.5329], rgba: [90, 140, 70, 255] },
}
// The tie rule in metres (stage.ts `TIE_BIAS`), at a host's range (near 0.1, far 1000, where a bias in window-depth units
// would be millimetres a place): a figure and its inverse-coloured twin `offset` metres behind it, every texel's depth
// differing by the same amount (so no two surfaces cross, where the GPU's depth step would decide a sliver of pixels).
// Half a step behind the twin still loses to it (the later sprite); a step and a half behind, the twin shows through.
const HOST_RANGE = { near: 0.1, far: 1000 }
const twin = (offset: number): StageFrame => {
  const fr = stageFrame([new ScriptedActor({ who: 'base-f', at: [0, 0] })], 0, gameplay([0, 0.6, 0])),
    s = fr.sprites[0],
    inverse = s.cell.rgba.slice()
  for (let i = 0; i < inverse.length; i += 4)
    if (inverse[i + 3]) {
      inverse[i] ^= 255
      inverse[i + 1] ^= 255
      inverse[i + 2] ^= 255
    }
  return {
    ...fr,
    sprites: [
      s,
      {
        ...s,
        name: 'inverse',
        depth: s.depth + offset,
        cell: { ...s.cell, rgba: inverse, key: `${s.cell.key}!` },
      },
    ],
  }
}
CASES['range/later'] = { frame: () => twin(0.0005), claim: 'bytes', range: HOST_RANGE }
CASES['range/earlier'] = { frame: () => twin(0.0015), claim: 'bytes', range: HOST_RANGE }
CASES['range/wall'] = {
  frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0])),
  claim: 'bytes',
  range: HOST_RANGE,
  wall: { z: 0.043, x: [-50, 50], y: [0.0251, 0.5329], rgba: [90, 140, 70, 255] },
}
CASES['tie/reversed'] = {
  frame: () =>
    stageFrame(
      [new ScriptedActor({ who: 'base-f', at: [0, 0] }), new ScriptedActor({ who: 'base-m', at: [0, 0] })],
      0,
      ortho(1, [64, 96]),
      { density: 1 },
    ),
  claim: 'bytes',
}
CASES.scene4 = { frame: () => stageFrame(scene4(), T4, SCENE_POSE()), claim: 'bytes' }
CASES.day = {
  frame: () => stageFrame(scene4(), T4, SCENE_POSE(), { lighting: { time: TIMES.day, lamps: [] } }),
  claim: 'bytes',
}
CASES.lit = { frame: () => stageFrame(scene4(), T4, SCENE_POSE(), { lighting: NIGHT }), claim: 'bytes' }
// The sprite light (`StageOptions.sprite`): two figures under a warm lamp on the world's left; each cell is lit, so the frame
// is `compose` of lit cells.
const WARM_LEFT: SpriteLighting = {
  flat: [1.3, 1.1, 0.8],
  lamps: [{ dir: [-0.8, 0.4, 0.45], strength: 0.8 }],
}
CASES['stage/sprite-lit'] = {
  frame: () => {
    const fr = stageFrame(
      [
        new ScriptedActor({ who: 'base-m', at: [-0.5, 0] }),
        new ScriptedActor({ who: 'base-f', at: [0.5, 0.3] }),
      ],
      0,
      ortho(2, [256, 192]),
      { sprite: () => WARM_LEFT },
    )
    if (!fr.sprites.every((s) => s.cell.rgba !== s.cell.painted))
      throw new Error('stage/sprite-lit: a cell was not lit')
    return fr
  },
  claim: 'bytes',
}
for (let k = 0; k < 8; k++) {
  CASES[`gameplay/crisp/${k}`] = {
    frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], k)),
    claim: 'bytes',
  }
  CASES[`gameplay/true/${k}`] = {
    frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], k), { crisp: false }),
    claim: 'palette',
  }
}
// The gameplay camera with D1 figures (2 px a texel), and at twice the frame (2 px a D2 texel).
CASES['gameplay/d1/1'] = {
  frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], 1), { density: 1 }),
  claim: 'bytes',
}
CASES['gameplay/x2/1'] = {
  frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], 1, [1280, 960])),
  claim: 'bytes',
}
CASES['orbit/true'] = {
  frame: () =>
    stageFrame(scene4(), T4, lookAt([3, 2.2, 4], [0, 0.9, 0], { f: 600 }, [480, 320]), { crisp: false }),
  claim: 'palette',
}
