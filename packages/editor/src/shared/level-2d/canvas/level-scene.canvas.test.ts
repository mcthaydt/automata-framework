import { autoDetectRenderer, type Container, Rectangle, type Renderer } from 'pixi.js'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cellsPng } from '../../../testing/level-2d/png'
import { createColorResolver } from './colors'
import type {
  IntChunk,
  LayerDraw,
  LevelDrawList,
  LinkDraw,
  TileChunk,
  TileDraw,
} from './draw/draw-list-types'
import { createLevelScene, type LevelScene } from './level-scene'
import { createTextureManager, type TextureManager } from './textures.manager'

// The scene builder (ED2D.4c3b, plan decision 3) in Chromium with WebGL2: hand-made draw lists in, pixels read back.

let renderer: Renderer
let textures: TextureManager
let scene: LevelScene | undefined
const tokens: Record<string, string> = {
  '--color-layer-tiles': '#00ff00',
  '--color-accent-default': '#e0a54a',
}
const colors = createColorResolver((name) => tokens[name] ?? '')

beforeAll(async () => {
  renderer = await autoDetectRenderer({ preference: 'webgl', width: 64, height: 32, antialias: false })
  textures = createTextureManager({
    read: async (path) =>
      path === 'assets/rgb.png' ? cellsPng(3, 1, 8, ['#ff0000', '#00ff00', '#0000ff']) : undefined,
  })
  await textures.load(['assets/rgb.png'])
})
afterAll(() => {
  textures.destroy()
  renderer.destroy()
})
afterEach(() => {
  scene?.destroy()
  scene = undefined
})

/** The colour at a level pixel, as `#rrggbb`, after drawing the scene at scale 1. */
function colorAt(root: Container, x: number, y: number): string {
  const { pixels, width } = renderer.extract.pixels({ target: root, frame: new Rectangle(0, 0, 64, 32) })
  const at = (y * width + x) * 4
  const hex = (value: number | undefined) => (value ?? 0).toString(16).padStart(2, '0')
  return `#${hex(pixels[at])}${hex(pixels[at + 1])}${hex(pixels[at + 2])}`
}

/** Half-transparent colours round either way (127 or 128): within one step a channel. */
function expectNear(actual: string, expected: string): void {
  const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
  const want = channels(expected)
  channels(actual).forEach((value, index) => {
    expect(Math.abs(value - (want[index] ?? 0)), `${actual} near ${expected}`).toBeLessThanOrEqual(1)
  })
}

const placeholder = (x: number, y: number, tile: number, color: string): TileDraw => ({
  x,
  y,
  w: 8,
  h: 8,
  tile,
  flipX: false,
  flipY: false,
  kind: 'placeholder',
  reason: 'placeholder',
  color,
  label: String(tile),
})
const imageTile = (x: number, y: number, tile: number, flipX = false): TileDraw & { kind: 'image' } => ({
  x,
  y,
  w: 8,
  h: 8,
  tile,
  flipX,
  flipY: false,
  kind: 'image',
  image: 'assets/rgb.png',
  frame: { x: tile * 8, y: 0, w: 8, h: 8 },
})
const tileChunk = (tiles: readonly TileDraw[], cx = 0): TileChunk => ({
  cx,
  cy: 0,
  bounds: { x: cx * 128, y: 0, w: 128, h: 128 },
  tiles,
})
const tilesLayer = (def: string, chunks: readonly TileChunk[], opacity = 1): LayerDraw => ({
  kind: 'tiles',
  def,
  opacity,
  locked: false,
  chunks,
})
const list = (layers: readonly LayerDraw[], patch: Partial<LevelDrawList> = {}): LevelDrawList => ({
  level: 'l',
  size: { w: 64, h: 32 },
  background: { color: '#000000', mode: 'fit' },
  layers,
  grid: undefined,
  footprint: undefined,
  selection: [],
  links: [],
  ...patch,
})
const sceneOf = () => {
  scene = createLevelScene({ textures, colors })
  return scene
}

