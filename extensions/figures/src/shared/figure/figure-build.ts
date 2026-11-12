// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 26 of the builders-fold plan (the strict flags) replaces each with a check

import { DEFAULT_HEAD } from '../body/genes'
import { boneGroups, type Decal, GROUP, type Material, type Part } from '../body/parts'
import { J, type Pose, type Side, type Skeleton } from '../body/rig'
import { apply, applyDir, type M, type V3 } from '../math/math'
import type { ActionId } from '../motion/motion'
import type { Expression, FaceLook } from '../outfit/garments'
import { ITEMS } from '../outfit/items'
import { fabricOf } from '../paint/fabric'
import { densityOf, duel, eyeWhite, type FaceStamp, familyTones, tonesOf } from '../paint/paint'
import { type Soup, TRI, VERT, type ViewDecal } from '../paint/raster'
import type { CastMember } from './cast'
import { type ClothFrame, clothFrame, clothSlots } from './cloth'
/**
 * A procedural figure at run time: the stepped pose clock, the snap to 8 directions, the hair's spring, the triangle
 * soup, the G-buffer and the painter's cell with its normal map (which the lighting feature lights), each pose's cell
 * kept in a cache. Drawn by the review frames (frames.ts) and by the scriptable actors (actor.ts), whose made
 * poses it draws through `update({ pose })`.
 */
/** An outside light for the figure (EnvironmentBuilder's scene light): RGB (1 is full, may exceed it) at a vertex's
 * place and normal in the figure's own frame (metres, origin on the root, x right, y up, z toward the camera, before
 * the pitch). With one set, the painter drops its key bands and lights each texel by the light interpolated there. */
export type FigureLight = (place: V3, normal: V3) => V3
export interface View {
  /** The camera's azimuth around the figure (rad; 0 when it stands on +z of the figure), and its pitch down (rad). The
   * figure is drawn at the nearest of the 8 directions to it, and the pitch to the nearest 2°. */
  azimuth: number
  pitch: number
}
export interface Built {
  parts: Part[]
  decals: Decal[]
  materials: Material[]
  materialIndex: Map<string, number>
  vertexCount: number
  triangleCount: number
  face: DrawnFace
  groups: Map<number, number>
  clear?: [number, number]
  hands: HandShape[]
  /** Cloth slots `(cos t, sin t, −y)` per vertex and the cylinders they come from (cloth.ts), or null when no built material names a fabric (H5). */
  cloth: Float32Array | null
  frame: ClothFrame | null
}
/**
 * A hand's measures in its own bone's space (x the figure's left, y up the bone, z forward), from the parts the hand
 * bone carries (garments.ts hands): so the hand stamp (paint.ts HandStamp) is sized from the hand the figure wears.
 */
