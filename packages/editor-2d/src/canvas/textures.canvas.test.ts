import { afterEach, describe, expect, it } from 'vitest'
import { cellsPng } from '../testing/png'
import { createTextureManager, type TextureManager } from './textures.manager'

// The texture manager over the workspace's images (ED2D.4c3b, plan decision 5), in Chromium.

let manager: TextureManager | undefined
afterEach(() => {
  manager?.destroy()
  manager = undefined
})

function storeOf(files: Record<string, Uint8Array | 'throws'>) {
  const reads: string[] = []
  return {
    reads,
    async read(path: string): Promise<Uint8Array | undefined> {
      reads.push(path)
      const file = files[path]
      if (file === 'throws') throw new Error('io')
      return file
    },
  }
}

describe('texture manager', () => {
  it('loads an image from the store with nearest-neighbour scaling', async () => {
    const store = storeOf({ 'assets/a.png': await cellsPng(2, 1, 4, ['#ff0000', '#00ff00']) })
    manager = createTextureManager(store)
    await manager.load(['assets/a.png'])
    expect([...manager.loaded]).toEqual(['assets/a.png'])
    const texture = manager.texture('assets/a.png')
    expect(texture?.width).toBe(8)
    expect(texture?.height).toBe(4)
    expect(texture?.source.scaleMode).toBe('nearest')
  })

  it('leaves a missing, unreadable or undecodable image unloaded, and never rejects', async () => {
    const store = storeOf({ 'assets/bad.png': new Uint8Array([1, 2, 3]), 'assets/io.png': 'throws' })
    manager = createTextureManager(store)
    await expect(
      manager.load(['assets/gone.png', 'assets/bad.png', 'assets/io.png']),
    ).resolves.toBeUndefined()
    expect(manager.loaded.size).toBe(0)
    expect(manager.texture('assets/bad.png')).toBeUndefined()
    expect(manager.frame('assets/bad.png', { x: 0, y: 0, w: 4, h: 4 })).toBeUndefined()
  })

  it('reads a loaded image once, and tries a failed one again', async () => {
    const store = storeOf({ 'assets/a.png': await cellsPng(1, 1, 4, ['#ff0000']) })
    manager = createTextureManager(store)
    await manager.load(['assets/a.png', 'assets/gone.png'])
    await manager.load(['assets/a.png', 'assets/gone.png'])
    expect(store.reads).toEqual(['assets/a.png', 'assets/gone.png', 'assets/gone.png'])
  })

  it('keeps one texture per frame rectangle, on the image’s source', async () => {
    const store = storeOf({ 'assets/a.png': await cellsPng(2, 1, 4, ['#ff0000', '#00ff00']) })
    manager = createTextureManager(store)
    await manager.load(['assets/a.png'])
    const right = manager.frame('assets/a.png', { x: 4, y: 0, w: 4, h: 4 })
    expect(right).toBe(manager.frame('assets/a.png', { x: 4, y: 0, w: 4, h: 4 }))
    expect(right).not.toBe(manager.frame('assets/a.png', { x: 0, y: 0, w: 4, h: 4 }))
    expect(right?.frame).toMatchObject({ x: 4, y: 0, width: 4, height: 4 })
    expect(right?.source).toBe(manager.texture('assets/a.png')?.source)
  })

  it('keeps one placeholder texture per label, colour and size', () => {
    manager = createTextureManager(storeOf({}))
    const seven = manager.placeholder('7', '#3a6ea5', { w: 16, h: 16 })
    expect(seven).toBe(manager.placeholder('7', '#3a6ea5', { w: 16, h: 16 }))
    expect(seven).not.toBe(manager.placeholder('8', '#3a6ea5', { w: 16, h: 16 }))
    expect(seven).not.toBe(manager.placeholder('7', '#3a6ea5', { w: 16, h: 8 }))
    expect(seven.width).toBe(64)
    expect(seven.height).toBe(64)
    // Never more than 256 px a side, whatever the tile.
    expect(manager.placeholder('7', '#3a6ea5', { w: 128, h: 32 }).width).toBe(256)
  })

  it('forgets an image, so the next load reads it again, and destroys its textures', async () => {
    const store = storeOf({ 'assets/a.png': await cellsPng(1, 1, 4, ['#ff0000']) })
    manager = createTextureManager(store)
    await manager.load(['assets/a.png'])
    const texture = manager.texture('assets/a.png')
    const frame = manager.frame('assets/a.png', { x: 0, y: 0, w: 2, h: 2 })
    manager.forget('assets/a.png')
    expect(manager.loaded.has('assets/a.png')).toBe(false)
    expect(texture?.destroyed).toBe(true)
    expect(frame?.destroyed).toBe(true)
    await manager.load(['assets/a.png'])
    expect(store.reads).toEqual(['assets/a.png', 'assets/a.png'])
  })

  it('destroys everything it made', async () => {
    const store = storeOf({ 'assets/a.png': await cellsPng(1, 1, 4, ['#ff0000']) })
    manager = createTextureManager(store)
    await manager.load(['assets/a.png'])
    const texture = manager.texture('assets/a.png')
    const placeholder = manager.placeholder('1', '#000000', { w: 8, h: 8 })
    manager.destroy()
    manager = undefined
    expect(texture?.destroyed).toBe(true)
    expect(placeholder.destroyed).toBe(true)
  })
})