describe('level scene: what it draws', () => {
  it('fills the level with its background colour', () => {
    const s = sceneOf()
    s.update(list([], { background: { color: '#336699', mode: 'fit' } }))
    expect(colorAt(s.root, 0, 0)).toBe('#336699')
    expect(colorAt(s.root, 63, 31)).toBe('#336699')
  })

  it('draws a placeholder tile in its colour over its cell, and the frame of an image tile', () => {
    const s = sceneOf()
    s.update(list([tilesLayer('t', [tileChunk([placeholder(0, 0, 4, '#5a8a6d'), imageTile(8, 0, 2)])])]))
    // The cell's edge is darkened and its middle carries the number, so sample a corner just inside the edge.
    expect(colorAt(s.root, 1, 6)).toBe('#5a8a6d')
    expect(colorAt(s.root, 12, 4)).toBe('#0000ff')
    expect(colorAt(s.root, 20, 4)).toBe('#000000')
  })

  it('mirrors a flipped tile inside its own cell', () => {
    const s = sceneOf()
    // Tiles 0 to 2 are red, green and blue; a 16 px cell showing the 8 px red and green halves of a 16 × 8 frame.
    const wide: TileDraw = { ...imageTile(0, 0, 0, true), w: 16, frame: { x: 0, y: 0, w: 16, h: 8 } }
    s.update(list([tilesLayer('t', [tileChunk([wide])])]))
    expect(colorAt(s.root, 2, 4)).toBe('#00ff00')
    expect(colorAt(s.root, 13, 4)).toBe('#ff0000')
    expect(colorAt(s.root, 18, 4)).toBe('#000000')
  })

  it('draws IntGrid cells in their value’s colour at the layer’s opacity', () => {
    const s = sceneOf()
    const cells: IntChunk = {
      cx: 0,
      cy: 0,
      bounds: { x: 0, y: 0, w: 128, h: 128 },
      cells: [
        { x: 0, y: 0, w: 8, h: 8, value: 1, color: '#ff0000' },
        { x: 8, y: 0, w: 8, h: 8, value: 2, color: 'layer/tiles' },
      ],
    }
    s.update(list([{ kind: 'intgrid', def: 'i', opacity: 0.5, locked: false, chunks: [cells] }]))
    expectNear(colorAt(s.root, 4, 4), '#800000')
    expectNear(colorAt(s.root, 12, 4), '#008000')
  })

  it('draws later layers over earlier ones', () => {
    const s = sceneOf()
    s.update(
      list([
        tilesLayer('back', [tileChunk([imageTile(0, 0, 0)])]),
        tilesLayer('front', [tileChunk([imageTile(0, 0, 2)])]),
      ]),
    )
    expect(colorAt(s.root, 4, 4)).toBe('#0000ff')
  })

  it('draws an entity box in its colour and the selection over everything', () => {
    const s = sceneOf()
    s.update(
      list(
        [
          {
            kind: 'entities',
            def: 'e',
            opacity: 1,
            locked: false,
            entities: [
              {
                id: 'a',
                def: 'd',
                shape: 'rect',
                x: 16,
                y: 8,
                w: 16,
                h: 16,
                pivot: { x: 24, y: 24 },
                color: '#ff0000',
                label: 'Door',
                tile: undefined,
              },
            ],
          },
        ],
        { selection: [{ id: 'a', x: 16, y: 8, w: 16, h: 16 }] },
      ),
    )
    // Inside the box (its fill is a tint over the black background), off it, and on the selection's edge.
    expect(colorAt(s.root, 20, 12)).not.toBe('#000000')
    expect(colorAt(s.root, 40, 12)).toBe('#000000')
    expect(colorAt(s.root, 16, 16)).toBe('#e0a54a')
  })
})

describe('level scene: links (plan ED2D.6c decision 4)', () => {
  const link = (patch: Partial<LinkDraw> = {}): LinkDraw => ({
    id: 'a',
    field: 'target',
    from: { x: 8, y: 8 },
    label: 'Inn · Door',
    color: '#ff0000',
    selected: false,
    to: undefined,
    ...patch,
  })

  it('draws a chip in the source colour at the source, the accent when selected, and a line to a target here', () => {
    const s = sceneOf()
    s.update(list([], { links: [link()] }))
    const chip = s.root.children.at(-1)
    expect(chip?.children.length).toBe(1)
    s.update(list([], { links: [link({ selected: true, to: { x: 56, y: 24 } })] }))
    // On the line from (8, 8) to (56, 24), above the chip that starts 6 px below and right of the source.
    expect(colorAt(s.root, 20, 12)).toBe('#e0a54a')
    s.update(list([], { links: [] }))
    expect(s.root.children.at(-1)?.children.length).toBe(0)
  })
})

