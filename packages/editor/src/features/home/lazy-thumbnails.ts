import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'

// Home's thumbnails behind a dynamic import: `main.ts` hands `load` an `import()` of the Pixi module, so
// the editor starts without Pixi and fetches it with the first card that has a level to show. Only a type is imported
// here, so this file pulls no renderer into the main chunk.

export function lazyThumbnails(load: () => Promise<LevelThumbnails>): LevelThumbnails {
  let loading: Promise<LevelThumbnails | undefined> | undefined
  let disposed = false

  function loaded(): Promise<LevelThumbnails | undefined> {
    loading ??= load().then(
      (made) => {
        // Disposed while it loaded: let it go at once.
        if (disposed) made.dispose()
        return disposed ? undefined : made
      },
      () => undefined,
    )
    return loading
  }

  return {
    async thumbnail(key, preview) {
      if (disposed) return undefined
      const made = await loaded()
      return made === undefined || disposed ? undefined : made.thumbnail(key, preview)
    },
    dispose() {
      if (disposed) return
      disposed = true
      void loading?.then((made) => made?.dispose())
    },
  }
}
