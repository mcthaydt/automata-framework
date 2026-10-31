import { describe, expect, it } from 'vitest'
import { packTile } from '../../model/cells-codec'
import { counterIds } from '../../model/ids'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { topdownRpgTemplate } from '../../profiles/level-project/templates/topdown-rpg'
import { drawView, richProject } from '../../testing/draw-fixtures'
import { linkedMaps } from '../../testing/linked-maps'
import { entity, paintLayer, withDefs, withEntities } from '../../testing/project-edit'
import type { LayerDraw } from './draw-list-types'
import { createLevelDrawList } from './level-draw-list'

// The rich fixture's level `start`: 64 × 48 px on a 16 px grid (4 × 3 cells), with layers, front to back, `entities`,
// `props` (objects), `ground-art` (auto, from `collision`), `decor` (tiles, opacity 0.5) and `collision` (IntGrid). Its
// tileset `terrain` is a placeholder set (no image) of 8 × 8 tiles of 16 px.

const noImages: ReadonlySet<string> = new Set()

function layerOf(layers: readonly LayerDraw[], def: string): LayerDraw {
  const layer = layers.find((candidate) => candidate.def === def)
  if (layer === undefined) throw new Error(`no layer "${def}" drawn`)
  return layer
}

describe('level draw list: the level', () => {
  it('draws the level’s size and background, and its layers back to front', () => {
    const list = createLevelDrawList()({ project: richProject(), view: drawView(), images: noImages })
    expect(list.level).toBe('start')
    expect(list.size).toEqual({ w: 64, h: 48 })
    expect(list.background).toEqual({ color: '#1b1b2f', mode: 'fit' })
    expect(list.layers.map((layer) => [layer.def, layer.kind])).toEqual([
      ['collision', 'intgrid'],
      ['decor', 'tiles'],
      ['ground-art', 'auto'],
      ['props', 'objects'],
      ['entities', 'entities'],
    ])
  })

  it('passes the background image through only when it is loaded', () => {
    const draw = createLevelDrawList()
    const project = richProject()
    const cellar = drawView({ level: 'cellar' })
    expect(draw({ project, view: cellar, images: noImages }).background).toEqual({
      color: '#000000',
      mode: 'repeat-x',
    })
    expect(draw({ project, view: cellar, images: new Set(['art/cellar.png']) }).background).toEqual({
      color: '#000000',
      image: 'art/cellar.png',
      mode: 'repeat-x',
    })
  })

  it('draws a layer’s chunks again when the image of its tileset has a new generation', () => {
    const draw = createLevelDrawList()
    const project = withDefs(richProject(), (defs) => ({
      ...defs,
      tilesets: defs.tilesets.map((set) => ({ ...set, image: 'assets/terrain.png' })),
    }))
    const images = new Set(['assets/terrain.png'])
    const chunksOf = (generation: number) => {
      const list = draw({
        project,
        view: drawView(),
        images,
        generations: new Map([['assets/terrain.png', generation]]),
      })
      const decor = list.layers.find((layer) => layer.def === 'decor')
      return decor?.kind === 'tiles' ? decor.chunks : []
    }
    const first = chunksOf(1)
    expect(first.length).toBeGreaterThan(0)
    expect(chunksOf(1)[0]).toBe(first[0])
    expect(chunksOf(2)[0]).not.toBe(first[0])
  })

  it('leaves hidden layers out, and marks locked ones, which are still drawn', () => {
    const view = drawView({ hidden: new Set(['decor', 'props']), locked: new Set(['collision']) })
    const list = createLevelDrawList()({ project: richProject(), view, images: noImages })
    expect(list.layers.map((layer) => [layer.def, layer.locked])).toEqual([
      ['collision', true],
      ['ground-art', false],
      ['entities', false],
    ])
  })

  it('takes each layer’s opacity from its definition; entities and objects are opaque', () => {
    const list = createLevelDrawList()({ project: richProject(), view: drawView(), images: noImages })
    expect(list.layers.map((layer) => [layer.def, layer.opacity])).toEqual([
      ['collision', 1],
      ['decor', 0.5],
      ['ground-art', 1],
      ['props', 1],
      ['entities', 1],
    ])
  })

  it('draws the cells of each cell layer, with numbered placeholders for a set with no image', () => {
    const list = createLevelDrawList()({ project: richProject(), view: drawView(), images: noImages })
    const decor = layerOf(list.layers, 'decor')
    expect(decor.kind === 'tiles' && decor.chunks[0]?.tiles).toEqual([
      {
        x: 16,
        y: 16,
        w: 16,
        h: 16,
        tile: 5,
        flipX: true,
        flipY: false,
        kind: 'placeholder',
        reason: 'placeholder',
        color: expect.stringMatching(/^#/),
        label: '5',
      },
    ])
    const collision = layerOf(list.layers, 'collision')
    expect(
      collision.kind === 'intgrid' && collision.chunks[0]?.cells.map((cell) => [cell.x, cell.y, cell.color]),
    ).toEqual([
      [16, 16, '#0000ff'],
      [0, 32, '#ff0000'],
      [16, 32, '#ff0000'],
      [32, 32, '#ff0000'],
      [48, 32, '#ff0000'],
    ])
    const auto = layerOf(list.layers, 'ground-art')
    expect(auto.kind === 'auto' && auto.chunks.flatMap((chunk) => chunk.tiles).length).toBeGreaterThan(0)
  })

  it('draws objects at their tileset’s tile size, top-left at their position', () => {
    const list = createLevelDrawList()({ project: richProject(), view: drawView(), images: noImages })
    const props = layerOf(list.layers, 'props')
    expect(props.kind === 'objects' && props.objects).toEqual([
      {
        id: '0000000b',
        x: 20,
        y: 12,
        w: 16,
        h: 16,
        tile: 7,
        flipX: false,
        flipY: true,
        kind: 'placeholder',
        reason: 'placeholder',
        color: expect.stringMatching(/^#/),
        label: '7',
      },
    ])
  })

  it('draws an object whose layer names a tileset that is gone as a 1 px placeholder at its position', () => {
    const project = withDefs(richProject(), (defs) => ({
      ...defs,
      layers: defs.layers.map((def) => (def.kind === 'objects' ? { ...def, tileset: 'gone' } : def)),
    }))
    const props = layerOf(
      createLevelDrawList()({ project, view: drawView(), images: noImages }).layers,
      'props',
    )
    expect(props.kind === 'objects' && props.objects[0]).toMatchObject({
      x: 20,
      y: 12,
      w: 1,
      h: 1,
      kind: 'placeholder',
      reason: 'noTileset',
    })
  })

  it('draws each entity as its box, pivot, shape, colour and label, in the layer’s order', () => {
    const list = createLevelDrawList()({ project: richProject(), view: drawView(), images: noImages })
    const entities = layerOf(list.layers, 'entities')
    if (entities.kind !== 'entities') throw new Error('not an entities layer')
    expect(entities.entities.map(({ tile: _tile, ...rest }) => rest)).toEqual([
      {
        id: '00000009',
        def: 'player-start',
        shape: 'point',
        x: 8,
        y: 16,
        w: 16,
        h: 16,
        pivot: { x: 16, y: 32 },
        color: '#00ff00',
        label: 'Player start',
      },
      {
        id: '0000000a',
        def: 'slime',
        shape: 'ellipse',
        x: 20,
        y: 16,
        w: 24,
        h: 16,
        pivot: { x: 32, y: 32 },
        color: undefined,
        label: 'slime',
      },
      {
        id: '0000000c',
        def: 'door',
        shape: 'tile',
        x: 40,
        y: 0,
        w: 16,
        h: 32,
        pivot: { x: 48, y: 32 },
        color: 'entity/door',
        label: 'Door',
      },
    ])
    expect(entities.entities.map((entity) => entity.tile?.tile)).toEqual([undefined, undefined, 4])
    expect(entities.entities[2]?.tile).toMatchObject({ x: 40, y: 0, w: 16, h: 32, kind: 'placeholder' })
  })

  it('leaves out an entity whose definition is gone, as the select tool cannot hit it', () => {
    const project = withDefs(richProject(), (defs) => ({
      ...defs,
      entities: defs.entities.filter((def) => def.id !== 'slime'),
    }))
    const entities = layerOf(
      createLevelDrawList()({ project, view: drawView(), images: noImages }).layers,
      'entities',
    )
    expect(entities.kind === 'entities' && entities.entities.map((entity) => entity.id)).toEqual([
      '00000009',
      '0000000c',
    ])
  })

  it('refuses a level the project does not have', () => {
    expect(() =>
      createLevelDrawList()({
        project: richProject(),
        view: drawView({ level: 'nowhere' }),
        images: noImages,
      }),
    ).toThrow(RangeError)
  })

  it('hands back the chunks a stroke did not touch, and the auto layer while its source is unchanged', () => {
    // The platformer's level is 32 cells wide: two chunks across.
    const draw = createLevelDrawList()
    const view = drawView({ level: 'level-1', layer: 'decor' })
    const start = paintLayer(platformerTemplate.create(counterIds()), 'level-1', 'decor', (cells) => {
      cells.set(0, 0, 1)
      cells.set(20, 0, 1)
    })
    const before = draw({ project: start, view, images: noImages })
    const stroke = paintLayer(start, 'level-1', 'decor', (cells) =>
      cells.set(21, 0, packTile(2, false, false)),
    )
    const after = draw({ project: stroke, view, images: noImages })
    const chunksOf = (list: typeof before) => {
      const decor = layerOf(list.layers, 'decor')
      return decor.kind === 'tiles' ? decor.chunks : []
    }
    expect(chunksOf(before)).toHaveLength(2)
    expect(chunksOf(after)[0]).toBe(chunksOf(before)[0])
    expect(chunksOf(after)[1]).not.toBe(chunksOf(before)[1])
    const autoOf = (list: typeof before) => {
      const auto = layerOf(list.layers, 'ground')
      return auto.kind === 'auto' ? auto.chunks : undefined
    }
    expect(autoOf(after)).toBe(autoOf(before))
    const dug = paintLayer(stroke, 'level-1', 'collision', (cells) => cells.set(0, 16, 0))
    expect(autoOf(draw({ project: dug, view, images: noImages }))).not.toBe(autoOf(before))
  })
})

describe('level draw list: the templates', () => {
  it('draws the platformer and the RPG starter levels with every layer and no error', () => {
    for (const [template, level] of [
      [platformerTemplate, 'level-1'],
      [topdownRpgTemplate, 'map-1'],
    ] as const) {
      const project = template.create(counterIds())
      const view = drawView({ level, layer: project.defs.layers[0]?.id ?? '' })
      const list = createLevelDrawList()({ project, view, images: noImages })
      expect(list.layers).toHaveLength(project.defs.layers.length)
      expect(list.grid?.step).toBe(16)
    }
  })

  it('draws the platformer’s floor as solid IntGrid cells and its auto ground as tiles over them', () => {
    const project = platformerTemplate.create(counterIds())
    const list = createLevelDrawList()({
      project,
      view: drawView({ level: 'level-1', layer: 'collision' }),
      images: noImages,
    })
    const collision = layerOf(list.layers, 'collision')
    const cells = collision.kind === 'intgrid' ? collision.chunks.flatMap((chunk) => chunk.cells) : []
    expect(cells).toHaveLength(64)
    expect(new Set(cells.map((cell) => cell.color))).toEqual(new Set(['#64748b']))
    const ground = layerOf(list.layers, 'ground')
    const tiles = ground.kind === 'auto' ? ground.chunks.flatMap((chunk) => chunk.tiles) : []
    expect(new Set(tiles.map((tile) => tile.y))).toEqual(new Set([256, 272]))
  })
})

describe('level draw list: links (plan ED2D.6c decision 4)', () => {
  const view = (patch: Partial<Parameters<typeof drawView>[0]> = {}) =>
    drawView({ level: 'map-1', layer: 'entities', ...patch })

  it('names each resolved link of the level at its source, in the source definition’s colour', () => {
    const project = linkedMaps()
    const list = createLevelDrawList()({ project, view: view(), images: noImages })
    const door = project.defs.entities.find((def) => def.id === 'door')
    expect(list.links).toEqual([
      {
        id: 'door-out',
        field: 'target',
        from: { x: 96, y: 64 },
        label: 'Inn · Door',
        color: door?.color,
        selected: false,
        to: undefined,
      },
    ])
  })

  it('marks a selected source, and draws a line to a target in the same level', () => {
    const inside = withEntities(linkedMaps(), 'map-1', [
      entity('warp-1', 'warp', 200, 100, { target: { target: 'door-out', container: 'map-1' } }),
    ])
    const list = createLevelDrawList()({
      project: inside,
      view: view({ selected: ['warp-1'] }),
      images: noImages,
    })
    expect(list.links.find((link) => link.id === 'warp-1')).toMatchObject({
      label: 'Village · Door',
      selected: true,
      to: { x: 96, y: 64 },
    })
  })

  it('draws nothing for a broken link or one on a hidden layer', () => {
    const broken = withEntities(linkedMaps(), 'map-1', [
      entity('door-2', 'door', 10, 10, { target: { target: 'gone' } }),
    ])
    const draw = createLevelDrawList()
    expect(draw({ project: broken, view: view(), images: noImages }).links.map((link) => link.id)).toEqual([
      'door-out',
    ])
    expect(
      draw({ project: broken, view: view({ hidden: new Set(['entities']) }), images: noImages }).links,
    ).toEqual([])
  })
})
