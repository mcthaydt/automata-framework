// Hair styles as parts: a style is a list of pieces fitted to the skull in head units (angles round it from
// the front, + toward the figure's left and mirrored; heights of its half-height about its middle; sizes of
// its half-width), so any head the sliders make wears it. The pieces: a scalp (a shell, or a fade's tiers),
// rows (braids or cornrows laid on the scalp), a tail (tail.ts), a fall of ropes or locks, a bun, a sweep (a
// quiff), a block (a high-top) and edges (baby hairs, as marks).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`HairInput`,
// `hairParts`), with AF's strict types; the formulas and their order are the source's. Changed: a piece's
// tone is a swatch variant (tones.ts) instead of a painter ramp; the texel sizes are held at the fixed ppm.

import type { Made } from '../build/materials'
import { FACE_SEAM, headAt, headForm, headNormal } from '../garments/head'
import type { Measure } from '../genes/genes'
import type { HairStyle, Piece } from '../library/hair.schema'
import { add, clamp, cross, hash, lerp, normalize, scale, smooth, sub, type V3 } from '../math/math'
import type { Decal, Mesh, Part, Weight } from '../parts/mesh'
import { superquadric } from '../parts/superquadric'
import { FIGURE_PPM, texels } from '../parts/texels'
import { at, J, type Skeleton } from '../rig/rig'
import { shell } from './shell'
import { alignY, along, CROWN, HAIR_SEAM, onHead, type Skull, skull, toHead, unitAt } from './skull'
import { grid, sweep } from './sweep'
import { tail } from './tail'
import { type Finish, toneOf } from './tones'

export interface HairInput {
  m: Measure
  s: Skeleton
  /** The hair's swatch, and the skin's (a fade and the scalp take its colour). */
  hair: string
  skin: string
  made: Made
  /** Under a cap. */
  capped?: boolean
  /** The wearer's tie (a swatch): the outfit's metal, or one it names. */
  tie?: string | undefined
  /** The dressed trunk (its tops and the body's torso, rest figure space): what a tail falls clear of. */
  trunk?: readonly Part[]
}

/**
 * What a style's pieces share as they are built: the head's frame, the parts so far, and how to tone and bind
 * them.
 */
export interface HairBuild {
  readonly input: HairInput
  readonly k: Skull
  readonly form: ReturnType<typeof headForm>
  readonly head: V3
  readonly hw: number
  readonly parts: Part[]
  readonly decals: Decal[]
  /** A material for a tone in the style's finish. */
  tone(t: string, matte?: boolean): string
  /** A tie's swatch: the style's own, or the wearer's (true), else a band in the hair's own lit tone. */
  tieOf(t: boolean | string | undefined): string | null
  /** A fresh seam: a rope whose gaps must show is its own surface. */
  nextSeam(): number
  /** A rigid piece on the head. */
  rigid(mesh: Mesh, t: string, own?: number, lit?: Mesh, matte?: boolean): void
  /** A skinned piece: its points in head space, each carried by `swing` of its share along. */
  hung(
    mesh: Mesh,
    ts: readonly number[],
    to: string,
    swing: (t: number) => Weight[],
    own: number,
    lit?: Mesh,
    matte?: boolean,
  ): void
}

/**
 * A style's parts on the head and its swinging joints, fitted to the skeleton's head and the body under it.
 */
export function hairParts(input: HairInput, style: HairStyle): { parts: Part[]; decals: Decal[] } {
  const { s, m } = input
  const k = skull(s)
  const form = headForm(m, s)
  const head = at(s.rest, J.head)
  const hw = k.r[0]
  const parts: Part[] = []
  const decals: Decal[] = []
  const finish: Finish = style.finish ?? 'straight'
  let seam = HAIR_SEAM + 100
  const b: HairBuild = {
    input,
    k,
    form,
    head,
    hw,
    parts,
    decals,
    tone: (t, matte) => toneOf(input.made, input.hair, input.skin, finish, t, matte),
    tieOf: (t) => (!t ? null : typeof t === 'string' ? t : (input.tie ?? b.tone('lit'))),
    nextSeam: () => seam++,
    rigid: (mesh, t, own = HAIR_SEAM, lit, matte) => {
      parts.push({ bone: J.head, mesh, material: b.tone(t, matte), group: 1, seam: own })
      if (lit) parts.push({ bone: J.head, mesh: lit, material: b.tone('lit', matte), group: 1, seam: own })
    },
    hung: (mesh, ts, to, swing, own, lit, matte) => {
      const meshes: [Mesh, string][] = [[mesh, to], ...(lit ? [[lit, 'lit'] as [Mesh, string]] : [])]
      for (const [m_, t] of meshes) {
        const placed = { ...m_, positions: m_.positions.map((v, n) => v + at(head, n % 3)) }
        parts.push({ mesh: placed, material: b.tone(t, matte), group: 1, seam: own, skin: ts.map(swing) })
      }
    },
  }
  for (const piece of style.pieces ?? []) {
    const first = parts.length
    buildPiece(b, piece)
    // The hair's top over the crown (its shells, rows, masses, block and bun; never a lock hanging off it, a
    // tail, a fade): what is worn up lies on it, not on whatever stands furthest out.
    if (
      ['rows', 'sweep', 'block', 'bun'].some((c) => c in piece) ||
      ('scalp' in piece && piece.scalp.tone !== 'fade')
    )
      for (let n = first; n < parts.length; n++) parts[n] = { ...at(parts, n), tag: CROWN }
  }
  return { parts, decals }
}

