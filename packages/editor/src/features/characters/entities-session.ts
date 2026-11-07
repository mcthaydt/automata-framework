// The Characters view's editing: add, change and remove entity definitions and their fields. A change that would
// break instances is refused with the list of uses, unless the person confirms it.
import type { FieldDef, FieldType } from '@automata/content/level-2d'
import type { History } from '../../shared/kit/history/history.ts'
import type { DefinitionUse, GuardedEdit } from '../../shared/level-2d/model/commands/def-lookup'
import { deleteDefinition } from '../../shared/level-2d/model/commands/definition-uses'
import {
  addEntityDef,
  type EntityDefPatch,
  editEntityDef,
  renameEntityDef,
} from '../../shared/level-2d/model/commands/entity-def-edits'
import { addField, renameField, retypeField } from '../../shared/level-2d/model/commands/field-edits'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import { commitEdit, type FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { EntityDef2D, Project } from '../../shared/level-2d/model/project-types'
import {
  type EntitiesSelection,
  type ResolvedEntitiesSelection,
  resolveSelection,
  withType,
} from './entities-model'

// One Entities view's state over an open document: what
// is selected, and every edit the view offers as one undo step through `commitEdit`. A delete or a field change that
// would break values comes back as the list of uses with nothing applied; the view asks, and calls the same action
// again with `anyway`, which applies the change and the removals as one step. The selection is kept as the person made
// it and resolved on every read, so an undo or a delete falls back to the first remaining definition or field.

/** A guarded edit's outcome: applied, refused with a message, or refused with the uses it would break. */
export type GuardedCommit = FieldCommit | { readonly ok: false; readonly uses: readonly DefinitionUse[] }

interface Anyway {
  readonly anyway?: boolean
}

export interface EntitiesSession {
  readonly project: Project
  readonly selection: ResolvedEntitiesSelection
  /** Called after the selection or the project changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** Choosing another owner selects its first field unless `field` is given too. */
  select(patch: EntitiesSelection): void
  addDefinition(): FieldCommit
  duplicateDefinition(): FieldCommit
  renameDefinition(to: string): FieldCommit
  editDefinition(patch: EntityDefPatch): FieldCommit
  deleteDefinition(options?: Anyway): GuardedCommit
  addField(): FieldCommit
  renameField(to: string): FieldCommit
  /** Replaces the selected field's definition (anything but its id) through the retype rule. */
  changeField(next: FieldDef, options?: Anyway): GuardedCommit
  setType(type: FieldType, options?: Anyway): GuardedCommit
  deleteField(options?: Anyway): GuardedCommit
  dispose(): void
}

export interface EntitiesSessionOptions {
  readonly history: History<unknown>
  /** Where new definition and field ids come from. */
  readonly ids: IdSource
}

const OK: FieldCommit = { ok: true }

/** A new definition: a 16 × 16 rect standing on its bottom centre, with no fields. */
const newDefinition = (id: string): EntityDef2D => ({
  id,
  color: '#94a3b8',
  fields: [],
  shape: 'rect',
  size: { w: 16, h: 16 },
  pivot: { x: 0.5, y: 1 },
  resizable: 'none',
  tags: [],
})

/** Undefined for a document that is not a level project. */
export function createEntitiesSession(options: EntitiesSessionOptions): EntitiesSession | undefined {
  const edits = projectHistory(options.history)
  if (edits === undefined) return undefined
  const listeners = new Set<() => void>()
  let raw: EntitiesSelection = {}

  const tell = (): void => {
    for (const run of [...listeners]) run()
  }
  const stopHistory = options.history.subscribe(tell)
  const current = (): ResolvedEntitiesSelection => resolveSelection(edits.state, raw)
  const choose = (patch: EntitiesSelection): void => {
    raw = { ...raw, ...patch }
    tell()
  }

  /** Runs a guarded edit: its uses come back with nothing applied; otherwise it is one `label` step. */
  const guarded = (label: string, edit: (project: Project) => GuardedEdit): GuardedCommit => {
    let first: GuardedEdit
    try {
      first = edit(edits.state)
    } catch (error) {
      if (error instanceof RangeError) return { ok: false, message: error.message }
      throw error
    }
    if (!first.ok) return { ok: false, uses: first.uses }
    return commitEdit(edits, label, (project) => {
      const result = edit(project)
      if (!result.ok) throw new RangeError('the change was refused')
      return result.project
    })
  }

  const onDefinition = (
    label: string,
    edit: (project: Project, def: EntityDef2D) => Project,
  ): FieldCommit => {
    const { def } = current()
    if (def === undefined) return OK
    return commitEdit(edits, label, (project) => edit(project, def))
  }

  const addDefinitionAs = (label: string, def: EntityDef2D): FieldCommit => {
    const done = commitEdit(edits, label, (project) => addEntityDef(project, def))
    if (done.ok) choose({ owner: { entity: def.id }, field: undefined })
    return done
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
      const ownerChanged = patch.owner !== undefined && patch.field === undefined
      choose(ownerChanged ? { ...patch, field: undefined } : patch)
    },
    addDefinition: () => addDefinitionAs('Add a character', newDefinition(`entity-${options.ids.next()}`)),
    duplicateDefinition() {
      const { def } = current()
      if (def === undefined) return OK
      const id = `entity-${options.ids.next()}`
      return addDefinitionAs('Duplicate entity', { ...def, id, label: `Copy of ${def.label ?? def.id}` })
    },
    renameDefinition(to) {
      const done = onDefinition('Rename entity', (project, def) => renameEntityDef(project, def.id, to))
      if (done.ok) choose({ owner: { entity: to } })
      return done
    },
    editDefinition: (patch) =>
      onDefinition('Edit entity', (project, def) => editEntityDef(project, def.id, patch)),
    deleteDefinition(options = {}) {
      const { def } = current()
      if (def === undefined) return OK
      return guarded('Delete entity', (project) =>
        deleteDefinition(project, { kind: 'entity', id: def.id }, options),
      )
    },
    addField() {
      const { owner } = current()
      const field: FieldDef = { id: `field_${options.ids.next()}`, type: 'text', default: '' }
      const done = commitEdit(edits, 'Add setting', (project) => addField(project, owner, field))
      if (done.ok) choose({ owner, field: field.id })
      return done
    },
    renameField(to) {
      const { owner, field } = current()
      if (field === undefined) return OK
      const done = commitEdit(edits, 'Rename field', (project) => renameField(project, owner, field.id, to))
      if (done.ok) choose({ field: to })
      return done
    },
    changeField(next, options = {}) {
      const { owner, field } = current()
      if (field === undefined) return OK
      return guarded('Change field', (project) =>
        retypeField(project, owner, field.id, { ...next, id: field.id }, options),
      )
    },
    setType(type, options = {}) {
      const { field } = current()
      if (field === undefined) return OK
      return this.changeField(withType(field, type), options)
    },
    deleteField(options = {}) {
      const { owner, field } = current()
      if (field === undefined) return OK
      return guarded('Delete field', (project) =>
        deleteDefinition(project, { kind: 'field', owner, id: field.id }, options),
      )
    },
    dispose() {
      stopHistory()
      listeners.clear()
    },
  }
}
