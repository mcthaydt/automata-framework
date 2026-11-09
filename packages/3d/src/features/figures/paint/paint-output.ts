import { pow } from '@automata/sim/math'
import { noise3 } from '../../../shared/math/noise.ts'
import { GROUP } from '../body/mesh.ts'
import { labelAt } from './fabric.ts'
import { stampFace } from './face-stamp.ts'
import type { OutputOut, State8 } from './paint-state.ts'
import { LINE, MIRROR, OUTLINE, RIM } from './paint-style.ts'
import { isLeg } from './regions.ts'
import { budget } from './tone-budget.ts'
import { tint } from './tones.ts'
import { must } from './vec.ts'
/** The cell's colours and normal map, the face's marks on them, and the colour budget. */
export function output(s: State8): OutputOut {
  const {
    albedo,
    cloth,
    face,
    g,
    materials,
    normals,
    D,
    depth,
    extra,
    fabrics,
    group,
    h,
    handTone,
    ink,
    material,
    n,
    part,
    ppm,
    skinny,
    sm,
    stains,
    tones,
    w,
    P,
    owner,
    tone,
    hue,
    through,
    wash,
  } = s

  for (let k = 0; k < n; k++) {
    const o = k * 4,
      t = tone[k] ?? Number.NaN
    if (t === -2) {
      albedo[o + 3] = 0
      normals[o] = 128
      normals[o + 1] = 128
      normals[o + 2] = 255
      normals[o + 3] = 0
      continue
    }
    // A line inside the figure is the far surface's own (its fold, its normal); one outside, its shape's.
    const at = t >= OUTLINE && (material[k] ?? Number.NaN) < 0 ? (owner[k] ?? Number.NaN) : k,
      mi = material[at] ?? Number.NaN
    let ramp = must(tones, mi)
    const stain = must(materials, mi).stain
    let tt: number = t
    if (stain && t < OUTLINE) {
      const q = k * 3,
        up = ((P[q + 1] ?? Number.NaN) - stain.hem) / (stain.below - stain.hem),
        gr = group[k] ?? Number.NaN
      if (isLeg(gr) || gr === GROUP.torso) {
        const worn = isLeg(gr) ? wash(k, up, stain) : 0
        if (worn) {
          ramp = must(stains, mi) ?? ramp
          tt = worn === 3 ? Math.max(Math.min(t, 3) - 1, 0) : t
        }
        // On hanging cloth (a skirt's hem): surely at the hem, ever less often up to its top, in runs that climb (noise
        // tall in y, fine across), on the cloth's own surface so it never swims.
      } else if (
        up < 1 &&
        noise3((P[q] ?? Number.NaN) * 34, (P[q + 1] ?? Number.NaN) * 5, (P[q + 2] ?? Number.NaN) * 34) >
          pow(Math.max(0, up), 0.7) * 0.85
      )
        ramp = must(stains, mi) ?? ramp
    }
    if ((hue[k] ?? Number.NaN) >= MIRROR) {
      ramp = tint(ramp)
      tt = (hue[k] ?? Number.NaN) - MIRROR
    } else if ((hue[k] ?? Number.NaN) >= 0) tt = hue[k] ?? Number.NaN
    // A fabric's tile (H5): a step along the material's own ramp by the tile's label, on cloth's own surface only. Not shine,
    // a line, the rim or the outline; not a holo hue, a mark or a print, a hand, or a texel the painter refilled (the
    // cloth channel follows the raster's surface, not the painter's copy). The head and held items have no cylinder.
    const fab = fabrics[mi]
    if (
      fab &&
      t >= 0 &&
      t <= 3 &&
      (hue[k] ?? Number.NaN) < 0 &&
      at === k &&
      (part[k] ?? Number.NaN) >= 0 &&
      (part[k] ?? Number.NaN) === (g.part[k] ?? Number.NaN) &&
      (material[k] ?? Number.NaN) === (g.material[k] ?? Number.NaN) &&
      (handTone[k] ?? Number.NaN) < 0
    ) {
      const u = cloth!.u(
        group[k] ?? Number.NaN,
        cloth!.place[k * 3] ?? Number.NaN,
        cloth!.place[k * 3 + 1] ?? Number.NaN,
      )
      if (u !== null)
        tt = Math.max(
          0,
          Math.min(ramp.length - 1, tt - labelAt(fab, u, cloth!.place[k * 3 + 2] ?? Number.NaN, ppm)),
        )
    }
    if (
      must(materials, mi).see &&
      t < OUTLINE &&
      ((hue[k] ?? Number.NaN) >= MIRROR || must(materials, mi).holo !== 'mirror')
    )
      through.set(k, tint(must(tones, mi)))
    const c =
      t === OUTLINE
        ? at === k
          ? must(extra, mi).fold
          : ink
        : t === LINE
          ? must(extra, mi).line
          : t === RIM
            ? must(extra, mi).rim
            : t === -1
              ? must(extra, mi).shine
              : (ramp[Math.min(tt, ramp.length - 1)] ?? Number.NaN)
    albedo[o] = (c >> 16) & 255
    albedo[o + 1] = (c >> 8) & 255
    albedo[o + 2] = c & 255
    albedo[o + 3] = 255
    normals[o] = Math.round(((sm[at * 3] ?? Number.NaN) + 1) * 127.5)
    normals[o + 1] = Math.round((1 - (sm[at * 3 + 1] ?? Number.NaN)) * 127.5)
    normals[o + 2] = Math.round(((sm[at * 3 + 2] ?? Number.NaN) + 1) * 127.5)
    normals[o + 3] = 255
  }
  // The face reads the tones: an outline texel (9) is never the face's.
  const fixed = tone.map((v) => (v >= OUTLINE ? 9 : v))
  const kept = new Uint8Array(n)
  for (let k = 0; k < n; k++) if ((tone[k] ?? Number.NaN) === -1 || (hue[k] ?? Number.NaN) >= 0) kept[k] = 1
  if (face)
    stampFace(
      face,
      { ...g, material, part, group, depth },
      must(tones, face.skin),
      albedo,
      fixed,
      through,
      kept,
      (m) => skinny[m] ?? false,
    )
  budget(
    albedo,
    w,
    h,
    D,
    kept,
    (k: number) =>
      material[
        (tone[k] ?? Number.NaN) >= OUTLINE && (material[k] ?? Number.NaN) < 0 ? (owner[k] ?? Number.NaN) : k
      ] ?? Number.NaN,
  )
  return {}
}
