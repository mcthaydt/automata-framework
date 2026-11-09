// The tile store a page uses: tiles made in a pool of workers, photos fetched by the bundler's URLs. A game makes one for its
// swatches and gives it to `drawLevel`; the store keeps its tiles for the session, and `terminate` ends its workers.
import type { TexturedSwatch } from '../features/photo/swatch-tile.ts'
import type { TileJob } from '../features/photo/tile-render.ts'
import { createTileStore, type TileStore } from '../features/photo/tile-store.ts'
import { createWorkerTileMaker } from '../features/photo/tile-workers.ts'

export type BrowserTileStore = TileStore & { terminate(): void }

export function createBrowserTileStore(swatches: Readonly<Record<string, unknown>>): BrowserTileStore {
  // The pool starts with the first tile, so a page that imports the game but never draws a level starts no worker.
  let pool: ReturnType<typeof createWorkerTileMaker> | undefined
  const maker = {
    parallel: true,
    make: (job: TileJob) => {
      pool ??= createWorkerTileMaker()
      return pool.make(job)
    },
  }
  const store = createTileStore(
    async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()),
    (message) => console.warn(message),
    { swatches: swatches as Readonly<Record<string, TexturedSwatch>>, maker },
  )
  return Object.assign(store, { terminate: () => pool?.terminate() })
}
