// The definitions editor's controller (ED3D.13b; ED3D spec §4.7, §5.4, ED3-r): the level's entity definitions, with each
// one's instance count, and its materials table, as rows the sheet shows; and every change as one undo step through the
// model's `def.*` and `material.*` edits. A change answers `undefined` when it was made and the model's own sentence when
// it was refused (and nothing changed). A format whose definitions or materials the game fixes has no rows
// for them, and `fixed` says so.

import type { AfMaterial, AfSector } from '@automata/3d/level'
import type { FieldDef } from '@automata/editor/kit/fields'
import type { ThingDef, ThingShape } from '../entities/thing-def.schema'
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
  setDefinitionField,
} from '../model/definition-edits'
import type { Edit } from '../model/edit'
import type { LevelEditor } from '../model/level-editor'
import {
  addMaterial,
  removeMaterial,
  renameMaterial,
  setMaterial,
} from '../profile/af-sector/af-material-edits'

export interface DefinitionRow {
  readonly id: string
  readonly label: string
  readonly shape: ThingShape
  readonly single: boolean
  /** How many things in the level are of it. */
  readonly instances: number
  readonly fields: readonly FieldDef[]
}

export interface MaterialRow {
  readonly id: string
  readonly category: string
  readonly label: string | undefined
  readonly wallOnly: boolean
}

export interface DefinitionsView {
  /** `undefined` when the format fixes its definitions. */
  readonly definitions: readonly DefinitionRow[] | undefined
  /** `undefined` when the materials are not the file's own. */
  readonly materials: readonly MaterialRow[] | undefined
  /** Why there is nothing to edit, when there is not. */
  readonly fixed: string | undefined
}

export interface NewDefinition {
  readonly id: string
  readonly shape: ThingShape
  readonly label?: string | undefined
}

export interface DefinitionsController {
  readonly view: DefinitionsView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  addDefinition(definition: NewDefinition): string | undefined
  renameDefinition(id: string, to: string): string | undefined
  removeDefinition(id: string): string | undefined
  addField(def: string, field: FieldDef): string | undefined
  /** Replaces the field `id` of `def` (its type, bounds, options, even its id). */
  changeField(def: string, id: string, field: FieldDef): string | undefined
  removeField(def: string, id: string): string | undefined
  addMaterial(id: string, material: AfMaterial): string | undefined
  changeMaterial(id: string, material: AfMaterial): string | undefined
  renameMaterial(id: string, to: string): string | undefined
  removeMaterial(id: string): string | undefined
  dispose(): void
}

const FIXED = 'This level’s definitions and materials are fixed by its format.'

export function createDefinitionsController<D>(editor: LevelEditor<D>): DefinitionsController {
  const listeners = new Set<() => void>()

  const materialsOf = (): readonly MaterialRow[] | undefined => {
    if (editor.profile.id !== 'af-sector') return undefined
    const table = (editor.level as unknown as AfSector).materials ?? {}
    return Object.entries(table).map(([id, material]) => ({
      id,
      category: material.category,
      label: material.label,
      wallOnly: material.wallOnly === true,
    }))
  }

  const definitionsOf = (): readonly DefinitionRow[] | undefined => {
    if (editor.profile.definitions === undefined) return undefined
    const kit = editor.profile.entities(editor.level)
    return kit.definitions.map((definition: ThingDef) => ({
      id: definition.id,
      label: definition.label ?? definition.id,
      shape: definition.shape,
      single: definition.single === true,
      instances: kit.things.filter((thing) => thing.def === definition.id).length,
      fields: definition.fields,
    }))
  }

  const read = (): DefinitionsView => {
    const definitions = definitionsOf()
    const materials = materialsOf()
    return {
      definitions,
      materials,
      fixed: definitions === undefined && materials === undefined ? FIXED : undefined,
    }
  }

  let view = read()
  const refresh = (): void => {
    view = read()
    for (const run of [...listeners]) run()
  }
  const stop = editor.history.subscribe(refresh)

  /** Runs an edit as one undo step; answers the model's sentence when it is refused. */
  const run = (edit: Edit<D>): string | undefined => {
    const result = editor.run(edit)
    return result.ok ? undefined : result.reason
  }
  /** The material edits are written over an `af-sector` level; they are only offered, so only run, on one. */
  const runMaterial = (edit: Edit<AfSector>): string | undefined =>
    editor.profile.id === 'af-sector' ? run(edit as unknown as Edit<D>) : 'this level has no materials table'

  return {
    get view() {
      return view
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    addDefinition: ({ id, shape, label }) =>
      run(
        addDefinition<D>({
          definition: { id, shape, fields: [], ...(label === undefined ? {} : { label }) },
        }),
      ),
    renameDefinition: (id, to) => run(renameDefinition<D>({ def: id, to })),
    removeDefinition: (id) => run(removeDefinition<D>({ def: id })),
    addField: (def, field) => run(setDefinitionField<D>({ def, value: field })),
    changeField: (def, id, field) => run(setDefinitionField<D>({ def, field: id, value: field })),
    removeField: (def, id) => run(setDefinitionField<D>({ def, field: id, value: null })),
    addMaterial: (id, material) => runMaterial(addMaterial({ id, material })),
    changeMaterial: (id, material) => runMaterial(setMaterial({ id, material })),
    renameMaterial: (id, to) => runMaterial(renameMaterial({ id, to })),
    removeMaterial: (id) => runMaterial(removeMaterial({ id })),
    dispose() {
      stop()
      listeners.clear()
    },
  }
}
