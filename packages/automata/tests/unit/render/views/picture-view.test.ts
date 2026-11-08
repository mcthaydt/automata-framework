import type { ContentEntityDef, ContentProject } from '@automata/content/level-2d'
import type { RenderRow } from '@automata/sim'
import { Assets, Graphics, Sprite, Texture, TextureSource } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pictureView } from '#src/features/render/views/picture-view.ts'

const def = (over: Partial<ContentEntityDef> & { id: string }): ContentEntityDef => ({
  label: over.id,
  fields: [],
  shape: 'rect',
  size: { w: 16, h: 24 },
  pivot: { x: 0.5, y: 1 },
  resizable: 'none',
  tags: [],
  color: '#22c55e',
  ...over,
})

const project: ContentProject = {
  format: 'af2d-content',
  version: 1,
  name: 'P',
  template: 'blank',
  layers: [],
  tilesets: [
    {
      id: 'terrain',
      tile: { w: 16, h: 16 },
      columns: 2,
      rows: 1,
      spacing: 0,
      padding: 0,
      image: 'assets/terrain.png',
      placeholder: false,
      tags: [],
    },
  ],
  entities: [
    def({ id: 'hero', shape: 'tile', size: { w: 16, h: 16 }, tile: { tileset: 'terrain', index: 1 } }),
    def({ id: 'flat-tile', shape: 'rect', tile: { tileset: 'terrain', index: 1 } }),
    def({ id: 'blob', shape: 'ellipse', color: '#a855f7' }),
    def({ id: 'far', shape: 'tile', tile: { tileset: 'terrain', index: 70 } }),
  ],
  levelFields: [],
}

const row: RenderRow = { sid: 1, components: { body: { x: 0, y: 0 } } }
const sheet = (): Texture => new Texture({ source: new TextureSource({ width: 32, height: 16 }) })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pictureView', () => {
  it('draws a tile-shaped character as the frame of its tile, anchored at its pivot', async () => {
    const loaded = sheet()
    vi.spyOn(Assets, 'load').mockResolvedValue(loaded as never)
    const images = { 'assets/terrain.png': 'terrain.png' }
    const view = pictureView(project, 'hero', images)(row, 'body')
    // The picture is on its way: the view shows the tile's colour until it lands.
    await vi.waitFor(() => {
      const sprite = view?.container.children[0]
      expect(sprite).toBeInstanceOf(Sprite)
    })
    const sprite = view?.container.children[0] as Sprite
    expect(sprite.texture.frame.x).toBe(16)
    expect(sprite.texture.frame.width).toBe(16)
    expect([sprite.anchor.x, sprite.anchor.y]).toEqual([0.5, 1])
  })

  it('draws the flat shape when the shape is not tile, as the editor does', () => {
    const view = pictureView(project, 'flat-tile', { 'assets/terrain.png': 'terrain.png' })(row, 'body')
    expect(view?.container.children[0]).toBeInstanceOf(Graphics)
  })

  it('draws a plain character as its colour and shape', () => {
    const view = pictureView(project, 'blob', {})(row, 'body')
    expect(view?.container.children[0]).toBeInstanceOf(Graphics)
  })

  it('follows the entity pose', () => {
    const view = pictureView(project, 'blob', {})(row, 'body')
    view?.update?.({ body: { x: 10, y: 4, angle: 0 } }, { body: { x: 0, y: 0, angle: 0 } }, 0.5)
    expect([view?.container.x, view?.container.y]).toEqual([5, 2])
  })

  it('shows the flat colour and says so once when the tile is past the set', () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const make = pictureView(project, 'far', { 'assets/terrain.png': 'terrain.png' })
    expect(make(row, 'body')?.container.children[0]).toBeInstanceOf(Graphics)
    make(row, 'body')
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(String(reportError.mock.calls[0]?.[0])).toContain('uses tile 70, but "terrain" has 2 tiles.')
    vi.unstubAllGlobals()
  })

  it('names a character the project lacks', () => {
    expect(() => pictureView(project, 'ghost', {})).toThrow('There is no character "ghost" in the project.')
  })
})