interface HandShape {
  side: Side
  group: number
  material: string
  /** Wrist to fingertips (m), and the centre line's place across the bone (x, z). */
  len: number
  c: [number, number]
  /** The breadth's axis across the bone (x, z: toward the thumb), the half-breadth at the wrist and at the knuckles,
   * and the half-thickness there; the back of the hand's side along the thickness axis (x, z). */
  across: [number, number]
  wrist: number
  breadth: number
  thick: [number, number]
  back: [number, number]
  /** The thumb's span down the hand (fractions of `len`). */
  thumb: [number, number]
}
/** The hand bones' parts as measures (HandShape): the palm and fingers together, the thumb (a surface of its own) apart. */
function handShapes(parts: Part[]): HandShape[] {
  const out: HandShape[] = []
  for (const side of ['L', 'R'] as const) {
    const mine = parts.filter((p) => p.bone === J[`hand.${side}`] && p.group !== GROUP.item)
    if (!mine.length) continue
    const seam = mine[0].seam,
      thumb = mine.filter((p) => p.seam !== seam),
      hand = mine.filter((p) => p.seam === seam)
    const pts = (ps: Part[]) =>
      ps.flatMap((p) => {
        const v: V3[] = []
        for (let i = 0; i < p.mesh.positions.length; i += 3)
          v.push([p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]])
        return v
      })
    const P = pts(hand),
      T = pts(thumb)
    const len = -Math.min(...P.map((v) => v[1])),
      cx = P.reduce((s, v) => s + v[0], 0) / P.length,
      cz = P.reduce((s, v) => s + v[2], 0) / P.length
    // The breadth runs along the cross-section's long axis (its xz spread's first principal axis), toward the thumb.
    let xx = 0,
      zz = 0,
      xz = 0
    for (const v of P) {
      const a = v[0] - cx,
        b = v[2] - cz
      xx += a * a
      zz += b * b
      xz += a * b
    }
    const ang = 0.5 * Math.atan2(2 * xz, xx - zz)
    let across: [number, number] = [Math.cos(ang), Math.sin(ang)]
    const tc = T.length
      ? [T.reduce((s, v) => s + v[0], 0) / T.length - cx, T.reduce((s, v) => s + v[2], 0) / T.length - cz]
      : [0, 1]
    if (across[0] * tc[0] + across[1] * tc[1] < 0) across = [-across[0], -across[1]]
    const thickAxis: [number, number] = [-across[1], across[0]]
    const ext = (lo: number, hi: number, ax: [number, number]) =>
      Math.max(
        ...P.filter((v) => -v[1] >= lo * len && -v[1] <= hi * len).map((v) =>
          Math.abs((v[0] - cx) * ax[0] + (v[2] - cz) * ax[1]),
        ),
      )
    // The back of the hand faces out from the body (the palm to the thigh): +x on the left hand.
    const out1 = side === 'L' ? 1 : -1,
      back: [number, number] = thickAxis[0] * out1 >= 0 ? thickAxis : [-thickAxis[0], -thickAxis[1]]
    const ty = T.map((v) => -v[1] / len)
    out.push({
      side,
      group: mine[0].group,
      material: mine[0].material,
      len,
      c: [cx, cz],
      across,
      wrist: ext(0, 0.15, across),
      breadth: ext(0.4, 0.7, across),
      thick: [ext(0, 0.15, thickAxis), ext(0.4, 0.7, thickAxis)],
      back,
      thumb: ty.length ? [Math.min(...ty), Math.max(...ty)] : [0.2, 0.6],
    })
  }
  return out
}
/** Builds the part list of a cast member in an outfit, holding an item, once per change. */
export function build(member: CastMember, s: Skeleton, outfit: string, item: string | null): Built {
  const look = member.outfits[outfit](s, member.cell[1] / member.metres)
  // A drawn face replaces the face's marks (garments.ts face).
  const parts = [...look.parts],
    decals = look.decals.filter((d) => !member.drawnFace || d.tag !== 'face')
  if (item) parts.push(...ITEMS[item].parts(J[`socket.${member.hand}`]))
  const names = [
    ...new Set([
      ...parts.map((p) => p.material),
      ...decals.flatMap((d) => [d.material, ...Object.values(d.print?.inks ?? {})]),
    ]),
  ]
  const own = { ...member.materials, ...look.materials }
  const materials = names.map((n) => {
    const m = own[n]
    if (!m) throw new Error(`${member.id}: no material ${n}`)
    return m
  })
  for (const m of materials)
    if (m.fabric && !fabricOf(m.fabric)) throw new Error(`${member.id}: no fabric ${m.fabric}`)
  // Cloth coordinates, once per build, only when a built material names a fabric (H5): with none, nothing below runs.
  let frame: ClothFrame | null = null,
    cloth: Float32Array | null = null
  if (materials.some((m) => m.fabric)) {
    if (!look.profiles) throw new Error(`${member.id}: a fabric needs the look's profiles`)
    frame = clothFrame(look.profiles)
    cloth = clothSlots(parts, s, frame)
  }
  const materialIndex = new Map(names.map((n, i) => [n, i]))
  const vertexCount = parts.reduce((n, p) => n + p.mesh.positions.length / 3, 0),
    triangleCount = parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0)
  return {
    parts,
    decals,
    materials,
    materialIndex,
    vertexCount,
    triangleCount,
    face: drawnFace(member, look.face),
    groups: boneGroups(parts, [GROUP.item]),
    clear: look.clear,
    hands: handShapes(parts),
    cloth,
    frame,
  }
}
/** The drawn face's structure and colours (paint.ts FaceStamp). */
type DrawnFace = Pick<FaceStamp, 'shape' | 'iris' | 'lash' | 'white' | 'brow' | 'lips' | 'off' | 'keep'>
/** From the outfit's swatches: the iris and lash the eyes' first two tones, the whites (dimmed to the skin, paint.ts
 * eyeWhite), the brow the brows' (the hair's) second tone, the lips' three; where the outfit names none, the skin's own
 * ramp gives the lips. Their near-blacks are their ramps' dark family (paint.ts darkOf), as the hair's are. */
