// ─── The hand's form: which texels of the designed hand (paint-hands.ts drawHands) are drawn, and their tones ───
/**
 * The two forms a designed hand can take. `paddle` is the hand as it was drawn until the Owner asked for better hands
 * (2026-11-12): a palm with a one-texel thumb on its edge and its tips notched. `parted` is the hand he asked for: a
 * thumb that hangs free of the palm at its tip, an index finger parted from the other three, and those three as one
 * mitten. The paddle stays the default until the Owner has seen the parted hand's before-and-after sheet
 * (docs/superpowers/audits/2026-11-12-painter-hands/) and the goldens are re-recorded with it; then the default
 * becomes `parted` and the paddle goes.
 */
export type HandFormKind = 'paddle' | 'parted'
export const HAND_FORM: HandFormKind = 'paddle'
/** What a role is drawn from: the stamp's thumb (paint-hands.ts HandStamp), its length and its widths at the wrist and the knuckles (texels), the density,
 * which side the key is on across the hand (±1), whether the back of the hand is turned from the key (1, a step down),
 * and the wrist's first column across the axis. */
interface RoleInput {
  L: number
  Ww: number
  Wk: number
  D: number
  hs: { thumbAt: [number, number]; thumbFacing: number }
  kSide: number
  dim: number
  lo: number
}
/** A role: the tone of the texel at `s` down the hand (texels from the wrist) and `t` across it (toward the thumb);
 * −1 where the hand is not, −2 a gap inside its contour. */
