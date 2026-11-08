import type { ContentLevel, ContentProject } from '@automata/content/level-2d'
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawLevelScene, levelScene, mountLevelScene } from '#src/features/render/level-2d/level-scene.ts'
import type { DrawSim } from '#src/shared/draw/read-sim.ts'

// A real 32 × 16 picture (tile 0 red, tile 1 blue) drawn by a real level scene in the engine under test: the pixel
// at each cell's centre is the tile's own colour, so the scene cut the right frame and put it in the right place.

const sim = { tick: 0 } as unknown as DrawSim

async function tilesetPicture(): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 16
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 16, 16)
  context.fillStyle = '#0000ff'
  context.fillRect(16, 0, 16, 16)
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((made) => resolve(made as Blob), 'image/png'),
  )
  return URL.createObjectURL(blob)
}

const project: ContentProject = {
  format: 'af2d-content',
  version: 1,
  name: 'P',
  template: 'blank',
  layers: [{ id: 'decor', kind: 'tiles', grid: 16, tileset: 'terrain' }],
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
  entities: [],
  levelFields: [],
}

const level: ContentLevel = {
  format: 'af2d-content',
  version: 1,
  id: 'start',
  name: 'Start',
  size: { w: 32, h: 16 },
  background: { color: '#00ff00', mode: 'fit' },
  fields: {},
  layers: [{ def: 'decor', kind: 'tiles', rows: ['0 1'] }],
}

let app: Application | undefined
afterEach(() => {
  app?.destroy(true)
  app = undefined
})

describe('levelScene in a real engine', () => {
  it('draws each tile from its picture at its cell', async () => {
    const url = await tilesetPicture()
    const scene = levelScene({
      project,
      levels: { start: level },
      images: { 'assets/terrain.png': url },
      start: 'start',
    })
    app = new Application()
    await app.init({
      width: 32,
      height: 16,
      preference: 'webgl',
      autoStart: false,
      antialias: false,
      resolution: 1,
    })
    const world = new Container()
    app.stage.addChild(world)
    mountLevelScene(scene, world, new Container())

    // The picture loads on the first frame; draw again until the tiles are sprites.
    await vi.waitFor(() => {
      drawLevelScene(scene, sim)
      expect(world.children[0]?.children.filter((child) => child instanceof Sprite)).toHaveLength(2)
    })

    app.renderer.render({ container: app.stage })
    const { pixels, width } = app.renderer.extract.pixels({ target: app.stage })
    const at = (x: number, y: number): number[] =>
      Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3))
    expect(at(8, 8)).toEqual([255, 0, 0])
    expect(at(24, 8)).toEqual([0, 0, 255])
  })

  it('has an overlay that covers every view the game adds to the world, even one made after the scene was mounted', async () => {
    const url = await tilesetPicture()
    const scene = levelScene({
      project,
      levels: { start: level },
      images: { 'assets/terrain.png': url },
      start: 'start',
    })
    scene.add({
      draw: (_sim, { overlay }) => {
        if (overlay.children.length === 0) overlay.addChild(new Graphics().rect(0, 0, 32, 16).fill(0x000000))
      },
    })
    app = new Application()
    await app.init({
      width: 32,
      height: 16,
      preference: 'webgl',
      autoStart: false,
      antialias: false,
      resolution: 1,
    })
    const world = new Container()
    const ui = new Container()
    app.stage.addChild(world)
    app.stage.addChild(ui)
    mountLevelScene(scene, world, ui)
    // A live entity's view, added after the scene and so drawn over the level, as the game's own views are.
    world.addChild(new Graphics().rect(4, 4, 8, 8).fill(0xff0000))

    drawLevelScene(scene, sim)
    app.renderer.render({ container: app.stage })
    const { pixels, width } = app.renderer.extract.pixels({ target: app.stage })
    const at = (x: number, y: number): number[] =>
      Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3))
    expect(at(8, 8)).toEqual([0, 0, 0])
  })
})
