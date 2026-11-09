// The photo library read from disk, for the tests and the Node tools: a photo's bytes, its hash, and a loader that caches
// the prepared source of each (name, facet, flatten) so a run reads a photo once. The game fetches the same bytes by URL.

import { readFileSync } from 'node:fs'
import { PHOTOS, type PhotoSourceLoader, photoOf, photoSource } from '../features/photo/photo-library.ts'
import type { PhotoSource } from '../features/photo/tile.ts'

const LIBRARY = new URL('../features/photo/library/', import.meta.url)

/** A photo's PNG, from the library folder. */
export function photoBytes(name: string): Uint8Array {
  return readFileSync(new URL(photoOf(PHOTOS, name).file, LIBRARY))
}

const prepared = new Map<string, Promise<PhotoSource>>()

/** A loader of prepared photo sources that reads from disk and remembers what it made. */
export const diskPhotoSources: PhotoSourceLoader = (name, facetRadius, flat) => {
  const key = `${name}|${facetRadius}|${flat}`
  let hit = prepared.get(key)
  if (hit === undefined) {
    hit = photoSource(photoBytes(name), photoOf(PHOTOS, name), facetRadius, flat)
    prepared.set(key, hit)
  }
  return hit
}
