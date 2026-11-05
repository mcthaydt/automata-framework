import type { FlowGraph } from '@mcthaydt/automata-content'
import {
  Cause,
  Context,
  Deferred,
  Effect,
  ExecutionStrategy,
  Exit,
  FiberId,
  Option,
  Queue,
  Scope,
} from 'effect'
import type { PageLayers } from '../../shared/runtime/page-layers.svelte.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { Time } from '../../shared/runtime/time/time.manager.js'
import { tabbables } from '../../shared/ui/focus/focus-nav.ts'
import type { GeometryOwner } from '../../shared/ui/geometry/geometry-owner.svelte.ts'
import { BOOT_FAILURE_COPY_EN, type BootFailureCopy } from '../../shared/ui/status/boot-failure.ts'
import type { Assets } from '../loading/assets.manager.js'
import type { FlowFailure, RuntimeServices, ScreenContext, ScreenDef } from './screen.js'
import type { Veil } from './veil.js'

/**
 * The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu`
 * for the current screen's menu, and `settled` once no transition is pending.
 */
export interface Flow {
  readonly current: string | undefined
  dispatch(event: string): boolean
  openMenu(): boolean
  readonly settled: Effect.Effect<void>
}

export const Flow: Context.Tag<Flow, Flow> = Context.GenericTag<Flow>('@mcthaydt/automata-runtime/Flow')

export interface MakeFlowOptions<R = never> {
  readonly graph: FlowGraph
  readonly screens: readonly ScreenDef<R>[]
  readonly layers: PageLayers
  readonly assets: Assets
  readonly time: Time
  readonly bus: PresentationBus
  readonly geometry: GeometryOwner
  readonly veil: Veil
  readonly copy?: Partial<BootFailureCopy> & { readonly loading?: string; readonly slow?: string }
  readonly services: () => Context.Context<RuntimeServices | R>
  readonly logUnmatched?: (screen: string, event: string) => void
  /**
   * What every screen gets as `ScreenContext.runtime`. Boot forks it before the save, so it closes after the save's
   * last flush; absent, the flow forks one before its own finalizer, so it closes after the current screen.
   */
  readonly runtime?: Scope.Scope
  /** Hears why a screen could not load or enter, after the error panel is up (`RuntimeSeams.onFailure`). */
  readonly onFailure?: (cause: unknown) => void
}

export interface FlowHandle {
  readonly flow: Flow
  readonly start: () => Effect.Effect<void>
  readonly reportFailure: (failure: FlowFailure) => void
}

interface QueuedTransition {
  readonly from: string | undefined
  readonly to: string
  readonly style: string
  readonly force?: boolean | undefined
}

/** How a focused control is found again after its screen remounts: its `data-testid`, else its `id`. */
type FocusName = { readonly attribute: 'data-testid' | 'id'; readonly value: string }

/** The name of the focused control under `root`, or undefined when focus is elsewhere or the control is unnamed. */
function focusName(root: ParentNode): FocusName | undefined {
  const active = root instanceof Node ? root.ownerDocument?.activeElement : undefined
  if (!(active instanceof HTMLElement) || !root.contains(active)) return undefined
  const testId = active.getAttribute('data-testid')
  if (testId !== null && testId !== '') return { attribute: 'data-testid', value: testId }
  return active.id === '' ? undefined : { attribute: 'id', value: active.id }
}

function findByName(root: HTMLElement, name: FocusName): HTMLElement | null {
  return (
    [...root.querySelectorAll<HTMLElement>(`[${name.attribute}]`)].find(
      (element) => element.getAttribute(name.attribute) === name.value,
    ) ?? null
  )
}

/**
 * Creates the Flow service and transition queue manager (spec §3.6).
 * Follows the 9-step transition order, coordinates single-flight screens,
 * veil fading, loader overlay over missing assets, and menu pauses.
 */
