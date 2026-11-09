import { hypot } from '@automata/sim/math'
import { oklab } from '../../../shared/math/colour.ts'
import { GROUP } from '../body/mesh.ts'
import { FACE_SEAM } from './face-plane.ts'
import type { CleanTonesOut, QuiltingOut, State3, State4, State5, ToneTexelsOut } from './paint-state.ts'
import { K2, KEY, OUTLINE, RISE, SHEEN } from './paint-style.ts'
import { isLeg, touching } from './regions.ts'
import { must, norm, sq } from './vec.ts'
/** Quilting: a sewn chamber lit as one pillow by its rows. */
export function quilting(s: State3): QuiltingOut {
  const { materials, D, group, h, material, n, part, tones, w, lit, modelled, thOf } = s

  // Quilting: a sewn chamber (a surface beside another of its group in the same ramp under another name, as garments.ts
  // `chambers` makes a puffer's baffles, and long across its run) is lit as one pillow by its rows across the band: its
  // first rows on the key's side the crest (light where the band faces the key, mid away from it), its body mid or
  // shadow by the band's own light, its last row before the stitch deep. Each baffle then reads as one clean roll over a
  // shadow, varying only in width with the light, never as islands of light where the bumps catch it.
  const band = new Int8Array(n).fill(-9)
  {
    const by = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (modelled(k)) {
        let a = by.get(part[k] ?? Number.NaN)
        if (!a) {
          a = []
          by.set(part[k] ?? Number.NaN, a)
        }
        a.push(k)
      }
    for (const [p, ks] of by) {
      if (ks.length < 4 * D * D) continue
      let stitched = 0,
        mx = 0,
        my = 0
      for (const k of ks) {
        const x = k % w,
          y = (k - x) / w
        mx += x
        my += y
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w])
          if (
            q >= 0 &&
            q < n &&
            (part[q] ?? Number.NaN) !== p &&
            modelled(q) &&
            (group[q] ?? Number.NaN) === (group[k] ?? Number.NaN) &&
            (material[q] ?? Number.NaN) !== (material[k] ?? Number.NaN) &&
            must(tones, material[q] ?? Number.NaN) === must(tones, material[k] ?? Number.NaN)
          )
            stitched++
      }
      if (stitched < 2 * D) continue
      mx /= ks.length
      my /= ks.length
      let sxx = 0,
        syy = 0,
        sxy = 0
      for (const k of ks) {
        const x = (k % w) - mx,
          y = (k - (k % w)) / w - my
        sxx += x * x
        syy += y * y
        sxy += x * y
      }
      // The band's run is its long axis; across it (the short one) its rows go from the stitch on the key's side to the next.
      const tr = (sxx + syy) / 2,
        det = Math.sqrt(Math.max(0, sq((sxx - syy) / 2) + sxy * sxy)),
        lo = tr - det,
        hi = tr + det
      if (hi < lo * 3.2) continue
      let ux = sxy,
        uy = lo - sxx
      if (Math.abs(ux) + Math.abs(uy) < 1e-9) {
        ux = sxx <= syy ? 1 : 0
        uy = sxx <= syy ? 0 : 1
      }
      const ul = hypot(ux, uy)
      ux /= ul
      uy /= ul
      if (Math.abs(ux) > 0.92) {
        ux = Math.sign(ux)
        uy = 0
      } else if (Math.abs(uy) > 0.92) {
        ux = 0
        uy = Math.sign(uy)
      }
      if (ux * K2[0] + uy * K2[1] > 0) {
        ux = -ux
        uy = -uy
      }
      const th = thOf(ks[0] ?? Number.NaN),
        gloss = must(materials, material[ks[0] ?? Number.NaN] ?? Number.NaN).gloss !== undefined
      for (const k of ks) {
        const x = k % w,
          y = (k - x) / w
        let a = 0,
          b = 0,
          sum = lit[k] ?? Number.NaN,
          c = 1
        const at = (i: number) => {
          const xx = Math.round(x + ux * i),
            yy = Math.round(y + uy * i)
          return xx >= 0 && yy >= 0 && xx < w && yy < h && (part[yy * w + xx] ?? Number.NaN) === p
            ? yy * w + xx
            : -1
        }
        for (let q = at(-1); q >= 0 && a < 12 * D; q = at(-(++a + 1))) {
          sum += lit[q] ?? Number.NaN
          c++
        }
        for (let q = at(1); q >= 0 && b < 12 * D; q = at(++b + 1)) {
          sum += lit[q] ?? Number.NaN
          c++
        }
        const fb = sum / c,
          rows = a + b + 1
        // A glossy chamber's crest catches the key as one line of shine along its top, where the band faces it.
        band[k] =
          a < D && rows > D
            ? fb > (th[0] ?? Number.NaN) && a === 0 && gloss
              ? -1
              : fb > (th[1] ?? Number.NaN)
                ? 0
                : 1
            : b === 0 && rows >= 3
              ? D > 1 && rows >= 4
                ? 3
                : 2
              : fb > (th[2] ?? Number.NaN)
                ? 1
                : 2
      }
    }
  }
  return { band }
}

