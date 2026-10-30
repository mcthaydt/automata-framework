import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { startEditor } from './app/boot'
import { createColorResolver } from './canvas/colors'
import { createLevelThumbnails } from './canvas/level-thumbnails'

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
  thumbnails: (workspace) =>
    createLevelThumbnails({
      read: (path) => workspace.store.read(path),
      colors: createColorResolver((name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name),
      ),
      makeCanvas: () => document.createElement('canvas'),
    }),
}).catch((error: unknown) => {
  target.textContent = `The editor could not start: ${error instanceof Error ? error.message : String(error)}`
})
