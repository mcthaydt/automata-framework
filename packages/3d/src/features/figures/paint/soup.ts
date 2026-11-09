// A posed figure as the painter takes it: its parts' triangles projected into the cell (orthographic along the camera's
// pitch, the root on the feet texel), the marks that go on them (decals, the drawn face, the hands) and the cloth
// coordinates of a fabric. `paintFigure` prepares what does not change with the pose, once per build; `soupOf` is the
// part of a frame that does.

import { cos, sin } from '@automata/sim/math'
import { apply, applyDir, type M, type V3 } from '../../../shared/math/math.ts'
import { measure } from '../body/genes.ts'
import { type Decal, GROUP, NECK, type Part } from '../body/mesh.ts'
import { profiles } from '../body/profiles.ts'
import { J, type Skeleton } from '../body/rig.ts'
import type { Built } from '../figure/build.ts'
import type { FigureDef } from '../figure/figure.schema.ts'
import { type PainterMaterial, painterMaterials } from '../figure/materials.ts'
import { type ClothFrame, clothFrame, clothSlots, clothU } from './cloth.ts'
import type { FaceStamp } from './face-stamp.ts'
import type { Bends, HandStamp } from './hand-stamp.ts'
import { bendsOf, type DrawnFace, drawnFace, faceAt, type HandShape, handShapes, handsAt } from './marks.ts'
import type { ClothInput } from './paint-cell.ts'
import { type Soup, TRI, VERT } from './raster.ts'
import { densityOf } from './regions.ts'
import type { ViewDecal } from './stamps.ts'
import { must } from './vec.ts'

/** What the face shows this pose: the expression and its marks' tags, and whether the eyes are mid-blink. */
export interface FaceState {
  readonly tags: ReadonlySet<string>
  readonly blink: boolean
}

/** The cell and the camera a pose is drawn into. */
export interface CellView {
  /** The figure's yaw against the camera (rad), snapped to the 8 directions. */
  readonly yaw: number
  /** The camera's pitch (rad), snapped to 2°. */
  readonly pitch: number
  /** Texels a sheet-texel: the cell is `64·density` by `96·density` for 2.6 m. */
  readonly density: number
  /** The face this pose shows; a neutral, open-eyed face when left out. */
  readonly state?: FaceState | undefined
}

/** The metres a cell shows, and its feet row from the bottom, at every density. */
export const CELL_METRES = 2.6
const FEET_ROW = 13.5

/** The cell's size at a density. */
export const cellSize = (density: number): [number, number] => [
  Math.round(64 * density),
  Math.round(96 * density),
]

/** Everything about a built figure the painter needs that the pose does not change. */
export interface PaintFigure {
  readonly built: Built
  readonly parts: readonly Part[]
  readonly materials: readonly PainterMaterial[]
  /** A material's index by name: the order of `built.materials`. */
  readonly materialIndex: ReadonlyMap<string, number>
  readonly skin: number
  readonly vertexCount: number
  readonly triangleCount: number
  /** The surface group a bone's marks lie on. */
  readonly groups: ReadonlyMap<number, number>
  readonly hands: readonly HandShape[]
  readonly face: DrawnFace
  /** The G-buffer ids of the neck's parts, for the neckline rule. */
  readonly neck: ReadonlySet<number>
  readonly bends: Bends
  /** The cloth coordinates of a figure with a fabric, once per build. */
  readonly cloth: { readonly slots: Float32Array; readonly frame: ClothFrame } | null
  readonly hand: 'L' | 'R'
}

/**
 * The surface group each bone's marks lie on: the group most of the bone's vertices belong to (by weight), so a mark on
 * the thigh knows the leg is its surface and a hand lying over it is not. `skip` groups (jewellery) carry no marks.
 */
function boneGroups(parts: readonly Part[], skip: readonly number[]): Map<number, number> {
  const votes = new Map<number, Map<number, number>>()
  const vote = (bone: number, group: number, n: number): void => {
    const v = votes.get(bone) ?? new Map<number, number>()
    v.set(group, (v.get(group) ?? 0) + n)
    votes.set(bone, v)
  }
  for (const p of parts) {
    if (skip.includes(p.group)) continue
    if (p.bone !== undefined) vote(p.bone, p.group, p.mesh.positions.length / 3)
    else for (const w of p.skin ?? []) for (const [bone, weight] of w) vote(bone, p.group, weight)
  }
  return new Map(
    [...votes].map(
      ([bone, v]) => [bone, [...v].reduce((a, b) => (b[1] > a[1] ? b : a))[0]] as [number, number],
    ),
  )
}

