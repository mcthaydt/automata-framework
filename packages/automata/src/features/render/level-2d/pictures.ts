import { Assets, Texture as PixiTexture, Rectangle, type Texture } from 'pixi.js'

// The pictures a game's content names (`assets/terrain.png`), loaded once per game and cut into frames once. The
// level and every `pictureView` of a game share them, so a tileset is fetched and uploaded one time.

/** The loaded pictures of one game. */
export interface Pictures {
  /** The picture at `path`, or undefined while it loads (the first ask starts the load) or when the game lacks it. */
  texture(path: string): Texture | undefined
  /** A rectangle of a loaded picture, cut once. Undefined until the picture is loaded. */
  cut(
    path: string,
    frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  ): Texture | undefined
  /** Calls `listener` with the path of each picture as it arrives; returns the way to stop. */
  onLoad(listener: (path: string) => void): () => void
}

const shared = new WeakMap<object, Pictures>()

const report = (message: string): void => globalThis.reportError?.(new Error(message))

/** The pictures of the game whose workspace paths map to `images` (the same object gives the same cache). */
export function picturesOf(images: Readonly<Record<string, string>>): Pictures {
  const known = shared.get(images)
  if (known !== undefined) return known
  const textures = new Map<string, Texture>()
  const cuts = new Map<string, Texture>()
  const requested = new Set<string>()
  const listeners = new Set<(path: string) => void>()

  const made: Pictures = {
    texture(path) {
      const have = textures.get(path)
      if (have !== undefined) return have
      const url = images[path]
      if (url === undefined || requested.has(path)) return undefined
      requested.add(path)
      const cached = Assets.cache.get(url) as Texture | undefined
      if (cached !== undefined) {
        textures.set(path, cached)
        return cached
      }
      // The parser is named, not guessed from the url: a small picture is a `data:` url once the build inlines it.
      Assets.load<Texture>({ src: url, parser: 'loadTextures' }).then(
        (loaded) => {
          textures.set(path, loaded)
          for (const listener of [...listeners]) listener(path)
        },
        () => report(`The picture "${path}" could not be loaded.`),
      )
      return undefined
    },
    cut(path, frame) {
      const sheet = made.texture(path)
      if (sheet === undefined) return undefined
      const key = `${path}|${frame.x}|${frame.y}|${frame.w}|${frame.h}`
      let cut = cuts.get(key)
      if (cut === undefined) {
        cut = new PixiTexture({
          source: sheet.source,
          frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
        })
        cuts.set(key, cut)
      }
      return cut
    },
    onLoad(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
  shared.set(images, made)
  return made
}
