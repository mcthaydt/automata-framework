import { checkEntityDef, ENTITY_ID, type FieldDef } from '@mcthaydt/automata-editor-kit/fields'
import { entityDef2DSchema } from '../project.schema'
import type { EntityDef2D, Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import { checkShape, tilesetOf } from './def-lookup'
import { entityDefOf } from './field-owner'

// Entity definition edits (2D editor spec §5.5, §8 flow 5). A definition is checked with the kit's `checkEntityDef`
// (its messages are the ones a person reads), then with the file schema, then against the project (a new id, a tile
// its tileset has). What changes the meaning of existing instances, its fields, is `field-edits.ts`; deleting one is
// `deleteDefinition`.

/**
 * What can change on a definition without touching an instance. `undefined` clears an optional property. Making a
 * definition `single` keeps every instance; a level that then holds two is the Checks' `singleExceeded`.
 */
export type EntityDefPatch = Partial<
  Pick<EntityDef2D, 'label' | 'color' | 'single' | 'shape' | 'size' | 'pivot' | 'tile' | 'tags' | 'min'>
>

function checkDefinition(project: Project, def: EntityDef2D): void {
  const problem = checkEntityDef(def)[0]
  if (problem !== undefined) throw new RangeError(problem.message)
  checkShape(entityDef2DSchema, def, `entity "${def.id}"`)
  if (def.tile !== undefined) {
    const { count } = tilesetTiles(tilesetOf(project, def.tile.tileset))
    if (def.tile.index >= count)
      throw new RangeError(`tileset "${def.tile.tileset}" has tiles 0 to ${count - 1}, not ${def.tile.index}`)
  }
}

export function addEntityDef(project: Project, def: EntityDef2D): Project {
  checkDefinition(project, def)
  if (project.defs.entities.some((candidate) => candidate.id === def.id))
    throw new RangeError(`entity id "${def.id}" is already used`)
  return { ...project, defs: { ...project.defs, entities: [...project.defs.entities, def] } }
}

function replaceEntityDef(project: Project, old: EntityDef2D, next: EntityDef2D): Project {
  return {
    ...project,
    defs: {
      ...project.defs,
      entities: project.defs.entities.map((candidate) => (candidate === old ? next : candidate)),
    },
  }
}

export function editEntityDef(project: Project, id: string, patch: EntityDefPatch): Project {
  const def = entityDefOf(project, id)
  const merged: Record<string, unknown> = { ...def, ...patch }
  for (const key of Object.keys(patch)) if (merged[key] === undefined) delete merged[key]
  // The schema check below decides the shape; the record only drops the keys the patch cleared.
  const next = merged as unknown as EntityDef2D
  if (JSON.stringify(next) === JSON.stringify(def)) return project
  checkDefinition(project, next)
  return replaceEntityDef(project, def, next)
}

/** A field whose `to` names `from` names `to` instead, in the same place. */
function renameTarget(field: FieldDef, from: string, to: string): FieldDef {
  if (field.to?.includes(from) !== true) return field
  return { ...field, to: field.to.map((entry) => (entry === from ? to : entry)) }
}

/**
 * Changes a definition's id. Every instance of it, and every ref field (of any entity or of the levels) that may point
 * at it, follow in the same step, so no ref stops resolving and no instance is orphaned.
 */
export function renameEntityDef(project: Project, from: string, to: string): Project {
  const def = entityDefOf(project, from)
  if (from === to) return project
  if (!ENTITY_ID.test(to)) throw new RangeError(`"${to}" is not an entity id`)
  if (project.defs.entities.some((candidate) => candidate.id === to))
    throw new RangeError(`entity id "${to}" is already used`)
  const retarget = (fields: readonly FieldDef[]): FieldDef[] =>
    fields.map((field) => renameTarget(field, from, to))
  return {
    ...project,
    defs: {
      ...project.defs,
      entities: project.defs.entities.map((candidate) => ({
        ...candidate,
        ...(candidate === def ? { id: to } : {}),
        fields: retarget(candidate.fields),
      })),
      levelFields: retarget(project.defs.levelFields),
    },
    levels: project.levels.map((level) => ({
      ...level,
      layers: level.layers.map((layer) =>
        layer.kind === 'entities'
          ? {
              ...layer,
              items: layer.items.map((item) => (item.def === from ? { ...item, def: to } : item)),
            }
          : layer,
      ),
    })),
  }
}
