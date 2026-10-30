// A fitted cap, and the hair under it. The cap: a crown of panels lifted off the head's own form from its
// band to a button; a brim on the band (worn backwards at π); a snapback's gap opposite the brim with a strap
// across its foot; the panels' seams as marks a texel apart. Under it, the hair is pressed inside its dome,
// so no style stands through it.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`underCap`,
// `capParts`), with AF's strict types; the formulas and their order are the source's. Changed: the seam's
// painter tone is a variant of the cap's swatch (build/materials.ts), and its marks are spaced at the fixed
// ppm.

import { type Made, variant } from '../build/materials'
import { headForm } from '../garments/head'
import type { Measure } from '../genes/genes'
import type { Cap } from '../library/headwear.schema'
import { add, axisAngle, lerp, normalize, qmul, scale, sub, type V3 } from '../math/math'
import type { Decal, Part } from '../parts/mesh'
import { superquadric } from '../parts/superquadric'
import { FIGURE_PPM } from '../parts/texels'
import { at, J, type Skeleton } from '../rig/rig'
import { shell } from './shell'
import { alignY, along, CROWN, onHead, skull, toHead } from './skull'
import { grid, sweep } from './sweep'

/**
 * Hair under a cap: every point of it above the cap's band and outside its dome is drawn in toward the
 * skull's centre to just inside the dome, as a cap presses the hair flat. What hangs below the band and what
 * comes out through a cap's gap is left as it falls.
 */
