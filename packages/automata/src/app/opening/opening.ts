import type { RuntimeServices } from '../flow/screen.js'
import type { SeenFlags } from './seen-flags.js'

// The opening sequence: what a game shows after the host is ready and before its first screen. It is not part of the
// flow graph, so a game's content flow and its hash are untouched, and because the host's ready has already resolved
// it can never hold the host's ready signal back. First-run language, the photosensitivity warning and the game's
// splash are steps of it, in that order.

/** What an opening step is given. */
export interface OpeningContext {
  /** The step's own element in the overlay layer, removed when the step ends. */
  readonly layer: HTMLElement
  readonly services: Pick<RuntimeServices, 'hosting' | 'locale' | 'settings' | 'audio' | 'clock' | 'bus'>
  readonly seen: SeenFlags
  /** Aborted when the runtime shuts down; a step then resolves at once. */
  readonly signal: AbortSignal
}

/** One step before the first screen: it shows what it wants in `layer` and resolves when the player may go on. */
export type OpeningStep = (context: OpeningContext) => Promise<void>

/**
 * Runs the steps in order, each in its own element of `overlay`. A step that throws is reported through `warn` and
 * skipped: an opening never blocks play. Once `signal` is aborted no further step starts.
 */
export async function runOpening(
  steps: readonly OpeningStep[],
  context: Omit<OpeningContext, 'layer'>,
  overlay: HTMLElement,
  warn: (message: string) => void,
): Promise<void> {
  for (const step of steps) {
    if (context.signal.aborted) return
    const layer = overlay.ownerDocument.createElement('div')
    layer.setAttribute('data-opening-step', '')
    overlay.append(layer)
    try {
      await step({ ...context, layer })
    } catch (cause) {
      warn(
        `An opening step failed and was skipped: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    } finally {
      layer.remove()
    }
  }
}