/** Prepares a built figure for the painter. */
export function paintFigure(def: FigureDef, skeleton: Skeleton, built: Built, outfit: string): PaintFigure {
  const names = Object.keys(built.materials)
  const materials = painterMaterials(built)
  const materialIndex = new Map(names.map((n, i) => [n, i]))
  const skin = materialIndex.get(def.skin) ?? -1
  const parts = built.parts
  // The face garment names the swatches the drawn face is coloured from.
  const marks = (def.outfits[outfit] ?? []).find((g) => 'eyes' in g) as
    | { eyes?: string; brows?: string; mouth?: string }
    | undefined
  const material = (id: string | undefined): PainterMaterial | undefined =>
    id === undefined ? undefined : materials[materialIndex.get(id) ?? -1]
  const palette = {
    skin: materials[skin],
    eyes: material(marks?.eyes),
    brows: material(marks?.brows),
    lips: material(marks?.mouth),
  }
  let cloth: PaintFigure['cloth'] = null
  if (materials.some((m) => m.fabric)) {
    const frame = clothFrame(profiles({ ...measure(def.sliders), genes: skeleton.genes }, skeleton))
    cloth = { slots: clothSlots(parts, skeleton, frame), frame }
  }
  return {
    built,
    parts,
    materials,
    materialIndex,
    skin,
    vertexCount: parts.reduce((n, p) => n + p.mesh.positions.length / 3, 0),
    triangleCount: parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0),
    groups: boneGroups(parts, [GROUP.item]),
    hands: handShapes(parts),
    face: drawnFace(measure(def.sliders).face, palette),
    neck: new Set(parts.flatMap((p, i) => (p.tag === NECK ? [p.seam ?? i] : []))),
    bends: bendsOf(skeleton),
    cloth,
    hand: def.hand,
  }
}

/** What `soupOf` hands the painter. */
export interface PosedCell {
  readonly soup: Soup
  readonly decals: ViewDecal[]
  readonly face: FaceStamp | null
  readonly hands: HandStamp[]
  readonly feet: [number, number]
  readonly cell: [number, number]
  readonly cloth?: ClothInput | undefined
}

const NEUTRAL: FaceState = { tags: new Set(['neutral']), blink: false }

