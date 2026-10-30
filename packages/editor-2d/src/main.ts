import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { startEditor } from './app/boot'
import { lazyThumbnails } from './app/home/lazy-thumbnails'
import { createColorResolver } from './canvas/colors'

// The only file that reaches for the page's globals (plan ED2D.4c2a, decision 9); everything else gets them through
// `startEditor`'s environment.

const target = document.getElementById('app')
if (target === null) throw new Error('index.html has no #app element')

startEditor(target, {
  window,
  document,
  clock: {
    now: () => Date.now(),
    setTimer: (ms, run) => window.setTimeout(run, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  },
  fillRandom: (bytes) => {
    crypto.getRandomValues(bytes)
  },
  storage: navigator.storage,
  objectUrls: {
    create: (bytes) => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])),
    revoke: (url) => URL.revokeObjectURL(url),
  },
  // Pixi is fetched with the first card that has a level to show, not with the editor (a chunk of its own).
  thumbnails: (workspace) =>
    lazyThumbnails(async () => {
      const { createLevelThumbnails } = await import('./canvas/level-thumbnails')
      return createLevelThumbnails({
        read: (path) => workspace.store.read(path),
        colors: createColorResolver((name) =>
          getComputedStyle(document.documentElement).getPropertyValue(name),
        ),
        makeCanvas: () => document.createElement('canvas'),
      })
    }),
}).catch((error: unknown) => {
  target.textContent = `The editor could not start: ${error instanceof Error ? error.message : String(error)}`
})