export function makeFlow<R = never>(
  options: MakeFlowOptions<R>,
): Effect.Effect<FlowHandle, never, Scope.Scope> {
  return Effect.gen(function* () {
    const runtimeScope = yield* Scope.Scope
    // Forked before the finalizer below is added, so it closes after that finalizer has closed the current screen.
    const keptAcrossScreens =
      options.runtime ?? (yield* Scope.fork(runtimeScope, ExecutionStrategy.sequential))
    const queue: QueuedTransition[] = []
    const trigger = yield* Queue.unbounded<void>()
    const loggedUnmatched = new Set<string>()

    let busy = false
    let closed = false
    let isCovered = false
    let currentScreenId: string | undefined
    let currentScreenDef: ScreenDef<R> | undefined
    let currentScreenScope: Scope.CloseableScope | null = null

    let idleDeferred: Deferred.Deferred<void, never> = yield* Deferred.make<void>()
    yield* Deferred.succeed(idleDeferred, undefined)

    const enqueueTransition = (to: string, style: string, from?: string, force?: boolean): void => {
      if (closed) return
      if (!busy && queue.length === 0) {
        idleDeferred = Deferred.unsafeMake<void>(FiberId.none)
      }
      queue.push({ from, to, style, force })
      Queue.unsafeOffer(trigger, undefined)
    }

    /** Per screen, the name of the control that had focus when the player last left it (F-b). */
    const lastFocus = new Map<string, FocusName>()

    const runTransition = (next: QueuedTransition): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (closed) return
        if (next.to === currentScreenId && !next.force) {
          if (isCovered && queue.length === 0) {
            yield* options.veil.reveal()
            isCovered = false
          }
          return
        }

        const targetScreen = options.screens.find((s) => s.id === next.to)
        if (!targetScreen) {
          return
        }

        // (1) Load target's files and fonts with LoaderOverlay over the current screen when anything is missing (Q8)
        if (!options.assets.isLoaded(targetScreen.id)) {
          const loader = options.layers.showLoader({
            label: options.copy?.loading ?? 'Loading…',
            slowLabel: options.copy?.slow ?? 'Taking a while…',
          })
          const loadResult = yield* Effect.exit(
            options.assets.load(targetScreen.id, (fraction) => loader.setProgress(fraction)),
          )
          loader.close()
          if (Exit.isFailure(loadResult)) {
            const errorOpt = Cause.failureOption(loadResult.cause)
            const isStalled = Option.isSome(errorOpt) && errorOpt.value._tag === 'LoadStalled'
            const code = isStalled ? 'download-stalled' : 'download'
            const message = isStalled
              ? (options.copy?.['download-stalled'] ?? BOOT_FAILURE_COPY_EN['download-stalled'])
              : (options.copy?.download ?? BOOT_FAILURE_COPY_EN.download)
            const dismiss = options.layers.showError({
              code,
              message,
              actions: [
                {
                  id: 'retry',
                  label: options.copy?.retry ?? BOOT_FAILURE_COPY_EN.retry,
                  kind: 'primary',
                  onSelect: () => {
                    dismiss()
                    enqueueTransition(targetScreen.id, next.style, next.from, true)
                  },
                },
              ],
            })
            queue.length = 0
            options.onFailure?.(Option.isSome(errorOpt) ? errorOpt.value : Cause.squash(loadResult.cause))
            return
          }
        }

        // (2) Cover, for `fade`
        if (next.style === 'fade' && !isCovered) {
          const coveredOk = yield* options.veil.cover()
          if (coveredOk) {
            isCovered = true
          } else {
            // A veil that fails to cover makes the edge a cut
            isCovered = false
          }
        }

        // (3) Remember what had focus on the screen being left (M4 spec §4.7, F-b), then close the current screen's
        // scope (its finalizers run in reverse order, replacing DisposeBag)
        if (currentScreenId !== undefined) {
          const name = focusName(options.layers.screens)
          if (name === undefined) lastFocus.delete(currentScreenId)
          else lastFocus.set(currentScreenId, name)
        }
        if (currentScreenScope) {
          yield* Scope.close(currentScreenScope, Exit.void)
          currentScreenScope = null
          currentScreenDef = undefined
        }

        // (4) Set `current` to the target before awaiting its enter
        const previousScreen = currentScreenId
        currentScreenId = targetScreen.id
        currentScreenDef = targetScreen

        // (5) Run `enter` in a new child scope of the runtime scope, inside the screen layer
        const childScope = yield* Scope.fork(runtimeScope, ExecutionStrategy.sequential)
        currentScreenScope = childScope

        const doc =
          options.layers.screens.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined)
        const section = doc ? doc.createElement('section') : ({} as HTMLElement)
        if (section.setAttribute) {
          section.setAttribute('data-screen', targetScreen.id)
          options.layers.screens.appendChild(section)
        }

        // First finalizer removes section, so in sequential LIFO execution it runs last
        yield* Scope.addFinalizer(
          childScope,
          Effect.sync(() => {
            try {
              if (typeof section.remove === 'function') {
                section.remove()
              } else if (section.parentElement) {
                section.parentElement.removeChild(section)
              }
            } catch {
              // ignore DOM cleanup error
            }
          }),
        )

        const context: ScreenContext = {
          layer: section,
          from: previousScreen,
          runtime: keptAcrossScreens,
        }

        const enterResult = yield* Effect.exit(
          targetScreen
            .enter(context)
            .pipe(Effect.provideService(Scope.Scope, childScope), Effect.provide(options.services())),
        )

        if (Exit.isFailure(enterResult)) {
          yield* Scope.close(childScope, Exit.void)
          currentScreenScope = null
          currentScreenDef = undefined
          currentScreenId = undefined
          queue.length = 0
          if (isCovered) {
            yield* options.veil.reveal()
            isCovered = false
          }
          const dismiss = options.layers.showError({
            code: 'start',
            message: options.copy?.start ?? BOOT_FAILURE_COPY_EN.start,
            actions: [
              {
                id: 'retry',
                label: options.copy?.retry ?? BOOT_FAILURE_COPY_EN.retry,
                kind: 'primary',
                onSelect: () => {
                  dismiss()
                  enqueueTransition(targetScreen.id, next.style, previousScreen, true)
                },
              },
            ],
          })
          options.onFailure?.(Cause.squash(enterResult.cause))
          return
        }

        // (6) Set or clear Time's `menu` reason from `pausesSim`
        if (targetScreen.pausesSim) {
          options.time.pause('menu')
        } else {
          options.time.resume('menu')
        }

        // (7) geometry.remeasure(), then focus (M4 spec §4.7): on a return, the control the player left from, matched
        // by name because the screen remounted; else [data-autofocus], the first [data-kind="primary"] control, or the
        // first tabbable (ui tabbables)
        options.geometry.remeasure()
        if (typeof section.querySelector === 'function') {
          const remembered = lastFocus.get(targetScreen.id)
          const target =
            (remembered === undefined ? null : findByName(section, remembered)) ??
            section.querySelector<HTMLElement>('[data-autofocus]') ??
            section.querySelector<HTMLElement>('[data-kind="primary"]') ??
            tabbables(section)[0] ??
            null
          if (target !== null && typeof target.focus === 'function') target.focus()
        }

        // (8) Reveal
        if (isCovered && queue.length === 0) {
          yield* options.veil.reveal()
          isCovered = false
        }

        // (9) Publish `screen.entered`
        options.bus.publish('screen.entered', {
          screen: targetScreen.id,
          from: previousScreen,
        })
      })

    // Fork queue runner fiber in the runtime scope
    yield* Effect.forkScoped(
      Effect.forever(
        Effect.gen(function* () {
          yield* Queue.take(trigger)
          while (queue.length > 0 && !closed) {
            busy = true
            const next = queue.shift()
            if (!next) break
            yield* runTransition(next)
          }
          busy = false
          yield* Deferred.succeed(idleDeferred, undefined)
        }),
      ),
    )

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        queue.length = 0
        if (currentScreenScope) {
          yield* Scope.close(currentScreenScope, Exit.void)
          currentScreenScope = null
        }
        if (isCovered) {
          yield* options.veil.reveal()
          isCovered = false
        }
        yield* Deferred.succeed(idleDeferred, undefined)
      }),
    )

    const flow: Flow = {
      get current(): string | undefined {
        return currentScreenId
      },
      dispatch(event: string): boolean {
        if (closed) return false
        const effectiveScreen = queue.length > 0 ? queue[queue.length - 1]?.to : currentScreenId
        if (!effectiveScreen) return false

        const transition = options.graph.transitions.find(
          (t) => t.from === effectiveScreen && t.event === event,
        )

        if (!transition) {
          const pair = `${effectiveScreen}:${event}`
          if (!loggedUnmatched.has(pair)) {
            loggedUnmatched.add(pair)
            if (options.logUnmatched) {
              options.logUnmatched(effectiveScreen, event)
            } else if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
              console.warn(`[flow] Unmatched event "${event}" on screen "${effectiveScreen}"`)
            }
          }
          return false
        }

        if (transition.to === effectiveScreen) {
          return true
        }

        enqueueTransition(transition.to, transition.transition, effectiveScreen)
        return true
      },
      openMenu(): boolean {
        if (closed || busy || queue.length > 0) return false
        if (!currentScreenDef?.openMenu) return false
        return currentScreenDef.openMenu()
      },
      get settled(): Effect.Effect<void> {
        return Deferred.await(idleDeferred)
      },
    }

    return {
      flow,
      start: (): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (closed) return
          enqueueTransition(options.graph.entry, 'cut', undefined, true)
          yield* flow.settled
        }),
      reportFailure: (failure: FlowFailure): void => {
        if (closed) return
        if (failure._tag === 'ScreenFailed') {
          const dismiss = options.layers.showError({
            code: 'start',
            message: options.copy?.start ?? BOOT_FAILURE_COPY_EN.start,
            actions: [
              {
                id: 'retry',
                label: options.copy?.retry ?? BOOT_FAILURE_COPY_EN.retry,
                kind: 'primary',
                onSelect: () => {
                  dismiss()
                  enqueueTransition(failure.screen, 'cut', failure.screen, true)
                },
              },
            ],
          })
        }
      },
    }
  })
}
