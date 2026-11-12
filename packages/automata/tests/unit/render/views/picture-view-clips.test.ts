import type { ContentEntityDef, ContentProject } from '@automata/content/level-2d'
import type { RenderRow } from '@automata/sim'
import { AnimatedSprite, Assets, Graphics, Texture, TextureSource } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pictureView } from '#src/features/render/views/picture-view.ts'

// A character with an animation is a picture cut into frames and named clips. Code picks the clip by name; the
// clip's frames, speed and repeat are the character's, edited in Characters.

const hero: ContentEntityDef = {
  id: 'hero',
  label: 'Hero',
  fields: [],
  color: '#22c55e',
  shape: 'rect',
  size: { w: 16, h: 24 },
  pivot: { x: 0.5, y: 1 },
  resizable: 'none',
  tags: [],
  animation: {
    image: 'assets/hero.png',
    frame: { w: 16, h: 24 },
    clips: [
      { id: 'idle', frames: [0, 1], fps: 6, loop: true },
      { id: 'run', frames: [2, 3, 4], fps: 12, loop: true },
      { id: 'hit', frames: [5], fps: 6, loop: false },
    ],
  },
}
const other: ContentEntityDef = {
  ...hero,
  id: 'other',
  label: 'Other',
  animation: {
    image: 'assets/other.png',
    frame: { w: 16, h: 24 },
    clips: [{ id: 'idle', frames: [0], fps: 6, loop: true }],
  },
}
const project: ContentProject = {
  format: 'af2d-content',
  version: 1,
  name: 'P',
  template: 'blank',
  layers: [],
  tilesets: [],
  entities: [hero, other],
  levelFields: [],
}
const images = { 'assets/hero.png': 'hero.png', 'assets/other.png': 'other.png' }
const row: RenderRow = { sid: 1, components: { body: { x: 0, y: 0 } } }
/** A 96 x 24 picture: six frames of 16 x 24. */
const sheet = (): Texture => new Texture({ source: new TextureSource({ width: 96, height: 24 }) })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function loaded(clip?: (components: Record<string, Record<string, unknown>>) => string) {
  vi.spyOn(Assets, 'load').mockResolvedValue(sheet() as never)
  const fresh = { ...images }
  const view = pictureView(project, 'hero', fresh, { clip: clip as never })(row, 'body')
  await vi.waitFor(() => expect(view?.container.children[0]).toBeInstanceOf(AnimatedSprite))
  return { view, sprite: view?.container.children[0] as AnimatedSprite }
}

describe('pictureView with clips', () => {
  it('shows the character’s colour until the picture arrives', () => {
    vi.spyOn(Assets, 'load').mockReturnValue(new Promise(() => {}) as never)
    const view = pictureView(project, 'hero', { ...images })(row, 'body')
    expect(view?.container.children[0]).toBeInstanceOf(Graphics)
  })

  it('plays the first clip: its frames in order, at its speed, repeating as it says', async () => {
    const { sprite } = await loaded()
    expect(sprite.textures.map((texture) => (texture as Texture).frame.x)).toEqual([0, 16])
    expect(sprite.animationSpeed).toBeCloseTo(6 / 60)
    expect(sprite.loop).toBe(true)
    expect(sprite.playing).toBe(true)
    expect([sprite.anchor.x, sprite.anchor.y]).toEqual([0.5, 1])
    expect([sprite.width, sprite.height]).toEqual([16, 24])
  })

  it('swaps to the clip the game names, from its first frame, and does not restart one that is playing', async () => {
    let name = 'idle'
    const { view, sprite } = await loaded(() => name)
    view?.update?.({ body: { x: 0, y: 0 } })
    expect((sprite.textures[0] as Texture).frame.x).toBe(0)
    name = 'run'
    view?.update?.({ body: { x: 0, y: 0 } })
    expect(sprite.textures.map((texture) => (texture as Texture).frame.x)).toEqual([32, 48, 64])
    expect(sprite.animationSpeed).toBeCloseTo(12 / 60)
    expect(sprite.currentFrame).toBe(0)
    sprite.gotoAndPlay(2)
    view?.update?.({ body: { x: 0, y: 0 } })
    expect(sprite.currentFrame).toBe(2)
  })

  it('plays a clip that does not repeat once', async () => {
    let name = 'idle'
    const { view, sprite } = await loaded(() => name)
    name = 'hit'
    view?.update?.({ body: { x: 0, y: 0 } })
    expect(sprite.loop).toBe(false)
    expect(sprite.textures).toHaveLength(1)
  })

  it('keeps the first clip and says once, in words, when the game names a clip the character lacks', async () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const { view, sprite } = await loaded(() => 'fly')
    view?.update?.({ body: { x: 0, y: 0 } })
    view?.update?.({ body: { x: 0, y: 0 } })
    expect(sprite.textures).toHaveLength(2)
    expect(reportError).toHaveBeenCalledTimes(1)
    const [error] = reportError.mock.calls[0] ?? []
    expect((error as Error).message).toBe('The character "Hero" has no clip "fly".')
  })

  it('follows the entity pose like any picture', async () => {
    const { view } = await loaded()
    view?.update?.({ body: { x: 10, y: 4, angle: 0 } }, { body: { x: 0, y: 0, angle: 0 } }, 0.5)
    expect([view?.container.x, view?.container.y]).toEqual([5, 2])
  })

  it('skips a frame the picture does not have, and says so once in words', async () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    vi.spyOn(Assets, 'load').mockResolvedValue(sheet() as never)
    const short: ContentProject = {
      ...project,
      entities: [
        {
          ...hero,
          animation: {
            image: 'assets/hero.png',
            frame: { w: 16, h: 24 },
            clips: [{ id: 'idle', frames: [0, 9], fps: 6, loop: true }],
          },
        },
      ],
    }
    const view = pictureView(short, 'hero', { ...images })(row, 'body')
    await vi.waitFor(() => expect(view?.container.children[0]).toBeInstanceOf(AnimatedSprite))
    const sprite = view?.container.children[0] as AnimatedSprite
    expect(sprite.textures).toHaveLength(1)
    expect(reportError).toHaveBeenCalledTimes(1)
    const [error] = reportError.mock.calls[0] ?? []
    expect((error as Error).message).toBe('The clip "idle" of "Hero" uses frame 9, but the picture has 6.')
  })

  it('keeps a running clip going when a picture it does not use arrives', async () => {
    // Two characters of one game share its pictures; the second one's arrives after the first one's clip is running.
    const shared = { ...images }
    let release: (() => void) | undefined
    vi.spyOn(Assets, 'load').mockImplementation(((asset: { src: string }) =>
      asset.src === 'other.png'
        ? new Promise((resolve) => {
            release = () => resolve(sheet())
          })
        : Promise.resolve(sheet())) as never)
    const first = pictureView(project, 'hero', shared)(row, 'body')
    await vi.waitFor(() => expect(first?.container.children[0]).toBeInstanceOf(AnimatedSprite))
    const sprite = first?.container.children[0] as AnimatedSprite
    sprite.gotoAndPlay(1)
    const second = pictureView(project, 'other', shared)(row, 'body')
    await vi.waitFor(() => expect(release).toBeDefined())
    release?.()
    await vi.waitFor(() => expect(second?.container.children[0]).toBeInstanceOf(AnimatedSprite))
    expect(first?.container.children[0]).toBe(sprite)
    expect(sprite.currentFrame).toBe(1)
  })
})
