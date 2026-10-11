import type { RoundOutcome } from '@ruken/sdk'

// What happens when a round's sim cannot be made (out of Koota worlds or memory): there is nothing to play on,
// so the game stops for good. It ends the round it told the host about, stops the loop, removes its input and
// window listeners so no key press can reach a disposed sim, and shows the same message and page state as a
// boot failure (main.ts). Terminal: after the first failure every later call does nothing.

export interface FailureParts {
  readonly root: { textContent: string | null }
  readonly html: { dataset: Record<string, string | undefined> }
  readonly stopLoop: () => void
  readonly endRound: (outcome: RoundOutcome) => void
  /** Removes listeners: input devices, resize, and anything else that could still call into the game. */
  readonly cleanups: ReadonlyArray<() => void>
  readonly log: (error: unknown) => void
}

export interface Failure {
  failed(): boolean
  fail(error: unknown): void
}

export function createFailure(parts: FailureParts): Failure {
  let failed = false
  return {
    failed: () => failed,
    fail(error) {
      if (failed) return
      failed = true
      parts.log(error)
      parts.stopLoop()
      parts.endRound('fail')
      for (const cleanup of parts.cleanups) cleanup()
      parts.root.textContent = "This device can't run the game."
      parts.html.dataset.state = 'failed'
    },
  }
}
