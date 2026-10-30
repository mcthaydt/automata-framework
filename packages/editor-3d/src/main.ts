import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { startEditor } from './ui/boot'
import { lazyPlanRenderer } from './ui/plan/lazy-renderer'

// The only file that reaches for the page's globals (plan ED3D.5c); everything else gets them through
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
  storage: navigator.storage,
  renderer: lazyPlanRenderer(() => import('./ui/plan/plan-renderer')),
}).catch((error: unknown) => {
  target.textContent = `The editor could not start: ${error instanceof Error ? error.message : String(error)}`
})
