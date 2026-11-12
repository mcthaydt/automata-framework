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
 * scales its widths. One factor for every body: the base pair's hand at density 2 is six to eight texels across.
 */
export const PARTED_HAND = { size: 1.15, turn: 0.7 }
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
/** The parted hand (see HandFormKind): its pieces from handForm, toned as the paddle is, its creases the deep step. */
export function partedRole({ L, Ww, Wk, D, hs, kSide, dim, lo }: RoleInput): Role {
  // The hand's form (handForm): the wrist, the palm, the thumb off its side, the index and the mitten.
  const f = handForm({ L, Ww, Wk, thumbAt: hs.thumbAt[0], thumbs: hs.thumbFacing > -0.55, D })
  const { flare, sk, t0, t1, thumbs } = f
  return (s: number, t: number): number => {
    const row = Math.floor(s),
      col = Math.floor(t - lo),
      piece = handPiece(f, row, col)
    if (!piece) return -1
    // A crease is the skin's deep step, wherever it lies: no ink inside the hand.
    if (piece === 'crease') return 3
    const cols = row >= flare ? Wk : Ww,
      keyEdge = kSide > 0 ? cols - 1 : 0,
      farEdge = cols - 1 - keyEdge,
      thumbEdge = cols - 1
    const tone = (q: number) => Math.min(2, q + dim)
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
  /** The thumb's rows, whether it shows, and its width (two columns on a hand six broad, its tip then clear of the
   * palm by a texel of background). */
  t0: number
  t1: number
  thumbs: boolean
  thumbWide: number
  /** The index parted from the mitten by a crease and a row longer (the hand is four columns broad and its fingers
   * two rows long), and its width (columns at the thumb's side of the fingers). */
  parted: boolean
  index: number
  D: number
}
/** What a texel of the hand is: the wrist and palm (to the knuckle row), the thumb, the index, the other three fingers
 * as one mitten, or a crease (the skin's deep step) between the thumb and the palm or the index and the mitten. */
export type HandPiece = 'palm' | 'thumb' | 'index' | 'mitten' | 'crease'
/**
 * The form from the stamp's sizes (texels): `L` the length to draw, `Ww` and `Wk` the widths at the wrist and the
 * knuckles, `thumbAt` where the thumb starts (a fraction of `L`), `thumbs` whether it shows.
 * - The palm flares a fifth of the way down; the knuckle row is a little past half way.
 * - The thumb runs from its root (at least the flare) a good third of the hand, past the palm's edge: a bump two
 *   columns across on a broad hand, its top corner rounded, creased from the palm along its last two rows, and its tip
 *   standing clear of the palm by a texel of background.
 * - The fingers below the knuckles: the index on the thumb's side (two columns on a broad hand) down to the last row;
 *   the mitten beside it, a crease between them, ending a row short with its little finger's corner rounded, so the
 *   index steps out of the silhouette. No ink is cut inside the hand: its partings are creases of the skin.
 * - A smaller hand (density 1) is a plain mitten with a thumb bump, its tip's corner rounded, so the shape stays whole.
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
    thumbWide: o.Wk >= 6 && t1 - t0 >= 2 ? 2 : 1,
    parted: o.Wk >= 4 && last - sk >= 2,
    index: o.Wk >= 6 ? 2 : 1,
    D: o.D,
  }
}
/** The piece at a row and column of the form, or null where the hand is not. */
export function handPiece(f: HandForm, row: number, col: number): HandPiece | null {
  if (row < 0 || row > f.last || col < 0) return null
  const cols = row >= f.flare ? f.Wk : f.Ww
  // The thumb past the palm's edge: its outer column from the row under its root (its top corner rounded); on a broad
  // hand its inner column stops a row short, so its tip stands clear of the palm.
  if (f.thumbs && row >= f.t0 && row <= f.t1 && col >= cols && col < cols + f.thumbWide) {
    const outer = col === cols + f.thumbWide - 1
    if (f.thumbWide === 2) return (outer ? row > f.t0 : row < f.t1) ? 'thumb' : null
    return 'thumb'
  }
  if (col >= cols) return null
  // Its crease along the palm, beside the thumb's last two rows.
  if (f.thumbs && col === cols - 1 && row >= Math.max(f.t0 + 1, f.t1 - 1) && row <= f.t1) return 'crease'
  if (row <= f.sk) return 'palm'
  if (!f.parted) {
    // A plain mitten, its tip's corners rounded.
    if (row === f.last && (col === 0 || (cols >= 3 && col === cols - 1))) return null
    return 'mitten'
  }
  // The index at the thumb's side to the last row; the crease beside it; the mitten a row short, its corner rounded.
  const gap = cols - f.index - 1
  if (col > gap) return 'index'
  if (row === f.last) return null
  if (col === gap) return 'crease'
  if (row === f.last - 1 && col === 0) return null
  return 'mitten'
}
