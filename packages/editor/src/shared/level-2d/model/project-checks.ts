// What a project file must satisfy beyond its shape: ids that repeat, and references to definitions that are not there.
// Each problem is an `OpenIssue` with its path in the file. Nothing here throws or stops at the first problem.
import type { Definitions, LayerDef, ProjectFile } from './project-types.ts'

/** One thing wrong with a file: a stable `code`, the `path` in the file (`levels[moss-steps].layers[collision].rows[3]`) and a sentence. */
export interface OpenIssue {
  readonly code: string
  readonly path: string
  readonly message: string
}

/** Repeated ids in `items`, each reported at the later one; `pathOf(index)` addresses an item. */
function duplicateIds(
  items: readonly { readonly id: string }[],
  pathOf: (index: number) => string,
  issues: OpenIssue[],
): void {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      issues.push({ code: 'duplicateId', path: pathOf(index), message: `the id "${item.id}" is used twice` })
    }
    seen.add(item.id)
  })
}

function duplicateValues(layers: readonly LayerDef[], issues: OpenIssue[]): void {
  for (const layer of layers) {
    if (layer.kind !== 'intgrid') continue
    const ids = new Set<string>()
    const numbers = new Set<number>()
    layer.values.forEach((value, index) => {
      if (ids.has(value.id) || numbers.has(value.value)) {
        issues.push({
          code: 'duplicateId',
          path: `defs.layers[${layer.id}].values[${index}]`,
          message: `the value ${value.value} "${value.id}" repeats an earlier value or id`,
        })
      }
      ids.add(value.id)
      numbers.add(value.value)
    })
  }
}

function instanceItems(levels: ProjectFile['levels']): { id: string; path: string }[] {
  const items: { id: string; path: string }[] = []
  for (const level of levels) {
    for (const layer of level.layers) {
      if (layer.kind !== 'entities' && layer.kind !== 'objects') continue
      layer.items.forEach((item, index) => {
        items.push({ id: item.id, path: `levels[${level.id}].layers[${layer.def}].items[${index}]` })
      })
    }
  }
  return items
}

export function checkIds(file: ProjectFile, issues: OpenIssue[]): void {
  duplicateIds(file.defs.layers, (index) => `defs.layers[${index}]`, issues)
  duplicateIds(file.defs.tilesets, (index) => `defs.tilesets[${index}]`, issues)
  duplicateIds(file.defs.entities, (index) => `defs.entities[${index}]`, issues)
  duplicateIds(file.worlds, (index) => `worlds[${index}]`, issues)
  duplicateIds(file.levels, (index) => `levels[${index}]`, issues)
  duplicateValues(file.defs.layers, issues)
  const items = instanceItems(file.levels)
  duplicateIds(items, (index) => items[index]?.path ?? '', issues)
}

export function checkDefinitionRefs(defs: Definitions, issues: OpenIssue[]): void {
  const tilesets = new Set(defs.tilesets.map((tileset) => tileset.id))
  const layers = new Map(defs.layers.map((layer) => [layer.id, layer]))
  const needsTileset = (path: string, tileset: string): void => {
    if (!tilesets.has(tileset)) {
      issues.push({ code: 'unknownTileset', path, message: `there is no tileset "${tileset}"` })
    }
  }
  for (const layer of defs.layers) {
    if (layer.kind === 'tiles' || layer.kind === 'auto' || layer.kind === 'objects') {
      needsTileset(`defs.layers[${layer.id}].tileset`, layer.tileset)
    }
    if (layer.kind !== 'auto') continue
    const path = `defs.layers[${layer.id}].source`
    const source = layers.get(layer.source)
    if (source === undefined) {
      issues.push({ code: 'unknownLayer', path, message: `there is no layer "${layer.source}"` })
    } else if (source.kind !== 'intgrid') {
      issues.push({
        code: 'layerKindMismatch',
        path,
        message: `an auto layer reads an IntGrid layer, and "${source.id}" is a ${source.kind} layer`,
      })
    }
  }
  for (const entity of defs.entities) {
    if (entity.tile) needsTileset(`defs.entities[${entity.id}].tile.tileset`, entity.tile.tileset)
  }
}
