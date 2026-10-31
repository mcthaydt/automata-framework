import type { FieldDef, FieldValue, RefValue } from '@mcthaydt/automata-editor-kit/fields'
import { unpackTile } from '../../model/cells-codec'
import { setEntityField } from '../../model/commands/entity-edits'
import type { Grid } from '../../model/grid'
import type { LayerDef, LayerInstance, Level, Project } from '../../model/project-types'
import { tilesetTiles } from '../../model/tileset-grid'
import { setLevelField } from '../../model/world/level-edits'
import type { Diagnostic } from '../profile'

// The level-project profile's repairs (plan ED2D.7a decisions 1 to 3; 2D editor spec §7 `fix`, §9): the name a
// finding carries turned into one returned project, which the app applies as one undo step. `remove` clears what
// `tileOutOfRange` and `cellValueUnknown` count, `move-inside` clamps an anchor into its level, `delete` removes an
// instance whose definition is gone. `choose-target` needs a choice, so the Checks view handles it, not this. A
// finding with no repair, an unknown repair or a target that is gone throws `RangeError`, as `applyStageFix` does.

const LAYER_PATH = /^levels\[([^\]]+)\]\.layers\[([^\]]+)\](?:\.items\[([^\]]+)\])?$/

interface Target {
  readonly level: Level
  readonly def: LayerDef
  readonly layer: LayerInstance
  readonly item: string | undefined
}

function targetOf(project: Project, path: string): Target {
  const match = LAYER_PATH.exec(path)
  const level = project.levels.find((each) => each.id === match?.[1])
  const def = project.defs.layers.find((each) => each.id === match?.[2])
  const layer = level?.layers.find((each) => each.def === match?.[2])
  if (level === undefined || def === undefined || layer === undefined)
    throw new RangeError(`nothing to repair at ${path}`)
  return { level, def, layer, item: match?.[3] }
}

function withLayer(project: Project, target: Target, layer: LayerInstance): Project {
  return {
    ...project,
    levels: project.levels.map((level) =>
      level === target.level
        ? { ...level, layers: level.layers.map((each) => (each === target.layer ? layer : each)) }
        : level,
    ),
  }
}

/** The grid with every cell `bad` says is wrong set to empty. */
function cleared(grid: Grid, bad: (value: number) => boolean): Grid {
  const cells = grid.nonEmpty().filter(({ value }) => bad(value))
  return grid.edit((editor) => {
    for (const cell of cells) editor.set(cell.x, cell.y, 0)
  })
}

function tileCount(project: Project, tileset: string): number {
  const set = project.defs.tilesets.find((each) => each.id === tileset)
  return set === undefined ? Number.POSITIVE_INFINITY : tilesetTiles(set).count
}

function remove(project: Project, target: Target): LayerInstance {
  const { def, layer } = target
  const beyond = (count: number) => (value: number) => (unpackTile(value)?.tile ?? 0) >= count
  if (layer.kind === 'tiles' && def.kind === 'tiles')
    return { ...layer, cells: cleared(layer.cells, beyond(tileCount(project, def.tileset))) }
  if (layer.kind === 'auto' && def.kind === 'auto')
    return { ...layer, overrides: cleared(layer.overrides, beyond(tileCount(project, def.tileset))) }
  if (layer.kind === 'intgrid' && def.kind === 'intgrid') {
    const defined = new Set(def.values.map((value) => value.value))
    return { ...layer, cells: cleared(layer.cells, (value) => !defined.has(value)) }
  }
  if (layer.kind === 'objects' && def.kind === 'objects') {
    const count = tileCount(project, def.tileset)
    return { ...layer, items: layer.items.filter((item) => item.tile < count) }
  }
  throw new RangeError(`nothing to remove in layer "${def.id}"`)
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max)

function moveInside(target: Target): LayerInstance {
  const { level, layer, item } = target
  const inside = <T extends { id: string; x: number; y: number }>(items: readonly T[]): readonly T[] => {
    if (!items.some((each) => each.id === item)) throw new RangeError(`no instance "${item}"`)
    return items.map((each) =>
      each.id === item ? { ...each, x: clamp(each.x, level.size.w), y: clamp(each.y, level.size.h) } : each,
    )
  }
  if (layer.kind === 'entities') return { ...layer, items: inside(layer.items) }
  if (layer.kind === 'objects') return { ...layer, items: inside(layer.items) }
  throw new RangeError(`layer "${layer.def}" holds no instances`)
}