export function underCap(m: Measure, s: Skeleton, o: Cap, parts: readonly Part[]): Part[] {
  const k = skull(s)
  const form = headForm(m, s)
  const head = at(s.rest, J.head)
  const gapAt = o.brim.at + Math.PI
  // A little inside the dome's least lift (its panels' valleys), so the cap's own surface is always the
  // nearer.
  const inner = (y: number) => (o.lift * (1 - (o.panels?.[1] ?? 0)) + o.crown * Math.max(0, y)) * 0.8 * k.r[0]
  return parts.map((p) => {
    const off: V3 = p.skin ? head : [0, 0, 0]
    const pos = p.mesh.positions.slice()
    let moved = false
    for (let n = 0; n < pos.length; n += 3) {
      const d: V3 = [
        at(pos, n) - off[0] - k.c[0],
        at(pos, n + 1) - off[1] - k.c[1],
        at(pos, n + 2) - off[2] - k.c[2],
      ]
      const len = Math.hypot(...d)
      if (len < 1e-9) continue
      const base = sub(toHead(form, k, d), k.c)
      const y = base[1] / k.r[1]
      const a = Math.atan2(d[0] / k.r[0], d[2] / k.r[2])
      const y0 = along(o.band, a)
      if (y < y0) continue
      if (o.gap) {
        const g =
          Math.abs(((((a - gapAt + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI) /
          o.gap.width
        const up = (y - y0) / o.gap.height
        if (g * g + up * up < 1) continue
      }
      const dome = Math.hypot(...base) + inner(y)
      if (len <= dome) continue
      const f = dome / len
      for (let q = 0; q < 3; q++) pos[n + q] = at(off, q) + at(k.c, q) + at(d, q) * f
      moved = true
    }
    return moved ? { ...p, mesh: { ...p.mesh, positions: pos } } : p
  })
}

export function capParts(
  m: Measure,
  s: Skeleton,
  material: string,
  o: Cap,
  made: Made,
  mark?: string,
): { parts: Part[]; decals: Decal[] } {
  const k = skull(s)
  const form = headForm(m, s)
  const hw = k.r[0]
  const parts: Part[] = []
  const decals: Decal[] = []
  const gapAt = o.brim.at + Math.PI
  const on = (a: number, y: number, lift: number) => onHead(form, k, a, y, lift)
  const dome = {
    from: o.band,
    lift: o.lift,
    crown: o.crown,
    ridges: o.panels,
    comb: [0, 1, 0] as V3,
    ...(o.gap ? { cut: { at: gapAt, width: o.gap.width, height: o.gap.height } } : {}),
  }
  parts.push({ bone: J.head, mesh: shell(k, dome, form).mesh, material, group: 1, tag: CROWN })
  if (o.panels) {
    // The seams run up the ridges' valleys, a mark every half texel, so the line is unbroken; clear of the
    // band and the button, where the brim and the button stand in front.
    const seamTone = variant(made, material, 'seam', { flat: true, shade: -1 })
    const step = 0.5 / FIGURE_PPM
    for (let j = 0; j < o.panels[0]; j++) {
      const a = (2 * Math.PI * j) / o.panels[0]
      const y0 = along(o.band, a) + 0.12
      const y1 = 0.9
      const n = Math.ceil(Math.hypot(...sub(on(a, y0, 0), on(a, y1, 0))) / step)
      for (let q = 0; q <= n; q++) {
        const y = lerp(y0, y1, q / n)
        const p = on(a, y, (o.lift + o.crown * Math.max(0, y)) * (1 - o.panels[1]))
        decals.push({ bone: J.head, at: p, normal: normalize(sub(p, k.c)), material: seamTone })
      }
    }
  }
  // The brim: a thin plate from the band out, its plan rounded, its sides bent down.
  const rows = 12
  const cols = 10
  const th = (o.brim.thick ?? 0.05) * hw
  const { reach, droop, width } = o.brim
  const curve = o.brim.curve ?? 0.25
  const edge = (r: number) => {
    const a = o.brim.at + width * ((r / rows) * 2 - 1)
    return on(a, along(o.band, a), o.lift * 0.9)
  }
  const radial = (p: V3) => normalize([p[0] - k.c[0], 0, p[2] - k.c[2]])
  const plate = (i: number, j: number): V3 => {
    const u = (i / rows) * 2 - 1
    const p = edge(i)
    const d = radial(p)
    const R = reach * k.r[2] * Math.sqrt(Math.max(0.02, 1 - 0.8 * u * u))
    const t = (2 * Math.PI * j) / cols
    const r = ((1 - Math.cos(t)) / 2) * 1.08 - 0.08
    const lift = Math.sin(t) * th * Math.sqrt(Math.max(0.1, 1 - u * u))
    return add(
      p,
      add(scale(d, R * r * Math.cos(droop)), [0, -R * r * Math.sin(droop) - curve * u * u * r * R + lift, 0]),
    )
  }
  // Its inside: the middle of each row's section (the plate is thin, so its normals turn from that point).
  const centre = (i: number) => {
    const u = (i / rows) * 2 - 1
    const p = edge(i)
    const R = reach * k.r[2] * Math.sqrt(Math.max(0.02, 1 - 0.8 * u * u))
    const r = 0.46
    return add(
      p,
      add(scale(radial(p), R * r * Math.cos(droop)), [
        0,
        -R * r * Math.sin(droop) - curve * u * u * r * R,
        0,
      ]),
    )
  }
  parts.push({ bone: J.head, mesh: grid(rows, cols, plate, true, centre), material, group: 1 })
  if (mark && o.brim.sticker) {
    // The sticker: a flat square on the brim's top, halfway out, a little off its middle, turned down its
    // slope.
    const i = Math.round(rows * 0.6)
    const c = centre(i)
    const d = radial(edge(i))
    const up = normalize(add(scale(d, Math.sin(droop)), [0, Math.cos(droop), 0]))
    const R = reach * k.r[2] * o.brim.sticker
    const turn = qmul(alignY(up), axisAngle([0, 1, 0], Math.atan2(d[0], d[2])))
    parts.push({
      bone: J.head,
      mesh: superquadric({
        at: add(c, scale(up, th)),
        r: [R, th * 0.5, R * 0.8],
        e: [0.3, 0.3],
        seg: 8,
        rings: 3,
        turn,
      }),
      material: mark,
      group: 1,
    })
  }
  if (o.button)
    parts.push({
      bone: J.head,
      mesh: superquadric({
        at: on(0, 1, o.lift + o.crown),
        r: [o.button * hw, o.button * hw * 0.55, o.button * hw],
        seg: 8,
        rings: 4,
      }),
      material,
      group: 1,
    })
  if (o.gap) {
    // The strap across the gap's foot, from one side of the arch to the other.
    const path: V3[] = []
    for (let q = 0; q <= 8; q++) {
      const a = gapAt + o.gap.width * 1.1 * (q / 4 - 1)
      path.push(on(a, along(o.band, a) + 0.04, o.lift * 1.02))
    }
    parts.push({
      bone: J.head,
      mesh: sweep(path, { r: 0.07, flat: 0.5, tip: 'blunt', root: 0.02 }, hw, (p) => sub(p, k.c)).mesh,
      material: o.gap.strap ?? material,
      group: 1,
    })
  }
  return { parts, decals }
}