function buildPiece(b: HairBuild, piece: Piece): void {
  const { input: i, k, form, hw, parts, decals } = b
  if ('scalp' in piece) {
    const o = piece.scalp
    // A fade: the head's own surface graded up the band in tiers, the skin at its foot, then the hair's tones
    // toward the skin's, then the stubble (the hair's, matte), each tier one solid tone.
    if (o.tone === 'fade') {
      const grade = o.grade ?? []
      const tier = (row: number) => grade.reduce((n, [from], q) => ((row + 0.5) / 18 >= from ? q : n), -1)
      for (let n = -1; n < grade.length; n++) {
        const { mesh } = shell(k, o, form, (row) => tier(row) === n)
        if (mesh.indices.length)
          parts.push({
            bone: J.head,
            mesh,
            material: n < 0 ? i.skin : b.tone(at(grade, n)[1], true),
            group: 1,
            seam: FACE_SEAM,
          })
      }
    } else {
      const sh = shell(k, o, form)
      b.rigid(sh.mesh, o.tone ?? 'hair', HAIR_SEAM, sh.lit)
    }
  } else if ('rows' in piece) {
    // Rows from the hairline, gathered to one point, or each straight back over the top to the nape, keeping
    // its place across the head (in the skull's units) so the rows run parallel and the scalp shows evenly
    // between them.
    const o = piece.rows
    for (let r = 0; r < o.count; r++) {
      const a = (o.at ?? 0) + (o.count === 1 ? 0 : -o.span + (2 * o.span * r) / (o.count - 1))
      const start = sub(onHead(form, k, a, along(o.from, a)), k.c)
      const path: V3[] = []
      if (o.to === 'nape') {
        const end = sub(onHead(form, k, Math.PI - a, along(o.nape ?? [[0, -0.5]], Math.PI - a)), k.c)
        const u = (d: V3) => normalize([d[0] / k.r[0], d[1] / k.r[1], d[2] / k.r[2]])
        const us = u(start)
        const ue = u(end)
        const f0 = Math.atan2(us[1], us[2])
        const f1 = Math.atan2(ue[1], ue[2]) + (Math.atan2(ue[1], ue[2]) < f0 ? 2 * Math.PI : 0)
        for (let q = 0; q <= 16; q++) {
          const t = q / 16
          const x = lerp(us[0], ue[0], t)
          const f = lerp(f0, f1, t)
          const c = Math.sqrt(1 - x * x)
          path.push(toHead(form, k, [x * k.r[0], c * Math.sin(f) * k.r[1], c * Math.cos(f) * k.r[2]], o.lift))
        }
      } else {
        const to = scale(normalize(o.to), Math.hypot(...start))
        for (let q = 0; q <= 8; q++)
          path.push(
            toHead(form, k, add(scale(normalize(start), 1 - q / 8), scale(normalize(to), q / 8)), o.lift),
          )
      }
      // A slanted plait turns against the next row's, half a bead on, so rows side by side read as a
      // herringbone.
      const slant = o.rope.slant ? { phase: (r % 2) * 0.5, slant: (r % 2 ? 1 : -1) * o.rope.slant } : {}
      const { mesh, lit } = sweep(path, { tip: 'blunt', ...o.rope, ...slant }, hw, (p) => sub(p, k.c))
      b.rigid(mesh, o.tone ?? 'hair', o.apart === false ? HAIR_SEAM : b.nextSeam(), lit, o.matte)
    }
  } else if ('tail' in piece) tail(b, piece.tail)
  else if ('fall' in piece && !(piece.fall.bare && i.capped) && !(piece.fall.capped && !i.capped)) {
    const o = piece.fall
    const locks = o.at.flatMap((knot) => {
      const [a = 0, y0 = 0, y1 = 0, own, to] = knot
      const lock = [a, y0, y1, own ?? o.lift, to ?? a]
      return a > 1e-3 && a < Math.PI - 1e-3
        ? [lock, lock.map((v, n) => (n === 0 || n === 4 ? -v : v))]
        : [lock]
    })
    for (const [a = 0, y0 = 0, y1 = 0, lift = 0, to = 0] of locks) {
      // Down the skull to where it hangs plumb, then straight down, its angle swinging to `to` on the way (so
      // a lock swept toward the face crosses the cheek), flicking out at the tip.
      const top = onHead(form, k, a, y0, o.lift)
      const path: V3[] = [top]
      const steps = 10
      const outDir = (aq: number) => {
        const p = onHead(form, k, aq, Math.min(y0, o.plumb), lift)
        return normalize([p[0] - k.c[0], 0, p[2] - k.c[2]])
      }
      for (let q = 1; q <= steps; q++) {
        const y = lerp(y0, y1, q / steps)
        const aq = lerp(a, to, smooth(q / steps))
        const off = lerp(o.lift, lift, smooth((q / steps) * 5))
        const plumb = onHead(form, k, aq, Math.min(y0, o.plumb), off)
        const p: V3 = y > o.plumb ? onHead(form, k, aq, y, off) : [plumb[0], k.c[1] + y * k.r[1], plumb[2]]
        const below = Math.max(0, o.plumb - y) / Math.max(1e-6, o.plumb - y1)
        path.push(add(p, scale(outDir(aq), hw * ((o.out ?? 0) * below + (o.flick ?? 0) * below ** 3))))
      }
      const { mesh, lit, t } = sweep(path, o.rope, hw, (p, tt) =>
        tt < 0.15 ? sub(p, k.c) : add(outDir(lerp(a, to, tt)), [0, 0.3, 0]),
      )
      const joint = Math.abs(a) > Math.PI * 0.7 ? J['hair.back'] : a > 0 ? J['hair.L'] : J['hair.R']
      b.hung(
        mesh,
        t,
        o.tone ?? 'hair',
        (tt) => {
          const w = smooth((tt - 0.1) / 0.9) * 0.9
          return [
            [J.head, 1 - w],
            [joint, w],
          ]
        },
        o.apart ? b.nextSeam() : (o.seam ?? HAIR_SEAM),
        lit,
        o.matte,
      )
    }
  } else if ('bun' in piece) bun(b, piece.bun)
  else if ('block' in piece) block(b, piece.block)
  else if ('sweep' in piece) {
    const o = piece.sweep
    const from = Array.isArray(o.out) ? unitAt(k, o.out) : null
    const { mesh, lit } = sweep(
      o.path.map((p) => unitAt(k, p)),
      o.rope,
      hw,
      (p) =>
        from ? sub(p, from) : o.out === 'skull' ? sub(p, k.c) : o.out === 'front' ? [0, 0, 1] : [0, 1, 0],
    )
    b.rigid(mesh, o.tone ?? 'hair', o.apart ? b.nextSeam() : HAIR_SEAM, lit)
  } else if ('edges' in piece) {
    // Baby hairs and edges: hair-tone marks laid on the skin just under the hairline, facing out of the face.
    const o = piece.edges
    const material = b.tone(o.tone ?? 'hair')
    for (const [a, dy, w, h] of o.at)
      for (const x of a ? [1, -1] : [1]) {
        const y = along(o.line, a) - dy
        const t = (clamp(y, -1, 1) + 1) / 2
        const v = Math.PI / 2 - x * a
        decals.push({
          bone: J.head,
          at: onHead(form, k, x * a, y, 0.03),
          normal: headNormal(form, t, v),
          material,
          size: [w, h],
        })
      }
  }
}

