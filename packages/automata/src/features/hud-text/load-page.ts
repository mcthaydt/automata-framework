import { BitmapFont, Cache, ImageSource, Texture } from 'pixi.js'
import type { PageId } from './pages.ts'

const loading = new Map<PageId, Promise<string>>()
const loaded = new Map<PageId, string>()

// A dynamic import is a JavaScript chunk next to the game's own, so a game that draws no text never downloads a page
// and every target already serves it (the PNG is decoded from bytes and never becomes an image request).
const importPage = (id: PageId) =>
  id === 'latin' ? import('./fonts/latin-font.ts') : import('./fonts/cyrillic-font.ts')

const bytesOf = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function load(id: PageId): Promise<string> {
  const { FONT, NOTICE, ATLAS_PNG_BASE64 } = await importPage(id)
  const bitmap = await createImageBitmap(new Blob([bytesOf(ATLAS_PNG_BASE64)], { type: 'image/png' }))
  // The options Pixi's own loader gives a distance-field font. Pixel art makes every new texture nearest, which tears
  // an MSDF edge, so none of them is left to the default.
  const source = new ImageSource({
    resource: bitmap,
    scaleMode: 'linear',
    alphaMode: 'premultiply-alpha-on-upload',
    autoGenerateMipmaps: false,
    resolution: 1,
  })
  const font = new BitmapFont({ data: FONT, textures: [new Texture({ source })] })
  Cache.set(`${FONT.fontFamily}-bitmap`, font)
  // The font's copyright and licence, kept as data: a game's minifier drops the comment that says the same.
  Cache.set(`${FONT.fontFamily}-notice`, NOTICE)
  loaded.set(id, FONT.fontFamily)
  return FONT.fontFamily
}

/**
 * Registers a baked font page with Pixi under its family (`af-hud-latin`) and resolves to that family. One load per
 * page; a failed load is forgotten, so the next ask tries again.
 */
export function loadPage(id: PageId): Promise<string> {
  let pending = loading.get(id)
  if (pending === undefined) {
    pending = load(id)
    loading.set(id, pending)
    pending.catch(() => loading.delete(id))
  }
  return pending
}

/** A page's family once it is loaded, else `undefined` (the label draws with the fallback meanwhile). */
export function pageFamilyIfLoaded(id: PageId): string | undefined {
  return loaded.get(id)
}
