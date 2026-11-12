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
/**
 * The parted hand's size: a stylised hand, larger than life, as pixel-art figures of this size draw one (a hand drawn
 * to life is a few texels and reads as a claw). `turn` is how far it shows its back as well as its edge (0 the hand as
 * the view sees it, 1 its full breadth, as a relaxed hand hangs with its back turned out and its thumb forward); `size`
 * scales its widths and `long` is its length against its knuckles' breadth (an open hand, not a fist). One factor
 * for every body, from twice the brand kit's density; at density 1 the hand keeps the size the view gives it.
 */
export const PARTED_HAND = { size: 1.25, turn: 0.7, long: 1.5 }
/** The half-widths (texels) the parted hand is drawn at, at the wrist and the knuckles, from its stamp's: as the view
 * sees it (`half`) and its full breadth (`breadth`). */
export function partedHalf(
  half: readonly [number, number],
  breadth: readonly [number, number],
): [number, number] {
  const at = (i: 0 | 1) =>
    PARTED_HAND.size * Math.max(half[i], half[i] + (breadth[i] - half[i]) * PARTED_HAND.turn)
  return [at(0), at(1)]
}
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
 * −1 where the hand is not. */
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
/** The role's value for a divide: the stamp (paint-hands.ts drawHands) writes it as the outline's tone, so the painter
 * draws it in the silhouette's ink. */
export const DIVIDE = 15
/** The parted hand (see HandFormKind): its pieces from handForm, toned as the paddle is, its divides in ink. */
export function partedRole({ L, Ww, Wk, D, hs, kSide, dim, lo }: RoleInput): Role {
  // The hand's form (handForm): the wrist, the palm, the thumb off its side, the index and the mitten.
  const f = handForm({ L, Ww, Wk, thumbAt: hs.thumbAt[0], thumbs: hs.thumbFacing > -0.55, D })
  const { flare, sk, t0, t1, thumbs } = f
  return (s: number, t: number): number => {
    const row = Math.floor(s),
      col = Math.floor(t - lo),
      piece = handPiece(f, row, col)
    if (!piece) return -1
    const tone = (q: number) => Math.min(2, q + dim)
    // The Owner: "there should be a sharp divide between the combined 3 fingers, index, and thumb". A divide is the
    // outline's ink, a run to the silhouette (handPiece), never a step of the skin.
    if (piece === 'divide') return DIVIDE
    const cols = row >= flare ? Wk : Ww,
      keyEdge = kSide > 0 ? cols - 1 : 0,
      farEdge = cols - 1 - keyEdge,
      thumbEdge = cols - 1
    // The thumb: its top catching the light where it turns to the key or the camera, its tip a step down.
    if (piece === 'thumb')
      return row === t1 && t1 > t0 ? 2 : row === t0 && (kSide > 0 || hs.thumbFacing > 0.4) ? tone(0) : tone(1)
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
    // The side away in shadow (below the thumb on its side).
    if (col === farEdge && row > (thumbs && farEdge === thumbEdge ? t1 + 1 : flare)) return 2
    return tone(1)
  }
}
/**
 * A hand's form in its own grid: rows down from the wrist, columns across from the little finger's edge toward the
 * thumb (the thumb stands past the palm's last column). Sized from the stamp alone (its length and its widths at the
 * wrist and the knuckles, texels), so every body, pose and density gets the same hand.
 */
export interface HandForm {
  /** The last row (the index's tip), where the palm flares, and the knuckle row. */
  last: number
  flare: number
  sk: number
  /** The width at the wrist and from the flare down (columns). */
  Ww: number
  Wk: number
  /** The thumb's rows, whether it shows, and its thickness: two columns divided from the palm in ink, or (density 1)
   * one column along the palm's side. */
  t0: number
  t1: number
  thumbs: boolean
  thumbWide: number
  /** The index divided from the mitten (the hand is broad enough for a mitten of three, a divide and an index of two),
   * and its width (two columns at the thumb's side). */
  parted: boolean
  index: number
  D: number
}
/** What a texel of the hand is: the wrist and palm (to the knuckle row), the thumb, the index, the other three fingers
 * as one mitten, or a divide (the outline's ink) between the thumb and the palm or the index and the mitten. */
