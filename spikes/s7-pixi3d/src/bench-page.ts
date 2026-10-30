// S7-Q8 and S7-Q9 in the browser (M3.1b): the same timings as bench/rig-bench.ts, run on the phone profiles by
// e2e/gpu.e2e.ts. Imports what the scene's page imports first (render-pixi/no-eval and the S7-Q1 shim), so the
// modules run as they would in the game. `window.__s7bench` carries the result, or the error.
import '@mcthaydt/automata-render-pixi/no-eval'
import './mount/pixi3d-no-eval.ts'
import { runRigBench } from './bench/rig-timing.ts'

const state: { done: boolean; result?: unknown; error?: string } = { done: false }
;(window as unknown as { __s7bench: typeof state }).__s7bench = state

// After the page has settled, so the timings do not share the main thread with the load.
setTimeout(() => {
  try {
    state.result = runRigBench()
  } catch (error) {
    state.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  }
  state.done = true
}, 500)