/** A coil: the rope wound round the bun's axis from a narrow foot up, swelling to a ball and tucked in on
 * top, so it stands off the head on its neck and breaks the silhouette from every side; a band round its
 * foot. */
function bun(b: HairBuild, o: Extract<Piece, { bun: unknown }>['bun']): void {
  const { k, form, hw, parts } = b
  const c0 = toHead(form, k, o.at)
  const up0 = normalize(sub(c0, k.c))
  const R = o.r * hw
  const c = add(c0, scale(up0, R * 0.9))
  const up = normalize(sub(c, k.c))
  const u = normalize(cross(up, [1, 0, 0]))
  const w = cross(up, u)
  const path: V3[] = []
  const steps = Math.ceil(o.turns * 12)
  const radius = (t: number) => R * Math.sqrt(1 - 0.75 * (2 * t - 1) ** 2)
  const height = (t: number) => R * lerp(-0.6, 0.5, t)
  for (let q = 0; q <= steps; q++) {
    const t = q / steps
    const th = 2 * Math.PI * o.turns * t
    path.push(
      add(
        c,
        add(
          scale(up, height(t)),
          add(scale(u, Math.cos(th) * radius(t)), scale(w, Math.sin(th) * radius(t))),
        ),
      ),
    )
  }
  const { mesh, lit } = sweep(path, { ...o.rope, root: 0.02, tip: 'round' }, hw, (p) => sub(p, c))
  b.rigid(mesh, 'hair', b.nextSeam(), lit)
  // The tie: a band, not a cord, standing a little proud of the coil all round, a whole texel tall.
  const band = b.tieOf(o.tie)
  if (band) {
    const foot = add(c, scale(up, height(0.06)))
    const rr = radius(0.12) + o.rope.r * hw * 1.1
    parts.push({
      bone: J.head,
      mesh: superquadric({
        at: foot,
        r: [rr, texels(0.034 * b.input.s.genes.head) / 2, rr],
        e: [0.2, 1],
        seg: 18,
        rings: 4,
        turn: alignY(up),
      }),
      material: band,
      group: 1,
      seam: b.nextSeam(),
    })
  }
}