function deleteItem(target: Target): LayerInstance {
  const { layer, item } = target
  if (layer.kind !== 'entities' || !layer.items.some((each) => each.id === item))
    throw new RangeError(`no instance "${item}"`)
  return { ...layer, items: layer.items.filter((each) => each.id !== item) }
}

export function applyProjectFix(project: Project, diagnostic: Diagnostic): Project {
  switch (diagnostic.fix) {
    case 'remove': {
      const target = targetOf(project, diagnostic.path)
      return withLayer(project, target, remove(project, target))
    }
    case 'move-inside': {
      const target = targetOf(project, diagnostic.path)
      return withLayer(project, target, moveInside(target))
    }
    case 'delete': {
      const target = targetOf(project, diagnostic.path)
      return withLayer(project, target, deleteItem(target))
    }
    default:
      throw new RangeError(
        diagnostic.fix === undefined
          ? `"${diagnostic.code}" has no repair`
          : `"${diagnostic.fix}" is not a repair this profile applies`,
      )
  }
}

// `choose-target` (`brokenRef`, `refWrongKind`): the finding's path names a ref value of an instance or of a level
// (`….fields.target`, or `….fields.route[2]` in a list). The Checks view offers `refChoices` and commits the one picked
// with `chooseTarget`, one undo step.

const REF_PATH =
  /^levels\[([^\]]+)\](?:\.layers\[([^\]]+)\]\.items\[([^\]]+)\])?\.fields\.([A-Za-z][A-Za-z0-9_]*)(?:\[(\d+)\])?$/

/** A target the field allows: `check-1 · checkpoint in level-1`, or a level's id. */
export interface RefChoice {
  readonly label: string
  readonly value: RefValue
}

interface RefHolder {
  readonly level: string
  readonly layer: string | undefined
  readonly item: string | undefined
  readonly field: FieldDef
  readonly position: number | undefined
  readonly values: Readonly<Record<string, FieldValue>>
}

function refHolder(project: Project, diagnostic: Diagnostic): RefHolder {
  const match = diagnostic.fix === 'choose-target' ? REF_PATH.exec(diagnostic.path) : null
  if (match === null) throw new RangeError(`"${diagnostic.code}" is not about a ref`)
  const [, level, layer, item, fieldId, position] = match
  const found = project.levels.find((each) => each.id === level)
  const layerFound = found?.layers.find((each) => each.def === layer)
  const instance =
    layerFound?.kind === 'entities' ? layerFound.items.find((each) => each.id === item) : undefined
  const fields =
    item === undefined
      ? project.defs.levelFields
      : (project.defs.entities.find((def) => def.id === instance?.def)?.fields ?? [])
  const field = fields.find((each) => each.id === fieldId)
  const values = item === undefined ? found?.fields : instance?.fields
  if (found === undefined || field === undefined || values === undefined || field.type !== 'ref')
    throw new RangeError(`nothing to repair at ${diagnostic.path}`)
  return {
    level: found.id,
    layer,
    item,
    field,
    position: position === undefined ? undefined : Number(position),
    values,
  }
}

export function refChoices(project: Project, diagnostic: Diagnostic): readonly RefChoice[] {
  const holder = refHolder(project, diagnostic)
  const allowed = holder.field.to ?? []
  const any = allowed.length === 0
  const choices: RefChoice[] = []
  const defs = any
    ? project.defs.entities.map((def) => def.id)
    : allowed.filter((entry) => entry !== '$level')
  for (const def of defs)
    for (const level of project.levels)
      for (const layer of level.layers) {
        if (layer.kind !== 'entities') continue
        for (const item of layer.items)
          if (item.def === def && item.id !== holder.item)
            choices.push({
              label: `${item.id} · ${def} in ${level.id}`,
              value: { target: item.id, container: level.id },
            })
      }
  if (any || allowed.includes('$level'))
    for (const level of project.levels) choices.push({ label: level.id, value: { target: level.id } })
  return choices
}

/** The ref value the finding names set to `value` (one place of a list), validated by the field edits. */
export function chooseTarget(project: Project, diagnostic: Diagnostic, value: RefValue): Project {
  const holder = refHolder(project, diagnostic)
  const current = holder.values[holder.field.id]
  const next: FieldValue =
    holder.position === undefined
      ? value
      : (Array.isArray(current) ? current : []).map((entry, index) =>
          index === holder.position ? value : entry,
        )
  if (holder.item === undefined || holder.layer === undefined)
    return setLevelField(project, holder.level, holder.field.id, next)
  return setEntityField(
    project,
    { level: holder.level, layer: holder.layer },
    holder.item,
    holder.field.id,
    next,
  )
}
