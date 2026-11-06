// What the Tilesets view shows: the rows for tilesets, auto layers, rule groups and rules, and the inspector for a
// selected rule. It only reads the project.
import type {
  AutoLayerDef,
  IntGridLayerDef,
  LayerDef,
  Project,
  TilesetDef,
} from '../../shared/level-2d/model/project-types'
import { tilesetTiles } from '../../shared/level-2d/model/tileset-grid'
import type { PatternCell, Rule } from '../../shared/level-2d/tiles/autotile/rule.schema'
import { type TileItem, tileItems } from '../../shared/level-2d/tiles/palette-model'

// What the Tilesets view shows: the
// panel's rows, what is selected once the project has had its say, and the selected rule as the inspector edits it.
// Plain functions of the project, so the Node tests decide what the Svelte files only draw.

export interface TilesetsSelection {
  readonly tileset?: string | undefined
  readonly layer?: string | undefined
  readonly group?: string | undefined
  readonly rule?: string | undefined
  /** Tile indices picked on the sheet. */
  readonly tiles: readonly number[]
  readonly tag?: string | undefined
  /** The IntGrid value the pattern cycle and the preview's sample use. */
  readonly value?: number | undefined
}

export interface ResolvedSelection {
  readonly tileset: string | undefined
  readonly layer: string | undefined
  readonly group: string | undefined
  readonly rule: string | undefined
  readonly tiles: readonly number[]
  readonly tag: string | undefined
  readonly value: number | undefined
}

export interface Row {
  readonly id: string
  readonly label: string
  readonly sub: string
}

export interface GroupRow extends Row {
  readonly active: boolean
}

export interface RuleRow extends Row {
  readonly size: 1 | 3 | 5
  readonly pattern: readonly PatternCell[]
  readonly firstTile: number | undefined
  readonly active: boolean
}

export interface TagRow {
  readonly tag: string
  readonly count: number
  readonly tiles: readonly number[]
}

export interface PatternCellView {
  readonly index: number
  readonly cell: PatternCell
  readonly label: string
  /** The cell being decided. */
  readonly centre: boolean
}

export interface ValueChoice {
  readonly value: number
  readonly label: string
  readonly color: string
}

export interface RuleInspector {
  readonly layer: string
  readonly group: string
  /** 1-based place of the rule in its group. */
  readonly place: number
  readonly tileset: string
  readonly rule: Rule
  readonly cells: readonly PatternCellView[]
  /** The source layer's values, for the cycle and for `outside`. */
  readonly values: readonly ValueChoice[]
  readonly outputs: readonly TileItem[]
  /** `chance` in percent. */
  readonly chance: number
  /** `same`, or the value read beyond the level edge as text (`0` is empty). */
  readonly outside: string
  readonly outsideOptions: readonly { readonly id: string; readonly label: string }[]
}

const isAuto = (layer: LayerDef): layer is AutoLayerDef => layer.kind === 'auto'

export const autoLayersOf = (project: Project): readonly AutoLayerDef[] => project.defs.layers.filter(isAuto)

