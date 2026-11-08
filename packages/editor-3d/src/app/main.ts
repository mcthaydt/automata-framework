import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import './main.css'
import { openServedWorkspace } from '@automata/editor/kit/core'
import { lazyPlanRenderer } from '../features/levels-3d/plan/lazy-renderer'
import { startEditor } from './boot'

// The only file that reaches for the page's globals (plan ED3D.5c); everything else gets them through
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
  storage: navigator.storage,
  renderer: lazyPlanRenderer(() => import('../features/levels-3d/plan/plan-renderer')),
  frames: {
    request: (callback) => requestAnimationFrame((ms) => callback(ms / 1000)),
    cancel: (handle) => cancelAnimationFrame(handle),
  },
}).catch((error: unknown) => {
  target.textContent = `The editor could not start: ${error instanceof Error ? error.message : String(error)}`
})