function drawnFace(member: CastMember, look?: FaceLook): DrawnFace {
  const tones = (name?: string) =>
    name && member.materials[name] ? familyTones(tonesOf(member.materials[name])) : null
  const eyes = tones(look?.eyes) ?? [duel(0x31222a), duel(0x1d1d21)],
    skin = tones(member.skin) ?? [0, 0, 0, 0],
    lips = tones(look?.lips) ?? [skin[2], skin[1], skin[3]]
  return {
    shape: look?.shape ?? DEFAULT_HEAD,
    iris: eyes[0],
    lash: eyes[1],
    white: eyeWhite(tones(look?.white)?.[0] ?? duel(0xeadbc9), skin[1]),
    brow: tones(look?.brows ?? 'brow')?.[1] ?? eyes[1],
    lips: [lips[0], lips[1], lips[2]],
    // The marks the outfit leaves off, and the eyes kept in the rows the hair leaves (paint.ts FaceStamp): present only when asked for.
    ...(look?.nose === false || look?.mouth === false
      ? {
          off: [
            ...(look.nose === false ? ['nose' as const] : []),
            ...(look.mouth === false ? ['mouth' as const] : []),
          ],
        }
      : {}),
    ...(look?.keep ? { keep: true } : {}),
  }
}
/** Projects the posed parts into the cell: orthographic along the camera's pitch, the root on the feet texel. */
export function soupOf(
  built: Built,
  s: Skeleton,
  world: M[],
  pitch: number,
  cell: [number, number],
  metres: number,
  feet: number,
  soup?: Soup,
  scale = 1,
  face?: FaceState,
  light?: FigureLight,
  lightOut?: Float32Array,
): { soup: Soup; decals: ViewDecal[] } {
  // `scale`: the supersampling factor; decals still come back in cell texels.
  const [w, h] = cell,
    ppm = (h / metres) * scale,
    cx = (w / 2) * scale,
    cy = (h - feet) * scale
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch)
  const verts =
    soup && soup.verts.length >= built.vertexCount * VERT
      ? soup.verts
      : new Float32Array(built.vertexCount * VERT)
  const tris =
    soup && soup.tris.length >= built.triangleCount * TRI
      ? soup.tris
      : new Int32Array(built.triangleCount * TRI)
  // Skinning: a bone's world transform after undoing its rest position (rest rotations are the identity). Written out
  // by hand, with no per-vertex allocation: this loop runs over every vertex at each pose step.
  let vi = 0,
    ti = 0
  // The surface's own place (its rest position, plus a per-part offset), so grain sticks to it as it moves.
  let sx = 0,
    sy = 0,
    sz = 0
  const put = (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => {
    const o = vi * VERT,
      l = Math.hypot(nx, ny, nz) || 1
    verts[o + 6] = sx
    verts[o + 7] = sy
    verts[o + 8] = sz
    if (light) lightOut!.set(light([px, py, pz], [nx / l, ny / l, nz / l]), vi * 3)
    verts[o] = cx + px * ppm
    verts[o + 1] = cy - (py * cp - pz * sp) * ppm
    verts[o + 2] = py * sp + pz * cp
    verts[o + 3] = nx / l
    verts[o + 4] = (ny * cp - nz * sp) / l
    verts[o + 5] = (ny * sp + nz * cp) / l
    return vi++
  }
  for (let pi = 0; pi < built.parts.length; pi++) {
    const part = built.parts[pi],
      base = vi,
      pos = part.mesh.positions,
      nor = part.mesh.normals,
      mat = built.materialIndex.get(part.material)!
    const seed = pi * 7.31
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i],
        y = pos[i + 1],
        z = pos[i + 2],
        a = nor[i],
        b = nor[i + 1],
        c = nor[i + 2]
      sx = x + seed
      sy = y
      sz = z
      if (part.bone !== undefined) {
        const m = world[part.bone]
        put(
          m[0] * x + m[1] * y + m[2] * z + m[9],
          m[3] * x + m[4] * y + m[5] * z + m[10],
          m[6] * x + m[7] * y + m[8] * z + m[11],
          m[0] * a + m[1] * b + m[2] * c,
          m[3] * a + m[4] * b + m[5] * c,
          m[6] * a + m[7] * b + m[8] * c,
        )
      } else {
        let qx = 0,
          qy = 0,
          qz = 0,
          nx = 0,
          ny = 0,
          nz = 0
        for (const [bone, wt] of part.skin![i / 3]) {
          if (!wt) continue
          const m = world[bone],
            r = s.rest[bone],
            lx = x - r[0],
            ly = y - r[1],
            lz = z - r[2]
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
    const idx = part.mesh.indices,
      closed = part.skin === undefined
    for (let i = 0; i < idx.length; i += 3) {
      const v0 = base + idx[i],
        v1 = base + idx[i + 1],
        v2 = base + idx[i + 2]
      if (
        closed &&
        verts[v0 * VERT + 5] < -0.05 &&
        verts[v1 * VERT + 5] < -0.05 &&
        verts[v2 * VERT + 5] < -0.05
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
  const D = densityOf(w),
    dense = (d: Decal) => !d.density || (D >= d.density[0] && D <= d.density[1])
  const shown = (d: Decal) =>
    dense(d) &&
    (!face ||
      ((!d.when || d.when.some((t) => face.tags.has(t))) &&
        (d.blink === undefined || d.blink === face.blink)))
  const decals: ViewDecal[] = built.decals.filter(shown).map((d) => {
    const p = apply(world[d.bone], d.at),
      n = applyDir(world[d.bone], d.normal),
      nl = Math.hypot(...n) || 1
    const y = p[1] * cp - p[2] * sp,
      z = p[1] * sp + p[2] * cp
    // A print's across and down steps (a bitmap texel each), in cell texels and depth (raster.ts stampPrint).
    const step = (q: V3): [number, number, number] => {
      const e = applyDir(world[d.bone], q),
        t = d.print!.texel
      return [
        (e[0] * t * ppm) / scale,
        (-(e[1] * cp - e[2] * sp) * t * ppm) / scale,
        (e[1] * sp + e[2] * cp) * t,
      ]
    }
    const print = d.print && {
      rows: d.print.rows,
      du: step(d.print.u),
      dv: step(d.print.v),
      seams: d.print.seams,
      inks: Object.fromEntries(
        Object.entries({ '#': d.material, ...d.print.inks }).map(([c, n]) => [
          c,
          built.materialIndex.get(n)!,
        ]),
      ),
    }
    return {
      x: (cx + p[0] * ppm) / scale,
      y: (cy - y * ppm) / scale,
      z,
      facing: (n[1] * sp + n[2] * cp) / nl,
      material: built.materialIndex.get(d.material)!,
      w: d.size?.[0] ?? 1,
      h: d.size?.[1] ?? 1,
      group: built.groups.get(d.bone),
      print,
    }
  })
  return { soup: { verts, count: vi, tris, triCount: ti }, decals }
}
export interface FigureInput {
  /** World facing (rad) the figure wants, and whether it walks. */
  facing: number
  moving: boolean
  view: View
  /** An action playing, from its own start (s). */
  action?: { id: ActionId; t: number } | null
  /** The face (garments.ts EXPRESSIONS): 'talk' opens and shuts the mouth. */
  expression?: Expression
  /** More of the face's marks with it (the painter's, paint.ts stampFace): 'talk' with another expression (angry and
   * talking), 'lookL' / 'lookR' the eyes to one side, 'beside' is an alias of 'lookR' at this size. */
  mood?: string[]
  /**
   * A pose made outside the figure's own motion (the actors' made poses, actor.ts): local to the figure (facing +z, root at
   * its feet), its `yaw` added to the facing. `key` names it for the cell cache, so the same key must mean the same
   * pose. The figure faces `facing` at once, with no turn steps.
   */
  pose?: { key: string; pose: Pose } | null
  /**
   * The figure's clock (s), set from outside (a scripted actor's timeline, actors/actor.ts): its idle, blink and talk
   * are then a pure function of this time, not of the steps it was updated by. Left out, its own clock runs by `dt`.
   */
  clock?: number
}
/** What the face shows this pose: the expression and its marks' tags, and whether the eyes are mid-blink. */
export interface FaceState {
  tags: Set<string>
  blink: boolean
}
