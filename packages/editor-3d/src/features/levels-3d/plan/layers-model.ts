// The rows of the layers panel (ED3D.5d, ED3D spec §5.2): Rooms (the file's sectors) and Walls, then Things with one sub-layer per entity
// definition the level has, in its order. Each row carries what the panel shows (label, colour, count) and its state
// in the view store. `inherited` marks a sub-layer whose Things parent is hidden or locked: it is off with its parent,
// whatever its own toggles say. Plain data, so every rule is a unit test.

import type { LevelEditor } from '../../../shared/edit/level-editor'
import { thingLayer, type ViewState } from '../../../shared/edit/view-store'
import { GeometryError } from '../../../shared/level-session/level-profile'
import type { EntityKit } from '../../../shared/things/things'

export interface LayerRow {
  /** The view store's name for the layer: `sectors`, `walls`, `things` or `things:<definition>`. */
  readonly id: string
  readonly label: string
  /** The swatch, as a CSS colour. */
  readonly color: string
  readonly count: number
  /** 0 for a layer, 1 for a sub-layer of Things. */
  readonly depth: 0 | 1
  readonly hidden: boolean
  readonly locked: boolean
  /** The layer the tools work on. */
  readonly active: boolean
  readonly inherited: boolean
}

export interface LayerRowsInput {
  readonly kit: EntityKit
  readonly sectors: number
  readonly walls: number
  readonly view: Pick<ViewState, 'layer' | 'hidden' | 'locked'>
}

// The mockups' layer swatches (`docs/design/editor-3d/ui.mjs`, `LAYERS`): Sectors `ent/wall`, Walls `ent/portal`.
const SECTORS = '#cfd3dc'
const WALLS = '#5aa9e6'
const THINGS = '#8f9bb3'

/** A definition's id as a word to read: its first letter capital (`ember` is Ember), as a person would write it. */
const worded = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1)

export function layerRows(input: LayerRowsInput): readonly LayerRow[] {
  const { kit, view } = input
  const row = (id: string, label: string, color: string, count: number, depth: 0 | 1): LayerRow => ({
    id,
    label,
    color,
    count,
    depth,
    hidden: view.hidden.includes(id),
    locked: view.locked.includes(id),
    active: view.layer === id,
    inherited: depth === 1 && (view.hidden.includes('things') || view.locked.includes('things')),
  })
  const rows = [
    row('sectors', 'Rooms', SECTORS, input.sectors, 0),
    row('walls', 'Walls', WALLS, input.walls, 0),
  ]
  if (kit.definitions.length === 0) return rows
  rows.push(row('things', 'Things', THINGS, kit.things.length, 0))
  for (const definition of kit.definitions) {
    const count = kit.things.filter((thing) => thing.def === definition.id).length
    const layer = row(
      thingLayer(definition.id),
      definition.label ?? worded(definition.id),
      definition.color ?? THINGS,
      count,
      1,
    )
    // A kind the level has none of is a row of nothing: it is listed only while it is the layer the tools work on, or
    // while it is hidden or locked, so the switch that was set can be set back. The Things palette still offers it.
    if (count > 0 || layer.active || layer.hidden || layer.locked) rows.push(layer)
  }
  return rows
}

/** The rows for the editor's live level: its rooms, its walls (each side of a wall that joins two rooms counts) and things. */
export function editorLayerRows<D>(editor: LevelEditor<D>): readonly LayerRow[] {
  const { level, profile } = editor
  let sectors = 0
  let walls = 0
  try {
    for (const layer of profile.geometry(level).layers) {
      sectors += layer.map.sectors.length
      walls += layer.map.edges.length
    }
  } catch (error) {
    // A level the engine cannot build lists no rooms and no walls; its checks say why.
    if (!(error instanceof GeometryError)) throw error
  }
  return layerRows({ kit: profile.entities(level), sectors, walls, view: editor.view.state })
}
