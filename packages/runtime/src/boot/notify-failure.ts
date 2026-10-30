import type { RuntimeSeams } from './game-definition.js'

/**
 * Tells `seams.onFailure` what failed, after the runtime has handled it. A listener's own throw is swallowed: it must
 * never change how the runtime shows the failure.
 */
export function notifyFailure(seams: RuntimeSeams | undefined, cause: unknown): void {
  try {
    seams?.onFailure?.(cause)
  } catch {
    // The listener is a test's or the playground's; the runtime's own handling has already happened.
  }
}