describe('level scene: a link near the right edge', () => {
  it('puts its chip on the left of the source, so it stays inside the level', () => {
    const s = sceneOf()
    const near = {
      id: 'a',
      field: 'target',
      from: { x: 60, y: 8 },
      label: 'Inn',
      color: '#ff0000',
      selected: false,
      to: undefined,
    }
    s.update(list([], { links: [near] }))
    const tag = s.root.children.at(-1)?.children[0]?.children.at(-1)
    if (tag === undefined) throw new Error('no chip')
    expect(tag.x + tag.width).toBeLessThanOrEqual(60)
    expect(tag.x).toBeGreaterThanOrEqual(0)
  })
})

describe('level scene: rebuilding only what changed (ED2D-D4)', () => {
  it('keeps the Pixi object of every chunk that comes back the same, and replaces only the new one', () => {
    const s = sceneOf()
    const kept = tileChunk([imageTile(0, 0, 0)], 0)
    const before = tileChunk([imageTile(128, 0, 1)], 1)
    s.update(list([tilesLayer('t', [kept, before])]))
    const keptView = s.chunkView(kept)
    const beforeView = s.chunkView(before)
    expect(keptView).toBeDefined()
    const after = tileChunk([imageTile(128, 0, 2)], 1)
    s.update(list([tilesLayer('t', [kept, after])]))
    expect(s.chunkView(kept)).toBe(keptView)
    expect(s.chunkView(after)).not.toBe(beforeView)
    expect(s.chunkView(before)).toBeUndefined()
    expect(beforeView?.destroyed).toBe(true)
    expect(keptView?.destroyed).toBe(false)
  })

  it('destroys a layer that is no longer drawn (hidden, or gone)', () => {
    const s = sceneOf()
    const chunk = tileChunk([imageTile(0, 0, 0)])
    s.update(list([tilesLayer('t', [chunk])]))
    const view = s.chunkView(chunk)
    s.update(list([]))
    expect(view?.destroyed).toBe(true)
    expect(colorAt(s.root, 4, 4)).toBe('#000000')
  })

  it('follows a layer’s new opacity without rebuilding its chunks', () => {
    const s = sceneOf()
    const chunk = tileChunk([imageTile(0, 0, 0)])
    s.update(list([tilesLayer('t', [chunk], 1)]))
    const view = s.chunkView(chunk)
    s.update(list([tilesLayer('t', [chunk], 0.5)]))
    expect(s.chunkView(chunk)).toBe(view)
    expectNear(colorAt(s.root, 4, 4), '#800000')
  })

  it('destroys everything it built', () => {
    const s = sceneOf()
    const chunk = tileChunk([imageTile(0, 0, 0)])
    s.update(list([tilesLayer('t', [chunk])]))
    const view = s.chunkView(chunk)
    s.destroy()
    scene = undefined
    expect(view?.destroyed).toBe(true)
    expect(s.root.destroyed).toBe(true)
  })

  it('draws an image again once it was forgotten and loaded again, never the destroyed texture', async () => {
    let color = '#ff0000'
    const reloading = createTextureManager({
      read: async (path) => (path === 'assets/bg.png' ? cellsPng(1, 1, 8, [color]) : undefined),
    })
    const s = createLevelScene({ textures: reloading, colors })
    scene = s
    await reloading.load(['assets/bg.png'])
    const object = {
      ...imageTile(0, 0, 0),
      id: 'o',
      image: 'assets/bg.png',
      frame: { x: 0, y: 0, w: 8, h: 8 },
    }
    const drawn = () =>
      list([{ kind: 'objects', def: 'o', opacity: 1, locked: false, objects: [object] }], {
        background: { color: '#000000', image: 'assets/bg.png', mode: 'repeat' },
      })
    s.update(drawn())
    expect(colorAt(s.root, 4, 4)).toBe('#ff0000')
    expect(colorAt(s.root, 30, 20)).toBe('#ff0000')
    reloading.forget('assets/bg.png')
    color = '#00ff00'
    await reloading.load(['assets/bg.png'])
    s.update(drawn())
    expect(colorAt(s.root, 4, 4)).toBe('#00ff00')
    expect(colorAt(s.root, 30, 20)).toBe('#00ff00')
    s.destroy()
    scene = undefined
    reloading.destroy()
  })
})
