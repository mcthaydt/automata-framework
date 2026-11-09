// A pool of tile-making workers. A photo's jobs all go to one worker (by the photo's name), so it is fetched and prepared
// once, and different photos are made in parallel on the device's other cores while the page's own thread stays free.

import type { PaintedTile, TileJob } from './tile-render.ts'
import type { TileMaker } from './tile-store.ts'

/** The most workers a pool starts: tile making is memory-light but each worker prepares its own photos. */
const MOST_WORKERS = 4

interface Pending {
  readonly resolve: (tile: PaintedTile) => void
  readonly reject: (error: Error) => void
}

export function createWorkerTileMaker(count?: number): TileMaker & { terminate(): void } {
  const size = Math.max(
    1,
    Math.min(count ?? MOST_WORKERS, MOST_WORKERS, Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1)),
  )
  const pending = new Map<number, Pending>()
  let next = 0
  const workers = Array.from({ length: size }, () => {
    const worker = new Worker(new URL('./tile-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent<{ id: number; tile?: PaintedTile; error?: string }>) => {
      const job = pending.get(data.id)
      pending.delete(data.id)
      if (data.tile !== undefined) job?.resolve(data.tile)
      else job?.reject(new Error(data.error ?? 'the tile worker failed'))
    }
    worker.onerror = (event) => {
      for (const job of pending.values()) job.reject(new Error(event.message))
      pending.clear()
    }
    return worker
  })
  const slot = (photo: string): number => {
    let h = 0
    for (let i = 0; i < photo.length; i++) h = (h * 31 + photo.charCodeAt(i)) >>> 0
    return h % workers.length
  }
  return {
    parallel: true,
    make: (job: TileJob) =>
      new Promise<PaintedTile>((resolve, reject) => {
        const id = next++
        pending.set(id, { resolve, reject })
        workers[slot(job.photo)]?.postMessage({ id, job })
      }),
    terminate: () => {
      for (const worker of workers) worker.terminate()
    },
  }
}
