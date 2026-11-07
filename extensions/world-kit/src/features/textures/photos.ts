// The photo library on disk: `assets/photos/photos.json` (each photo's file, the metres it spans, where it came from, its
// licence and its credit) and the PNGs beside it. Node only. A photo is read once per run; its sha-256 is what a committed
// tile is stamped with, so a tile older than its photo is told.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { facet, flatten, labOf } from './pipeline.ts'
import { decodePng } from './png.ts'
import { TEXTURE_DEFAULTS } from './texture-spec.ts'
import type { PhotoSource } from './tile.ts'

/** A photo in the library. */
export interface Photo {
  readonly file: string
  /** The metres it spans: width, height. */
  readonly size: readonly [number, number]
  readonly source: string
  readonly licence: string
  readonly credit?: string | undefined
}

/** The library folder: the photos and `photos.json`. */
export const PHOTO_DIR = new URL('../../../assets/photos/', import.meta.url)

export type PhotoLibrary = Readonly<Record<string, Photo>>

/** The library `dir` holds. */
export function readPhotoLibrary(dir: URL = PHOTO_DIR): PhotoLibrary {
  return JSON.parse(readFileSync(new URL('photos.json', dir), 'utf8')) as PhotoLibrary
}

/** A photo by name; an unknown name says which the library has. */
export function photoOf(library: PhotoLibrary, name: string): Photo {
  const photo = library[name]
  if (photo === undefined)
    throw new Error(
      `There is no photo called "${name}". The library has: ${Object.keys(library).join(', ')}.`,
    )
  return photo
}

/** The photo's bytes. */
export const photoBytes = (photo: Photo, dir: URL = PHOTO_DIR): Uint8Array =>
  readFileSync(new URL(photo.file, dir))

/** The sha-256 of the photo's bytes, in hex. */
export const photoHash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const prepared = new Map<string, PhotoSource>()

/** A photo read, flattened (`flat` of its slow light changes taken out) and faceted, cached by what was asked. */
export function photoSource(
  library: PhotoLibrary,
  name: string,
  facetRadius: number = TEXTURE_DEFAULTS.facet,
  flat: number = TEXTURE_DEFAULTS.flatten,
  dir: URL = PHOTO_DIR,
): PhotoSource {
  const key = `${dir.href}|${name}|${facetRadius}|${flat}`
  let hit = prepared.get(key)
  if (hit === undefined) {
    const photo = photoOf(library, name)
    const raw = labOf(decodePng(photoBytes(photo, dir)))
    hit = {
      lab: facet(flatten(raw, Math.max(raw.width, raw.height) / 8, flat), facetRadius),
      size: photo.size,
    }
    prepared.set(key, hit)
  }
  return hit
}
