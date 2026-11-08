import { unpackTile } from '../../../model/cells-codec'
import type { Grid } from '../../../model/grid'
import type { LayerDef, LayerInstance, Level, Project, World } from '../../../model/project-types'
import { tilesetTiles } from '../../../model/tileset-grid'
import type { Diagnostic } from '../../profile'
import { agree, diagnostic, itemPath, layerPath, levelPath, plural } from './diagnostics'

// Checks of the levels and the worlds that place them (2D editor spec §9, "Levels" and "Editor-only"). Everything here
// concerns what is in a level; what its entities' fields say is `entities.ts`, and what they point at is `links.ts`.

interface Cell {
  readonly x: number
  readonly y: number
}

/** The cells that satisfy `bad`, first by row then by column, so "first at" is the one a person finds first. */
function badCells(grid: Grid, bad: (value: number) => boolean): Cell[] {
  return grid
    .nonEmpty()
    .filter(({ value }) => bad(value))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

const firstAt = (cells: readonly Cell[]): string => `first at ${cells[0]?.x}, ${cells[0]?.y}`

/** Tiles of a tiles layer or the manual tiles of an auto layer that name a tile the tileset does not have. */
function tileCellsBeyond(grid: Grid, count: number, path: string, tilesetId: string): Diagnostic[] {
  const bad = badCells(grid, (value) => (unpackTile(value)?.tile ?? 0) >= count)
  if (bad.length === 0) return []
  return [
    diagnostic(
      'error',
      'tileOutOfRange',
      path,
      `${plural(bad.length, 'cell')} ${agree(bad.length, 'uses', 'use')} tiles beyond the ${count} tiles of tileset "${tilesetId}" (${firstAt(bad)}).`,
      'remove',
    ),
  ]
}

function layerChecks(project: Project, level: Level, def: LayerDef, layer: LayerInstance): Diagnostic[] {
  const path = layerPath(level.id, def.id)
  const countOf = (tilesetId: string): number => {
    const set = project.defs.tilesets.find((candidate) => candidate.id === tilesetId)
    return set === undefined ? Number.POSITIVE_INFINITY : tilesetTiles(set).count
  }
  switch (layer.kind) {
    case 'tiles':
      return def.kind === 'tiles' ? tileCellsBeyond(layer.cells, countOf(def.tileset), path, def.tileset) : []
    case 'auto':
      return def.kind === 'auto'
        ? tileCellsBeyond(layer.overrides, countOf(def.tileset), path, def.tileset)
        : []
    case 'intgrid': {
      if (def.kind !== 'intgrid') return []
      const defined = new Set(def.values.map((value) => value.value))
      const bad = badCells(layer.cells, (value) => !defined.has(value))
      if (bad.length === 0) return []
      const values = [...new Set(bad.map((cell) => layer.cells.get(cell.x, cell.y)))].sort((a, b) => a - b)
      return [
        diagnostic(
          'error',
          'cellValueUnknown',
          path,
          `${plural(bad.length, 'cell')} ${agree(bad.length, 'holds', 'hold')} a value the layer does not define (${values.join(', ')}; ${firstAt(bad)}).`,
          'remove',
        ),
      ]
    }
    case 'objects': {
      const found: Diagnostic[] = []
      if (def.kind === 'objects') {
        const count = countOf(def.tileset)
        const beyond = layer.items.filter((item) => item.tile >= count)
        if (beyond.length > 0) {
          found.push(
            diagnostic(
              'error',
              'tileOutOfRange',
              path,
              `${plural(beyond.length, 'object')} ${agree(beyond.length, 'uses', 'use')} tiles beyond the ${count} tiles of tileset "${def.tileset}".`,
              'remove',
            ),
          )
        }
      }
      for (const item of layer.items) found.push(...boundsCheck(level, def.id, item))
      return found
    }
    case 'entities': {
      const found: Diagnostic[] = []
      for (const item of layer.items) {
        if (!project.defs.entities.some((candidate) => candidate.id === item.def)) {
          found.push(
            diagnostic(
              'error',
              'unknownEntityDef',
              itemPath(level.id, def.id, item.id),
              `There is no entity definition "${item.def}".`,
              'delete',
            ),
          )
        }
        found.push(...boundsCheck(level, def.id, item))
      }
      return found
    }
  }
}

/** An entity or object is out of bounds when its anchor is outside the closed rectangle from 0 to the level's size. */
function boundsCheck(
  level: Level,
  layerDef: string,
  item: { id: string; x: number; y: number },
): Diagnostic[] {
  const inside = item.x >= 0 && item.y >= 0 && item.x <= level.size.w && item.y <= level.size.h
  return inside
    ? []
    : [
        diagnostic(
          'warning',
          'entityOutOfBounds',
          itemPath(level.id, layerDef, item.id),
          `Placed at ${item.x}, ${item.y}, outside the ${level.size.w} × ${level.size.h} level.`,
          'move-inside',
        ),
      ]
}

const isEmpty = (layer: LayerInstance): boolean => {
  switch (layer.kind) {
    case 'tiles':
    case 'intgrid':
      return layer.cells.chunkCount === 0
    case 'auto':
      return layer.overrides.chunkCount === 0
    case 'entities':
    case 'objects':
      return layer.items.length === 0
  }
}

function levelChecks(project: Project, level: Level, placed: number): Diagnostic[] {
  const found: Diagnostic[] = []
  if (placed === 0) {
    found.push(
      diagnostic(
        'error',
        'levelOutsideWorld',
        levelPath(level.id),
        `Level "${level.name}" is not placed in any world.`,
      ),
    )
  } else if (placed > 1) {
    const times = placed === 2 ? 'twice' : `${placed} times`
    found.push(
      diagnostic(
        'error',
        'levelOutsideWorld',
        levelPath(level.id),
        `Level "${level.name}" is placed ${times}; a level belongs to exactly one place in one world.`,
      ),
    )
  }
  for (const layer of level.layers) {
    const def = project.defs.layers.find((candidate) => candidate.id === layer.def)
    if (def !== undefined) found.push(...layerChecks(project, level, def, layer))
  }
  if (level.layers.every(isEmpty)) {
    found.push(
      diagnostic('info', 'emptyLevel', levelPath(level.id), `Level "${level.name}" has nothing in it yet.`),
    )
  }
  return found
}

function overlaps(project: Project, world: World): Diagnostic[] {
  if (world.layout !== 'free') return []
  const sized = world.placements.flatMap((placement) => {
    const level = project.levels.find((candidate) => candidate.id === placement.level)
    return level === undefined ? [] : [{ placement, size: level.size }]
  })
  const found: Diagnostic[] = []
  sized.forEach((a, index) => {
    for (const b of sized.slice(index + 1)) {
      const sameDepth = a.placement.depth === b.placement.depth
      const crossX = a.placement.x < b.placement.x + b.size.w && b.placement.x < a.placement.x + a.size.w
      const crossY = a.placement.y < b.placement.y + b.size.h && b.placement.y < a.placement.y + a.size.h
      if (sameDepth && crossX && crossY) {
        found.push(
          diagnostic(
            'warning',
            'levelsOverlap',
            `worlds[${world.id}]`,
            `Levels "${a.placement.level}" and "${b.placement.level}" overlap at depth ${a.placement.depth}.`,
          ),
        )
      }
    }
  })
  return found
}

export function levelChecksOf(project: Project): Diagnostic[] {
  const found: Diagnostic[] = []
  const known = new Set(project.levels.map((level) => level.id))
  const placements = new Map<string, number>()
  for (const world of project.worlds) {
    for (const placement of world.placements) {
      if (known.has(placement.level)) {
        placements.set(placement.level, (placements.get(placement.level) ?? 0) + 1)
      } else {
        found.push(
          diagnostic(
            'error',
            'placementUnknownLevel',
            `worlds[${world.id}].placements[${placement.level}]`,
            `World "${world.id}" places level "${placement.level}", which does not exist.`,
          ),
        )
      }
    }
    found.push(...overlaps(project, world))
  }
  for (const level of project.levels)
    found.push(...levelChecks(project, level, placements.get(level.id) ?? 0))
  return found
}