/** Each texel's tone: light, mid, shadow or deep, with its outline, crevice and cast shadow. */
export function toneTexels(s: State4): ToneTexelsOut {
  const {
    materials,
    skin,
    style,
    D,
    depth,
    filled,
    group,
    h,
    handTone,
    material,
    n,
    part,
    ppm,
    skinny,
    sm,
    tones,
    w,
    faceLight,
    isFace,
    grains,
    lit,
    thOf,
    band,
  } = s

  /** A dark, hard gloss (leather, patent, a black frame): its body stays dark, its light only a thin rim on the key's side
   * of its silhouette, its highlight streaks a texel wide along the crest of its form. */
  const hard = materials.map(
    (m, i) =>
      m.gloss !== undefined && !m.strands && i !== skin && oklab(must(tones, i)[1] ?? Number.NaN)[0] < 0.4,
  )
  // Tones: 0 light … 3 deep, −1 a gloss's shine, −2 empty, OUTLINE and LINE. `owner` is the shape an outline texel
  // belongs to (the nearer one): its line tone and its normal.
  const tone = new Int8Array(n).fill(-2),
    owner = new Int32Array(n).fill(-1),
    under = new Int8Array(n).fill(2)
  const half = (() => {
    const v = [KEY[0], KEY[1], KEY[2] + 1],
      l = norm(v)
    return v.map((c) => c / l)
  })()
  const spec = (k: number) =>
    (sm[k * 3] ?? Number.NaN) * (half[0] ?? Number.NaN) +
    (sm[k * 3 + 1] ?? Number.NaN) * (half[1] ?? Number.NaN) +
    (sm[k * 3 + 2] ?? Number.NaN) * (half[2] ?? Number.NaN)
  // A glossy face's sheen: a few texels on the planes that mirror the key best (its top 4%, at most 3·D of them), never
  // a whole plane (its planes are flat, so a sheen by threshold would take one entire).
  let faceSheen = Infinity
  if (skin >= 0 && must(materials, skin).gloss !== undefined) {
    const ss: number[] = []
    for (let k = 0; k < n; k++) if (isFace(k)) ss.push(spec(k))
    ss.sort((a, b) => b - a)
    if (ss.length)
      faceSheen = ss[Math.min(ss.length - 1, Math.floor(Math.min(0.04 * ss.length, 3 * D)))] ?? Number.NaN
  }
  const maxShadow = Math.round(style.shadow * D)
  /** Within `D` rows under the face's skin: the jaw's own shadow band on the neck. */
  const underJaw = (x: number, y: number) => {
    for (let d = 1; d <= D; d++)
      if (y - d >= 0 && (part[(y - d) * w + x] ?? Number.NaN) === FACE_SEAM) return true
    return false
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        mi = material[k] ?? Number.NaN
      if (mi < 0) continue
      const m = must(materials, mi)
      // Where another group passes in front: this, the far side, takes its outline; a nearer part beside: a crevice tone.
      let line = -1,
        crevice = false
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (
          (part[q] ?? Number.NaN) === (part[k] ?? Number.NaN) ||
          ((part[q] ?? Number.NaN) < 0 && (part[q] ?? Number.NaN) !== -2)
        )
          continue
        const d = (depth[q] ?? Number.NaN) - (depth[k] ?? Number.NaN)
        // One garment over the trunk and the legs (trousers' seat and legs, in one cloth whatever its wash) is one
        // surface: no line where it crosses.
        const cloth =
          (material[q] ?? Number.NaN) >= 0 &&
          must(tones, material[q] ?? Number.NaN) === must(tones, mi) &&
          (isLeg(group[k] ?? Number.NaN)
            ? (group[q] ?? Number.NaN) === GROUP.torso
            : (group[k] ?? Number.NaN) === GROUP.torso && isLeg(group[q] ?? Number.NaN))
        if ((group[q] ?? Number.NaN) !== (group[k] ?? Number.NaN) && d > style.line && !cloth) {
          if (line < 0 || (depth[q] ?? Number.NaN) > (depth[line] ?? Number.NaN)) line = q
        }
        // Where two body regions only touch (an arm hanging against the ribs, the thighs, a hand on the leg), their
        // depths meet: the line runs down the contact, on whichever side sits behind, beside the other's flank (not over
        // a shoulder's or a hip's top, where one grows from the other).
        else if (
          i < 2 &&
          touching(group[k] ?? Number.NaN, group[q] ?? Number.NaN) &&
          (d > 0 || (d === 0 && (group[k] ?? Number.NaN) < (group[q] ?? Number.NaN))) &&
          Math.abs(sm[k * 3 + 1] ?? Number.NaN) < 0.35 &&
          Math.abs(sm[q * 3 + 1] ?? Number.NaN) < 0.35
        ) {
          if (line < 0) line = q
        } else if (
          d > style.crevice &&
          !(
            (band[k] ?? Number.NaN) > -9 &&
            (group[q] ?? Number.NaN) === (group[k] ?? Number.NaN) &&
            (material[q] ?? Number.NaN) >= 0 &&
            must(tones, material[q] ?? Number.NaN) === must(tones, mi)
          )
        )
          crevice = true
      }
      if (m.flat || (part[k] ?? Number.NaN) === -2) {
        if (line >= 0 && (part[k] ?? Number.NaN) !== -2) {
          tone[k] = OUTLINE
          owner[k] = line
          under[k] = 1
        } else tone[k] = 1
        continue
      }
      const f = lit[k] ?? Number.NaN,
        grain = grains[k] ?? Number.NaN,
        th = thOf(k)
      let t =
        (band[k] ?? Number.NaN) > -9
          ? (band[k] ?? Number.NaN)
          : f > (th[0] ?? Number.NaN)
            ? 0
            : f > (th[1] ?? Number.NaN)
              ? 1
              : f > (th[2] ?? Number.NaN)
                ? 2
                : 3
      if (t === 1 && (faceLight[k] ?? Number.NaN)) t = 0
      if (m.lift !== undefined && m.lift <= 0) t = Math.max(t, 1)
      // A chamber's stitch is its own last row: the next chamber beside it casts no crevice and no shadow on it.
      const quilted = (band[k] ?? Number.NaN) > -9,
        stitch = (q: number) =>
          quilted &&
          (group[q] ?? Number.NaN) === (group[k] ?? Number.NaN) &&
          (material[q] ?? Number.NaN) >= 0 &&
          must(tones, material[q] ?? Number.NaN) === must(tones, mi)
      if (crevice) t = Math.max(t, 2)
      // The cast shadow: march toward the key; a part of another surface standing above the ray's climb shades this one.
      // The head shades the neck in one band, `D` rows under the jaw's edge, never stacked deeper (a crevice and a cast
      // shadow piled under a short chin read as a beard).
      const neck =
        mi === skin && (part[k] ?? Number.NaN) !== FACE_SEAM && (group[k] ?? Number.NaN) === GROUP.head
      // The neck is the head's to shade: it sits under the jaw, never in the face's light.
      if (neck) t = Math.max(t, 1)
      for (let d = 1; d <= maxShadow; d++) {
        const xx = Math.round(x + K2[0] * d),
          yy = Math.round(y + K2[1] * d)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if ((part[q] ?? Number.NaN) === (part[k] ?? Number.NaN) || (part[q] ?? Number.NaN) === -2) continue
        if ((neck && (part[q] ?? Number.NaN) === FACE_SEAM && !underJaw(x, y)) || stitch(q)) continue
        if ((depth[q] ?? Number.NaN) - (depth[k] ?? Number.NaN) > style.shadowDepth + (RISE * d) / ppm) {
          t = Math.max(t, 2)
          break
        }
      }
      // A gloss mirrors the key where the surface faces halfway between it and the eye (the strands break it on hair): a
      // tight spot, tighter the glossier. A hard one: its shine only on the ridge of that mirror (the texel facing it best
      // across the form, along x or y), so a sleeve's is a streak a texel wide down its crest that holds its place from
      // frame to frame.
      if (m.gloss !== undefined && t <= 1 && (band[k] ?? Number.NaN) === -9) {
        const sk = spec(k)
        if (hard[mi] ?? false) {
          const same = (q: number) =>
            q >= 0 && q < n && (part[q] ?? Number.NaN) === (part[k] ?? Number.NaN) ? spec(q) : NaN
          const l = same(x > 0 ? k - 1 : -1),
            r = same(x < w - 1 ? k + 1 : -1),
            u = same(k - w),
            dn = same(k + w)
          if (sk > 1 - (1 - m.gloss) * 0.9 && ((sk >= l && sk >= r) || (sk >= u && sk >= dn))) t = -1
        } else if (isFace(k) ? t === 0 && sk > faceSheen : sk + grain * 0.15 > 1 - (1 - m.gloss) * 0.6) t = -1
      }
      // An ear (a surface in the skin's own tones but not the skin): the skin's ramp, its rim the mid or the shadow (never
      // the light, nor a gloss's shine: the face's front is where the light lands) and its bowl the one shadow step inside
      // it, so at sprite size it reads as an ear, not a dark or a pale patch.
      if ((skinny[mi] ?? false) && mi !== skin && t !== OUTLINE) t = Math.max(1, Math.min(t, 2))
      // A line texel keeps the tone it would have had (`under`), should its line turn out a stray fleck.
      if (line >= 0) {
        tone[k] = OUTLINE
        owner[k] = line
        under[k] = Math.max(t, 2)
      } else tone[k] = (handTone[k] ?? Number.NaN) >= 0 ? (handTone[k] ?? Number.NaN) : t
    }
  return { tone, owner, under }
}

