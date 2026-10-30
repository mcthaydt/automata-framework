import { describe, expect, it } from 'vitest'
import * as editor2d from './index'

describe('editor-2d entry', () => {
  it('exports the model, the working file API and the profile registry', () => {
    const functions = [
      editor2d.openProject,
      editor2d.printProject,
      editor2d.decodeProject,
      editor2d.encodeProject,
      editor2d.encodeRows,
      editor2d.decodeRows,
      editor2d.packTile,
      editor2d.unpackTile,
      editor2d.counterIds,
      editor2d.randomIds,
      editor2d.createProfileRegistry,
    ]
    for (const member of functions) expect(member).toBeTypeOf('function')
    expect(editor2d.Grid.empty(2, 2).cols).toBe(2)
    expect(editor2d.FILE_VERSION).toBe(1)
    for (const schema of [editor2d.projectFileSchema, editor2d.ruleSchema, editor2d.ruleGroupSchema]) {
      expect(schema.safeParse).toBeTypeOf('function')
    }
  })

  it('exports the tile tools and the auto-tile engine', () => {
    const functions = [
      editor2d.brushCells,
      editor2d.lineCells,
      editor2d.paintCells,
      editor2d.paintRect,
      editor2d.paintRandom,
      editor2d.floodFill,
      editor2d.copyStamp,
      editor2d.flipStamp,
      editor2d.pasteStamp,
      editor2d.flipCell,
      editor2d.pickTile,
      editor2d.compileRules,
      editor2d.evaluateCell,
      editor2d.autoTiles,
      editor2d.patchAutoTiles,
      editor2d.windowAround,
      editor2d.applyOverrides,
      editor2d.ruleIssues,
    ]
    for (const member of functions) expect(member).toBeTypeOf('function')
  })

  it('exports the world and level commands', () => {
    const functions = [
      editor2d.addLevel,
      editor2d.removeLevel,
      editor2d.duplicateLevel,
      editor2d.setLevelField,
      editor2d.setLevelDepth,
      editor2d.moveLevelInWorld,
      editor2d.placeLevel,
      editor2d.resizeLevel,
      editor2d.resizeLevelLoss,
      editor2d.setWorldLayout,
      editor2d.worldNeighbours,
    ]
    for (const member of functions) expect(member).toBeTypeOf('function')
  })

  it('paints and auto-tiles through nothing but the entry', () => {
    const ground = editor2d.paintRect(editor2d.Grid.empty(5, 3), { x: 0, y: 1 }, { x: 4, y: 2 }, 1)
    const rules = editor2d.compileRules([
      {
        id: 'ground',
        label: 'Ground',
        active: true,
        rules: [
          {
            id: 'top',
            active: true,
            size: 3,
            pattern: ['any', 'empty', 'any', 'any', 'filled', 'any', 'any', 'any', 'any'],
            tiles: [7],
            chance: 1,
            flipX: false,
            flipY: false,
            breakOnMatch: false,
            outside: 0,
          },
        ],
      },
    ])
    const tiles = editor2d.autoTiles(ground, rules, 1)
    expect([...tiles.stacks.keys()]).toEqual([5, 6, 7, 8, 9])
  })

  it('opens a project through nothing but the entry', () => {
    const file = {
      format: 'af2d',
      version: 1,
      name: 'Entry',
      template: 'blank',
      defs: { layers: [], tilesets: [], entities: [], levelFields: [] },
      worlds: [{ id: 'main', layout: 'free', placements: [] }],
      levels: [],
    }
    const result = editor2d.openProject(JSON.stringify(file))
    expect(result.status).toBe('opened')
    if (result.status === 'opened') expect(JSON.parse(editor2d.printProject(result.project))).toEqual(file)
  })

  it('exports the level edit commands, the entity geometry and the Level view controller', () => {
    const functions = [
      editor2d.updateLayer,
      editor2d.findLayer,
      editor2d.paintLayerCells,
      editor2d.eraseLayerCells,
      editor2d.paintLayerRect,
      editor2d.fillLayer,
      editor2d.paintLayerRandom,
      editor2d.pasteLayerStamp,
      editor2d.placeEntity,
      editor2d.moveEntity,
      editor2d.resizeEntity,
      editor2d.setEntityField,
      editor2d.deleteEntity,
      editor2d.duplicateEntity,
      editor2d.entityBounds,
      editor2d.entityAt,
      editor2d.placeObject,
      editor2d.moveObject,
      editor2d.flipObject,
      editor2d.deleteObject,
      editor2d.createLevelEditor,
    ]
    for (const member of functions) expect(member).toBeTypeOf('function')
  })

  it('exports the level draw list, which draws a level through nothing but the entry', () => {
    const grid = editor2d.Grid.empty(20, 2).set(0, 0, 1).set(17, 1, 2)
    expect(grid.chunks().map((chunk) => chunk.cx)).toEqual([0, 1])
    expect(editor2d.createLevelDrawList).toBeTypeOf('function')
  })
})