export type HandPiece = 'palm' | 'thumb' | 'index' | 'mitten' | 'divide'
/**
 * The form from the stamp's sizes (texels): `L` the length to draw, `Ww` and `Wk` the widths at the wrist and the
 * knuckles, `thumbAt` where the thumb starts (a fraction of `L`), `thumbs` whether it shows.
 * - Three shapes from twice the brand kit's density, each parted from the next by a divide in ink (the Owner's
 *   "sharp divide"): the thumb, the index and the other three fingers as one mitten. The wrist is one row; the knuckle
 *   row a little under half way (an open hand's fingers are a good half of it).
 * - The thumb: two texels thick, rooted at the palm's side a row or two under the wrist, angled down and a column away
 *   (its tip at most two columns past the palm), ending above the knuckle row; a divide down its free length, its tip
 *   standing free of the palm by a notch.
 * - The fingers below the knuckles: the index (two columns) on the thumb's side down to the last row; the mitten beside
 *   it a row short, its outer corner rounded where it is four broad; a divide between them from the knuckle row,
 *   opening into a notch between their tips.
 * - A hand too narrow for three shapes (seen on its edge) is two: a mitten of all four fingers and the thumb, divided.
 * - Density 1 keeps the size its view gives it: a plain mitten with a one-texel thumb bump, the row under its tip clear.
 */
export function handForm(o: {
  L: number
  Ww: number
  Wk: number
  thumbAt: number
  thumbs: boolean
  D: number
}): HandForm {
  const big = o.D > 1,
    last = Math.max(3, Math.ceil(o.L) - 1),
    sk = Math.round((big ? 0.45 : 0.5) * (last + 1)),
    flare = big ? 1 : Math.max(1, Math.round(0.2 * (last + 1)))
  const t0 = Math.max(Math.round(o.thumbAt * o.L), flare),
    t1 = Math.min(t0 + (big ? 3 : Math.max(2, Math.ceil(0.35 * o.L))) - 1, sk - 1)
  return {
    last,
    flare,
    sk,
    Ww: o.Ww,
    Wk: o.Wk,
    t0,
    t1,
    thumbs: o.thumbs,
    thumbWide: big ? 2 : 1,
    parted: big && o.Wk >= 6 && last - sk >= 3,
    index: 2,
    D: o.D,
  }
}
/** The piece at a row and column of the form, or null where the hand is not. */
export function handPiece(f: HandForm, row: number, col: number): HandPiece | null {
  if (row < 0 || row > f.last || col < 0) return null
  const cols = row >= f.flare ? f.Wk : f.Ww,
    thumbRow = f.thumbs && row >= f.t0 && row <= f.t1
  if (thumbRow && f.thumbWide === 2) {
    // The thumb, two thick: its root on the palm's last column and the next; below it a column away, divided from
    // the palm in ink; its tip one column, the furthest out, with the notch between it and the palm.
    if (row === f.t0) {
      if (col === cols - 1 || col === cols) return 'thumb'
    } else {
      if (col === cols - 1) return 'divide'
      if (col === cols + 1 || (col === cols && row < f.t1)) return 'thumb'
    }
    if (col >= cols) return null
  } else if (thumbRow && col === cols) return 'thumb'
  if (col >= cols) return null
  if (row < f.sk) return 'palm'
  if (!f.parted) {
    if (row === f.sk) return 'palm'
    // One mitten, its tip's corners rounded.
    if (row === f.last && (col === 0 || (cols >= 3 && col === cols - 1))) return null
    return 'mitten'
  }
  // The index at the thumb's side to the last row; the divide beside it from the knuckle row to a row above the
  // mitten's end, which is the notch between their tips; the mitten a row short, its outer corner rounded.
  const gap = cols - f.index - 1,
    end = f.last - 1
  if (col > gap) return row === f.sk ? 'palm' : 'index'
  if (col === gap) return row < end ? 'divide' : null
  if (row === f.sk) return 'palm'
  if (row > end || (row === end && col === 0 && gap >= 4)) return null
  return 'mitten'
}
