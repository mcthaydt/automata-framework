import type { Hosting } from '@mcthaydt/automata-host'
import { Cause, Effect, Exit, Fiber, Option, Scope } from 'effect'
import { BootDefect, type BootError } from './boot-error.js'
import { bootProgram } from './boot-program.js'
import { failureHost } from './failure-host.js'
import type { GameDefinition, RuntimeHandle } from './game-definition.js'
import type { LoaderControls, PageLayers } from './page-layers.svelte.js'
import { createPageLayers } from './page-layers.svelte.js'

/**
 * Formats a boot error into a descriptive message for logging (spec §4).
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
    case 'BootDefect':
      return `Boot defect: ${String(error.cause)}`
    default: {
      const _exhaustive: never = error
      return `Unknown boot error: ${_exhaustive}`
    }
  }
}

/**
 * Boots and runs the game in a runtime Scope (spec §4 Failure and Shutdown).
 *
 * Each attempt runs in a fresh Scope. On failure, mounts BootFailurePanel and keeps
 * the attempt scope open so Back to {host} can access its Hosting service. Try again
 * and Continue without loading close the failed attempt scope and re-run bootProgram
 * in a fresh Scope on the same root without reloading the page.
 *
 * RuntimeHandle.shutdown() closes the runtime scope, running all finalizers in LIFO order.
 */
export function runGame<S>(game: GameDefinition<S>): RuntimeHandle {
  let currentScope: Scope.CloseableScope | null = null
  let capturedHosting: Hosting | null = null
  let unmountFailure: (() => void) | null = null
  let isShuttingDown = false
  let isShutdown = false
  let currentFiber: Fiber.RuntimeFiber<void, unknown> | null = null

  function runAttempt(skipSettingsRead: boolean) {
    if (isShuttingDown || isShutdown) return

    const program = Effect.gen(function* () {
      const scope = yield* Scope.make()
      currentScope = scope

      const layersRef: { current: PageLayers | null } = { current: null }
      const loaderRef: { current: LoaderControls | null } = { current: null }
      const hostingRef: { current: Hosting | null } = { current: null }

      const exit = yield* Effect.exit(
        Effect.provideService(
          bootProgram(game, {
            skipSettingsRead,
            onHosting: (h) => {
              hostingRef.current = h
              capturedHosting = h
            },
            onLayers: (l) => {
              layersRef.current = l
            },
            onLoader: (loader) => {
              loaderRef.current = loader
            },
          }),
          Scope.Scope,
          scope,
        ),
      )

      if (Exit.isFailure(exit)) {
        if (isShuttingDown || isShutdown) {
          yield* Scope.close(scope, Exit.void)
          currentScope = null
          return
        }

        const cause = exit.cause
        if (Cause.isInterruptedOnly(cause)) {
          return
        }

        const failureOpt = Cause.failureOption(cause)
        const error: BootError = Option.isSome(failureOpt)
          ? failureOpt.value
          : new BootDefect({ cause: Cause.squash(cause) })

        // Log error through describeBootError (exhaustive switch)
        yield* Effect.logError(describeBootError(error))
        game.seams?.onFailure?.(error)

        // Close loader if still mounted
        loaderRef.current?.close()

        // Ensure layers exist and set state to failed
        const doc = game.seams?.document ?? game.root.ownerDocument ?? document
        const layers = layersRef.current ?? createPageLayers(game.root, doc)
        layers.setState('failed')

        // Mount BootFailurePanel; attempt scope is kept open so Back to {host} has Hosting
        const closeFailure = layers.showBootFailure({
          failure: error,
          ...failureHost(hostingRef.current),
          copy: game.copy,
          onRetry: () => {
            closeFailure()
            unmountFailure = null
            void Effect.runPromise(
              Effect.gen(function* () {
                yield* Scope.close(scope, Exit.void)
                currentScope = null
                capturedHosting = null
                runAttempt(false)
              }),
            )
          },
          onContinue: () => {
            closeFailure()
            unmountFailure = null
            void Effect.runPromise(
              Effect.gen(function* () {
                yield* Scope.close(scope, Exit.void)
                currentScope = null
                capturedHosting = null
                runAttempt(true)
              }),
            )
          },
          onExit: () => {
            if (capturedHosting) {
              void Effect.runPromise(capturedHosting.exit('player'))
            }
          },
        })

        unmountFailure = closeFailure
      }
    })

    currentFiber = Effect.runFork(program)
  }

  // Start the first boot attempt
  runAttempt(false)

  return {
    async shutdown() {
      if (isShutdown) return
      if (isShuttingDown) return
      isShuttingDown = true

      if (unmountFailure) {
        unmountFailure()
        unmountFailure = null
      }

      if (currentFiber) {
        await Effect.runPromise(Fiber.interrupt(currentFiber))
        currentFiber = null
      }

      if (currentScope) {
        const scopeToClose = currentScope
        currentScope = null
        capturedHosting = null
        await Effect.runPromise(Scope.close(scopeToClose, Exit.void))
      }

      isShutdown = true
    },
  }
}
