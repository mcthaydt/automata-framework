// A figure's proportions read off its painted cell, for the look rounds: how many heads tall, how long the neck, where the legs start,
// and how wide the shoulders, waist and hips are. The head is measured on a bald copy of the figure (hair and headwear taken off the
// outfit, nothing else) so a bob does not count as skull; the joints' heights come from the rig's own numbers, since a front view
// cannot show where two legs that touch begin. Every figure is read the same way, so two rounds of the same character compare.

import { type CharacterDef, member } from '../shared/figure-builder/door.ts'
import { type PaintedCell, paintedCell, rowWidths } from './painted-cell.ts'

/** The rig's own joint heights as shares of the standing height, from the figure's genes (a figure at rest: no stand, no stoop). */
export interface RiggedHeights {
  /** The hip joint: the crotch is a hand's breadth below it. */
  readonly hipJoint: number
  readonly knee: number
  readonly elbow: number
  readonly wrist: number
  /** The tips of the fingers, a hand length below the wrist. */
  readonly fingertip: number
  readonly shoulder: number
  readonly chin: number
}

export interface Proportions {
  /** Rows from the first to the last opaque row, with the hair, as the figure is played. */
  readonly height: number
  /** Rows of the skull, crown to chin, on the bald copy (the outline above it counts), and with the hair as played. */
  readonly headRows: number
  readonly headRowsWithHair: number
  /** Skin rows under the chin before the cloth starts: 0 when the collar meets the chin. */
  readonly neckRows: number
  readonly trunkRows: number
  /** Rows from the hip joint (the rig's, else where the legs part in the picture, else the middle) to the sole. */
  readonly legRows: number
  /** The bald figure's height over its head, and the figure as played over its head with hair. */
  readonly heads: number
  readonly headsWithHair: number
  /** The widest skin row of the head, and the widths in texels of the shoulders, waist and hips (hanging arms count). */
  readonly headWidth: number
  readonly shoulder: number
  readonly waist: number
  readonly hip: number
  readonly shoulderHeads: number
  /** Where the legs part in the picture, as a share of the height up from the sole: undefined where they touch to the feet. Trousers
   * and shorts hide the crotch, so this is the inseam's top or the hem of a short, the one leg measure a picture alone gives. */
  readonly legsPart: number | undefined
  /** The feet's length seen from the side (texels, and heads); undefined without a side view. */
  readonly footLength: number | undefined
  readonly footHeads: number | undefined
  /** The rig's joint heights; undefined for a figure that is only a picture (the old game's). */
  readonly rig: RiggedHeights | undefined
}

/** The garment entries that put anything on the head: the hair, and the kit's and the builder's headwear. */
const HEAD_KEYS = ['hair', 'style', 'tie', 'cap', 'hat', 'hood', 'helmet']

/** `def` with its hair and headwear off, the rest of what it wears as it is. */
export function bald(def: CharacterDef): CharacterDef {
  const outfits = Object.fromEntries(
    Object.entries(def.outfits).map(([name, items]) => [
      name,
      items.filter((item) => !HEAD_KEYS.some((key) => key in item)),
    ]),
  )
  return { ...def, outfits }
}

/** The joints' heights as shares of the height, from the rig's own numbers (`skeleton` in the builder's `rig.ts`). */
export function riggedHeights(def: CharacterDef): RiggedHeights {
  const g = member(def, 1).genes
  const k = g.height / 1.62
  const hip = g.legs * g.height
  const shoulder = g.height - g.head - g.neck - 0.02 * k
  const arm = shoulder - 0.045 * k
  const wrist = arm - g.arms
  const share = (y: number) => y / g.height
  return {
    hipJoint: share(hip),
    knee: share(hip - (hip - g.ankle) * 0.5),
    elbow: share(arm - g.arms * (1 - g.forearm)),
    wrist: share(wrist),
    fingertip: share(wrist - 0.17 * k),
    shoulder: share(shoulder),
    chin: share(g.height - g.head),
  }
}

const first = (widths: readonly number[]) => widths.findIndex((w) => w > 0)
const last = (widths: readonly number[]) => widths.length - 1 - [...widths].reverse().findIndex((w) => w > 0)

/** The head's rows on a cell: the first opaque row down to the chin. The face is widest at the cheeks and narrows to the chin; the neck
 * is the first run of three rows of one width under it (two where the run ends the skin, the cloth closing on the neck), and the
 * chin is the row above that. Without such a run the chin is the last row of skin. */
