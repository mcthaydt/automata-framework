// The photo library: `library/photos.json` (each photo's file, the metres it spans, where it came from, its licence and
// its credit) and the PNGs beside it. This file holds the index and makes a photo's pixels from bytes someone else
// fetched (the game from a URL, a test from disk), so it runs in a browser and in Node alike.

import library from './library/photos.json' with { type: 'json' }
import { facet, flatten, labOf } from './pipeline.ts'
import { decodePng } from './png.ts'
import { TEXTURE_DEFAULTS } from './texture-spec.ts'
import type { PhotoSource } from './tile.ts'

/** A photo in the library. */
export interface Photo {
  /** The PNG, relative to the library folder. */
  readonly file: string
  /** The metres it spans: width, height. */
  readonly size: readonly [number, number]
  readonly source: string
  readonly licence: string
  readonly credit?: string | undefined
}

export type PhotoLibrary = Readonly<Record<string, Photo>>

/** The library's index. */
export const PHOTOS: PhotoLibrary = library as unknown as PhotoLibrary

/** A photo by name; an unknown name says which the library has. */
export function photoOf(photos: PhotoLibrary, name: string): Photo {
  const photo = photos[name]
  if (photo === undefined)
    throw new Error(`There is no photo called "${name}". The library has: ${Object.keys(photos).join(', ')}.`)
  return photo
}

/** Reads a photo's pixels, flattened (`flat` of its slow light changes taken out) and faceted, as a texture needs it. */
export async function photoSource(
  bytes: Uint8Array,
  photo: Photo,
  facetRadius: number = TEXTURE_DEFAULTS.facet,
  flat: number = TEXTURE_DEFAULTS.flatten,
): Promise<PhotoSource> {
  const raw = labOf(await decodePng(bytes))
  return {
    lab: facet(flatten(raw, Math.max(raw.width, raw.height) / 8, flat), facetRadius),
    size: photo.size,
  }
}

/** How a caller hands over a photo's source: by name and the knobs that shape it (the caller caches). */
export type PhotoSourceLoader = (name: string, facetRadius: number, flat: number) => Promise<PhotoSource>
