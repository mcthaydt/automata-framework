// How the editor's edits reach the sectors of a level, whatever format it is in (ED3D spec §4.1): the members both
// formats share, read out and written back, so that an edit is written once. A format keeps what is its own (Last
// Light's zone, its openings, its things) inside its own access object; nothing here names a Last Light concept.
import type { Decor, PartialTrim, WallDef, WindowGrid } from '@automata/3d/level'

/** A wall as written: the members of `WallDef`, and Last Light's `preset` (a wall that starts from a named one). */
export type EditWall = WallDef & {
  readonly preset?: string | undefined
  /** What is set into the wall, each at a place along it (an `af-sector/2` member). */
  readonly decor?: readonly Decor[] | undefined
  /** A row of windows over the whole wall (an `af-sector/2` member). */
  readonly windows?: WindowGrid | undefined
}

/**
 * A corner starts the wall that runs to the next one. A string in its third member is Last Light's spelling of
 * `{ cut: <name> }`, a cutaway group; a corner with no wall is `[x, z]`, never `[x, z, undefined]`.
 */
export type EditCorner = readonly [number, number, (string | EditWall | undefined)?]

/** The members of a sector that both formats have. A member an edit does not know is carried through by spreading. */
export interface EditSector {
  readonly id: string
  readonly floor: number
  readonly ceiling: number
  /** Shade, Build-style: 1 is normal, lower is darker. */
  readonly light: number
  readonly open?: boolean | undefined
  readonly style?: string | undefined
  readonly floorTexture?: string | undefined
  readonly ceilingTexture?: string | undefined
  readonly wallTexture?: string | undefined
  readonly trim?: PartialTrim | undefined
  /** The camera view the game takes in this sector. */
  readonly view?: string | undefined
  /** The floor is a drop the player falls into. */
  readonly pit?: boolean | undefined
  readonly corners: readonly EditCorner[]
  readonly holes?: readonly (readonly EditCorner[])[] | undefined
}

/** What a drawn outline needs to become a sector. */
export interface SectorDraft {
  readonly id: string
  readonly corners: readonly (readonly [number, number])[]
  readonly floor: number
  readonly ceiling: number
  readonly light: number
  /** The sector it is drawn like: the members the format wants it to share (materials, and for Last Light its zone). */
  readonly like?: EditSector | undefined
}

/** A level cannot hold what an edit wrote, for instance `af-sector` given a wall written as a name. */
export class SectorAccessError extends Error {
  override readonly name = 'SectorAccessError'
}

export interface SectorAccess<D> {
  /** The sectors in file order. The same objects, so an edit that keeps one keeps its identity. */
  list(doc: D): readonly EditSector[]
  /**
   * The level with these sectors in place of its own, in this order, and nothing else changed. Sectors that are
   * the level's own objects stay those objects, and the level itself is returned when none changed. Throws
   * `SectorAccessError` for a wall the format cannot hold.
   */
  withSectors(doc: D, sectors: readonly EditSector[]): D
  /** Every id a new sector may not take (Last Light: its openings' too). */
  takenIds(doc: D): readonly string[]
  /** A sector for a drawn outline, with the members the format requires and the materials of `like`. */
  create(doc: D, draft: SectorDraft): EditSector
  /** What still names the sector or stands in it, as sentences; empty when it can go. */
  references(doc: D, id: string): readonly string[]
  /**
   * What is tied to the sector's walls or to its name beyond a portal, as sentences: the part of `references` that cutting
   * the sector in two, or joining it to another, would leave pointing at the wrong place. Last Light: the openings that
   * join the room, the wall presets that lead into it and the things that name one of its walls by number. Empty when
   * nothing is, and for a sector that is not there.
   */
  pinned(doc: D, id: string): readonly string[]
  /** The sector a wall leads into, through its preset where the format has presets; nothing for a wall that is not a portal. */
  portalOf(doc: D, wall: string | EditWall | undefined): string | undefined
}

/** The material members of a sector a new one drawn like it shares: its style and its three textures. */
export function inheritedMaterials(like: EditSector | undefined): Partial<EditSector> {
  if (like === undefined) return {}
  const { style, floorTexture, ceilingTexture, wallTexture } = like
  return {
    ...(style === undefined ? {} : { style }),
    ...(floorTexture === undefined ? {} : { floorTexture }),
    ...(ceilingTexture === undefined ? {} : { ceilingTexture }),
    ...(wallTexture === undefined ? {} : { wallTexture }),
  }
}

/**
 * The portals of the other sectors that lead into `id`, as sentences (`sector dock corner 3: a portal into hall`,
 * with `hole 0 ` before `corner` for a corner of a hole). `nextOf` says which sector a wall leads to.
 */
export function portalReferences(
  sectors: readonly EditSector[],
  id: string,
  noun: string,
  nextOf: (wall: string | EditWall | undefined) => string | undefined,
): string[] {
  const found: string[] = []
  for (const sector of sectors) {
    if (sector.id === id) continue
    const loops = [sector.corners, ...(sector.holes ?? [])]
    loops.forEach((loop, index) => {
      const where = index === 0 ? '' : `hole ${index - 1} `
      loop.forEach((corner, at) => {
        if (nextOf(corner[2]) === id)
          found.push(`${noun} ${sector.id} ${where}corner ${at}: a portal into ${id}`)
      })
    })
  }
  return found
}