function headOf(cell: PaintedCell, def: CharacterDef) {
  const all = rowWidths(cell)
  const skin = rowWidths(cell, { def, swatch: def.skin })
  const top = first(all)
  const bottom = last(all)
  const height = bottom - top + 1
  const at = (y: number) => skin[y] ?? 0
  // The head's skin is the first run of skin rows; the hands, further down, are not part of it.
  const start = first(skin)
  // A figure with no face showing (the old night nurse's hair hangs over hers) has no head to read.
  if (start < 0 || start > top + height * 0.3)
    return { all, top, bottom, height, widest: 0, chin: top - 1, neckRows: 0 }
  let end = start
  while (at(end + 1) > 0) end++
  const headZone = skin.slice(start, end + 1)
  const widest = Math.max(...headZone)
  const peakEnd = start + headZone.lastIndexOf(widest)
  let neckFrom: number | undefined
  for (let y = peakEnd + 1; y <= end && neckFrom === undefined; y++) {
    const w = at(y)
    if (w >= widest * 0.75) continue
    const run = at(y + 1) === w ? (at(y + 2) === w ? 3 : 2) : 1
    if (run === 3 || (run === 2 && y + 1 === end)) neckFrom = y
  }
  const chin = neckFrom === undefined ? end : neckFrom - 1
  let neckEnd = chin
  if (neckFrom !== undefined) {
    neckEnd = neckFrom
    while (at(neckEnd + 1) === at(neckFrom)) neckEnd++
  }
  return { all, top, bottom, height, widest, chin, neckRows: neckEnd - chin }
}

/** The first row below the waist where the legs part: two texels of the middle are empty with cloth either side, two rows running. */
function crotchRow(cell: PaintedCell, top: number, height: number): number | undefined {
  const [w] = cell.size
  const { painted } = cell
  const opaque = (x: number, y: number) => (painted[(y * w + x) * 4 + 3] ?? 0) !== 0
  const parted = (y: number) => {
    for (let x = w / 2 - 2; x <= w / 2 + 1; x++) {
      let left = false
      let right = false
      for (let d = 1; d <= 5; d++) {
        left ||= opaque(x - d, y)
        right ||= opaque(x + d, y)
      }
      if (!opaque(x, y) && left && right) return true
    }
    return false
  }
  const from = top + Math.round(height * 0.4)
  for (let y = from; y < top + height - 1; y++) if (parted(y) && parted(y + 1)) return y
  return undefined
}

/** The length of the feet seen from the side: the widest of the lowest rows of the figure. */
function footOf(side: PaintedCell): number {
  const widths = rowWidths(side)
  const top = first(widths)
  const bottom = last(widths)
  const band = widths.slice(bottom - Math.round((bottom - top + 1) * 0.07) + 1, bottom + 1)
  return Math.max(...band)
}

/** A figure's proportions from cells already painted: `front` as played, `bald` its front without hair (the same as `front` if it has
 * none), and `side` a side view for the feet. */
export function proportionsOfCells(input: {
  def: CharacterDef
  /** The rig's heights, when there is a rig behind the picture. */
  rig?: RiggedHeights
  front: PaintedCell
  bald?: PaintedCell
  side?: PaintedCell
}): Proportions {
  const { def, front } = input
  const { rig } = input
  const played = headOf(front, def)
  const skull = headOf(input.bald ?? front, def)
  const widths = skull.all
  const headRows = skull.chin - skull.top + 1
  // With no head to read (a face hidden under hair), the shoulders are taken from where a figure's shoulders are.
  const trunkTop =
    headRows > 0 ? skull.chin + 1 + skull.neckRows : played.top + Math.round(played.height * 0.16)
  const part = crotchRow(front, played.top, played.height)
  const crotchAt =
    rig !== undefined
      ? played.bottom + 1 - Math.round(rig.hipJoint * played.height)
      : (part ?? played.top + Math.round(played.height / 2))
  const band = (from: number, to: number) => {
    const rows = widths.slice(from, to + 1).filter((w) => w > 0)
    return rows.length > 0 ? rows : [0]
  }
  const shoulder = Math.max(...band(trunkTop, trunkTop + Math.round(played.height * 0.12)))
  const hip = Math.max(...band(crotchAt - Math.round(played.height * 0.08), crotchAt))
  const waist = Math.min(
    ...band(trunkTop + Math.round(played.height * 0.12), crotchAt - Math.round(played.height * 0.08)),
  )
  const foot = input.side === undefined ? undefined : footOf(input.side)
  const skullHeight = skull.bottom - skull.top + 1
  return {
    height: played.height,
    headRows,
    headRowsWithHair: skull.chin - played.top + 1,
    neckRows: skull.neckRows,
    trunkRows: crotchAt - trunkTop,
    legRows: played.bottom + 1 - crotchAt,
    heads: headRows > 0 ? skullHeight / headRows : Number.NaN,
    headsWithHair: skull.chin >= played.top ? played.height / (skull.chin - played.top + 1) : Number.NaN,
    headWidth: skull.widest,
    shoulder,
    waist,
    hip,
    shoulderHeads: skull.widest > 0 ? shoulder / skull.widest : Number.NaN,
    legsPart: part === undefined ? undefined : (played.bottom + 1 - part) / played.height,
    footLength: foot,
    footHeads: foot === undefined || headRows <= 0 ? undefined : foot / headRows,
    rig,
  }
}

/** A figure's proportions at `density`: painted as played (front), bald (front), and from its left (the feet). */
export function proportions(def: CharacterDef, density: 1 | 2 | 4 = 1): Proportions {
  return proportionsOfCells({
    def,
    rig: riggedHeights(def),
    front: paintedCell(def, 0, density),
    bald: paintedCell(bald(def), 0, density),
    side: paintedCell(def, 2, density),
  })
}
