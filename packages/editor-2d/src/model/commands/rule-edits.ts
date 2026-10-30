import {
  type PatternCell,
  type Rule,
  type RuleGroup,
  ruleGroupSchema,
  ruleSchema,
} from '../../tiles/autotile/rule.schema'
import type { AutoLayerDef, Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import {
  autoLayerOf,
  checkIndex,
  checkShape,
  insertItem,
  moveItem,
  replaceLayerDef,
  tilesetOf,
} from './def-lookup'

// Rule group and rule edits on an auto layer (2D editor spec §5.6, §8 flow 6). Group ids and rule ids are unique within
// their layer (a rule's id keys its hash, so two rules with one id would roll the same dice), and a rule is addressed
// by its id alone. A rule is checked against its layer when it changes: its outputs inside the tileset, every `is`,
// `not` and numeric `outside` a value the source IntGrid layer defines, so the editor never writes a rule the Checks
// would flag as `ruleTileOutOfRange` or `ruleValueUnknown`. Only the rule that changes is checked, so a project that
// opened with a bad rule elsewhere can still be edited and mended.

export type RulePatch = Partial<
  Pick<Rule, 'active' | 'tiles' | 'chance' | 'flipX' | 'flipY' | 'breakOnMatch' | 'outside'>
>

/** The pattern editor's tap: any → empty → filled → is `value` → not `value` → any. `value` is the selected IntGrid value. */
export function nextPatternCell(cell: PatternCell, value: number): PatternCell {
  if (cell === 'any') return 'empty'
  if (cell === 'empty') return 'filled'
  if (cell === 'filled') return { is: value }
  if ('is' in cell) return { not: value }
  return 'any'
}

const SIZE_3_CENTRE = 4

/**
 * A rule as the editor starts one: 3 × 3 of `any` around a `filled` centre, no output yet, always applies, no flips,
 * ends the cell and repeats the centre beyond the level edge, as the templates' terrain rules do.
 */
export function newRule(id: string): Rule {
  return {
    id,
    active: true,
    size: 3,
    pattern: Array.from({ length: 9 }, (_, i): PatternCell => (i === SIZE_3_CENTRE ? 'filled' : 'any')),
    tiles: [],
    chance: 1,
    flipX: false,
    flipY: false,
    breakOnMatch: true,
    outside: 'same',
  }
}

interface LayerContext {
  readonly values: ReadonlySet<number>
  readonly tileCount: number
}

function contextOf(project: Project, def: AutoLayerDef): LayerContext {
  const source = project.defs.layers.find((candidate) => candidate.id === def.source)
  const values = new Set(source?.kind === 'intgrid' ? source.values.map((value) => value.value) : [])
  return { values, tileCount: tilesetTiles(tilesetOf(project, def.tileset)).count }
}

function checkValue(value: number, context: LayerContext, where: string): void {
  if (!context.values.has(value)) throw new RangeError(`${where}: the source layer has no value ${value}`)
}

function checkCell(cell: PatternCell, context: LayerContext, where: string): void {
  if (typeof cell === 'object') checkValue('is' in cell ? cell.is : cell.not, context, where)
}

function checkRule(rule: Rule, context: LayerContext): void {
  const where = `rule "${rule.id}"`
  checkShape(ruleSchema, rule, where)
  for (const tile of rule.tiles) {
    if (tile >= context.tileCount)
      throw new RangeError(`${where}: tile ${tile} is beyond the tileset's ${context.tileCount} tiles`)
  }
  for (const cell of rule.pattern) checkCell(cell, context, where)
  if (rule.outside !== 'same' && rule.outside !== 0) checkValue(rule.outside, context, where)
}

/** Every group and rule of an auto layer that is about to be added: shapes, unique ids and each rule against the layer. */
export function checkGroups(project: Project, def: AutoLayerDef): void {
  const context = contextOf(project, def)
  const groupIds = new Set<string>()
  const ruleIds = new Set<string>()
  for (const group of def.groups) {
    checkShape(ruleGroupSchema, group, `group "${group.id}"`)
    if (groupIds.has(group.id)) throw new RangeError(`group id "${group.id}" is used twice`)
    groupIds.add(group.id)
    for (const rule of group.rules) {
      if (ruleIds.has(rule.id)) throw new RangeError(`rule id "${rule.id}" is used twice`)
      ruleIds.add(rule.id)
      checkRule(rule, context)
    }
  }
}

function withGroups(project: Project, def: AutoLayerDef, groups: readonly RuleGroup[]): Project {
  return groups === def.groups ? project : replaceLayerDef(project, def.id, { ...def, groups })
}

function groupIndex(def: AutoLayerDef, group: string): number {
  const index = def.groups.findIndex((candidate) => candidate.id === group)
  if (index < 0) throw new RangeError(`no rule group "${group}" in layer "${def.id}"`)
  return index
}

/** Replaces one group with `edit`'s result; the same project when `edit` returns that group. */
function updateGroup(
  project: Project,
  layer: string,
  group: string,
  edit: (found: RuleGroup, def: AutoLayerDef) => RuleGroup,
): Project {
  const def = autoLayerOf(project, layer)
  const index = groupIndex(def, group)
  const found = def.groups[index] as RuleGroup
  const next = edit(found, def)
  if (next === found) return project
  return withGroups(
    project,
    def,
    def.groups.map((candidate, i) => (i === index ? next : candidate)),
  )
}

/** The group holding rule `rule`, or a `RangeError`. */
function groupOfRule(def: AutoLayerDef, rule: string): RuleGroup {
  const found = def.groups.find((group) => group.rules.some((candidate) => candidate.id === rule))
  if (found === undefined) throw new RangeError(`no rule "${rule}" in layer "${def.id}"`)
  return found
}

/** Replaces one rule with `edit`'s result after checking it against the layer; the same project when nothing changes. */
function updateRule(project: Project, layer: string, rule: string, edit: (found: Rule) => Rule): Project {
  const def = autoLayerOf(project, layer)
  const group = groupOfRule(def, rule)
  return updateGroup(project, layer, group.id, (found) => {
    const index = found.rules.findIndex((candidate) => candidate.id === rule)
    const current = found.rules[index] as Rule
    const next = edit(current)
    if (next === current) return found
    checkRule(next, contextOf(project, def))
    return { ...found, rules: found.rules.map((candidate, i) => (i === index ? next : candidate)) }
  })
}

export function addRuleGroup(
  project: Project,
  layer: string,
  group: { readonly id: string; readonly label: string },
): Project {
  const def = autoLayerOf(project, layer)
  const next: RuleGroup = { id: group.id, label: group.label, active: true, rules: [] }
  checkShape(ruleGroupSchema, next, `group "${group.id}"`)
  if (def.groups.some((candidate) => candidate.id === group.id))
    throw new RangeError(`group id "${group.id}" is already used in layer "${layer}"`)
  return withGroups(project, def, [...def.groups, next])
}

export function editRuleGroup(
  project: Project,
  layer: string,
  group: string,
  patch: { readonly label?: string; readonly active?: boolean },
): Project {
  return updateGroup(project, layer, group, (found) => {
    const label = patch.label ?? found.label
    const active = patch.active ?? found.active
    return label === found.label && active === found.active ? found : { ...found, label, active }
  })
}

export function reorderRuleGroups(project: Project, layer: string, from: number, to: number): Project {
  const def = autoLayerOf(project, layer)
  return withGroups(project, def, moveItem(def.groups, from, to))
}

/** Removes a group and its rules. Nothing else refers to a rule, so there is nothing to refuse. */
export function deleteRuleGroup(project: Project, layer: string, group: string): Project {
  const def = autoLayerOf(project, layer)
  const index = groupIndex(def, group)
  return withGroups(
    project,
    def,
    def.groups.filter((_, i) => i !== index),
  )
}

/** Adds `rule` to `group` at `at` (the end when absent); its id must be new in the layer. */
export function addRule(project: Project, layer: string, group: string, rule: Rule, at?: number): Project {
  const def = autoLayerOf(project, layer)
  if (def.groups.some((candidate) => candidate.rules.some((existing) => existing.id === rule.id)))
    throw new RangeError(`rule id "${rule.id}" is already used in layer "${layer}"`)
  return updateGroup(project, layer, group, (found) => {
    checkRule(rule, contextOf(project, def))
    return { ...found, rules: insertItem(found.rules, rule, at) }
  })
}

const sameTiles = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((tile, i) => tile === b[i])

/** Changes a rule's outputs, chance, flips, break, `outside` or whether it is on. */
export function editRule(project: Project, layer: string, rule: string, patch: RulePatch): Project {
  return updateRule(project, layer, rule, (found) => {
    const next: Rule = { ...found, ...patch }
    const same =
      sameTiles(next.tiles, found.tiles) &&
      next.active === found.active &&
      next.chance === found.chance &&
      next.flipX === found.flipX &&
      next.flipY === found.flipY &&
      next.breakOnMatch === found.breakOnMatch &&
      next.outside === found.outside
    return same ? found : next
  })
}

/**
 * Changes the pattern's size and keeps its centred cells: growing pads with `any`, shrinking drops the outer ring, so
 * the cell being decided stays the centre.
 */
export function resizeRule(project: Project, layer: string, rule: string, size: 1 | 3 | 5): Project {
  return updateRule(project, layer, rule, (found) => {
    if (size === found.size) return found
    const offset = (found.size - size) / 2
    const pattern: PatternCell[] = []
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const oldRow = row + offset
        const oldCol = col + offset
        const inside = oldRow >= 0 && oldRow < found.size && oldCol >= 0 && oldCol < found.size
        pattern.push(inside ? (found.pattern[oldRow * found.size + oldCol] as PatternCell) : 'any')
      }
    }
    return { ...found, size, pattern }
  })
}

