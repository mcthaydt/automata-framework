import { describe, expect, it } from 'vitest'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { blankTemplate } from '#src/shared/level-2d/profiles/level-project/templates/blank.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import type { Diagnostic } from '#src/shared/level-2d/profiles/profile.ts'
import {
  entity,
  withEntities,
  withLayer,
  withNewLevel,
  withWorld,
} from '#src/testing/level-2d/project-edit.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const only = (project: Project, code: string): Diagnostic[] =>
  checkProject(project, {}).filter((d) => d.code === code)

describe('level checks', () => {
  describe('tileOutOfRange', () => {
    it('is one error for the tiles of a layer beyond its tileset, with the count and the first place', () => {
      const project = withLayer(platformer(), 'level-1', 'decor', (layer) =>
        layer.kind === 'tiles'
          ? {
              ...layer,
              cells: layer.cells.set(4, 7, packTile(99, false, false)).set(5, 7, packTile(64, true, false)),
            }
          : layer,
      )
      const found = only(project, 'tileOutOfRange')
      expect(found).toEqual([
        {
          severity: 'error',
          code: 'tileOutOfRange',
          path: 'levels[level-1].layers[decor]',
          message: expect.stringMatching(/2 cells use tiles.*64 tiles.*4, 7/),
          fix: 'remove',
        },
      ])
    })

    it('agrees the verb with one cell', () => {
      const project = withLayer(platformer(), 'level-1', 'decor', (layer) =>
        layer.kind === 'tiles'
          ? { ...layer, cells: layer.cells.set(4, 7, packTile(99, false, false)) }
          : layer,
      )
      expect(only(project, 'tileOutOfRange').map((d) => d.message)).toEqual([
        expect.stringMatching(/^1 cell uses tiles beyond/),
      ])
    })

    it('accepts the last tile of the set', () => {
      const project = withLayer(platformer(), 'level-1', 'decor', (layer) =>
        layer.kind === 'tiles'
          ? { ...layer, cells: layer.cells.set(0, 0, packTile(63, false, false)) }
          : layer,
      )
      expect(only(project, 'tileOutOfRange')).toEqual([])
    })

    it('covers the manual tiles of an auto layer', () => {
      const project = withLayer(platformer(), 'level-1', 'ground', (layer) =>
        layer.kind === 'auto'
          ? { ...layer, overrides: layer.overrides.set(1, 1, packTile(70, false, false)) }
          : layer,
      )
      expect(only(project, 'tileOutOfRange').map((d) => d.path)).toEqual(['levels[level-1].layers[ground]'])
    })

    it('covers the tiles of placed objects', () => {
      const rpg = topdownRpgTemplate.create(counterIds())
      const project = withLayer(rpg, 'map-1', 'props', (layer) =>
        layer.kind === 'objects'
          ? { ...layer, items: [{ id: 'tree-1', tile: 40, x: 8, y: 8, flipX: false, flipY: false }] }
          : layer,
      )
      const found = only(project, 'tileOutOfRange')
      expect(found).toEqual([
        expect.objectContaining({
          path: 'levels[map-1].layers[props]',
          message: expect.stringMatching(/^1 object uses tiles beyond/),
          fix: 'remove',
        }),
      ])
    })
  })

  describe('cellValueUnknown', () => {
    it('is an error for an IntGrid cell with a value the layer does not define', () => {
      const project = withLayer(platformer(), 'level-1', 'collision', (layer) =>
        layer.kind === 'intgrid' ? { ...layer, cells: layer.cells.set(3, 3, 9) } : layer,
      )
      expect(only(project, 'cellValueUnknown')).toEqual([
        {
          severity: 'error',
          code: 'cellValueUnknown',
          path: 'levels[level-1].layers[collision]',
          message: expect.stringMatching(/^1 cell holds a value.*9/),
          fix: 'remove',
        },
      ])
    })
  })

  describe('unknownEntityDef', () => {
    it('is an error for an instance whose definition is gone', () => {
      const project = withEntities(platformer(), 'level-1', [entity('ghost-1', 'ghost', 10, 10)])
      expect(only(project, 'unknownEntityDef')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'levels[level-1].layers[entities].items[ghost-1]',
          message: expect.stringContaining('ghost'),
        }),
      ])
    })
  })

  describe('entityOutOfBounds', () => {
    it('warns when the anchor is outside the level, with the move-inside fix', () => {
      const project = withEntities(platformer(), 'level-1', [
        entity('coin-1', 'coin', 600, 40),
        entity('coin-2', 'coin', 20, -1),
      ])
      expect(only(project, 'entityOutOfBounds')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'levels[level-1].layers[entities].items[coin-1]',
          fix: 'move-inside',
        }),
        expect.objectContaining({ path: 'levels[level-1].layers[entities].items[coin-2]' }),
      ])
    })

    it('allows the edges: a level is the closed rectangle from 0 to its size', () => {
      const project = withEntities(platformer(), 'level-1', [
        entity('coin-1', 'coin', 512, 288),
        entity('coin-2', 'coin', 0, 0),
      ])
      expect(only(project, 'entityOutOfBounds')).toEqual([])
    })

    it('covers objects too', () => {
      const rpg = topdownRpgTemplate.create(counterIds())
      const project = withLayer(rpg, 'map-1', 'props', (layer) =>
        layer.kind === 'objects'
          ? { ...layer, items: [{ id: 'tree-1', tile: 26, x: 999, y: 8, flipX: false, flipY: false }] }
          : layer,
      )
      expect(only(project, 'entityOutOfBounds').map((d) => d.path)).toEqual([
        'levels[map-1].layers[props].items[tree-1]',
      ])
    })
  })

  describe('worlds', () => {
    it('levelOutsideWorld: a level no world places', () => {
      const project = withWorld(platformer(), 'main', (world) => ({ ...world, placements: [] }))
      expect(only(project, 'levelOutsideWorld')).toEqual([
        expect.objectContaining({ severity: 'error', path: 'levels[level-1]' }),
      ])
    })

    it('levelOutsideWorld: a level placed twice', () => {
      const project = withWorld(platformer(), 'main', (world) => ({
        ...world,
        placements: [...world.placements, { level: 'level-1', x: 600, y: 0, depth: 0 }],
      }))
      expect(only(project, 'levelOutsideWorld')).toEqual([
        expect.objectContaining({ path: 'levels[level-1]', message: expect.stringContaining('twice') }),
      ])
    })

    it('placementUnknownLevel: a placement of a level that does not exist', () => {
      const project = withWorld(platformer(), 'main', (world) => ({
        ...world,
        placements: [...world.placements, { level: 'ghost', x: 0, y: 0, depth: 0 }],
      }))
      expect(only(project, 'placementUnknownLevel')).toEqual([
        expect.objectContaining({ severity: 'error', path: 'worlds[main].placements[ghost]' }),
      ])
    })

    it('levelsOverlap: levels on a free world that share a depth and an area', () => {
      const project = withNewLevel(platformer(), 'level-2', { x: 256, y: 100 })
      expect(only(project, 'levelsOverlap')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'worlds[main]',
          message: expect.stringMatching(/level-1.*level-2/),
        }),
      ])
    })

    it('levelsOverlap: different depths, touching edges and non-free layouts are fine', () => {
      expect(
        only(withNewLevel(platformer(), 'level-2', { x: 256, y: 100, depth: 1 }), 'levelsOverlap'),
      ).toEqual([])
      expect(only(withNewLevel(platformer(), 'level-2', { x: 512, y: 0 }), 'levelsOverlap')).toEqual([])
      const grid = withWorld(withNewLevel(platformer(), 'level-2', { x: 256, y: 100 }), 'main', (world) => ({
        ...world,
        layout: 'grid',
        grid: { w: 16, h: 16 },
      }))
      expect(only(grid, 'levelsOverlap')).toEqual([])
    })
  })

  describe('emptyLevel', () => {
    it('is info for a level with nothing in it', () => {
      const project = blankTemplate.create(counterIds())
      expect(only(project, 'emptyLevel')).toEqual([
        expect.objectContaining({ severity: 'info', path: 'levels[level-1]' }),
      ])
    })

    it('is silent once there is a tile, a cell or an entity', () => {
      expect(only(platformer(), 'emptyLevel')).toEqual([])
      const entityOnly = withEntities(blankTemplate.create(counterIds()), 'level-1', [
        entity('thing-1', 'thing', 1, 1),
      ])
      expect(only(entityOnly, 'emptyLevel')).toEqual([])
    })
  })
})
