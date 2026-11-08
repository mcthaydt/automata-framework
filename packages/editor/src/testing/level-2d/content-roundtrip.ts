import {
  type ContentLevel,
  levelContentSchema,
  projectContentSchema,
  worldContentSchema,
} from '@mcthaydt/automata-content/level-2d'
import { parse } from 'smol-toml'
import { decodeRows, packTile } from '../../shared/level-2d/model/cells-codec'
import { Grid } from '../../shared/level-2d/model/grid'
import type { LayerInstance, Level, Project } from '../../shared/level-2d/model/project-types'
import { exportContent } from '../../shared/level-2d/profiles/level-project/content-export'
import { applyOverrides, autoTiles } from '../../shared/level-2d/tiles/autotile/auto-tiles'
import { compileRules } from '../../shared/level-2d/tiles/autotile/match'

// Checks that the AF content export says what the editor holds (acceptance G-i): every file validates against its
// schema, the rows of tile and IntGrid layers decode to the editor's grids, an auto layer's stack equals the engine's
// own result, and items and worlds carry over. Returns what differs, so a test names every mismatch at once.

/** The editor's own result for an auto layer as one grid per stack depth (depth 0 first). */
export function engineStack(project: Project, level: Level, def: string): Grid[] {
  const layerDef = project.defs.layers.find((candidate) => candidate.id === def)
  const auto = level.layers.find((layer) => layer.def === def)
  if (layerDef?.kind !== 'auto' || auto?.kind !== 'auto') throw new Error(`"${def}" is not an auto layer`)
  const source = level.layers.find((layer) => layer.def === layerDef.source)
  if (source?.kind !== 'intgrid') return []
  const result = applyOverrides(
    autoTiles(source.cells, compileRules(layerDef.groups), auto.seed),
    auto.overrides,
  )
  let depth = 0
  for (const stack of result.stacks.values()) depth = Math.max(depth, stack.length)
  return Array.from({ length: depth }, (_, index) =>
    Grid.empty(result.cols, result.rows).edit((cells) => {
      for (const [key, stack] of result.stacks) {
        const tile = stack[index]
        if (tile) {
          cells.set(
            key % result.cols,
            Math.floor(key / result.cols),
            packTile(tile.tile, tile.flipX, tile.flipY),
          )
        }
      }
    }),
  )
}

/** JSON with object keys sorted, so two values that differ only in key order (TOML prints plain keys before tables) are equal. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  )
}

function layerMismatches(
  project: Project,
  level: Level,
  written: ContentLevel['layers'][number],
  original: LayerInstance,
): string[] {
  const where = `${level.id}/${written.def}`
  switch (written.kind) {
    case 'tiles':
    case 'intgrid': {
      if (original.kind !== written.kind)
        return [`${where}: kind ${original.kind} was written as ${written.kind}`]
      const decoded = decodeRows(
        written.rows,
        written.kind === 'tiles' ? 'tile' : 'int',
        original.cells.cols,
        original.cells.rows,
      )
      if (!decoded.ok) return [`${where}: rows do not decode (${decoded.problems[0]?.message})`]
      return decoded.grid.equals(original.cells)
        ? []
        : [`${where}: decoded rows differ from the editor's grid`]
    }
    case 'auto': {
      const expected = engineStack(project, level, written.def)
      if (written.stack.length !== expected.length) {
        return [`${where}: ${written.stack.length} stack grids written, the engine has ${expected.length}`]
      }
      const cols = expected[0]?.cols ?? 0
      const rows = expected[0]?.rows ?? 0
      return written.stack.flatMap((depth, index) => {
        const decoded = decodeRows(depth.rows, 'tile', cols, rows)
        if (!decoded.ok) return [`${where}: stack ${index} does not decode`]
        return decoded.grid.equals(expected[index] as Grid)
          ? []
          : [`${where}: stack ${index} differs from the engine`]
      })
    }
    case 'entities':
    case 'objects': {
      if (original.kind !== written.kind)
        return [`${where}: kind ${original.kind} was written as ${written.kind}`]
      const same = stable(written.items) === stable(original.items)
      return same ? [] : [`${where}: items differ from the editor's`]
    }
  }
}

export function contentMismatches(project: Project): string[] {
  const found: string[] = []
  for (const file of exportContent(project)) {
    const data = parse(file.contents)
    if (file.path === 'project.toml') {
      const result = projectContentSchema.safeParse(data)
      if (!result.success) found.push(`${file.path}: ${result.error.issues[0]?.message}`)
    } else if (file.path === 'world.toml') {
      const result = worldContentSchema.safeParse(data)
      if (!result.success) found.push(`${file.path}: ${result.error.issues[0]?.message}`)
      else if (result.data.worlds.length !== project.worlds.length)
        found.push('world.toml: world count differs')
    } else {
      const result = levelContentSchema.safeParse(data)
      if (!result.success) {
        found.push(`${file.path}: ${result.error.issues[0]?.message}`)
        continue
      }
      const level = project.levels.find((candidate) => candidate.id === result.data.id)
      if (level === undefined) {
        found.push(`${file.path}: no such level`)
        continue
      }
      if (result.data.layers.length !== level.layers.length) found.push(`${file.path}: layer count differs`)
      result.data.layers.forEach((written, index) => {
        const original = level.layers[index]
        if (original === undefined || original.def !== written.def) {
          found.push(`${file.path}: layer ${index} is not ${original?.def}`)
        } else {
          found.push(...layerMismatches(project, level, written, original))
        }
      })
    }
  }
  return found
}
