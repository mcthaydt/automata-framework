import type { RenderRow } from '@mcthaydt/automata-sim'
import { Assets, type Sprite, Texture, TextureSource } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sprite } from './sprite-view.js'

function texture(width: number, height: number): Texture {
  return new Texture({ source: new TextureSource({ width, height }) })
}

const row: RenderRow = { sid: 1, components: { body: { x: 0, y: 0 } } }

function spriteOf(view: { container: unknown } | undefined): Sprite {
  if (!view) throw new Error('no view')
  return view.container as Sprite
}

/** Assets.load is generic over its result; the stub only ever yields textures. */
function stubLoad(result: () => Promise<Texture>) {
  return vi.spyOn(Assets, 'load').mockImplementation((() => result()) as unknown as typeof Assets.load)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sprite view', () => {
  it('shows the texture, centred by default, at the interpolated pose', () => {
    const hero = texture(8, 8)
    const view = sprite(hero)(row, 'body')
    const shown = spriteOf(view)

    view?.update?.({ body: { x: 10, y: 4, angle: 2 } }, { body: { x: 0, y: 0, angle: 0 } }, 0.5)

    expect(shown.texture).toBe(hero)
    expect([shown.anchor.x, shown.anchor.y]).toEqual([0.5, 0.5])
    expect([shown.x, shown.y]).toEqual([5, 2])
    expect(shown.rotation).toBeCloseTo(1, 12)
  })

  it('takes an anchor', () => {
    const shown = spriteOf(sprite(texture(8, 8), { anchor: { x: 0, y: 1 } })(row, 'body'))
    expect([shown.anchor.x, shown.anchor.y]).toEqual([0, 1])
  })

  it('slices frames from a sheet and shows floor(frame) mod count', () => {
    const sheet = texture(32, 8)
    const view = sprite(sheet, { frames: { width: 8, height: 8 } })(row, 'body')
    const shown = spriteOf(view)

    expect(shown.texture.frame.x).toBe(0)
    view?.update?.({ body: { x: 0, y: 0, frame: 2.7 } }, undefined, 1)
    expect([shown.texture.frame.x, shown.texture.frame.width]).toEqual([16, 8])
    view?.update?.({ body: { x: 0, y: 0, frame: 5 } }, undefined, 1)
    expect(shown.texture.frame.x).toBe(8)
    expect(shown.texture.source).toBe(sheet.source)
  })

  it('limits the frames to count', () => {
    const view = sprite(texture(32, 8), { frames: { width: 8, height: 8, count: 2 } })(row, 'body')
    view?.update?.({ body: { x: 0, y: 0, frame: 3 } }, undefined, 1)
    expect(spriteOf(view).texture.frame.x).toBe(8)
  })

  it('uses a url already in the asset cache straight away', () => {
    const cached = texture(4, 4)
    vi.spyOn(Assets.cache, 'has').mockImplementation((key) => key === 'cached.png')
    vi.spyOn(Assets.cache, 'get').mockImplementation((key) => (key === 'cached.png' ? cached : undefined))
    const load = vi.spyOn(Assets, 'load')

    expect(spriteOf(sprite('cached.png')(row, 'body')).texture).toBe(cached)
    expect(load).not.toHaveBeenCalled()
  })

  it('shows nothing until an unloaded url loads, then the texture', async () => {
    const loaded = texture(4, 4)
    stubLoad(() => Promise.resolve(loaded))
    const shown = spriteOf(sprite('late.png')(row, 'body'))

    expect(shown.texture).toBe(Texture.EMPTY)
    await vi.waitFor(() => expect(shown.texture).toBe(loaded))
  })

  it('leaves a view destroyed before its texture loads alone', async () => {
    let resolve: (value: Texture) => void = () => {}
    stubLoad(() => new Promise<Texture>((r) => (resolve = r)))
    const view = sprite('slow.png')(row, 'body')
    view?.destroy?.()

    resolve(texture(4, 4))
    await Promise.resolve()
    await Promise.resolve()

    expect(spriteOf(view).destroyed).toBe(true)
  })

  it('reports a url that fails to load instead of swallowing it', async () => {
    const failure = new Error('404')
    stubLoad(() => Promise.reject(failure))
    const report = vi.fn()
    vi.stubGlobal('reportError', report)

    const missing = sprite('missing.png')
    missing(row, 'body')
    missing({ sid: 2, components: row.components }, 'body')

    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(failure))
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(1)
    expect(Assets.load).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