/** The tones as a pixel artist cleans them: sheen, face planes, whole lines, reflected light and clusters. */
export function cleanTones(s: State5): CleanTonesOut {
  const {
    materials,
    style,
    D,
    filled,
    h,
    hairy,
    handTone,
    material,
    n,
    part,
    sm,
    w,
    faceLight,
    isFace,
    grains,
    owner,
    tone,
    under,
  } = s

  // The hair's sheen band, as a sprite artist paints glossy hair: a ring of the hair's shine round the crown where its
  // surface turns from the top to the side (its normal's rise in a narrow window), broken where the strands part it, on
  // the key's side brighter (its shine) and on the far side its light; never on locks hanging down (a tail, a fringe's
  // fall), which do not rise. Glossy hair alone (a straight or sleek finish, or strands): coils, braids and locs are matte.
  for (let k = 0; k < n; k++) {
    const mi = material[k] ?? Number.NaN
    if (
      mi < 0 ||
      !hairy(part[k] ?? Number.NaN) ||
      !(must(materials, mi).sheen || must(materials, mi).strands) ||
      (tone[k] ?? Number.NaN) < 0 ||
      (tone[k] ?? Number.NaN) > 2
    )
      continue
    const nx = sm[k * 3] ?? Number.NaN,
      ny = sm[k * 3 + 1] ?? Number.NaN,
      nz = sm[k * 3 + 2] ?? Number.NaN
    if (nz < 0.05 || ny < SHEEN[0]) continue
    // Over the band the crown sits a tone down, in the mid, so the ring reads as a ring and not as the top lit whole.
    if (ny > SHEEN[1]) {
      tone[k] = Math.max(tone[k] ?? Number.NaN, 1)
      continue
    }
    if ((grains[k] ?? Number.NaN) < -0.18) continue
    tone[k] = nx * K2[0] >= -0.2 ? -1 : 0
  }
  // The face's tones as a pixel artist cleans them: a texel standing out of its plane (five of its eight neighbours one
  // other tone: a spur, a fleck, a notch in an edge) takes that tone, so its planes meet in clean edges and its shapes
  // keep their size (the drawn face puts its own marks on after). A front plane's light (LIGHT) is a shape drawn on
  // purpose, the bridge's a line: it stays.
  for (let pass = 0; pass < 2; pass++) {
    const was = tone.slice()
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x
        if (
          !isFace(k) ||
          (was[k] ?? Number.NaN) < 0 ||
          (was[k] ?? Number.NaN) > 3 ||
          ((was[k] ?? Number.NaN) === 0 && (faceLight[k] ?? Number.NaN))
        )
          continue
        const count = [0, 0, 0, 0]
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = k + dy * w + dx
            if ((dx || dy) && isFace(q) && (was[q] ?? Number.NaN) >= 0 && (was[q] ?? Number.NaN) <= 3)
              count[was[q] ?? Number.NaN] = (count[was[q] ?? Number.NaN] ?? Number.NaN) + 1
          }
        let best = was[k] ?? Number.NaN
        for (let i = 0; i < 4; i++) if ((count[i] ?? Number.NaN) > (count[best] ?? Number.NaN)) best = i
        if (
          best !== (was[k] ?? Number.NaN) &&
          (count[best] ?? Number.NaN) >= 5 &&
          (count[was[k] ?? Number.NaN] ?? Number.NaN) <= 2
        )
          tone[k] = best
      }
  }
  // Lines run whole: a gap of a texel or two along a line inside the figure (where the contact flickers along a flank)
  // closes, between line texels on one surface drawn for one nearer part, so no line breaks into dashes.
  const lineOn = (q: number, k: number) =>
    q >= 0 &&
    q < n &&
    (tone[q] ?? Number.NaN) === OUTLINE &&
    (material[q] ?? Number.NaN) >= 0 &&
    (part[q] ?? Number.NaN) === (part[k] ?? Number.NaN)
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const k = y * w + x
      if (
        (material[k] ?? Number.NaN) < 0 ||
        (tone[k] ?? Number.NaN) === OUTLINE ||
        (tone[k] ?? Number.NaN) === -2
      )
        continue
      for (const d of [1, w, w + 1, w - 1]) {
        // The line's ends either side, one of them next to this texel.
        const a = lineOn(k - d, k) ? k - d : lineOn(k - 2 * d, k) ? k - 2 * d : -1,
          b = lineOn(k + d, k) ? k + d : lineOn(k + 2 * d, k) ? k + 2 * d : -1
        if (
          a < 0 ||
          b < 0 ||
          (a !== k - d && b !== k + d) ||
          (part[owner[a] ?? Number.NaN] ?? Number.NaN) !== (part[owner[b] ?? Number.NaN] ?? Number.NaN)
        )
          continue
        under[k] = Math.max(tone[k] ?? Number.NaN, 2)
        tone[k] = OUTLINE
        owner[k] = owner[a] ?? Number.NaN
        break
      }
    }
  // Stray flecks of line: an interior line still of fewer than a few texels (8-connected, not running into the outline
  // outside) is where two forms only graze; it goes back to its shadow tone whole.
  const minLine = 2 + D,
    lineSeen = new Uint8Array(n),
    lineRun: number[] = [],
    stack: number[] = []
  for (let s0 = 0; s0 < n; s0++) {
    if (
      (lineSeen[s0] ?? Number.NaN) ||
      (tone[s0] ?? Number.NaN) !== OUTLINE ||
      (material[s0] ?? Number.NaN) < 0
    )
      continue
    lineRun.length = 0
    stack.push(s0)
    lineSeen[s0] = 1
    let outside = false
    while (stack.length) {
      const k = stack.pop()!
      lineRun.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const q = yy * w + xx
          if ((material[q] ?? Number.NaN) < 0) {
            outside = true
            continue
          }
          if ((tone[q] ?? Number.NaN) === OUTLINE && !(lineSeen[q] ?? Number.NaN)) {
            lineSeen[q] = 1
            stack.push(q)
          }
        }
    }
    if (!outside && lineRun.length < minLine)
      for (const k of lineRun) {
        tone[k] = under[k] ?? Number.NaN
        owner[k] = -1
      }
  }
  // Reflected light: a deep texel on the shadow side's edge (beside the outside, or the line on a far part, away from
  // the key) lifts to shadow, so the form turns before its line and the two darks never double.
  const edgeAt = (x: number, y: number) => !filled(x, y) || (tone[y * w + x] ?? Number.NaN) === OUTLINE
  if (style.bounce)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if ((tone[k] ?? Number.NaN) !== 3) continue
        const away = edgeAt(x + 1, y) || edgeAt(x, y + 1),
          toward = edgeAt(x - 1, y) || edgeAt(x, y - 1)
        if (away && !toward && ((tone[k - 1] ?? Number.NaN) === 3 || (tone[k - w] ?? Number.NaN) === 3))
          tone[k] = 2
      }
  // The clusters, as a pixel artist cleans them: a run of one tone in one part smaller than the cluster size takes the
  // tone its edge touches most (a shine keeps any run of two, a face's plane its light from a run of D, at least two).
  const minSize = style.cluster * D * D,
    seen = new Uint8Array(n),
    run: number[] = [],
    votes = new Int32Array(16)
  for (let s0 = 0; s0 < n; s0++) {
    const t0 = tone[s0] ?? Number.NaN
    if (
      (seen[s0] ?? Number.NaN) ||
      t0 < -1 ||
      t0 >= OUTLINE ||
      (part[s0] ?? Number.NaN) === -2 ||
      must(materials, material[s0] ?? Number.NaN).flat ||
      (handTone[s0] ?? Number.NaN) >= 0
    )
      continue
    run.length = 0
    stack.push(s0)
    seen[s0] = 1
    votes.fill(0)
    while (stack.length) {
      const k = stack.pop()!
      run.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let i = 0; i < 4; i++) {
        const q =
          i === 0
            ? x > 0
              ? k - 1
              : -1
            : i === 1
              ? x < w - 1
                ? k + 1
                : -1
              : i === 2
                ? y > 0
                  ? k - w
                  : -1
                : y < h - 1
                  ? k + w
                  : -1
        if (
          q < 0 ||
          (material[q] ?? Number.NaN) !== (material[s0] ?? Number.NaN) ||
          (part[q] ?? Number.NaN) !== (part[s0] ?? Number.NaN)
        )
          continue
        if ((tone[q] ?? Number.NaN) === t0 && (handTone[q] ?? Number.NaN) < 0) {
          if (!(seen[q] ?? Number.NaN)) {
            seen[q] = 1
            stack.push(q)
          }
        } else if ((tone[q] ?? Number.NaN) >= -1 && (tone[q] ?? Number.NaN) < OUTLINE)
          votes[(tone[q] ?? Number.NaN) + 1] = (votes[(tone[q] ?? Number.NaN) + 1] ?? Number.NaN) + 1
      }
    }
    if (
      run.length >=
      (t0 === -1
        ? Math.min(2, minSize)
        : t0 === 0 && (faceLight[s0] ?? Number.NaN)
          ? Math.max(2, D)
          : minSize)
    )
      continue
    let best = t0,
      most = 0
    for (let i = 0; i < 5; i++)
      if ((votes[i] ?? Number.NaN) > most) {
        most = votes[i] ?? Number.NaN
        best = i - 1
      }
    if (best !== t0) for (const k of run) tone[k] = best
  }
  return { stack, run }
}
