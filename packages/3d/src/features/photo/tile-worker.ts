// The tile maker in a worker: it fetches a photo, prepares it once and makes the tiles asked of it, so the page's own thread
// only sends a job and receives a tile. A same-origin module file, so a page that allows only its own scripts allows it.

import { PHOTOS, photoOf, photoSource } from './photo-library.ts'
import { TEXTURE_DEFAULTS } from './texture-spec.ts'
import type { PhotoSource } from './tile.ts'
import { renderTile, type TileJob } from './tile-render.ts'

interface WorkerScope {
  onmessage: ((event: { data: { id: number; job: TileJob } }) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}
const scope = self as unknown as WorkerScope

const sources = new Map<string, Promise<PhotoSource>>()

function sourceOf(job: TileJob): Promise<PhotoSource> {
  const facet = job.spec.facet ?? TEXTURE_DEFAULTS.facet
  const flat = job.spec.flatten ?? TEXTURE_DEFAULTS.flatten
  const key = `${job.photo}|${facet}|${flat}`
  let hit = sources.get(key)
  if (hit === undefined) {
    hit = fetch(job.url)
      .then((response) => {
        if (!response.ok) throw new Error(`${job.url}: ${response.status}`)
        return response.arrayBuffer()
      })
      .then((bytes) => photoSource(new Uint8Array(bytes), photoOf(PHOTOS, job.photo), facet, flat))
    sources.set(key, hit)
  }
  return hit
}

scope.onmessage = async ({ data: { id, job } }) => {
  try {
    const tile = renderTile(await sourceOf(job), job)
    scope.postMessage({ id, tile }, [tile.rgba.buffer, tile.labels.buffer])
  } catch (error) {
    // A photo that did not load is tried again by the next job that asks for it.
    sources.delete(
      `${job.photo}|${job.spec.facet ?? TEXTURE_DEFAULTS.facet}|${job.spec.flatten ?? TEXTURE_DEFAULTS.flatten}`,
    )
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }, [])
  }
}
