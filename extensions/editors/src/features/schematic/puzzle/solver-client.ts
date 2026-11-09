// The page's side of the solver worker: one worker, one question at a time, the newest answer wins.
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { PuzzleAnswer } from './solve.ts'

export interface FinishChecker {
  /** Asks whether the puzzle can be finished; a newer question makes an older one's answer be ignored. */
  ask(def: PuzzleDef): Promise<PuzzleAnswer>
  stop(): void
}

const newWorker = (): Worker => new Worker(new URL('./solver-worker.ts', import.meta.url), { type: 'module' })

export function createFinishChecker(make: () => Worker = newWorker): FinishChecker {
  let worker: Worker | undefined
  let asked = 0
  return {
    ask(def) {
      worker ??= make()
      const id = ++asked
      const w = worker
      return new Promise<PuzzleAnswer>((resolve) => {
        const heard = (event: MessageEvent<{ id: number; answer?: PuzzleAnswer; error?: string }>): void => {
          if (event.data.id !== id) return
          w.removeEventListener('message', heard as EventListener)
          resolve(
            event.data.answer ?? {
              finishable: false,
              words: `The check could not run: ${event.data.error ?? 'no answer'}`,
            },
          )
        }
        w.addEventListener('message', heard as EventListener)
        w.postMessage({ id, def })
      })
    },
    stop() {
      worker?.terminate()
      worker = undefined
    },
  }
}
