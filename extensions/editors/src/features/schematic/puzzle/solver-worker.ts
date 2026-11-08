// The worker the page asks "Can it be finished?" of: it gets the puzzle as it is being edited, runs the solver, and sends
// back a sentence. It imports nothing that needs Node.
import type { PuzzleDef } from '@automata/puzzle/sim'
import { canFinish } from './solve.ts'

self.addEventListener('message', (event: MessageEvent<{ id: number; def: PuzzleDef }>) => {
  const { id, def } = event.data
  try {
    self.postMessage({ id, answer: canFinish(def) })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
})
