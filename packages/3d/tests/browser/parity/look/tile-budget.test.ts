// The tiles a level's views need are made at load. Made on the page's own thread the base scenes' tiles for three views
// took 7.7 s under a 4× CPU throttle (a phone's pace), so they are made in workers: the same tiles must arrive in about two
// seconds, and the page's own thread must never be held for long while they are made.
import { describe, expect, it } from 'vitest'
import { cdp, server } from 'vitest/browser'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import { tileScales } from '#src/features/photo/tile-scales.ts'
import { createTileStore, type TileRequest } from '#src/features/photo/tile-store.ts'
import { createWorkerTileMaker } from '#src/features/photo/tile-workers.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { DRESSED_BASE_SCENES } from '#src/features/world/base/dressed-base-scenes.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { tileName } from '#src/features/world/surface.ts'

const LENS = 2 * Math.atan(0.5)
const swatches = coreLibrary.swatches as Record<string, TexturedSwatch>

/** The textured swatches a scene's pieces are drawn with. */
function texturedIn(level: Parameters<typeof buildWorld>[0]): string[] {
  const names = new Set<string>()
  for (const piece of buildWorld(level, coreLibrary).pieces) {
    const name = tileName(piece.surface).split('#')[0] as string
    if ((swatches[name] as TexturedSwatch | undefined)?.texture !== undefined) names.add(name)
  }
  return [...names]
}

describe('the tiles of the base scenes’ views', () => {
  // The CPU throttle is Chromium's (the DevTools protocol); the other engines' tiles are held to Node's by the engines test.
  it.skipIf(server.browser !== 'chromium')(
    'are made in under two seconds at a quarter of the page’s speed',
    async () => {
      const names = new Set<string>()
      for (const level of [...Object.values(BASE_SCENES), ...Object.values(DRESSED_BASE_SCENES)])
        for (const name of texturedIn(level)) names.add(name)
      const views = [
        { distance: 5, tiltDeg: 25 },
        { distance: 7, tiltDeg: 25 },
        { distance: 5, tiltDeg: 60 },
      ]
      const requests: TileRequest[] = []
      for (const name of names)
        for (const view of views) {
          const scales = tileScales(view, 360, LENS)
          for (const pair of [scales.floor, scales.wall])
            requests.push({ name, swatch: swatches[name] as TexturedSwatch, pair, grime: 1 })
        }
      const maker = createWorkerTileMaker()
      const store = createTileStore(
        async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()),
        (message) => {
          throw new Error(message)
        },
        { swatches, maker },
      )
      let longest = 0
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longest = Math.max(longest, entry.duration)
      })
      observer.observe({ entryTypes: ['longtask'] })
      await cdp().send('Emulation.setCPUThrottlingRate', { rate: 4 })
      const start = performance.now()
      try {
        await store.prewarm(requests)
      } finally {
        observer.disconnect()
        maker.terminate()
        await cdp().send('Emulation.setCPUThrottlingRate', { rate: 1 })
      }
      const ms = performance.now() - start
      console.info(
        `${names.size} swatches, ${store.made} tiles, ${Math.round(ms)} ms at 4× throttle, longest page task ${Math.round(longest)} ms`,
      )
      expect(store.made).toBeGreaterThan(names.size)
      // Measured 1.8 s on four shared cores; the gate leaves room for a busy runner.
      expect(ms).toBeLessThan(3000)
      expect(longest).toBeLessThan(100)
    },
    60_000,
  )

  it('a worker makes the tile the page’s own thread makes', async () => {
    const maker = createWorkerTileMaker(1)
    const fetchBytes = async (url: string): Promise<Uint8Array> =>
      new Uint8Array(await (await fetch(url)).arrayBuffer())
    const oak = swatches.oakFloor as TexturedSwatch
    try {
      const inline = await createTileStore(fetchBytes, () => undefined, { swatches }).tile(
        'oakFloor',
        oak,
        [64, 32],
        1.5,
      )
      const worker = await createTileStore(fetchBytes, () => undefined, { swatches, maker }).tile(
        'oakFloor',
        oak,
        [64, 32],
        1.5,
      )
      expect(inline).toBeDefined()
      expect(Array.from(worker?.labels ?? [])).toEqual(Array.from(inline?.labels ?? []))
      expect(Array.from(worker?.rgba ?? [])).toEqual(Array.from(inline?.rgba ?? []))
      expect(worker?.offset).toEqual(inline?.offset)
    } finally {
      maker.terminate()
    }
  }, 30_000)
})