const sameCell = (a: PatternCell, b: PatternCell): boolean =>
  typeof a === 'string' || typeof b === 'string'
    ? a === b
    : ('is' in a && 'is' in b && a.is === b.is) || ('not' in a && 'not' in b && a.not === b.not)

/** Sets one cell of the pattern, row-major from the top left. */
export function setPatternCell(
  project: Project,
  layer: string,
  rule: string,
  index: number,
  cell: PatternCell,
): Project {
  return updateRule(project, layer, rule, (found) => {
    checkIndex(index, found.pattern.length)
    if (sameCell(found.pattern[index] as PatternCell, cell)) return found
    return { ...found, pattern: found.pattern.map((current, i) => (i === index ? cell : current)) }
  })
}

/** Moves a rule within its group; the order is the order the engine tries them. */
export function reorderRules(
  project: Project,
  layer: string,
  group: string,
  from: number,
  to: number,
): Project {
  return updateGroup(project, layer, group, (found) => {
    const rules = moveItem(found.rules, from, to)
    return rules === found.rules ? found : { ...found, rules }
  })
}

export function deleteRule(project: Project, layer: string, rule: string): Project {
  const def = autoLayerOf(project, layer)
  const group = groupOfRule(def, rule)
  return updateGroup(project, layer, group.id, (found) => ({
    ...found,
    rules: found.rules.filter((candidate) => candidate.id !== rule),
  }))
}
