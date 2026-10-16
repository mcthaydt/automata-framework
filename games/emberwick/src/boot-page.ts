import { Cause, Effect, Exit } from 'effect'
import { bootFailureMessage } from './boot-failure.ts'

export interface BootPageParts {
  /** The game's root element; on a failure its text becomes the message. */
  readonly root: { textContent: string | null }
  /** The <html> element; `data-state` becomes `ready` or `failed` (the browser journeys wait on it). */
  readonly html: { dataset: Record<string, string | undefined> }
  /** startGame(root), or any boot program in tests. */
  readonly start: Effect.Effect<void, unknown>
  readonly log: (message: string, error: unknown) => void
}

/**
 * Runs the boot and shows how it ended. runPromiseExit, not runPromise: the Exit keeps the failure itself,
 * while runPromise rejects with a FiberFailure wrapper whose `_tag` is never the failure's.
 */
export async function bootPage(parts: BootPageParts): Promise<void> {
  const exit = await Effect.runPromiseExit(parts.start)
  if (Exit.isSuccess(exit)) {
    parts.html.dataset.state = 'ready'
    return
  }
  parts.root.textContent = bootFailureMessage(exit.cause)
  parts.html.dataset.state = 'failed'
  // The underlying error (Ruken's, the loader's), not just the tag: Cause.pretty prints only "SimFailed: An
  // error has occurred".
  parts.log('base-2d: the game could not start', underlyingError(exit.cause))
}

function underlyingError(cause: Cause.Cause<unknown>): unknown {
  const error = Cause.squash(cause)
  return typeof error === 'object' && error !== null && 'cause' in error ? error.cause : error
}
