// The atlas packer (M5 spec §4.7, M5-D8). AF's own: FloorFifty ships single images, so there is no source to port.
//
// Deterministic by construction: frames are taken in code-unit order of their names and placed on shelves, left to
// right, then top to bottom. Each frame sits in a cell one pixel larger on every side (the extrusion, which repeats
// its edge pixels so filtering at a frame's edge never samples a neighbour), cells are one pixel apart and from the
// page edge (the padding), and a shelf is as tall as its tallest cell. The page is the smallest power-of-two square
// that holds every frame; past 2048 (WebGL2's guaranteed MAX_TEXTURE_SIZE) frames fill further 2048 pages in order.

export const ATLAS_PAGE_MAX = 2048
export const ATLAS_PADDING = 1
export const ATLAS_EXTRUDE = 1

export interface FrameSize {
  readonly name: string
  readonly width: number
  readonly height: number
}

/** Where a frame's own pixels are: inside its extrusion, on page `page`. */
export interface Placement {
  readonly name: string
  readonly page: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PackedAtlas {
  /** Each page's side, in pixels. */
  readonly pageSizes: readonly number[]
  /** In code-unit order of the frame names. */
  readonly placements: readonly Placement[]
}

/** A frame that cannot fit a page even alone. */
export class AtlasFrameTooLarge extends Error {
  constructor(readonly frame: FrameSize) {
    super(
      `atlas frame '${frame.name}' (${frame.width} × ${frame.height}) does not fit a ${ATLAS_PAGE_MAX} page with its padding and extrusion`,
    )
    this.name = 'AtlasFrameTooLarge'
  }
}

const byCodeUnit = (a: FrameSize, b: FrameSize) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
const cellOf = (frame: FrameSize) => ({
  width: frame.width + 2 * ATLAS_EXTRUDE,
  height: frame.height + 2 * ATLAS_EXTRUDE,
})

/**
 * Shelf-packs `frames` from the first onto pages of side `size`. With `onePage` it stops at the first frame that
 * does not fit and returns undefined; otherwise it opens a new page.
 */
function shelfPack(frames: readonly FrameSize[], size: number, onePage: boolean): Placement[] | undefined {
  const placements: Placement[] = []
  let page = 0
  let x = ATLAS_PADDING
  let y = ATLAS_PADDING
  let shelfHeight = 0
  for (const frame of frames) {
    const cell = cellOf(frame)
    // Wider than the page even on a shelf of its own (only while trying smaller pages: `packFrames` checked 2048).
    if (ATLAS_PADDING + cell.width > size) return undefined
    if (x + cell.width > size) {
      // Next shelf.
      x = ATLAS_PADDING
      y += shelfHeight + ATLAS_PADDING
      shelfHeight = 0
    }
    if (y + cell.height > size) {
      if (onePage) return undefined
      page++
      x = ATLAS_PADDING
      y = ATLAS_PADDING
      shelfHeight = 0
    }
    placements.push({
      name: frame.name,
      page,
      x: x + ATLAS_EXTRUDE,
      y: y + ATLAS_EXTRUDE,
      width: frame.width,
      height: frame.height,
    })
    x += cell.width + ATLAS_PADDING
    shelfHeight = Math.max(shelfHeight, cell.height)
  }
  return placements
}

/** Packs `frames` into atlas pages. Throws `AtlasFrameTooLarge` for a frame no page can hold. */
export function packFrames(frames: readonly FrameSize[]): PackedAtlas {
  const sorted = [...frames].sort(byCodeUnit)
  for (const frame of sorted) {
    const cell = cellOf(frame)
    if (ATLAS_PADDING + Math.max(cell.width, cell.height) > ATLAS_PAGE_MAX)
      throw new AtlasFrameTooLarge(frame)
  }
  if (sorted.length === 0) return { pageSizes: [], placements: [] }

  for (let size = 1; size <= ATLAS_PAGE_MAX; size *= 2) {
    const placements = shelfPack(sorted, size, true)
    if (placements !== undefined) return { pageSizes: [size], placements }
  }
  const placements = shelfPack(sorted, ATLAS_PAGE_MAX, false) as Placement[]
  const pages = (placements.at(-1)?.page ?? 0) + 1
  return { pageSizes: Array.from({ length: pages }, () => ATLAS_PAGE_MAX), placements }
}
