import { type CellKind, decodeRows, encodeRows } from './cells-codec'
import type { Grid } from './grid'
import { layerCells } from './level-layers'
import { projectFileSchema } from './project.schema'
import type {
  Definitions,
  LayerDef,
  LayerInstance,
  LayerInstanceFile,
  Level,
  Project,
  ProjectFile,
  Size,
} from './project-types'

// Between the file shape and the model (2D editor spec §6.1, ED2D.1 decisions 1 and 4). `decodeProject` turns a file
// the schema accepted into a `Project`, and refuses what decoding and every later lookup depend on. Values that fit
// the shape but not the world (a tile index past its tileset, a ref to nothing, an instance of an unknown entity) open
// and become Checks (ED2D.3). `encodeProject` is its inverse; `printProject` is the canonical text.

/** One thing wrong with a file: a stable `code`, the `path` in the file (`levels[moss-steps].layers[collision].rows[3]`) and a sentence. */
export interface OpenIssue {
  readonly code: string
  readonly path: string
  readonly message: string
}

export type DecodeResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly issues: OpenIssue[] }

/** A layer is at most this many cells on a side (ED2D-D13), checked before a grid is allocated. */
export const MAX_LAYER_CELLS = 1024

// -- decoding ----------------------------------------------------------------------------------------------------

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

function checkIds(file: ProjectFile, issues: OpenIssue[]): void {
  duplicateIds(file.defs.layers, (index) => `defs.layers[${index}]`, issues)
  duplicateIds(file.defs.tilesets, (index) => `defs.tilesets[${index}]`, issues)
  duplicateIds(file.defs.entities, (index) => `defs.entities[${index}]`, issues)
  duplicateIds(file.worlds, (index) => `worlds[${index}]`, issues)
  duplicateIds(file.levels, (index) => `levels[${index}]`, issues)
  duplicateValues(file.defs.layers, issues)
  const items = instanceItems(file.levels)
  duplicateIds(items, (index) => items[index]?.path ?? '', issues)
}

