import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { openServedWorkspace } from '@mcthaydt/automata-editor-kit/core'
import { startEditor } from './app/boot'
import { lazyThumbnails } from './app/home/lazy-thumbnails'
import { storedLastOpened } from './app/home/stored-last-opened'
import { createColorResolver } from './canvas/colors'

// The only file that reaches for the page's globals (plan ED2D.4c2a, decision 9); everything else gets them through
// `startEditor`'s environment.

/** The tab's session storage, or nothing where the browser refuses it (a private window may throw). */
function sessionStorageOrNothing(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

const target = document.getElementById('app')
if (target === null) throw new Error('index.html has no #app element')

// Served by `automata editor`, the page's own origin is the game checkout; anywhere else it opens its own storage.
const served = await openServedWorkspace({
  origin: window.location.origin,
  search: window.location.search,
  sessionStorage: sessionStorageOrNothing(),
  storage: navigator.storage,
}).catch(() => undefined)

startEditor(target, {
  ...(served === undefined ? {} : { workspace: served }),
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
  lastOpened: storedLastOpened(() => localStorage),
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
