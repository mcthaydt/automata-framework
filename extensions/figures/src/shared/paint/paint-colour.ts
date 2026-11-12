// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check

import { GROUP } from '../body/parts'
import { depthAt, labelAt } from './fabric'
import { budget, isLeg, LINE, lightTexels, MIRROR, OUTLINE, RIM, tint } from './paint-budget'
import type { AfterStainsAndHolo } from './paint-detail'
import { stampFace } from './paint-stamp'
import { EDGE_LEVELS } from './paint-style'
import { noise3 } from './raster'
import { tiled } from './row'

/**
 * Tone to colour: each texel's colour from its material's ramp, a sheer cloth's denser edge, a stain's wash, a
 * holo hue, the outside light's flattening and a fabric's tile label, with the normal map written from the
 * smoothed normals.
 */
export function colourTexels(ctx: AfterStainsAndHolo) {
  const {
    P,
    albedo,
    cloth,
    edges,
    extra,
    fabrics,
    g,
    group,
    handTone,
    hue,
    ink,
    light,
    material,
    materials,
    n,
    normals,
    owner,
    part,
    ppm,
    slotOf,
    sm,
    stains,
    through,
    tone,
    tones,
    wash,
    weave,
  } = ctx
  for (let k = 0; k < n; k++) {
    const o = k * 4,
      t = tone[k]
    if (t === -2) {
      albedo[o + 3] = 0
      normals[o] = 128
      normals[o + 1] = 128
      normals[o + 2] = 255
      normals[o + 3] = 0
      continue
    }
    // A line inside the figure is the far surface's own (its fold, its normal); one outside, its shape's.
    const at = t >= OUTLINE && material[k] < 0 ? owner[k] : k,
      mi = material[at]
    let ramp = tones[mi]
    // Sheer cloth is denser where it turns from the eye: the share's level from how far this texel's normal is from facing it.
    const sheer = edges[mi]
    if (sheer && t < OUTLINE)
      ramp = sheer[Math.round((EDGE_LEVELS - 1) * (1 - Math.max(0, sm[at * 3 + 2])) ** 2)]
    const stain = materials[mi].stain
    let tt: number = t
    if (stain && t < OUTLINE) {
      const q = k * 3,
        up = (P[q + 1] - stain.hem) / (stain.below - stain.hem),
        gr = group[k]
      if (isLeg(gr) || gr === GROUP.torso) {
        const worn = isLeg(gr) ? wash(k, up, stain) : 0
        if (worn) {
          ramp = stains[mi]!
          tt = worn === 3 ? Math.max(Math.min(t, 3) - 1, 0) : t
        }
        // On hanging cloth (a skirt's hem): surely at the hem, ever less often up to its top, in runs that climb (noise
        // tall in y, fine across), on the cloth's own surface so it never swims.
      } else if (up < 1 && noise3(P[q] * 34, P[q + 1] * 5, P[q + 2] * 34) > Math.max(0, up) ** 0.7 * 0.85)
        ramp = stains[mi]!
    }
    if (hue[k] >= MIRROR) {
      ramp = tint(ramp)
      tt = hue[k] - MIRROR
    } else if (hue[k] >= 0) tt = hue[k]
    // Lit from outside: the key's bands are gone, so a light or dark key tone reads mid (3 deep stays).
    else if (light && t >= 0 && t <= 2) tt = 1
    // A fabric's tile (H5): a step along the material's own ramp by the tile's label, on cloth's own surface only. Not shine,
    // a line, the rim or the outline; not a holo hue, a mark or a print, a hand, or a texel the painter refilled (the
    // cloth channel follows the raster's surface, not the painter's copy). The head and held items have no cylinder.
    const fab = fabrics[mi]
    if (
      fab &&
      t >= 0 &&
      t <= 3 &&
      hue[k] < 0 &&
      at === k &&
      part[k] >= 0 &&
      part[k] === g.part[k] &&
      material[k] === g.material[k] &&
      handTone[k] < 0
    ) {
      let u = cloth!.u(group[k], cloth!.place[k * 3], cloth!.place[k * 3 + 1])
      // A handed tile (fabric.ts): the left limbs' `u` runs against the trunk's and the right limbs', so it is read negated.
      if (u !== null && fab.handed && (group[k] === GROUP.armL || group[k] === GROUP.legL)) u = -u
      if (u !== null) {
        weave!.labels[k] = labelAt(fab, u, cloth!.place[k * 3 + 2], ppm)
        weave!.on[k] = slotOf[mi]
      }
    }
    if (materials[mi].see && t < OUTLINE && (hue[k] >= MIRROR || materials[mi].holo !== 'mirror'))
      through.set(k, tint(tones[mi]))
    const c =
      t === OUTLINE
        ? at === k
          ? extra[mi].fold
          : ink
        : t === LINE
          ? extra[mi].line
          : t === RIM
            ? extra[mi].rim
            : t === -1
              ? extra[mi].shine
              : ramp[Math.min(tt, ramp.length - 1)]
    albedo[o] = (c >> 16) & 255
    albedo[o + 1] = (c >> 8) & 255
    albedo[o + 2] = c & 255
    albedo[o + 3] = 255
    normals[o] = Math.round((sm[at * 3] + 1) * 127.5)
    normals[o + 1] = Math.round((1 - sm[at * 3 + 1]) * 127.5)
    normals[o + 2] = Math.round((sm[at * 3 + 2] + 1) * 127.5)
    normals[o + 3] = 255
  }
}

/**
 * The drawn face reads the tones (an outline texel is never the face's) and is stamped on; then the colour budget,
 * the outside light's texels, and last the fabric's tile, a step along its own row by the label.
 */
export function stampAndBudget(ctx: AfterStainsAndHolo) {
  const {
    D,
    albedo,
    depth,
    face,
    g,
    group,
    h,
    hue,
    light,
    material,
    n,
    owner,
    part,
    skinny,
    through,
    tone,
    tones,
    w,
    weave,
  } = ctx
  // The face reads the tones: an outline texel (9) is never the face's.
  const fixed = tone.map((v) => (v >= OUTLINE ? 9 : v))
  const kept = new Uint8Array(n)
  for (let k = 0; k < n; k++) if (tone[k] === -1 || hue[k] >= 0) kept[k] = 1
  if (face)
    stampFace(
      face,
      { ...g, material, part, group, depth },
      tones[face.skin],
      albedo,
      fixed,
      through,
      kept,
      (m) => skinny[m],
    )
  budget(albedo, w, h, D, kept, (k: number) => material[tone[k] >= OUTLINE && material[k] < 0 ? owner[k] : k])
  if (light) lightTexels(light, g, albedo, D)
  if (weave) {
    // The tile, last: the ground as painted, budgeted and lit, then a step along its own row by the label (row.ts tiled).
    weave.ground.set(albedo)
    for (let k = 0; k < n; k++) {
      if (!weave.on[k]) continue
      const o = k * 4,
        c = tiled(
          (albedo[o] << 16) | (albedo[o + 1] << 8) | albedo[o + 2],
          weave.labels[k],
          ...depthAt(weave, k),
        )
      albedo[o] = (c >> 16) & 255
      albedo[o + 1] = (c >> 8) & 255
      albedo[o + 2] = c & 255
    }
  }
}