/** Projects the posed parts into the cell, and places the marks. `scratch` is a soup to reuse the arrays of. */
export function soupOf(
  fig: PaintFigure,
  skeleton: Skeleton,
  world: readonly M[],
  view: CellView,
  scale = 1,
  scratch?: Soup,
): PosedCell {
  const state = view.state ?? NEUTRAL
  const cell = cellSize(view.density)
  const [w, h] = cell
  const ppm = (h / CELL_METRES) * scale
  const cx = (w / 2) * scale
  const cy = (h - FEET_ROW) * scale
  const cp = cos(view.pitch)
  const sp = sin(view.pitch)
  const verts =
    scratch && scratch.verts.length >= fig.vertexCount * VERT
      ? scratch.verts
      : new Float32Array(fig.vertexCount * VERT)
  const tris =
    scratch && scratch.tris.length >= fig.triangleCount * TRI
      ? scratch.tris
      : new Int32Array(fig.triangleCount * TRI)
  let vi = 0
  let ti = 0
  // The surface's own place (its rest position, plus a per-part offset), so grain sticks to it as it moves.
  let sx = 0
  let sy = 0
  let sz = 0
  const put = (px: number, py: number, pz: number, nx: number, ny: number, nz: number): number => {
    const o = vi * VERT
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    verts[o + 6] = sx
    verts[o + 7] = sy
    verts[o + 8] = sz
    verts[o] = cx + px * ppm
    verts[o + 1] = cy - (py * cp - pz * sp) * ppm
    verts[o + 2] = py * sp + pz * cp
    verts[o + 3] = nx / l
    verts[o + 4] = (ny * cp - nz * sp) / l
    verts[o + 5] = (ny * sp + nz * cp) / l
    return vi++
  }
  for (let pi = 0; pi < fig.parts.length; pi++) {
    const part = must(fig.parts, pi)
    const base = vi
    const pos = part.mesh.positions
    const nor = part.mesh.normals
    const mat = fig.materialIndex.get(part.material) ?? -1
    const seed = pi * 7.31
    for (let i = 0; i < pos.length; i += 3) {
      const x = must(pos, i)
      const y = must(pos, i + 1)
      const z = must(pos, i + 2)
      const a = must(nor, i)
      const b = must(nor, i + 1)
      const c = must(nor, i + 2)
      sx = x + seed
      sy = y
      sz = z
      if (part.bone !== undefined) {
        const m = must(world, part.bone)
        put(
          m[0] * x + m[1] * y + m[2] * z + m[9],
          m[3] * x + m[4] * y + m[5] * z + m[10],
          m[6] * x + m[7] * y + m[8] * z + m[11],
          m[0] * a + m[1] * b + m[2] * c,
          m[3] * a + m[4] * b + m[5] * c,
          m[6] * a + m[7] * b + m[8] * c,
        )
      } else {
        let qx = 0
        let qy = 0
        let qz = 0
        let nx = 0
        let ny = 0
        let nz = 0
        for (const [bone, wt] of must(part.skin ?? [], i / 3)) {
          if (!wt) continue
          const m = must(world, bone)
          const r = must(skeleton.rest, bone)
          const lx = x - r[0]
          const ly = y - r[1]
          const lz = z - r[2]
          qx += (m[0] * lx + m[1] * ly + m[2] * lz + m[9]) * wt
          qy += (m[3] * lx + m[4] * ly + m[5] * lz + m[10]) * wt
          qz += (m[6] * lx + m[7] * ly + m[8] * lz + m[11]) * wt
          nx += (m[0] * a + m[1] * b + m[2] * c) * wt
          ny += (m[3] * a + m[4] * b + m[5] * c) * wt
          nz += (m[6] * a + m[7] * b + m[8] * c) * wt
        }
        put(qx, qy, qz, nx, ny, nz)
      }
    }
    // A closed part's triangles that face away are hidden by its own front: skip them (open skirts and capes keep both
    // sides, so their insides show).
    const idx = part.mesh.indices
    const closed = part.skin === undefined
    for (let i = 0; i < idx.length; i += 3) {
      const v0 = base + must(idx, i)
      const v1 = base + must(idx, i + 1)
      const v2 = base + must(idx, i + 2)
      if (
        closed &&
        must(verts, v0 * VERT + 5) < -0.05 &&
        must(verts, v1 * VERT + 5) < -0.05 &&
        must(verts, v2 * VERT + 5) < -0.05
      )
        continue
      const o = ti * TRI
      tris[o] = v0
      tris[o + 1] = v1
      tris[o + 2] = v2
      tris[o + 3] = mat
      tris[o + 4] = part.group
      tris[o + 5] = part.seam ?? pi
      ti++
    }
  }
  const D = densityOf(w)
  const dense = (d: Decal): boolean => !d.density || (D >= d.density[0] && D <= d.density[1])
  const shown = (d: Decal): boolean =>
    dense(d) &&
    (!d.when || d.when.some((t) => state.tags.has(t))) &&
    (d.blink === undefined || d.blink === state.blink)
  const decals: ViewDecal[] = fig.built.decals.filter(shown).map((d) => {
    const m = must(world, d.bone)
    const p = apply(m, d.at)
    const n = applyDir(m, d.normal)
    const nl = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1
    const y = p[1] * cp - p[2] * sp
    const z = p[1] * sp + p[2] * cp
    const print = d.print
    // A print's across and down steps (a bitmap texel each), in cell texels and depth.
    const step = (q: V3): [number, number, number] => {
      const e = applyDir(m, q)
      const t = print?.texel ?? 0
      return [
        (e[0] * t * ppm) / scale,
        (-(e[1] * cp - e[2] * sp) * t * ppm) / scale,
        (e[1] * sp + e[2] * cp) * t,
      ]
    }
    const index = (name: string): number => fig.materialIndex.get(name) ?? -1
    const group = fig.groups.get(d.bone)
    return {
      x: (cx + p[0] * ppm) / scale,
      y: (cy - y * ppm) / scale,
      z,
      facing: (n[1] * sp + n[2] * cp) / nl,
      material: index(d.material),
      w: d.size?.[0] ?? 1,
      h: d.size?.[1] ?? 1,
      ...(group !== undefined ? { group } : {}),
      ...(print
        ? {
            print: {
              rows: print.rows,
              du: step(print.u),
              dv: step(print.v),
              ...(print.seams ? { seams: print.seams } : {}),
              inks: Object.fromEntries(
                Object.entries({ '#': d.material, ...print.inks }).map(([c, name]) => [c, index(name)]),
              ),
            },
          }
        : {}),
    }
  })
  const cloth = fig.cloth
  const frame = { cell, metres: CELL_METRES, feet: FEET_ROW, pitch: view.pitch }
  const face =
    fig.skin >= 0
      ? faceAt(skeleton, world, frame, fig.face, fig.skin, state.blink, new Set(state.tags))
      : null
  return {
    soup: { verts, count: vi, tris, triCount: ti },
    decals,
    face,
    hands: handsAt(fig.hands, world, frame, fig.materialIndex),
    feet: [w / 2, h - FEET_ROW],
    cell,
    ...(cloth
      ? {
          cloth: { slots: cloth.slots, u: (g: number, c: number, s: number) => clothU(cloth.frame, g, c, s) },
        }
      : {}),
  }
}
