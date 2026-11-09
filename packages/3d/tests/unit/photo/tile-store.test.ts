import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import { createTileStore, tileTexel } from '#src/features/photo/tile-store.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { environmentBuilderLook } from '#src/testing/oracles.ts'
import { photoBytes } from '#src/testing/photo-files.ts'

const swatches = coreLibrary.swatches as Record<string, TexturedSwatch>
const oak = swatches.oakFloor as TexturedSwatch
// A test fetches by photo name, as the page fetches by URL.
const disk = (name: string): Promise<Uint8Array> => Promise.resolve(photoBytes(name))
const silent = (): void => undefined
const options = { swatches, urlOf: (photo: string) => photo }

describe('the tile store', () => {
  it('makes EnvironmentBuilder’s tiles', async () => {
    const store = createTileStore(disk, silent, options)
    for (const t of environmentBuilderLook().tiles) {
      const tile = await store.tile(t.swatch, swatches[t.swatch] as TexturedSwatch, t.texels, 1)
      expect(tile, t.swatch).toBeDefined()
      const labels = tile?.labels as Uint16Array
      expect([tile?.width, tile?.height]).toEqual([t.w, t.h])
      const bytes = new Uint8Array(labels.buffer, labels.byteOffset, labels.byteLength)
      expect(createHash('md5').update(bytes).digest('hex'), `${t.swatch} ${t.texels}`).toBe(t.md5)
    }
  }, 60_000)

  it('gives a tile its colours as RGBA, its texels a metre and the texel its seed starts at', async () => {
    const store = createTileStore(disk, silent, options)
    const tile = await store.tile('oakFloor', oak, [64, 64], 1)
    expect(tile?.rgba).toHaveLength((tile?.width ?? 0) * (tile?.height ?? 0) * 4)
    expect(tile?.texels).toEqual([64, 64])
    expect(tile?.rgba.filter((_, i) => i % 4 === 3).every((a) => a === 255)).toBe(true)
    const [x, y] = tile?.offset ?? [-1, -1]
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThan(tile?.width ?? 0)
    expect(y).toBeLessThan(tile?.height ?? 0)
  })

  it('wears a tile by the grime and caches by swatch, pair and grime', async () => {
    const store = createTileStore(disk, silent, options)
    const clean = await store.tile('oakFloor', oak, [64, 64], 1)
    expect(await store.tile('oakFloor', oak, [64, 64], 1)).toBe(clean)
    const dirty = await store.tile('oakFloor', oak, [64, 64], 2)
    expect(dirty).not.toBe(clean)
    expect(Array.from(dirty?.labels ?? [])).not.toEqual(Array.from(clean?.labels ?? []))
    expect(store.made).toBe(2)
  })

  it('draws a flat swatch with no tile and no warning', async () => {
    const warned: string[] = []
    const store = createTileStore(disk, (m) => warned.push(m), options)
    const flat = Object.values(swatches).find((s) => (s as TexturedSwatch).texture === undefined)
    expect(await store.tile('flat', flat as TexturedSwatch, [32, 32], 1)).toBeUndefined()
    expect(warned).toEqual([])
  })

  it('a photo that does not load draws its swatch flat and says which, once', async () => {
    const warned: string[] = []
    const store = createTileStore(
      () => Promise.reject(new Error('offline')),
      (m) => warned.push(m),
      options,
    )
    expect(await store.tile('oakFloor', oak, [64, 64], 1)).toBeUndefined()
    expect(await store.tile('oakFloor', oak, [32, 32], 1)).toBeUndefined()
    expect(warned).toEqual(['The material "oakFloor" could not load its photo, so it is drawn plain.'])
  })

  it('fetches and prepares a photo once for all its pairs', async () => {
    let fetched = 0
    const store = createTileStore(
      (url) => {
        fetched++
        return disk(url)
      },
      silent,
      options,
    )
    await store.prewarm([
      { name: 'oakFloor', swatch: oak, pair: [64, 64], grime: 1 },
      { name: 'oakFloor', swatch: oak, pair: [64, 32], grime: 1 },
      { name: 'oakFloor', swatch: oak, pair: [45, 45], grime: 1 },
    ])
    expect(fetched).toBe(1)
    expect(store.made).toBe(3)
  })

  it('makes one tile at a time and gives the page a turn between them', async () => {
    const turns: (() => void)[] = []
    const store = createTileStore(disk, silent, {
      ...options,
      turn: () => new Promise<void>((resolve) => turns.push(resolve)),
    })
    const all = store.prewarm([
      { name: 'oakFloor', swatch: oak, pair: [64, 64], grime: 1 },
      { name: 'oakFloor', swatch: oak, pair: [64, 32], grime: 1 },
      { name: 'oakFloor', swatch: oak, pair: [45, 45], grime: 1 },
    ])
    await vi_waitFor(() => turns.length === 1)
    expect(store.made).toBe(1)
    turns.shift()?.()
    await vi_waitFor(() => turns.length === 1)
    expect(store.made).toBe(2)
    turns.shift()?.()
    await vi_waitFor(() => turns.length === 1)
    turns.shift()?.()
    await all
    expect(store.made).toBe(3)
  })

  it('queues a tile asked for while frames are due, made one a frame, the old tile showing until then', async () => {
    const store = createTileStore(disk, silent, options)
    store.queue({ name: 'oakFloor', swatch: oak, pair: [64, 64], grime: 1 })
    store.queue({ name: 'oakFloor', swatch: oak, pair: [64, 32], grime: 1 })
    expect(store.pending).toBe(2)
    expect(await store.step()).toBe(true)
    expect(store.made).toBe(1)
    expect(store.pending).toBe(1)
    expect(await store.step()).toBe(true)
    expect(await store.step()).toBe(false)
    expect(store.made).toBe(2)
  })
})

const vi_waitFor = async (check: () => boolean): Promise<void> => {
  for (let i = 0; i < 2000 && !check(); i++) await new Promise((r) => setTimeout(r, 1))
  expect(check()).toBe(true)
}

describe('a tile’s texel at a place on its surface', () => {
  const tile = {
    width: 4,
    height: 4,
    texels: [4, 4] as const,
    offset: [1, 2] as const,
    labels: new Uint16Array(16),
    rgba: new Uint8Array(64),
  }
  it('starts at the origin when anchored, with no seed offset, rows running down a wall', () => {
    expect(tileTexel(tile, 0.1, 0.1, true, { anchored: true })).toEqual([0, 3])
    expect(tileTexel(tile, 1.1, 0.1, true, { anchored: true })).toEqual([0, 3])
    expect(tileTexel(tile, 0.3, 0.3, true, { anchored: true })).toEqual([1, 2])
  })
  it('keeps the seed’s offset where a surface is tiled in the world, rows running with v on a floor', () => {
    expect(tileTexel(tile, 0.1, 0.1, false, {})).toEqual([1, 2])
  })
  it('repeats a tile over more metres and pans it in whole texels', () => {
    expect(tileTexel(tile, 1.3, 0, false, { anchored: true, repeat: [2, 2] })).toEqual([2, 0])
    expect(tileTexel(tile, 0.5, 0, false, { anchored: true, pan: [0.25, 0] })).toEqual([1, 0])
  })
})
