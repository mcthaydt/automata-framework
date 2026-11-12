// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP } from '../body/parts'
import type { FaceStamp } from './paint-face'
import { FACE_SEAM, HAIR_SEAMS, oklab } from './paint-style'
import type { GBuffer } from './raster'
export function stampFace(
  f: FaceStamp,
  g: GBuffer,
  tones: number[],
  out: Uint8ClampedArray,
  tone: Int8Array,
  through: Map<number, number[]>,
  kept: Uint8Array,
  skinFamily: (material: number) => boolean,
) {
  const { w, h, material, part, group } = g,
    view = Math.abs(f.view),
    d = f.view < 0 ? -1 : 1,
    F = f.shape,
    s = f.size
  if (view >= 3) return
  const has = (t: string) => !!f.mood?.has(t),
    angry = has('angry'),
    smile = has('smile'),
    dead = has('dead'),
    open = has('mouthOpen')
  const gaze = has('lookL') ? -1 : has('lookR') || has('beside') ? 1 : 0
  // Detail by size: from 3 texels an eye has its white and lid, the lips two tones, the nose a lit bridge.
  const big = f.detail >= 3,
    ew = f.eye,
    whiteFar = f.white
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h
  const own = (x: number, y: number) =>
    inside(x, y) && part[y * w + x] === FACE_SEAM && material[y * w + x] === f.skin && tone[y * w + x] !== 9
  const set = (k: number, c: number) => {
    out[k * 4] = (c >> 16) & 255
    out[k * 4 + 1] = (c >> 8) & 255
    out[k * 4 + 2] = c & 255
  }
  const put = (x: number, y: number, c: number) => {
    if (own(x, y)) {
      set(y * w + x, c)
      kept[y * w + x] = 1
    }
  }
  /** An eye's mark: on the skin, or through a tinted lens (`through`) in its tint, the white faint, the lash dark; an
   * eye behind a lens draws on the lens alone (never half of it on the cheek under it). */
  let behind = false
  const mark = (x: number, y: number, c: number) => {
    const t = inside(x, y) ? through.get(y * w + x) : undefined
    if (t) {
      set(y * w + x, c === f.white || c === whiteFar || (c === f.iris && !big) ? t[2] : t[1])
      kept[y * w + x] = 1
    } else if (!behind) put(x, y, c)
  }
  /** A step along the skin's ramp from the painted tone (+1 a tone darker, −1 lighter). */
  const shade = (x: number, y: number, by: number) => {
    if (own(x, y)) set(y * w + x, tones[Math.max(0, Math.min(3, tone[y * w + x] + by))])
  }
  /** The lid's crease: a step darker, never past the skin's shadow; on deep skin the lit lid a step lighter, so under
   * the brow and over the lash it reads open, not as a fourth dark row. */
  const lightLid = oklab(tones[1])[0] < 0.5
  /** `soft` steps lighter along the ramp: the hood's line, which at the crease's strength read as a second brow. */
  const lid = (x: number, y: number, soft = 0) => {
    if (own(x, y)) {
      const t = tone[y * w + x]
      set(y * w + x, tones[lightLid ? Math.max(0, t - 1 - soft) : Math.max(t, Math.min(2 - soft, t + 1))])
    }
  }
  // The eye row: the eye line's, or in profile the near eye's (it sits nearer the camera, so lower under the pitch).
  /** The eyes' tilt: −1 the outer corner a row up (lifted), +1 a row down (drooping), 0 level. */
  const tilt = F.eyeTilt >= 0.75 ? -1 : F.eyeTilt <= 0.25 ? 1 : 0
  /** The uneven face (asymmetry): the side (+1 the figure's left) whose eye is lowered, 0 under |a| 0.5; the texel a row or a
   * width counts for at this density (two at density 4). Where `big` only. */
  const A = F.asymmetry,
    lowered = Math.abs(A) >= 0.5 ? Math.sign(A) : 0,
    dk = f.detail >= 6 ? 2 : 1
  const near = d > 0 ? f.eyes[0] : f.eyes[1]
  let I = Math.floor(view === 2 ? near[1] : f.centre[1])
  const noNose = !!f.off?.includes('nose'),
    noMouth = !!f.off?.includes('mouth')
  // `keep`: hair hanging over the eye row (a fringe past the brow) hides the eyes; they drop to the first rows it leaves bare,
  // at most three, so a face under a fringe keeps its eyes.
  if (f.keep) {
    const covered = (row: number) => {
      for (const e of view === 2 ? [near] : f.eyes)
        for (let y = row - 1; y <= row + 1; y++)
          for (let x = Math.floor(e[0] - ew / 2) - 1; x <= Math.ceil(e[0] + ew / 2) + 1; x++)
            if (inside(x, y) && part[y * w + x] >= HAIR_SEAMS[0] && part[y * w + x] < HAIR_SEAMS[1])
              return true
      return false
    }
    for (let k = 0; k < 3 && covered(I); k++) I++
  }
  /** The face's last skin texel from `x` toward `d` on row `y`: its front edge, inside the outline. */
  const edge = (x: number, y: number) => {
    while (own(x + d, y)) x += d
    return x
  }
  /** Shades over columns a..b: a part worn on the head that is neither its skin (nor a surface painted in the skin's own tones, an ear's rim) nor its hair (nor a mark), from the
   * brow's row down past the eye's. An eye there is behind them, whatever skin shows round the lens; behind a tinted
   * lens (`through`) it shows, on the lens (`behind`). */
  const shaded = (a: number, b: number) => {
    let worn = false,
      lens = false
    for (let y = I - 2; y <= I + 1; y++)
      for (let x = Math.min(a, b); x <= Math.max(a, b); x++) {
        if (!inside(x, y)) continue
        const k = y * w + x,
          p = part[k]
        if (through.has(k)) lens = true
        else if (
          material[k] >= 0 &&
          group[k] === GROUP.head &&
          !skinFamily(material[k]) &&
          p >= 0 &&
          p !== FACE_SEAM &&
          !(p >= HAIR_SEAMS[0] && p < HAIR_SEAMS[1])
        )
          worn = true
      }
    behind = lens
    return worn && !lens
  }
  /**
   * An eye: `x0` its left column, `n` texels wide, its outer corner to the `outer` side, the iris's first column `iris`
   * texels in. False when shades cover it (then it has no lid either). Open, as a sprite's eye reads awake: the upper
   * lid's lash over the iris and out to the outer corner (an eye of four, its whole width), the white either side of the
   * iris under it where the iris leaves room.
   */
  const eye = (x0: number, n: number, outer: number, iris: number, side = 0) => {
    // The uneven face (asymmetry): the eye on the lowered side a row lower, and a texel narrower from 0.8, its inner corner kept.
    const low = big && side !== 0 && side === lowered,
      Y = I + (low ? dk : 0)
    if (low && Math.abs(A) >= 0.8 && n - dk >= 2) {
      if (outer < 0) x0 += dk
      n -= dk
      iris = Math.min(iris, n - 1)
    }
    iris = Math.max(0, Math.min(n - 1, iris + gaze))
    const xo = outer < 0 ? x0 : x0 + n - 1,
      xin = xo - outer * (n - 1)
    if (shaded(x0 - 1, x0 + n)) return false
    // Small: the lid line over the eye's width, the iris under it (a closed eye, the line alone, a row down).
    if (!big) {
      for (let i = 0; i < n; i++) mark(x0 + i, f.blink ? Y : Y - 1, f.lash)
      if (!f.blink && !(dead && n < 2)) mark(x0 + iris, Y, f.iris)
      return !behind
    }
    // The lid line: a hooded lid's shadow under the brow, or a crease short of the inner corner; a smooth lid has none.
    // One line on the row under the brow, its length the sliders': the hood's from a texel past the outer corner (the
    // whole lid and a texel either side at 1), the crease's from the outer corner, short of the inner one (at 1); the
    // longer of the two is drawn. A dead eye keeps the full hooded line.
    if (behind) {
    } else if (dead) for (let i = -1; i <= n; i++) lid(x0 + i, Y - 2, 1)
    else {
      const hood = Math.round((n + 2) * F.hood),
        crease = Math.round(n * F.crease)
      if (hood >= crease) for (let i = 0; i < hood; i++) lid(xo + outer - outer * i, Y - 2, 1)
      else for (let i = 0; i < crease; i++) lid(xo - outer * i, Y - 2)
    }
    // The iris, as a sprite artist draws an eye this size: two texels tall, its pupil dark under the lash and its colour
    // below, two wide in an eye of four; the white beside it on the upper row only, the lower lid the skin. Never
    // further out than the eye's own width.
    const iw = n >= 4 ? 2 : 1,
      at = Math.max(0, Math.min(n - iw, iris))
    for (let i = 0; i < n; i++) {
      const x = x0 + i,
        inIris = i >= at && i < at + iw
      if (f.blink) {
        mark(x, Y, f.lash)
        continue
      }
      if ((n < 3 || x !== xin || n >= 4) && !(tilt && x === xo)) mark(x, Y - 1, f.lash)
      // Dead eyes: the lid drawn down over the whites, the iris alone staring out under it (its colour, not the pupil row of a live eye).
      if (dead) {
        if (inIris) mark(x, Y, f.iris)
        else lid(x, Y)
        continue
      }
      mark(x, Y, inIris ? f.lash : x < x0 + at ? f.white : whiteFar)
      if (inIris) mark(x, Y + 1, f.iris)
    }
    // The lash's flick: a texel past the outer corner, a row down (the upper lid's line turning down at its end); with
    // liner, on the lash's own row.
    // Tilt (eyeTilt): the outer corner's lash and the flick past it a row up when lifted, a row down when drooping.
    if (tilt && !f.blink) mark(xo, Y - 1 + tilt, f.lash)
    if (!f.blink) mark(xo + outer, (F.liner >= 0.5 ? Y - 1 : Y) + tilt, f.lash)
    else if (F.liner >= 0.5) mark(xo + outer, Y, f.lash)
    return !behind
  }
  /**
   * A brow from its inner end `xi`, `n` texels toward `outer`, at rest (no mood), a clean shape for its gene: straight; a
   * soft arch, on a brow long enough to carry it, or a full arch, one step up from its peak (two thirds out) to its
   * tail, so it rises toward its outer end in a single step (two steps at sprite size read as a scowl or a kink). Never
   * a texel below its head (a drip by the eye reads as a second eye) and never its head raised (that reads worried). A fine brow thins to the skin's deep tone at its tail, a heavy
   * one is two texels thick over its inner half; a high one sits a row up. Over shades (`seen` false) it is one row, and
   * only where a texel of skin parts it from the frame, or it reads as an eye.
   */
  const brow = (xi: number, n: number, outer: number, seen = true) => {
    const B = I - 3 - (big && F.browHeight > 0.4 ? 1 : 0) - (has('surprised') ? 1 : 0),
      peak = Math.round((n - 1) * 0.67)
    const lift = (t: number) =>
      !big || t === 0 || dead || angry
        ? 0
        : F.browArch >= 0.7
          ? +(t >= peak)
          : F.browArch >= 0.3
            ? +(t >= peak && n >= 6)
            : 0
    // Angry: the inner end pulled down toward the nose a row (two at the brand kit's double), the outer end up a row.
    const knit = (t: number) =>
      !angry ? 0 : t < Math.max(1, Math.round(n * 0.4)) ? 1 : t >= n - 1 && big ? -1 : 0
    for (let t = 0; t < n; t++) {
      const x = xi + outer * t,
        y = B - lift(t) + knit(t)
      if (!seen && !own(x, y + 1)) continue
      const thin = t === n - 1 && (F.browWeight < 0.4 || F.browArch >= 0.3)
      put(x, y, thin ? tones[3] : f.brow)
      if (seen && big && F.browWeight >= 0.7 && t < n * 0.6) put(x, y - 1, f.brow)
    }
  }
  // The nose's underside and the lips' line: the mouth where it projects, the nostrils kept two rows over it (a row of
  // philtrum), and below the eyes.
  const M = Math.max(Math.floor(f.mouth[1]), I + (big ? 6 : 3)),
    N = Math.max(I + (big ? 3 : 2), Math.min(Math.floor(f.nose[1]), M - (big ? 2 : 1)))
  const nh = Math.max(1, Math.round(s * (0.2 + 0.35 * (F.nose - 0.5)))),
    mh = Math.max(1, Math.round(s * (0.2 + 0.06 * F.lips)))
  /**
   * The cheek's stroke: on the row under the cheekbone, from the face's edge on the shadow side (the key light comes from
   * the screen's left in every view, so screen +x) inward, two texels a step darker along the skin's ramp: its row the
   * cheekbone's height (`cheekHeight`), never on the nose's columns (`past` the last of them). The cheekbones' width shows
   * by the outline (head.ts), not here. Where `big` only.
   */
  const cheek = (past: number) => {
    const len = 2
    if (!big) return
    const y = Math.round(N - (N - I) * (0.4 + 0.5 * F.cheekHeight)) + 1
    let x = Math.floor(f.centre[0])
    if (!own(x, y)) return
    while (own(x + 1, y)) x++
    for (let i = 0; i < len && x - i > past; i++) shade(x - i, y, 1)
  }
  /** The lit bridge's run down the nose, in rows up from the tip: none at bridge 0, brow to tip at 1. */
  const run = Math.round(F.bridge * (N - 1 - (I + 1)))
  /** The lower lip's rows by the lips slider: the upper lip's line alone under 0.25, two from 0.75, else one (today's). */
  const lipRows = F.lips < 0.25 ? 0 : F.lips < 0.75 ? 1 : 2
  /** The chin under the mouth at column `x`: its rows of skin below the lips' line. */
  const chin = (x: number) => {
    let n = 0
    while (own(x, M + 1 + n) && n < 4) n++
    return n
  }
  /**
   * Lips from column a to b: the upper lip dark, its corners the skin two steps down (a lip colour of their own is a
   * fleck); the lower lip lit; the hollow under it at `cm`. A
   * row of the chin's own skin always stays between the lower lip and the jaw's shadow (lips on the jaw's edge read as a
   * goatee): the lower lip only with two rows of chin under the lips' line, the hollow only with three. Parted on a
   * two-row chin: the upper lip and the mouth's dark, no lower lip, so a row of chin stays under the dark. On a small face
   * the mouth's dark keeps a texel of skin at each end, off the jaw's outline.
   */
  const lips = (a: number, b: number, cm: number) => {
    // The uneven face: the mouth's corner on the side away from the lowered eye a row higher (screen-left for +a).
    const upA = big && A >= 0.5,
      upB = big && A <= -0.5
    const corner = (x: number) => {
      if ((x === a && upA) || (x === b && upB)) shade(x, M - 1, 2)
      else shade(x, M, 2)
    }
    // The mood at the corners: up a row in a smile, down a row in anger (and closed).
    const corners = (y: number, dark = small || y < M) => {
      for (const x of [a - 1, b + 1])
        if (dark) put(x, y, f.lips[0])
        else shade(x, y, 2)
    }
    const small = !big
    if (!big) {
      for (let x = a; x <= b; x++) put(x, M, f.lips[0])
      if (open) {
        // The mouth's dark keeps a texel of the face's own skin between each end and the outline (a mouth that runs into
        // the jaw's outline reads as a wider one): the run shrinks from an end whose neighbour is not skin, to one texel, which steps a texel in off the outline.
        let x0 = Math.min(a + 1, cm),
          x1 = Math.max(b - 1, cm)
        while (x0 < x1 && !own(x0 - 1, M + 1)) x0++
        while (x1 > x0 && !own(x1 + 1, M + 1)) x1--
        // One texel left and still against the outline: it steps in, off it (never to nothing, so talk still shows).
        if (x0 === x1) {
          if (!own(x0 + 1, M + 1) && own(x0 - 1, M + 1)) x0--
          else if (!own(x0 - 1, M + 1) && own(x0 + 1, M + 1)) x0++
          x1 = x0
        }
        for (let x = x0; x <= x1; x++) put(x, M + 1, f.lash)
      } else if (smile) corners(M - 1)
      else if (angry) corners(M + 1)
      return
    }
    if (open && chin(cm) >= 3) {
      // Parted: the upper lip, the mouth's dark under it between the corners, the lower lip lit under that.
      for (let x = a; x <= b; x++)
        if (x === a || x === b) corner(x)
        else put(x, M, f.lips[0])
      for (let x = a + 1; x < b; x++) put(x, M + 1, f.lash)
      shade(a, M + 1, 2)
      shade(b, M + 1, 2)
      for (let x = a + 1; x < b; x++) put(x, M + 2, f.lips[1])
      return
    }
    if (open && chin(cm) === 2) {
      for (let x = a; x <= b; x++)
        if (x === a || x === b) corner(x)
        else put(x, M, f.lips[0])
      for (let x = a + 1; x < b; x++) put(x, M + 1, f.lash)
      shade(a, M + 1, 2)
      shade(b, M + 1, 2)
      return
    }
    if (smile) corners(M - 1)
    else if (angry) corners(M + 1)
    const below = chin(cm),
      rows = lipRows
    for (let x = a; x <= b; x++)
      if (x === a || x === b) corner(x)
      else put(x, M, f.lips[0])
    // The lower lip's rows (0, 1 or 2 by the slider), each only with a row of the chin's own skin left under it; the
    // hollow under the lip, a row further down the fuller it is.
    // Full lips (the second row's slider end) also take the corners' columns: the lower lip as wide as the mouth.
    if (rows >= 1 && below >= 2)
      for (let x = a + +(rows < 2); x <= b - +(rows < 2); x++)
        put(x, M + 1, x === b - 1 && b - a > 3 ? f.lips[0] : f.lips[1])
    if (rows >= 2 && below >= 3) for (let x = a + 1; x < b; x++) put(x, M + 2, f.lips[1])
    if (below >= rows + 2) for (let x = cm - 1; x <= cm; x++) shade(x, M + rows + 1, 1)
  }
  if (view === 0) {
    // Symmetric about the centre line, kept to the half texel.
    const c2 = Math.round(f.centre[0] * 2) / 2,
      mirror = (x: number) => Math.round(2 * c2 - 1 - x)
    const gi = Math.max(1, Math.round((f.eyes[1][0] - f.eyes[0][0]) / 2 - ew / 2))
    // The eyes' inner columns: mirrored about the centre on a face square to the camera; on one turned a little (still
    // this template, up to 22.5°) each at its own projected place, since the far eye foreshortens toward the centre and
    // its mirror lands past the far contour, off the skin, where it is never drawn. Either way each eye is drawn whole
    // on the face: moved in toward the centre while any of its texels on the eye's row is off the skin.
    const turned = Math.abs(f.eyes[1][0] - f.centre[0] - (f.centre[0] - f.eyes[0][0])) > 0.75
    const onFace = (x0: number) => {
      for (let i = 0; i < ew; i++) if (!own(x0 + i, I)) return false
      return true
    }
    const fitEye = (x0: number, inward: number) => {
      for (let s = 0; s <= ew && !onFace(x0); s++) x0 += inward
      return x0
    }
    const eL = fitEye(
      turned ? Math.round(f.eyes[0][0] + ew / 2 - 1) - ew + 1 : Math.floor(c2 - gi - 0.5) - ew + 1,
      1,
    )
    const eR = fitEye(turned ? Math.round(f.eyes[1][0] - ew / 2) : mirror(Math.floor(c2 - gi - 0.5)), -1)
    // Looking ahead: a two-texel iris centred in an eye of four, a white either side; a narrower eye's iris inward.
    const seenL = eye(eL, ew, -1, ew >= 4 ? (ew - 2) >> 1 : ew >> 1, -1),
      seenR = eye(eR, ew, 1, ew >= 4 ? (ew - 2) >> 1 : (ew - 1) >> 1, 1)
    brow(eL + ew - 1, ew + 1, -1, seenL)
    brow(eR, ew + 1, 1, seenR)
    // The nose: the bridge lit on the key's side and in shadow on the other, its tip catching the light, the shadow
    // under it and the nostrils darker at its wings (two steps, so they read on deep skin).
    // The uneven face: the nose a texel (two at density 4) off the centre line toward the lowered side.
    const off = big ? Math.round(A * dk) : 0,
      xc = Math.floor(c2 + 0.5),
      xr = xc + off,
      a0 = Math.floor(c2 - nh),
      a = a0 + off,
      b = mirror(a0) + off
    if (noNose) {
      // Left off.
    } else if (big) {
      for (let y = I + 1; y < N - 1; y++) {
        if (y >= N - 1 - run) shade(xr - 1, y, -1)
        shade(xr, y, 1)
      }
      shade(xr - 1, N - 1, -1)
      for (let x = a; x <= b; x++) shade(x, N, x === a || x === b ? 2 : 1)
    } else shade(xr, N, 1)
    cheek(b)
    const ma = Math.floor(c2 - mh)
    if (!noMouth) lips(ma, mirror(ma), xc)
  } else if (view === 1) {
    // The near eye whole, the far one foreshortened by a texel; both look where the face does.
    // The far eye keeps a texel of cheek between it and the contour, and the near one a texel of the bridge from it.
    const far = d > 0 ? f.eyes[1] : f.eyes[0],
      nf = Math.max(1, ew - 1),
      rim = edge(Math.floor(f.centre[0]), I)
    const xn0 = Math.floor(near[0] - ew / 2 + 0.5),
      xf0 = Math.floor(far[0] - nf / 2 + 0.5),
      xf = d > 0 ? Math.min(xf0, rim - nf) : Math.max(xf0, rim + 1)
    const xn = d > 0 ? Math.min(xn0, xf - 1 - ew) : Math.max(xn0, xf + nf + 1)
    // Both look where the face does: the iris toward its side of each eye.
    // (Turned to the viewer's right, the screen-left eye is the near one and the figure's right; the other way, the figure's left.)
    const seenN = eye(xn, ew, -d, d > 0 ? ew >> 1 : ew >= 4 ? 0 : (ew - 1) >> 1, -d),
      seenF = eye(xf, nf, d, d > 0 ? nf - 1 : 0, d)
    brow(d > 0 ? xn + ew - 1 : xn, ew + 1, -d, seenN)
    brow(d > 0 ? xf : xf + nf - 1, nf + 1, d, seenF)
    // The nose: its ridge from between the eyes to the tip, lit, the shadow beside it; the nostril on the near side.
    const off = big ? Math.round(A * dk) : 0,
      tip = Math.floor(f.nose[0]) + off
    if (noNose) {
      // Left off.
    } else if (big) {
      for (let y = I + 1; y < N; y++) {
        const x = Math.floor(f.centre[0] + ((f.nose[0] - f.centre[0]) * (y - I)) / (N - I)) + off
        if (y < N - 1 && y >= N - 1 - run) shade(x, y, -1)
        shade(x + 1, y, 1)
      }
      shade(tip - d, N, 2)
      shade(tip, N, 1)
    } else shade(tip - d, N, 1)
    cheek(tip + 1)
    const cm = Math.floor(f.mouth[0])
    // The mouth wider on the near side, its far corner foreshortened: two texels of lip between the corners at least.
    if (!noMouth) lips(cm - (d > 0 ? mh : Math.max(0, mh - 1)), cm + (d > 0 ? Math.max(0, mh - 1) : mh), cm)
  } else {
    // The eye from the side, a texel in from the face's front: the lash over it, the iris at its front, the white behind.
    // Big: as the front's eye seen edge on, a texel of the lid's skin in front of it: the lash three texels back along
    // the upper lid, the iris two tall at the front (its pupil dark under the lash), the white behind it, the lash's
    // flick down past the outer corner. So a profile keeps an eye that reads, not a fleck by the hairline.
    const xf = edge(Math.floor(f.centre[0]) - 2 * d, I) - (big ? 2 : 1) * d,
      seen = !shaded(xf - 3 * d, xf + d)
    if (seen && big) {
      // The uneven face: this eye (the figure's right when turned to the viewer's right) a row lower when it is the lowered one.
      const Ip = I + (lowered === -d ? dk : 0)
      if (!behind)
        for (let i = 0; i < Math.round(3 * Math.max(F.hood, F.crease)); i++)
          lid(xf - i * d, Ip - 2, +(F.hood > F.crease))
      if (f.blink) {
        mark(xf, Ip, f.lash)
        mark(xf - d, Ip, f.lash)
        mark(xf - 2 * d, Ip, f.lash)
      } else {
        for (let i = 0; i < 3; i++) mark(xf - i * d, Ip - 1, f.lash)
        mark(xf, Ip, f.lash)
        mark(xf, Ip + 1, f.iris)
        mark(xf - d, Ip, f.white)
        mark(xf - 3 * d, (F.liner >= 0.5 ? Ip - 1 : Ip) + tilt, f.lash)
      }
    } else if (seen) {
      // Small: the iris and a white behind it on the eye's row, the lash a texel over the iris alone, so under a low
      // hairline it reads as an eye, not one more row of hair.
      if (f.blink) {
        mark(xf, I, f.lash)
        mark(xf - d, I, f.lash)
      } else {
        mark(xf, I - 1, f.lash)
        mark(xf, I, f.iris)
        mark(xf - d, I, f.white)
      }
    }
    brow(xf + d, big ? 4 : 2, -d, seen && !behind)
    // The nostril's wing behind the tip, which stands off the face.
    if (!noNose) shade(Math.floor(f.nose[0]) - (big ? 2 : 1) * d, N, big ? 2 : 1)
    // The lips at the face's front on their rows: the upper dark with the mouth's corner behind it, the lower lit.
    const xm = edge(Math.floor(f.mouth[0]), M)
    if (!noMouth) {
      put(xm, M, f.lips[0])
      if (open) {
        put(xm, M + 1, f.lash)
        put(xm - d, M + 1, f.lash)
        if (big && chin(xm) >= 3) put(edge(Math.floor(f.mouth[0]), M + 2), M + 2, f.lips[1])
      } else if (smile) shade(xm - 2 * d, M - 1, 2)
      else if (big) {
        shade(xm - d, M, 2)
        const xl = edge(Math.floor(f.mouth[0]), M + 1)
        if (lipRows >= 1 && chin(xl) >= 2) put(xl, M + 1, f.lips[1])
        if (lipRows >= 2 && chin(xl) >= 3) put(edge(Math.floor(f.mouth[0]), M + 2), M + 2, f.lips[1])
      }
    }
  }
}
