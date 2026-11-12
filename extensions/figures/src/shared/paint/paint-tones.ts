// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP } from '../body/parts'
import {
  GLOSS_SHEEN,
  isLeg,
  K2,
  OUTLINE,
  RISE,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
  touching,
} from './paint-budget'
import { FACE_SEAM, KEY, oklab } from './paint-style'
import type { AfterQuiltedBands } from './paint-surface'

/**
 * The gloss patches (a dark gloss's sheen, a glossy face's) and the tone of every texel: its crevice, its cast
 * shadow marched toward the key, its shine, and the outline's owner and its line, with the hands' own tones.
 */
export function toneTexels(ctx: AfterQuiltedBands) {
  const {
    D,
    band,
    depth,
    faceLight,
    filled,
    grains,
    group,
    h,
    handTone,
    isFace,
    lit,
    material,
    materials,
    n,
    part,
    ppm,
    skin,
    skinny,
    sm,
    style,
    surfaceOf,
    thOf,
    tones,
    w,
  } = ctx
  /** A dark, hard gloss (leather, patent, a black frame): its body stays dark, its light only a thin rim on the key's side
   * of its silhouette, its highlight one soft patch per surface (the sheen, above), not a streak along every crest. */
  const hard = materials.map(
    (m, i) => m.gloss !== undefined && !m.strands && i !== skin && oklab(tones[i][1])[0] < 0.4,
  )
  // Tones: 0 light … 3 deep, −1 a gloss's shine, −2 empty, OUTLINE and LINE. `owner` is the shape an outline texel
  // belongs to (the nearer one): its line tone and its normal.
  const tone = new Int8Array(n).fill(-2),
    owner = new Int32Array(n).fill(-1),
    under = new Int8Array(n).fill(2)
  const half = (() => {
    const v = [KEY[0], KEY[1], KEY[2] + 1],
      l = Math.hypot(...v)
    return v.map((c) => c / l)
  })()
  const spec = (k: number) => sm[k * 3] * half[0] + sm[k * 3 + 1] * half[1] + sm[k * 3 + 2] * half[2]
  // A glossy face's sheen: a few texels on the planes that mirror the key best (its top 4%, at most 3·D of them), never
  // a whole plane (its planes are flat, so a sheen by threshold would take one entire).
  let faceSheen = Infinity
  if (skin >= 0 && materials[skin].gloss !== undefined) {
    const ss: number[] = []
    for (let k = 0; k < n; k++) if (isFace(k)) ss.push(spec(k))
    ss.sort((a, b) => b - a)
    if (ss.length) faceSheen = ss[Math.min(ss.length - 1, Math.floor(Math.min(0.04 * ss.length, 3 * D)))]
  }
  // A dark gloss's sheen patch, per surface (a part in one material): the texels that mirror the key best, by the mirror term
  // (the texel's index breaks a tie, so a flat surface never takes whole). Marked here, before the tone loop reads it.
  const sheen = new Uint8Array(n)
  if (hard.some(Boolean)) {
    const bySurface = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (material[k] >= 0 && part[k] >= 0 && hard[material[k]]) {
        const key = surfaceOf(k)
        let a = bySurface.get(key)
        if (!a) {
          a = []
          bySurface.set(key, a)
        }
        a.push(k)
      }
    for (const [key, ks] of bySurface) {
      if (ks.length < SHEEN_MIN * D * D) continue
      const take = Math.min(
        Math.floor(GLOSS_SHEEN * materials[key % 4096].gloss! * ks.length * sheenScale(D)),
        Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
      )
      ks.sort((a, b) => spec(b) - spec(a) || a - b)
      for (let i = 0; i < Math.max(1, take); i++) sheen[ks[i]] = 1
    }
  }
  const maxShadow = Math.round(style.shadow * D)
  /** Within `D` rows under the face's skin: the jaw's own shadow band on the neck. */
  const underJaw = (x: number, y: number) => {
    for (let d = 1; d <= D; d++) if (y - d >= 0 && part[(y - d) * w + x] === FACE_SEAM) return true
    return false
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        mi = material[k]
      if (mi < 0) continue
      const m = materials[mi]
      // Where another group passes in front: this, the far side, takes its outline; a nearer part beside: a crevice tone.
      let line = -1,
        crevice = false
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || (part[q] < 0 && part[q] !== -2)) continue
        const d = depth[q] - depth[k]
        // One garment over the trunk and the legs (trousers' seat and legs, in one cloth whatever its wash) is one
        // surface: no line where it crosses.
        const cloth =
          material[q] >= 0 &&
          tones[material[q]] === tones[mi] &&
          (isLeg(group[k]) ? group[q] === GROUP.torso : group[k] === GROUP.torso && isLeg(group[q]))
        if (group[q] !== group[k] && d > style.line && !cloth) {
          if (line < 0 || depth[q] > depth[line]) line = q
        }
        // Where two body regions only touch (an arm hanging against the ribs, the thighs, a hand on the leg), their
        // depths meet: the line runs down the contact, on whichever side sits behind, beside the other's flank (not over
        // a shoulder's or a hip's top, where one grows from the other).
        else if (
          i < 2 &&
          touching(group[k], group[q]) &&
          (d > 0 || (d === 0 && group[k] < group[q])) &&
          Math.abs(sm[k * 3 + 1]) < 0.35 &&
          Math.abs(sm[q * 3 + 1]) < 0.35
        ) {
          if (line < 0) line = q
        } else if (
          d > style.crevice &&
          !(band[k] > -9 && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi])
        )
          crevice = true
      }
      if (m.flat || part[k] === -2) {
        if (line >= 0 && part[k] !== -2) {
          tone[k] = OUTLINE
          owner[k] = line
          under[k] = 1
        } else tone[k] = 1
        continue
      }
      const f = lit[k],
        grain = grains[k],
        th = thOf(k)
      let t = band[k] > -9 ? band[k] : f > th[0] ? 0 : f > th[1] ? 1 : f > th[2] ? 2 : 3
      if (t === 1 && faceLight[k]) t = 0
      if (m.lift !== undefined && m.lift <= 0) t = Math.max(t, 1)
      // A chamber's stitch is its own last row: the next chamber beside it casts no crevice and no shadow on it.
      const quilted = band[k] > -9,
        stitch = (q: number) =>
          quilted && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi]
      if (crevice) t = Math.max(t, 2)
      // The cast shadow: march toward the key; a part of another surface standing above the ray's climb shades this one.
      // The head shades the neck in one band, `D` rows under the jaw's edge, never stacked deeper (a crevice and a cast
      // shadow piled under a short chin read as a beard).
      const neck = mi === skin && part[k] !== FACE_SEAM && group[k] === GROUP.head
      // The neck is the head's to shade: it sits under the jaw, never in the face's light.
      if (neck) t = Math.max(t, 1)
      for (let d = 1; d <= maxShadow; d++) {
        const xx = Math.round(x + K2[0] * d),
          yy = Math.round(y + K2[1] * d)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || part[q] === -2) continue
        if ((neck && part[q] === FACE_SEAM && !underJaw(x, y)) || stitch(q)) continue
        if (depth[q] - depth[k] > style.shadowDepth + (RISE * d) / ppm) {
          t = Math.max(t, 2)
          break
        }
      }
      // A gloss mirrors the key where the surface faces halfway between it and the eye (the strands break it on hair): a
      // tight spot, tighter the glossier. A hard one: its shine only in the surface's sheen patch (above), where it mirrors the
      // key best, so a sleeve's is one soft highlight that holds its place from frame to frame.
      if (m.gloss !== undefined && t <= 1 && band[k] === -9) {
        const sk = spec(k)
        if (hard[mi]) {
          if (sheen[k] && sk > 1 - (1 - m.gloss) * 0.9) t = -1
        } else if (isFace(k) ? t === 0 && sk > faceSheen : sk + grain * 0.15 > 1 - (1 - m.gloss) * 0.6) t = -1
      }
      // An ear (a surface in the skin's own tones but not the skin): the skin's ramp, its rim the mid or the shadow (never
      // the light, nor a gloss's shine: the face's front is where the light lands) and its bowl the one shadow step inside
      // it, so at sprite size it reads as an ear, not a dark or a pale patch.
      if (skinny[mi] && mi !== skin && t !== OUTLINE) t = Math.max(1, Math.min(t, 2))
      // A line texel keeps the tone it would have had (`under`), should its line turn out a stray fleck.
      if (line >= 0) {
        tone[k] = OUTLINE
        owner[k] = line
        under[k] = Math.max(t, 2)
      } else tone[k] = handTone[k] >= 0 ? handTone[k] : t
    }
  return { hard, tone, owner, under }
}

/** The context once `toneTexels` has run. */
export type AfterToneTexels = AfterQuiltedBands & ReturnType<typeof toneTexels>
