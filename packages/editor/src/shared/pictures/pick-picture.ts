// Getting a picture a person chose into the game folder: the file name it gets, the write that never goes over a file
// that is there, and what a refusal says. Add tiles (a picture of tiles) and a character's animation (a picture of
// frames) both put their pictures in `assets/` this way; a feature may not import another, so it lives here.
import type { ProjectStore } from '../kit/storage/project-store'
import type { Size } from '../level-2d/model/project-types'

/** The picture types a browser decodes everywhere the editor runs. */
export const PICTURE_TYPES = 'image/png,image/webp,image/jpeg'

/** The file name without its extension, as kebab-case: "Forest Tiles (v2)" is "forest-tiles-v2". */
export function slugOf(fileName: string, fallback = 'tiles'): string {
  const base = fileName.replace(/\.[^.]*$/, '')
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
  return slug === '' ? fallback : slug
}

/** `base`, or `base-2`, `base-3` … the first that is not taken. */
export function unused(base: string, taken: ReadonlySet<string>, make: (name: string) => string): string {
  if (!taken.has(make(base))) return make(base)
  for (let n = 2; ; n++) if (!taken.has(make(`${base}-${n}`))) return make(`${base}-${n}`)
}

/**
 * Where the picture is written: under `assets/` beside the levels (where every image the canvas draws lives), named
 * after the file in plain kebab-case with its own extension in lower case, never over a file that is there.
 */
export function pictureAsset(fileName: string, existing: readonly string[]): string {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? 'png'
  return unused(slugOf(fileName), new Set(existing), (name) => `assets/${name}.${extension}`)
}

/** A browser decodes the picture to learn its size; a file it cannot decode is not a picture we can read. */
export async function decodedSize(bytes: Uint8Array): Promise<Size | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]))
    const size = { w: bitmap.width, h: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return undefined
  }
}

/**
 * What a failed write says. A game that does not let the editor save pictures (`policy`) is not a fault to quote: the
 * person is told what is true and what to do. Any other failure carries its own plain sentence ("The disk is full.").
 */
function refusal(failed: { readonly reason: string; readonly message: string }): string {
  if (failed.reason === 'policy') {
    return 'This game doesn’t let the editor save pictures yet. Ask whoever set the game up to allow pictures in its assets folder.'
  }
  return `Couldn’t add the picture. ${failed.message}`
}

/** Writes `chosen` into `assets/` as a new file; the path it went to, or the sentence to show. */
export async function writePicture(
  files: Pick<ProjectStore, 'list' | 'write'>,
  chosen: { readonly name: string; readonly bytes: Uint8Array },
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const existing = (await files.list('assets/')).map((entry) => entry.path)
  const path = pictureAsset(chosen.name, existing)
  const written = await files.write(path, chosen.bytes, 'absent')
  return written.ok ? { ok: true, path } : { ok: false, message: refusal(written) }
}
