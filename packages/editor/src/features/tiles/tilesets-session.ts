import type { History } from '../../shared/kit/history/history.ts'
import {
  addRule,
  addRuleGroup,
  deleteRule,
  deleteRuleGroup,
  editRule,
  editRuleGroup,
  newRule,
  nextPatternCell,
  type RulePatch,
  reorderRuleGroups,
  reorderRules,
  resizeRule,
  setPatternCell,
} from '../../shared/level-2d/model/commands/rule-edits'
import { tagTiles, untagTiles } from '../../shared/level-2d/model/commands/tileset-edits'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import { commitEdit, type FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { AutoLayerDef, Project } from '../../shared/level-2d/model/project-types'
import type { Rule, RuleGroup } from '../../shared/level-2d/tiles/autotile/rule.schema'
import {
  autoLayersOf,
  type ResolvedSelection,
  resolveSelection,
  type TilesetsSelection,
} from './tilesets-model'

// One Tilesets view's state over an open document (plan ED2D.5b decisions 1, 2 and 7; 2D editor spec §8 flow 6): what
// is selected, and every edit the view offers as one undo step through `commitEdit`, so a value the model refuses comes
// back as its message with nothing applied. The selection is kept as the person made it and resolved against the
// project on every read, so an undo that removes the selected rule falls back to the first remaining one.

export interface TilesetsSession {
  readonly project: Project
  readonly selection: ResolvedSelection
  /** Called after the selection or the project changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** Choosing an auto layer also shows its tileset; showing another tileset clears the tile selection. */
  select(patch: Partial<TilesetsSelection>): void
  toggleTile(tile: number): void
  clearTiles(): void
  cycleCell(index: number): FieldCommit
  resize(size: 1 | 3 | 5): FieldCommit
  setRule(patch: Pick<RulePatch, 'active' | 'flipX' | 'flipY' | 'breakOnMatch'>): FieldCommit
  /** `percent` from 0 to 100. */
  setChance(percent: number): FieldCommit
  /** `same`, or a value as text (`0` is empty). */
  setOutside(choice: string): FieldCommit
  addOutputs(): FieldCommit
  removeOutput(at: number): FieldCommit
  addRule(): FieldCommit
  duplicateRule(): FieldCommit
  deleteRule(): FieldCommit
  reorderRules(from: number, to: number): FieldCommit
  addGroup(): FieldCommit
  editGroup(patch: { readonly label?: string; readonly active?: boolean }): FieldCommit
  deleteGroup(): FieldCommit
  reorderGroups(from: number, to: number): FieldCommit
  tagSelected(): FieldCommit
  untagSelected(): FieldCommit
  newTag(name: string): FieldCommit
  dispose(): void
}

export interface TilesetsSessionOptions {
  readonly history: History<unknown>
  /** Where new rule and group ids come from. */
  readonly ids: IdSource
}

const OK: FieldCommit = { ok: true }
const refused = (message: string): FieldCommit => ({ ok: false, message })

const FLAG_LABELS = { flipX: 'Flip X', flipY: 'Flip Y', breakOnMatch: 'Break on match' } as const

/** Undefined for a document that is not a level project. */
export function createTilesetsSession(options: TilesetsSessionOptions): TilesetsSession | undefined {
  const edits = projectHistory(options.history)
  if (edits === undefined) return undefined
  const listeners = new Set<() => void>()
  let raw: TilesetsSelection = { tiles: [] }

  const tell = (): void => {
    for (const run of [...listeners]) run()
  }
  const stopHistory = options.history.subscribe(tell)
  const current = (): ResolvedSelection => resolveSelection(edits.state, raw)
  const choose = (patch: Partial<TilesetsSelection>): void => {
    raw = { ...raw, ...patch }
    tell()
  }

  const layerDef = (): AutoLayerDef | undefined => {
    const { layer } = current()
    return autoLayersOf(edits.state).find((def) => def.id === layer)
  }
  const groupOf = (): RuleGroup | undefined => {
    const { group } = current()
    return layerDef()?.groups.find((each) => each.id === group)
  }
  const ruleOf = (): Rule | undefined => {
    const { rule } = current()
    return groupOf()?.rules.find((each) => each.id === rule)
  }

  /** Runs an edit of the selected rule; nothing is selected, nothing happens. */
  const onRule = (
    label: string,
    edit: (project: Project, layer: string, rule: Rule) => Project,
  ): FieldCommit => {
    const { layer } = current()
    const rule = ruleOf()
    if (layer === undefined || rule === undefined) return OK
    return commitEdit(edits, label, (project) => edit(project, layer, rule))
  }
  const onGroup = (
    label: string,
    edit: (project: Project, layer: string, group: RuleGroup) => Project,
  ): FieldCommit => {
    const { layer } = current()
    const group = groupOf()
    if (layer === undefined || group === undefined) return OK
    return commitEdit(edits, label, (project) => edit(project, layer, group))
  }
  const onTags = (label: string, tag: string | undefined, edit: typeof tagTiles): FieldCommit => {
    const { tileset, tiles } = current()
    if (tiles.length === 0) return refused('Select the tiles to tag first.')
    if (tileset === undefined || tag === undefined) return OK
    return commitEdit(edits, label, (project) => edit(project, tileset, tag, tiles))
  }

  return {
    get project() {
      return edits.state
    },
    get selection() {
      return current()
    },
    subscribe(run) {
      listeners.add(run)
      return () => listeners.delete(run)
    },
    select(patch) {
      const layer =
        patch.layer === undefined
          ? undefined
          : autoLayersOf(edits.state).find((def) => def.id === patch.layer)
      const next = layer === undefined ? patch : { tileset: layer.tileset, ...patch }
      // A tile index means a tile of one sheet: showing another sheet starts with nothing picked.
      const moved = next.tileset !== undefined && next.tileset !== current().tileset
      choose(moved ? { tiles: [], ...next } : next)
    },
    toggleTile(tile) {
      const { tiles } = current()
      choose({ tiles: tiles.includes(tile) ? tiles.filter((each) => each !== tile) : [...tiles, tile] })
    },
    clearTiles: () => choose({ tiles: [] }),
    cycleCell(index) {
      const value = current().value ?? 1
      return onRule('Edit pattern', (project, layer, rule) => {
        const cell = rule.pattern[index]
        if (cell === undefined) throw new RangeError(`the pattern has no cell ${index}`)
        return setPatternCell(project, layer, rule.id, index, nextPatternCell(cell, value))
      })
    },
    resize: (size) =>
      onRule('Resize pattern', (project, layer, rule) => resizeRule(project, layer, rule.id, size)),
    setRule(patch) {
      const label =
        patch.active !== undefined
          ? `Turn rule ${patch.active ? 'on' : 'off'}`
          : FLAG_LABELS[
              Object.hasOwn(patch, 'flipX')
                ? 'flipX'
                : Object.hasOwn(patch, 'flipY')
                  ? 'flipY'
                  : 'breakOnMatch'
            ]
      return onRule(label, (project, layer, rule) => editRule(project, layer, rule.id, patch))
    },
    setChance: (percent) =>
      onRule('Set chance', (project, layer, rule) =>
        editRule(project, layer, rule.id, { chance: percent / 100 }),
      ),
    setOutside: (choice) =>
      onRule('Set outside', (project, layer, rule) =>
        editRule(project, layer, rule.id, { outside: choice === 'same' ? 'same' : Number(choice) }),
      ),
    addOutputs() {
      const { tiles } = current()
      return onRule('Add outputs', (project, layer, rule) =>
        editRule(project, layer, rule.id, {
          tiles: [...rule.tiles, ...tiles.filter((tile) => !rule.tiles.includes(tile))],
        }),
      )
    },
    removeOutput: (at) =>
      onRule('Remove output', (project, layer, rule) =>
        editRule(project, layer, rule.id, { tiles: rule.tiles.filter((_, i) => i !== at) }),
      ),
    addRule() {
      const id = `rule-${options.ids.next()}`
      const done = onGroup('Add rule', (project, layer, group) =>
        addRule(project, layer, group.id, newRule(id)),
      )
      if (done.ok) choose({ rule: id })
      return done
    },
    duplicateRule() {
      const rule = ruleOf()
      const group = groupOf()
      if (rule === undefined || group === undefined) return OK
      const id = `rule-${options.ids.next()}`
      const at = group.rules.indexOf(rule) + 1
      const done = onGroup('Duplicate rule', (project, layer) =>
        addRule(project, layer, group.id, { ...rule, id }, at),
      )
      if (done.ok) choose({ rule: id })
      return done
    },
    deleteRule() {
      const rule = ruleOf()
      const rules = groupOf()?.rules ?? []
      if (rule === undefined) return OK
      const at = rules.indexOf(rule)
      const neighbour = rules[at + 1] ?? rules[at - 1]
      const done = onRule('Delete rule', (project, layer) => deleteRule(project, layer, rule.id))
      if (done.ok) choose({ rule: neighbour?.id })
      return done
    },
    reorderRules: (from, to) =>
      onGroup('Reorder rules', (project, layer, group) => reorderRules(project, layer, group.id, from, to)),
    addGroup() {
      const { layer } = current()
      const count = layerDef()?.groups.length ?? 0
      if (layer === undefined) return OK
      const id = `group-${options.ids.next()}`
      const done = commitEdit(edits, 'Add group', (project) =>
        addRuleGroup(project, layer, { id, label: `Group ${count + 1}` }),
      )
      if (done.ok) choose({ group: id, rule: undefined })
      return done
    },
    editGroup(patch) {
      const label = patch.active === undefined ? 'Rename group' : `Turn group ${patch.active ? 'on' : 'off'}`
      return onGroup(label, (project, layer, group) => editRuleGroup(project, layer, group.id, patch))
    },
    deleteGroup: () =>
      onGroup('Delete group', (project, layer, group) => deleteRuleGroup(project, layer, group.id)),
    reorderGroups(from, to) {
      const { layer } = current()
      if (layer === undefined) return OK
      return commitEdit(edits, 'Reorder groups', (project) => reorderRuleGroups(project, layer, from, to))
    },
    tagSelected: () => onTags('Tag tiles', current().tag, tagTiles),
    untagSelected: () => onTags('Untag tiles', current().tag, untagTiles),
    newTag(name) {
      const tag = name.trim()
      if (current().tiles.length === 0) return refused('Select the tiles to tag first.')
      if (tag === '') return refused('Give the tag a name.')
      const done = onTags('Tag tiles', tag, tagTiles)
      if (done.ok) choose({ tag })
      return done
    },
    dispose() {
      stopHistory()
      listeners.clear()
    },
  }
}
