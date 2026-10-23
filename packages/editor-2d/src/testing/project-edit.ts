import { emptyLayers } from '../model/level-layers'
import type {
  Definitions,
  EntityInstance,
  LayerInstance,
  Level,
  Placement,
  Project,
  World,
} from '../model/project-types'

// Small immutable edits for tests that need a valid project with exactly one thing wrong. Each returns a new project
// and throws when its target is missing, so a typo in a test fails loudly instead of editing nothing.

export function withDefs(project: Project, edit: (defs: Definitions) => Definitions): Project {
  return { ...project, defs: edit(project.defs) }
}

export function withLevel(project: Project, id: string, edit: (level: Level) => Level): Project {
  if (!project.levels.some((level) => level.id === id)) throw new Error(`no level "${id}"`)
  return { ...project, levels: project.levels.map((level) => (level.id === id ? edit(level) : level)) }
}

export function withLayer(
  project: Project,
  levelId: string,
  def: string,
  edit: (layer: LayerInstance) => LayerInstance,
): Project {
  return withLevel(project, levelId, (level) => {
    if (!level.layers.some((layer) => layer.def === def)) throw new Error(`no layer "${def}" in "${levelId}"`)
    return { ...level, layers: level.layers.map((layer) => (layer.def === def ? edit(layer) : layer)) }
  })
}

export function withWorld(project: Project, id: string, edit: (world: World) => World): Project {
  if (!project.worlds.some((world) => world.id === id)) throw new Error(`no world "${id}"`)
  return { ...project, worlds: project.worlds.map((world) => (world.id === id ? edit(world) : world)) }
}

/** Adds `items` to the end of an entities layer. */
export function withEntities(
  project: Project,
  levelId: string,
  items: readonly EntityInstance[],
  layerDef = 'entities',
): Project {
  return withLayer(project, levelId, layerDef, (layer) => {
    if (layer.kind !== 'entities') throw new Error(`"${layerDef}" is not an entities layer`)
    return { ...layer, items: [...layer.items, ...items] }
  })
}

/** An entity instance with a readable id; `fields` default to none. */
export function entity(
  id: string,
  def: string,
  x: number,
  y: number,
  fields: EntityInstance['fields'] = {},
): EntityInstance {
  return { id, def, x, y, fields }
}

/**
 * Adds an empty level of the first level's size to the project, placed in `world` at `at`. The new level has an
 * instance of every layer definition and no content.
 */
export function withNewLevel(
  project: Project,
  id: string,
  at: Pick<Placement, 'x' | 'y'> & { depth?: number },
  world: string = project.worlds[0]?.id ?? 'main',
): Project {
  const size = project.levels[0]?.size
  if (size === undefined) throw new Error('the project has no level to copy a size from')
  const level: Level = {
    id,
    name: id,
    size,
    background: { color: '#000000', mode: 'fit' },
    fields: {},
    layers: emptyLayers(project.defs.layers, size),
  }
  const placed = withWorld(project, world, (found) => ({
    ...found,
    placements: [...found.placements, { level: id, x: at.x, y: at.y, depth: at.depth ?? 0 }],
  }))
  return { ...placed, levels: [...placed.levels, level] }
}
