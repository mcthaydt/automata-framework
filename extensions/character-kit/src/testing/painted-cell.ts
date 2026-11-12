// A painted figure's texels, for a test: the figure builder's own painter in Node, with the kit's wardrobe registered, so a game
// can check what its character wears against the picture and not only against its data (a garment the painter does not know is
// dropped without a word; the picture is where it shows).

import { registerFashion } from '../features/fashion/register-fashion.ts'
import {
  type CharacterDef,
  cellOf,
  Figure,
  member,
  SWATCHES,
  walking,
} from '../shared/figure-builder/door.ts'

/** The painter's pitch: the builder's own camera looks down 18 degrees whatever the game's does. */
const PITCH = (18 * Math.PI) / 180

export interface PaintedCell {
  /** RGBA, `size[0]` by `size[1]`. */
  readonly painted: Uint8ClampedArray
  /** Width and height in texels. */
  readonly size: readonly [number, number]
}

/**
 * `def` standing in its default outfit, seen from `direction` (0 front, 2 its left, 4 back, 6 its right: eighths of a turn) at
 * `density` (1, 2 or 4).
 */
export function paintedCell(def: CharacterDef, direction = 0, density: 1 | 2 | 4 = 2): PaintedCell {
  registerFashion()
  const figure = new Figure(member(def, density))
  // Three steps, as the builder's own sheets take them: the hair's spring settles before the cell is read.
  for (let i = 0; i < 3; i++)
    figure.update(1 / 60, {
      facing: (direction * Math.PI) / 4,
      moving: false,
      view: { azimuth: 0, pitch: PITCH },
    })
  const cell = cellOf(figure)
  return { painted: cell.painted.slice(), size: cell.size }
}

/** The eight standing views of `def`, front first and turning toward its left. */
export function paintedStand(def: CharacterDef, density: 1 | 2 | 4 = 2): PaintedCell[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((direction) => paintedCell(def, direction, density))
}

/** The walk of `def`, one cell for each pose step of its gait's cycle, three-quarter front (the builder's own sheet). */
export function paintedWalk(def: CharacterDef, density: 1 | 2 | 4 = 2): PaintedCell[] {
  registerFashion()
  const cast = member(def, density)
  return walking(cast).map((painted) => ({ painted: painted.slice(), size: cast.cell }))
}

/** The texel at `at` (a texel index) as a colour test sees it: opaque, with its red, green and blue. */
type Colour = readonly [number, number, number]

/** The four painted colours of `swatch` (the character's own, else the builder's or the kit's), as RGB. */
function coloursOf(def: CharacterDef, swatch: string): Colour[] {
  const paint = def.swatches?.[swatch]?.paint ?? SWATCHES[swatch]?.paint ?? []
  return paint.map(
    (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as unknown as Colour,
  )
}

/** Whether the opaque texel `i` of `painted` is one of `colours`. */
const isOneOf = (painted: Uint8ClampedArray, i: number, colours: readonly Colour[]): boolean =>
  colours.some(([r, g, b]) => r === painted[i * 4] && g === painted[i * 4 + 1] && b === painted[i * 4 + 2])

/** How many texels of `cell` are one of the four painted colours of `swatch` (the character's own, else the builder's or the kit's). */
export function texelsOfSwatch(def: CharacterDef, cell: PaintedCell, swatch: string): number {
  const colours = coloursOf(def, swatch)
  const { painted } = cell
  let count = 0
  for (let i = 0; i < painted.length / 4; i++)
    if ((painted[i * 4 + 3] ?? 0) !== 0 && isOneOf(painted, i, colours)) count++
  return count
}

/**
 * The width, row by row from the top, of the opaque texels of `cell`: from the first to the last in the row (a gap between
 * an arm and the body counts), or, with `def` and `swatch`, of that swatch's texels only (a garment's own width). 0 for an
 * empty row.
 */
export function rowWidths(cell: PaintedCell, only?: { def: CharacterDef; swatch: string }): number[] {
  const [w, h] = cell.size
  const colours = only === undefined ? undefined : coloursOf(only.def, only.swatch)
  const { painted } = cell
  const widths: number[] = []
  for (let y = 0; y < h; y++) {
    let first = -1
    let last = -1
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if ((painted[i * 4 + 3] ?? 0) === 0) continue
      if (colours !== undefined && !isOneOf(painted, i, colours)) continue
      if (first < 0) first = x
      last = x
    }
    widths.push(first < 0 ? 0 : last - first + 1)
  }
  return widths
}

/**
 * How many empty texels lie inside each row of `cell`, between its first and last opaque texel: the floor that shows between two
 * legs or between an arm and the body (the margin to either side of the figure is not counted). 0 for an empty row.
 */
export function rowGaps(cell: PaintedCell): number[] {
  const [w, h] = cell.size
  const gaps: number[] = []
  for (let y = 0; y < h; y++) {
    let first = -1
    let last = -1
    let opaque = 0
    for (let x = 0; x < w; x++) {
      if ((cell.painted[(y * w + x) * 4 + 3] ?? 0) === 0) continue
      if (first < 0) first = x
      last = x
      opaque++
    }
    gaps.push(first < 0 ? 0 : last - first + 1 - opaque)
  }
  return gaps
}

/** A figure's silhouette in texels, read from the front: where it stands, and how wide it is at its shoulder, waist and hip. */
export interface Silhouette {
  /** First and last opaque rows, and the rows between them inclusive. */
  readonly top: number
  readonly bottom: number
  readonly height: number
  /** The widest row in the band of the figure's height where the shoulders are, 14 to 26 % down from the top. */
  readonly shoulder: number
  /** The narrowest row in the waist's band, 34 to 46 %: arms hanging at the sides count, as they do in the picture. */
  readonly waist: number
  /** The widest row in the hip's band, 44 to 58 %. */
  readonly hip: number
}

/**
 * The shoulder, waist and hip widths of `cell`, measured in bands of its height so a figure of any size reads on one scale. The
 * bands are fixed numbers of the builder's own human proportions (the sliders move a figure a little off them), so the same
 * measure before and after a change to a garment says whether its shape moved the silhouette.
 */
export function silhouette(cell: PaintedCell): Silhouette {
  const widths = rowWidths(cell)
  const top = widths.findIndex((w) => w > 0)
  const bottom = widths.length - 1 - [...widths].reverse().findIndex((w) => w > 0)
  const height = bottom - top + 1
  const band = (from: number, to: number) =>
    widths.slice(top + Math.round(height * from), top + Math.round(height * to) + 1)
  return {
    top,
    bottom,
    height,
    shoulder: Math.max(...band(0.14, 0.26)),
    waist: Math.min(...band(0.34, 0.46).filter((w) => w > 0)),
    hip: Math.max(...band(0.44, 0.58)),
  }
}