export function sourceOf(project: Project, def: AutoLayerDef): IntGridLayerDef | undefined {
  const source = project.defs.layers.find((layer) => layer.id === def.source)
  return source?.kind === 'intgrid' ? source : undefined
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** A share as a percent with at most one decimal: 0.3 is 30, 0.125 is 12.5. */
export const percentOf = (share: number): number => Math.round(share * 1000) / 10

export function tilesetRows(project: Project): readonly Row[] {
  return project.defs.tilesets.map((set) => {
    const size = set.tile.w === set.tile.h ? `${set.tile.w} px` : `${set.tile.w} × ${set.tile.h} px`
    const what = set.image === undefined ? 'placeholder' : plural(tilesetTiles(set).count, 'tile', 'tiles')
    return { id: set.id, label: set.label, sub: `${size} · ${what}` }
  })
}

export function autoLayerRows(project: Project): readonly Row[] {
  return autoLayersOf(project).map((def) => {
    const source = project.defs.layers.find((layer) => layer.id === def.source)
    return { id: def.id, label: def.label, sub: `from ${source?.label ?? def.source}` }
  })
}

export function groupRows(def: AutoLayerDef): readonly GroupRow[] {
  return def.groups.map((group) => ({
    id: group.id,
    label: group.label,
    sub: [plural(group.rules.length, 'rule', 'rules'), ...(group.active ? [] : ['off'])].join(' · '),
    active: group.active,
  }))
}

export function ruleSummary(rule: Rule): string {
  const parts = [rule.tiles.length === 0 ? 'no tile' : plural(rule.tiles.length, 'tile', 'tiles')]
  if (rule.chance < 1) parts.push(`chance ${percentOf(rule.chance)}%`)
  if (rule.flipX) parts.push('flip X')
  if (rule.flipY) parts.push('flip Y')
  if (rule.breakOnMatch) parts.push('break')
  if (!rule.active) parts.push('off')
  return parts.join(' · ')
}

export function ruleRows(def: AutoLayerDef, group: string): readonly RuleRow[] {
  const found = def.groups.find((each) => each.id === group)
  return (found?.rules ?? []).map((rule) => ({
    id: rule.id,
    label: rule.id,
    sub: ruleSummary(rule),
    size: rule.size,
    pattern: rule.pattern,
    firstTile: rule.tiles[0],
    active: rule.active,
  }))
}

export function tagRows(tileset: TilesetDef): readonly TagRow[] {
  return tileset.tags.map((entry) => ({ tag: entry.tag, count: entry.tiles.length, tiles: entry.tiles }))
}

export function resolveSelection(project: Project, selection: TilesetsSelection): ResolvedSelection {
  const sets = project.defs.tilesets
  const tileset = sets.find((set) => set.id === selection.tileset) ?? sets[0]
  const autos = autoLayersOf(project)
  const layer = autos.find((def) => def.id === selection.layer) ?? autos[0]
  const group = layer?.groups.find((each) => each.id === selection.group) ?? layer?.groups[0]
  const rule = group?.rules.find((each) => each.id === selection.rule) ?? group?.rules[0]
  const count = tileset === undefined ? 0 : tilesetTiles(tileset).count
  const tiles = [...new Set(selection.tiles)].filter((tile) => tile < count).sort((a, b) => a - b)
  const values = layer === undefined ? [] : (sourceOf(project, layer)?.values ?? [])
  const value = values.find((each) => each.value === selection.value) ?? values[0]
  return {
    tileset: tileset?.id,
    layer: layer?.id,
    group: group?.id,
    rule: rule?.id,
    tiles,
    tag: tileset?.tags.some((entry) => entry.tag === selection.tag) === true ? selection.tag : undefined,
    value: value?.value,
  }
}

function cellLabel(cell: PatternCell, values: readonly ValueChoice[]): string {
  if (typeof cell === 'string') return cell
  const [verb, value] = 'is' in cell ? ['is', cell.is] : ['not', cell.not]
  return `${verb} ${values.find((each) => each.value === value)?.label ?? value}`
}

export function ruleInspector(
  project: Project,
  layer: string,
  ruleId: string,
  images: ReadonlySet<string>,
): RuleInspector | undefined {
  const def = autoLayersOf(project).find((each) => each.id === layer)
  const group = def?.groups.find((each) => each.rules.some((rule) => rule.id === ruleId))
  const place = group?.rules.findIndex((rule) => rule.id === ruleId) ?? -1
  const rule = group?.rules[place]
  if (def === undefined || group === undefined || rule === undefined) return undefined
  const values = (sourceOf(project, def)?.values ?? []).map((value) => ({
    value: value.value,
    label: value.label ?? value.id,
    color: value.color,
  }))
  const centre = (rule.size * rule.size - 1) / 2
  const tiles = tileItems(
    project.defs.tilesets.find((set) => set.id === def.tileset),
    images,
  )
  return {
    layer,
    group: group.id,
    place: place + 1,
    tileset: def.tileset,
    rule,
    cells: rule.pattern.map((cell, index) => ({
      index,
      cell,
      label: cellLabel(cell, values),
      centre: index === centre,
    })),
    values,
    outputs: rule.tiles.flatMap((tile) => tiles.filter((item) => item.tile === tile)),
    chance: percentOf(rule.chance),
    outside: String(rule.outside),
    outsideOptions: [
      { id: 'same', label: 'Same as the centre' },
      { id: '0', label: 'Empty' },
      ...values.map((value) => ({ id: String(value.value), label: value.label })),
    ],
  }
}