function checkDefinitionRefs(defs: Definitions, issues: OpenIssue[]): void {
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

/** The grid of a layer's row strings, or an issue per row that does not decode. */
function decodeGrid(
  rows: readonly string[],
  kind: CellKind,
  size: Size,
  grid: number,
  path: string,
  field: 'rows' | 'overrides',
  issues: OpenIssue[],
): Grid | undefined {
  const { cols, rows: rowCount } = layerCells(size, grid)
  if (cols > MAX_LAYER_CELLS || rowCount > MAX_LAYER_CELLS) {
    issues.push({
      code: 'layerTooLarge',
      path,
      message: `${cols} × ${rowCount} cells; a layer is at most ${MAX_LAYER_CELLS} cells on a side`,
    })
    return undefined
  }
  const decoded = decodeRows(rows, kind, cols, rowCount)
  if (decoded.ok) return decoded.grid
  for (const problem of decoded.problems) {
    // A wrong row count is reported past the last row, so it belongs to the array and not to a row.
    const where = problem.row >= rows.length ? `${path}.${field}` : `${path}.${field}[${problem.row}]`
    issues.push({ code: 'cellInvalid', path: where, message: problem.message })
  }
  return undefined
}

function decodeLayer(
  layer: LayerInstanceFile,
  def: LayerDef,
  level: ProjectFile['levels'][number],
  issues: OpenIssue[],
): LayerInstance | undefined {
  const path = `levels[${level.id}].layers[${layer.def}]`
  if (def.kind === 'tiles' && layer.kind === 'tiles') {
    const cells = decodeGrid(layer.rows, 'tile', level.size, def.grid, path, 'rows', issues)
    return cells && { def: layer.def, kind: 'tiles', cells }
  }
  if (def.kind === 'intgrid' && layer.kind === 'intgrid') {
    const cells = decodeGrid(layer.rows, 'int', level.size, def.grid, path, 'rows', issues)
    return cells && { def: layer.def, kind: 'intgrid', cells }
  }
  if (def.kind === 'auto' && layer.kind === 'auto') {
    const overrides = decodeGrid(layer.overrides, 'tile', level.size, def.grid, path, 'overrides', issues)
    return overrides && { def: layer.def, kind: 'auto', seed: layer.seed, overrides }
  }
  // Items are the same shape in the file and in the model.
  if (def.kind === 'entities' && layer.kind === 'entities') return layer
  if (def.kind === 'objects' && layer.kind === 'objects') return layer
  issues.push({
    code: 'layerKindMismatch',
    path,
    message: `the layer is a ${layer.kind} layer and its definition is a ${def.kind} layer`,
  })
  return undefined
}

function decodeLevel(
  level: ProjectFile['levels'][number],
  defs: ReadonlyMap<string, LayerDef>,
  order: readonly string[],
  issues: OpenIssue[],
): Level | undefined {
  const before = issues.length
  const layers: LayerInstance[] = []
  let unknownLayer = false
  for (const layer of level.layers) {
    const def = defs.get(layer.def)
    if (def === undefined) {
      unknownLayer = true
      issues.push({
        code: 'unknownLayer',
        path: `levels[${level.id}].layers[${layer.def}]`,
        message: `there is no layer definition "${layer.def}"`,
      })
      continue
    }
    const decoded = decodeLayer(layer, def, level, issues)
    if (decoded) layers.push(decoded)
  }
  // Every level holds one instance of every definition, in the definitions' order (LDtk's rule), so a definition
  // change never leaves a level half-shaped. An unknown layer already explains a mismatch.
  const actual = level.layers.map((layer) => layer.def)
  if (!unknownLayer && (actual.length !== order.length || actual.some((id, index) => id !== order[index]))) {
    issues.push({
      code: 'layerMismatch',
      path: `levels[${level.id}].layers`,
      message: `expected the layers ${order.join(', ')}, found ${actual.join(', ')}`,
    })
  }
  return issues.length === before ? { ...level, layers } : undefined
}

/** The model of a file that passed `projectFileSchema`, or every problem found. */
export function decodeProject(file: ProjectFile): DecodeResult {
  const issues: OpenIssue[] = []
  checkIds(file, issues)
  checkDefinitionRefs(file.defs, issues)
  const defs = new Map(file.defs.layers.map((layer) => [layer.id, layer]))
  const order = file.defs.layers.map((layer) => layer.id)
  const levels: Level[] = []
  for (const level of file.levels) {
    const decoded = decodeLevel(level, defs, order, issues)
    if (decoded) levels.push(decoded)
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, project: { ...file, levels } }
}

// -- encoding ----------------------------------------------------------------------------------------------------

function encodeLayer(layer: LayerInstance): LayerInstanceFile {
  switch (layer.kind) {
    case 'tiles':
      return { def: layer.def, kind: 'tiles', rows: encodeRows(layer.cells, 'tile') }
    case 'intgrid':
      return { def: layer.def, kind: 'intgrid', rows: encodeRows(layer.cells, 'int') }
    case 'auto':
      return {
        def: layer.def,
        kind: 'auto',
        seed: layer.seed,
        overrides: encodeRows(layer.overrides, 'tile'),
      }
    case 'entities':
    case 'objects':
      return layer
  }
}

/** The file shape of a project: each grid as its row strings. The inverse of `decodeProject`. */
export function encodeProject(project: Project): ProjectFile {
  return {
    ...project,
    levels: project.levels.map((level) => ({ ...level, layers: level.layers.map(encodeLayer) })),
  }
}

// -- the canonical text ------------------------------------------------------------------------------------------

function byId<T extends { readonly id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function sortedKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

function canonicalLayer(layer: LayerInstanceFile): LayerInstanceFile {
  if (layer.kind !== 'entities') return layer
  return { ...layer, items: layer.items.map((item) => ({ ...item, fields: sortedKeys(item.fields) })) }
}

/**
 * Orders what has no meaning in its order: definitions, worlds and levels by id, and the keys of field values. An
 * order that means something (layer definitions, a level's layers, items, placements, rules) is kept. Object keys are
 * already in schema order, because the file went through the schema's parse.
 */
function canonical(file: ProjectFile): ProjectFile {
  return {
    ...file,
    defs: { ...file.defs, tilesets: byId(file.defs.tilesets), entities: byId(file.defs.entities) },
    worlds: byId(file.worlds),
    levels: byId(file.levels).map((level) => ({
      ...level,
      fields: sortedKeys(level.fields),
      layers: level.layers.map(canonicalLayer),
    })),
  }
}

/**
 * The text of `*.af2d.json`: UTF-8, two-space JSON, keys in schema order, a final newline, and one line per grid row
 * so a git diff shows the rows that changed. Equal projects print byte-equal, and opening a canonical file and printing
 * it again changes nothing (G-b). Throws when the project is not one the schema would open: a command that builds
 * such a project is the bug, and a file that could not be opened again must not be written.
 */
export function printProject(project: Project): string {
  const parsed = projectFileSchema.safeParse(encodeProject(project))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`cannot print an invalid project: ${issue?.path.join('.')}: ${issue?.message}`)
  }
  return `${JSON.stringify(canonical(parsed.data), null, 2)}\n`
}
