// The inspector's cards as plain data (ED3D.5f, plan decision 1; ED3D spec §9): what is selected, read from the live
// level through the profile, so the cards work for both formats. Several selected show the first and say how many (plan
// decision 2). A selection naming nothing the level has shows the none card.
import type { DoorDef, Occlude, WindowDef } from '../format/sector.schema'
import type { LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import type { EditCorner, EditWall } from '../profile/sector-access'

export type WallType = 'solid' | 'portal' | 'door' | 'window'

export type InspectorCard = { readonly selected: number } & (
  | { readonly kind: 'none' }
  | {
      readonly kind: 'sector'
      readonly id: string
      readonly floor: number
      readonly ceiling: number
      readonly light: number
      readonly style: string | undefined
      readonly floorTexture: string | undefined
      readonly ceilingTexture: string | undefined
      readonly wallTexture: string | undefined
      readonly view: string | undefined
      readonly walls: number
      readonly portals: number
    }
  | {
      readonly kind: 'wall'
      readonly sector: string
      readonly corner: number
      /** In metres. */
      readonly length: number
      readonly type: WallType
      /** The sector a portal leads into. */
      readonly to: string | undefined
      readonly door: DoorDef | undefined
      readonly window: WindowDef | undefined
      readonly texture: string | undefined
      readonly occlude: Occlude | undefined
      readonly handrail: number | undefined
      readonly frame: boolean | undefined
      readonly mask: 'glass' | 'bars' | undefined
      /** The cutaway a Last Light wall names instead of its own members. */
      readonly preset: string | undefined
    }
  | {
      readonly kind: 'thing'
      readonly definition: string
      readonly id: string
      readonly x: number
      readonly z: number
      readonly y: number | undefined
    }
)

const wallOf = (corner: EditCorner | undefined): EditWall | undefined =>
  typeof corner?.[2] === 'object' ? corner[2] : undefined

const typeOf = (wall: EditWall | undefined): WallType => {
  if (wall?.next !== undefined) return 'portal'
  if (wall?.door !== undefined) return 'door'
  if (wall?.window !== undefined) return 'window'
  return 'solid'
}

export function inspectorOf<D>(
  editor: Pick<LevelEditor<D>, 'profile' | 'level' | 'selection'>,
): InspectorCard {
  const ids = editor.selection.ids
  const selected = ids.length
  const first = ids[0] === undefined ? undefined : parseSelection(ids[0])
  const none: InspectorCard = { kind: 'none', selected }
  if (first === undefined) return none
  if (first.kind === 'entity') {
    const thing = editor.profile
      .entities(editor.level)
      .things.find((each) => each.def === first.definition && each.id === first.id)
    if (thing === undefined) return none
    return {
      kind: 'thing',
      selected,
      definition: thing.def,
      id: thing.id,
      x: thing.x,
      z: thing.z,
      y: thing.y,
    }
  }
  const sector = editor.profile.sectors.list(editor.level).find((each) => each.id === first.sector)
  if (sector === undefined) return none
  if (first.kind === 'sector') {
    const walls = sector.corners.map(wallOf)
    return {
      kind: 'sector',
      selected,
      id: sector.id,
      floor: sector.floor,
      ceiling: sector.ceiling,
      light: sector.light,
      style: sector.style,
      floorTexture: sector.floorTexture,
      ceilingTexture: sector.ceilingTexture,
      wallTexture: sector.wallTexture,
      view: sector.view,
      walls: sector.corners.length,
      portals: walls.filter((wall) => wall?.next !== undefined).length,
    }
  }
  const start = sector.corners[first.corner]
  const end = sector.corners[(first.corner + 1) % sector.corners.length]
  if (start === undefined || end === undefined) return none
  const wall = wallOf(start)
  return {
    kind: 'wall',
    selected,
    sector: sector.id,
    corner: first.corner,
    length: Math.hypot(end[0] - start[0], end[1] - start[1]),
    type: typeOf(wall),
    to: wall?.next,
    door: wall?.door,
    window: wall?.window,
    texture: wall?.texture,
    occlude: wall?.occlude,
    handrail: wall?.handrail,
    frame: wall?.frame,
    mask: wall?.mask,
    preset: typeof start[2] === 'string' ? start[2] : wall?.preset,
  }
}

/** A row of the portrait sheet's Walls or Things list: what tapping it selects, and what it says. */
export interface InspectorRow {
  readonly id: string
  readonly label: string
  readonly selected: boolean
}

type Readable<D> = Pick<LevelEditor<D>, 'profile' | 'level' | 'selection'>

/** The walls of the selected room (or of the selected wall's room), in outline order, each with its kind and length. */
export function wallRowsOf<D>(editor: Readable<D>): readonly InspectorRow[] {
  const first = editor.selection.ids[0] === undefined ? undefined : parseSelection(editor.selection.ids[0])
  if (first === undefined || first.kind === 'entity') return []
  const sector = editor.profile.sectors.list(editor.level).find((each) => each.id === first.sector)
  if (sector === undefined) return []
  const chosen = new Set(editor.selection.ids)
  return sector.corners.map((start, corner) => {
    const end = sector.corners[(corner + 1) % sector.corners.length] ?? start
    const wall = wallOf(start)
    const type = typeOf(wall)
    const kind = type === 'portal' ? `portal into ${wall?.next}` : type
    const id = `wall:${sector.id}/${corner}`
    const length = Math.hypot(end[0] - start[0], end[1] - start[1])
    // Counted from 1, as the status line counts walls for people.
    return { id, label: `Wall ${corner + 1} · ${kind} · ${length.toFixed(2)} m`, selected: chosen.has(id) }
  })
}

/** The level's things, in the level's order. */
export function thingRowsOf<D>(editor: Readable<D>): readonly InspectorRow[] {
  const chosen = new Set(editor.selection.ids)
  return editor.profile.entities(editor.level).things.map((thing) => {
    const id = `entity:${thing.def}/${thing.id}`
    return { id, label: `${thing.def} · ${thing.id}`, selected: chosen.has(id) }
  })
}
