import type { Hosting } from '../../shared/host/hosting.ts'
import type { BootError } from '../../shared/runtime/boot-error.js'
import type { LoaderControls, PageLayers } from '../../shared/runtime/page-layers.svelte.js'
import { createPageLayers } from '../../shared/runtime/page-layers.svelte.js'
import { bootProgram } from './boot-program.js'
import { failureHost } from './failure-host.js'
import type { GameDefinition, RuntimeHandle } from './game-definition.js'
import { notifyFailure } from './notify-failure.js'
import { type Teardown, teardown } from './teardown.ts'

/**
 * Formats a boot error into a descriptive message for logging.
 * The match is exhaustive and ends in never.
 */
export function describeBootError(error: BootError): string {
  switch (error._tag) {
    case 'HostError':
      return `Host error during ${error.operation}: [${error.code}] ${error.message ?? ''}`
    case 'ContentHashMismatch':
      return `Content hash mismatch: expected ${error.expected}, actual ${error.actual}`
    case 'AssetLoadFailed':
      return `Asset load failed: ${error.url} (status ${error.status})`
    case 'LoadStalled':
      return `Load stalled: ${error.url} after ${error.stalledMs} ms (${error.bytesSoFar} bytes)`
    case 'RendererUnavailable':
      return `Renderer unavailable: tried ${error.tried.join(', ')}`
    case 'ModelInvalid':
      return `Model invalid: ${error.file} (${error.reason})`
    case 'BootDefect':
      return `Boot defect: ${String(error.cause)}`
    default: {
      const _exhaustive: never = error
      return `Unknown boot error: ${_exhaustive}`
    }
  }
}

/**
 * Boots and runs the game: a failure draws the boot failure panel, and `shutdown` closes everything the runtime opened.
 *
 * Each attempt opens into a fresh `Teardown`. On failure it mounts the boot failure panel and keeps the attempt open,
 * so Back to {host} can still reach its `Hosting`. Try again and Continue without loading close the failed attempt and
 * boot again on the same root without reloading the page. Inside a Ruken session, Try again reloads the game's frame
 * instead: the host answers one hello per frame load, so a second session in this load would never be welcomed.
 *
 * `shutdown()` stops a boot under way and closes the current attempt, last opened first.
 */
export function runGame<S>(game: GameDefinition<S>): RuntimeHandle {
  let current: { readonly owned: Teardown; readonly abort: AbortController } | null = null
  let unmountFailure: (() => void) | null = null
  let stopping = false

  /** Closes the current attempt (stopping its boot first) and forgets it. */
  async function closeAttempt(): Promise<void> {
    const attempt = current
    current = null
    if (attempt === null) return
    attempt.abort.abort()
    await attempt.owned.close()
  }

  async function runAttempt(skipSettingsRead: boolean): Promise<void> {
    if (stopping) return
    const owned = teardown()
    const abort = new AbortController()
    current = { owned, abort }
    let layers: PageLayers | null = null
    let loader: LoaderControls | null = null
    let hosting: Hosting | null = null

    const booted = await bootProgram(game, owned, {
      skipSettingsRead,
      signal: abort.signal,
      onHosting: (opened) => {
        hosting = opened
      },
      onLayers: (opened) => {
        layers = opened
      },
      onLoader: (opened) => {
        loader = opened
      },
    })
    if (booted.ok || abort.signal.aborted || stopping) return

    const error = booted.reason
    console.error(describeBootError(error))
    ;(loader as LoaderControls | null)?.close()

    const doc = game.seams?.document ?? game.root.ownerDocument ?? document
    const failedLayers = (layers as PageLayers | null) ?? createPageLayers(game.root, doc)
    failedLayers.setState('failed')

    const failedHosting = hosting as Hosting | null
    const retry = (skip: boolean) => {
      closeFailure()
      unmountFailure = null
      void closeAttempt().then(() => runAttempt(skip))
    }
    // The attempt stays open so Back to {host} still has its Hosting.
    const closeFailure = failedLayers.showBootFailure({
      failure: error,
      ...failureHost(failedHosting),
      copy: game.copy,
      onRetry: () => {
        if (failedHosting?.kind === 'ruken') {
          const reload = game.seams?.reload ?? (() => doc.defaultView?.location.reload())
          reload()
          return
        }
        retry(false)
      },
      onContinue: () => retry(true),
      onExit: () => {
        if (failedHosting !== null) void failedHosting.exit('player')
      },
    })
    notifyFailure(game.seams, error)
    unmountFailure = closeFailure
  }

  // Start the first boot attempt
  void runAttempt(false)

  return {
    async shutdown() {
      if (stopping) return
      stopping = true
      unmountFailure?.()
      unmountFailure = null
      // A boot under way gives up at its next step; anything it opens after this closes at once (`Teardown.add`).
      await closeAttempt()
    },
  }
}