type Role = (s: number, t: number) => number
/** The paddle (see HandFormKind), exactly as it was drawn. */
export function paddleRole({ L, Ww, Wk, D, hs, kSide, dim, lo }: RoleInput): Role {
  // Down the hand (rows from the wrist): the wrist, the palm from its flare (a texel broader on the thumb's side), the
  // knuckle row, the fingers; across it (columns, toward the thumb), the little finger's side straight. The thumb over
  // the palm's upper middle, a quarter of the hand long.
  const last = Math.max(3, Math.ceil(L) - 1),
    sk = Math.round(0.58 * (last + 1)),
    flare = Math.max(1, Math.round(0.2 * (last + 1)))
  const t0 = Math.max(Math.round(hs.thumbAt[0] * L), flare),
    t1 = Math.min(t0 + Math.max(1, Math.round(0.26 * L)) - 1, sk - 1)
  // The thumb shows where it turns to the camera or across the view (from behind, the back of the hand hides it).
  const thumbs = hs.thumbFacing > -0.55
  return (s: number, t: number): number => {
    const row = Math.floor(s),
      col = Math.floor(t - lo),
      cols = row >= flare ? Wk : Ww
    if (row < 0 || row > last) return -1
    const thumb = thumbs && row >= t0 && row <= t1 && col === cols
    if (col < 0 || (col >= cols && !thumb)) return -1
    // The tips: the little finger's corner rounded off, and from twice the brand kit's density a notch between the
    // fingers (a broad hand's nearer the thumb, so two fingers' tips and the hand's own read).
    const split = cols <= 3 ? 1 : cols - 2
    if (row === last && ((col === 0 && cols >= 4) || (D > 1 && cols >= 3 && col === split))) return -1
    if (row === last && D === 1 && col === 0) return -1
    const keyEdge = kSide > 0 ? cols - 1 : 0,
      farEdge = cols - 1 - keyEdge,
      thumbEdge = cols - 1
    const tone = (q: number) => Math.min(2, q + dim)
    // The thumb: its top catching the light where it turns to the key or the camera, its tip a step down; a texel
    // of shadow under its tip where it meets the palm.
    if (thumb)
      return row === t1 && t1 > t0 ? 2 : row === t0 && (kSide > 0 || hs.thumbFacing > 0.4) ? tone(0) : tone(1)
    if (thumbs && row === t1 + 1 && col === thumbEdge) return 2
    // The knuckle row a step under the back of the hand, its corner toward the key kept mid.
    if (row === sk) return col === keyEdge ? tone(1) : 2
    // The back of the hand's plane toward the key: its edge from the flare down, broadening over the knuckles.
    if (
      row >= flare &&
      row < sk &&
      col === keyEdge &&
      !(thumbs && keyEdge === thumbEdge && row >= t0 && row <= t1 && kSide < 0)
    )
      return tone(0)
    if (cols >= 3 && row >= sk - 2 && row < sk && Math.abs(col - keyEdge) === 1 && !dim) return 0
    // The side away in shadow (below the thumb on its side), and the fingers parted by a line of shadow at D2.
    if (col === farEdge && row > (thumbs && farEdge === thumbEdge ? t1 + 1 : flare)) return 2
    if (D > 1 && cols >= 3 && row > sk && row < last && col === split) return 2
    return tone(1)
  }
}
/** The parted hand (see HandFormKind): its pieces from handForm, toned as the paddle is, its gaps reported as −2. */
export function partedRole({ L, Ww, Wk, D, hs, kSide, dim, lo }: RoleInput): Role {
  // The hand's form (handForm): the wrist, the palm, the thumb apart from it, the index and the mitten.
  const f = handForm({ L, Ww, Wk, thumbAt: hs.thumbAt[0], thumbs: hs.thumbFacing > -0.55, D })
  const { flare, sk, t0, t1, thumbs } = f
  return (s: number, t: number): number => {
    const row = Math.floor(s),
      col = Math.floor(t - lo),
      piece = handPiece(f, row, col)
    if (!piece) return handGap(f, row, col) ? -2 : -1
    const cols = row >= flare ? Wk : Ww,
      keyEdge = kSide > 0 ? cols - 1 : 0,
      farEdge = cols - 1 - keyEdge,
      thumbEdge = cols - 1
    const tone = (q: number) => Math.min(2, q + dim)
    // The thumb: its top catching the light where it turns to the key or the camera, its tip a step down; where it
    // is not parted from the palm, a texel of shadow under its tip.
    if (piece === 'thumb')
      return row === t1 && t1 > t0 ? 2 : row === t0 && (kSide > 0 || hs.thumbFacing > 0.4) ? tone(0) : tone(1)
    if (thumbs && !f.slit && row === t1 + 1 && col === thumbEdge) return 2
    // The knuckle row a step under the back of the hand, its corner toward the key kept mid.
    if (row === sk) return col === keyEdge ? tone(1) : 2
    // The back of the hand's plane toward the key: its edge from the flare down, broadening over the knuckles.
    if (
      row >= flare &&
      row < sk &&
      col === keyEdge &&
      !(thumbs && keyEdge === thumbEdge && row >= t0 && row <= t1 && kSide < 0)
    )
      return tone(0)
    if (cols >= 3 && row >= sk - 2 && row < sk && Math.abs(col - keyEdge) === 1 && !dim) return 0
    // The side away in shadow (below the thumb on its side); the index's tip a step down, so it ends as a finger.
    if (col === farEdge && row > (thumbs && farEdge === thumbEdge ? t1 + 1 : flare)) return 2
    if (piece === 'index' && f.parted && !handPiece(f, row + 1, col)) return 2
    return tone(1)
  }
}
/**
 * A hand's form in its own grid: rows down from the wrist, columns across from the little finger's edge toward the
 * thumb. Sized from the stamp alone (its length and its widths at the wrist and the knuckles, texels), so every body,
 * pose and density gets the same hand.
 */
export interface HandForm {
  /** The last row (the fingertips), where the palm flares, and the knuckle row. */
  last: number
  flare: number
  sk: number
  /** The width at the wrist and from the flare down (columns). */
  Ww: number
  Wk: number
  /** The thumb's rows (it stands in the column past the palm's edge), and whether it shows. */
  t0: number
  t1: number
  thumbs: boolean
  /** The thumb parted from the palm by a slit along its tip, open below it (it is long enough to stand apart). */
  slit: boolean
  /** The index parted from the mitten by a gap (the hand is broad and its fingers long enough). */
  parted: boolean
  /** The index's width (columns at the thumb's side of the fingers). */
  index: number
  D: number
}
/** What a texel of the hand is: the wrist and palm (to the knuckle row), the thumb, the index, or the other three
 * fingers as one mitten. */