/** A high-top's block of tight coils: the head's own section at its foot, so its walls rise out of the faded
 * sides with no hem; straight up, flaring a little, over a rounded edge to a flat top in the crest tone. Its
 * cells a texel each at the fixed ppm, a share of the sides' hash-picked into the lit tone: the coils'
 * dither. */
function block(b: HairBuild, o: Extract<Piece, { block: unknown }>['block']): void {
  const { k, form, hw } = b
  const t0 = (o.from + 1) / 2
  const y0 = t0 * form.h
  const y1 = k.c[1] + o.to * k.r[1]
  const c0: V3 = [0, y0, (form.front(t0) + form.back(t0)) / 2]
  const flare = o.flare ?? 1
  const lift = (o.lift ?? 0) * hw
  const rho = (o.round ?? 0.15) * hw
  const coil = o.coil ?? 0.4
  const foot = (v: number) => sub(headAt(form, t0, v), c0)
  const ring = Array.from({ length: 48 }, (_, j) => foot((2 * Math.PI * j) / 48))
  const around =
    (ring.reduce((l, d, j) => l + Math.hypot(...sub(d, at(ring, (j + 1) % 48))), 0) * (1 + flare)) / 2
  const cols = Math.max(24, Math.ceil(around * FIGURE_PPM))
  const walls = Math.max(6, Math.ceil((y1 - rho - y0) * FIGURE_PPM))
  const edge = 3
  const cap = 3
  const rows = walls + edge + cap
  const R = (r0: number, y: number) => {
    const q = clamp((y - y0) / (y1 - y0), 0, 1)
    return r0 * lerp(1, flare, q) + lift * smooth(q * 4)
  }
  const point = (i: number, j: number): V3 => {
    const d = foot((2 * Math.PI * j) / cols)
    const r0 = Math.hypot(d[0], d[2]) || 1e-6
    let r: number
    let y: number
    if (i <= walls) {
      y = lerp(y0, y1 - rho, i / walls)
      r = R(r0, y)
    } else if (i <= walls + edge) {
      const ph = (((i - walls) / edge) * Math.PI) / 2
      y = y1 - rho + rho * Math.sin(ph)
      r = R(r0, y1) - rho * (1 - Math.cos(ph))
    } else {
      y = y1
      r = (R(r0, y1) - rho) * (1 - (i - walls - edge) / cap)
    }
    return [c0[0] + (d[0] / r0) * r, y, c0[2] + (d[2] / r0) * r]
  }
  // The crest takes the top and the edge's upper part, so it shows a band two or three texels deep even seen
  // level.
  const inner = (): V3 => [c0[0], (y0 + y1) / 2, c0[2]]
  const top = (i: number) => i > walls
  const coiled = (i: number, j: number) => !top(i) && hash(i * 92821 + j * 68917) < coil
  b.rigid(
    grid(rows, cols, point, true, inner, (i, j) => top(i) || coiled(i, j)),
    o.tone ?? 'hair',
    HAIR_SEAM,
    grid(rows, cols, point, true, inner, (i, j) => !coiled(i, j)),
    true,
  )
  b.rigid(
    grid(rows, cols, point, true, inner, (i) => !top(i)),
    o.top ?? 'crest',
    HAIR_SEAM,
  )
}