export type HandPiece = 'palm' | 'thumb' | 'index' | 'mitten'
/**
 * The form from the stamp's sizes (texels): `L` the length to draw, `Ww` and `Wk` the widths at the wrist and the
 * knuckles, `thumbAt` where the thumb starts (a fraction of `L`), `thumbs` whether it shows.
 * - The palm flares a fifth of the way down; the knuckle row is a little past half way.
 * - The thumb runs from its root (at least the flare) a good third of the hand, so where it is three rows or more it
 *   stands apart: the palm's column beside its last two rows gives way, to a slit open at its tip.
 * - The fingers below the knuckles: the index on the thumb's side (two columns on a broad hand), a row short of the
 *   tips, parted from the mitten by a column of gap where the hand is four columns broad and its fingers two rows long;
 *   the mitten's corners rounded at the tips. A smaller hand (density 1, a hand seen on its edge) keeps the index as
 *   its column alone, so the shape stays whole.
 */
export function handForm(o: {
  L: number
  Ww: number
  Wk: number
  thumbAt: number
  thumbs: boolean
  D: number
}): HandForm {
  const last = Math.max(3, Math.ceil(o.L) - 1),
    sk = Math.round(0.58 * (last + 1)),
    flare = Math.max(1, Math.round(0.2 * (last + 1)))
  const t0 = Math.max(Math.round(o.thumbAt * o.L), flare),
    t1 = Math.min(t0 + Math.max(2, Math.ceil(0.35 * o.L)) - 1, sk - 1)
  return {
    last,
    flare,
    sk,
    Ww: o.Ww,
    Wk: o.Wk,
    t0,
    t1,
    thumbs: o.thumbs,
    slit: o.thumbs && t1 - t0 >= 2 && o.Wk >= 3,
    parted: o.Wk >= 4 && last - sk >= 2,
    index: o.Wk >= 6 ? 2 : 1,
    D: o.D,
  }
}
/** The piece at a row and column of the form, or null where the hand is not. */
export function handPiece(f: HandForm, row: number, col: number): HandPiece | null {
  if (row < 0 || row > f.last || col < 0) return null
  const cols = row >= f.flare ? f.Wk : f.Ww
  if (f.thumbs && col === cols && row >= f.t0 && row <= f.t1) return 'thumb'
  if (col >= cols) return null
  // The slit between the thumb and the palm: along its last two rows and past its tip, so it hangs free of the palm
  // there and is joined above (a slit down its whole length reads as a prong, not a thumb).
  if (f.slit && col === cols - 1 && row >= Math.max(f.t0 + 1, f.t1 - 1) && row <= f.t1 + 1) return null
  if (row <= f.sk) return 'palm'
  // The fingers: the index at the thumb's side, a row short of the tips where they are two rows long or more.
  const long = f.last - f.sk >= 2,
    gap = cols - f.index - 1
  if (col >= cols - f.index) return long && row === f.last ? null : 'index'
  if (f.parted && col === gap) return null
  // The mitten (or, unparted, the rest of the fingers), its corners rounded at the tips.
  const right = (f.parted ? gap : cols - f.index) - 1
  if (row === f.last && col === 0 && (right >= 1 || f.D === 1)) return null
  if (row === f.last && f.parted && right >= 2 && col === right) return null
  return 'mitten'
}
/** Whether a texel is one of the form's gaps inside its contour: the slit beside the thumb, or the gap between the
 * index and the mitten where both are drawn. */
export function handGap(f: HandForm, row: number, col: number): boolean {
  if (row < 0 || row > f.last || col < 0) return false
  const cols = row >= f.flare ? f.Wk : f.Ww
  if (f.slit && col === cols - 1 && row >= Math.max(f.t0 + 1, f.t1 - 1) && row <= f.t1) return true
  return f.parted && row > f.sk && row < f.last && col === cols - f.index - 1
}
