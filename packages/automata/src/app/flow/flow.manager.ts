import type { FlowGraph } from '@automataframework/automata-content'
import { type Disposables, disposables } from '../../shared/lib/disposables.ts'
import type { Assets } from '../../shared/runtime/assets.manager.js'
import type { PageLayers } from '../../shared/runtime/page-layers.svelte.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { Time } from '../../shared/runtime/time/time.manager.js'
import { tabbables } from '../../shared/ui/focus/focus-nav.ts'
import type { GeometryOwner } from '../../shared/ui/geometry/geometry-owner.svelte.ts'
import { BOOT_FAILURE_COPY_EN, type BootFailureCopy } from '../../shared/ui/status/boot-failure.ts'
import type { FlowFailure, RuntimeServices, ScreenContext, ScreenDef } from './screen.js'
import type { Veil } from './veil.js'

/**
 * The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu`
 * for the current screen's menu, and `settled()` once no transition is pending.
 */
export interface Flow {
  readonly current: string | undefined
  dispatch(event: string): boolean
  openMenu(): boolean
  /** Resolves once no transition is queued or running (at once when the flow is idle). */
  settled(): Promise<void>
}

export interface FlowOptions {
  readonly graph: FlowGraph
  readonly screens: readonly ScreenDef[]
  readonly layers: PageLayers
  readonly assets: Assets
  readonly time: Time
  readonly bus: PresentationBus
  readonly geometry: GeometryOwner
  readonly veil: Veil
  readonly copy?: Partial<BootFailureCopy> & { readonly loading?: string; readonly slow?: string }
  /** Read when a screen enters: boot builds the services after the flow, which is one of them. */
  readonly services: () => RuntimeServices
  readonly logUnmatched?: (screen: string, event: string) => void
  /**
   * What every screen gets as `ScreenContext.runtime`. Boot makes it, and disposes it after the save's last flush;
   * absent, the flow makes one and disposes it after the current screen.
   */
  readonly runtime?: Disposables
  /** Hears why a screen could not load or enter, after the error panel is up (`RuntimeSeams.onFailure`). */
  readonly onFailure?: (cause: unknown) => void
}

export interface FlowHandle {
  readonly flow: Flow
  /**
   * Enters the graph's entry screen, or `at` when the graph has that screen, and resolves once it has entered (or
   * failed to). `at` is for a restart in development, back onto the screen the person was on; a screen the graph no
   * longer has (a save renamed it) starts at the entry, as a first boot does.
   */
  start(at?: string): Promise<void>
  reportFailure(failure: FlowFailure): void
  /**
   * Stops the flow: nothing queued runs, the current screen is left (its `screen` disposed) and the veil revealed.
   * A flow that made its own `runtime` disposes it last.
   */
  dispose(): Promise<void>
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
 * Creates the Flow service and its transition queue.
 * Follows the 9-step transition order, runs one transition at a time, fades through the veil, shows the loader
 * over a screen whose files are missing, and pauses the sim for menu screens.
 */
export function createFlow(options: FlowOptions): FlowHandle {
  const ownRuntime = options.runtime === undefined ? disposables() : undefined
  const keptAcrossScreens = options.runtime ?? (ownRuntime as Disposables)
  const queue: QueuedTransition[] = []
  const loggedUnmatched = new Set<string>()

  let running = false
  let closed = false
  let isCovered = false
  let currentScreenId: string | undefined
  let currentScreenDef: ScreenDef | undefined
  let currentScreen: Disposables | null = null

  // Who waits for the queue to run dry: `settled()` hands each caller this promise while a transition is pending.
  let idle: Promise<void> = Promise.resolve()
  let markIdle: () => void = () => undefined

  /** Per screen, the name of the control that had focus when the player last left it (F-b). */
  const lastFocus = new Map<string, FocusName>()

  const enqueueTransition = (to: string, style: string, from?: string, force?: boolean): void => {
    if (closed) return
    queue.push({ from, to, style, force })
    if (running) return
    running = true
    idle = new Promise((resolve) => {
      markIdle = resolve
    })
    void drain()
  }

  /** Runs queued transitions one at a time until the queue is empty or the flow is disposed. */
  async function drain(): Promise<void> {
    // Started on the next microtask, so a dispatch that queues two transitions in a row sees them both queued.
    await Promise.resolve()
    try {
      while (queue.length > 0 && !closed) {
        const next = queue.shift()
        if (next !== undefined) await runTransition(next)
      }
    } finally {
      running = false
      markIdle()
    }
  }

  const reveal = async (): Promise<void> => {
    await options.veil.reveal()
    isCovered = false
  }

  /** Leaves the current screen: its undo functions run, last added first. */
  const leaveScreen = (): void => {
    const leaving = currentScreen
    currentScreen = null
    currentScreenDef = undefined
    leaving?.dispose()
  }

  const showStartFailure = (screen: string, style: string, from: string | undefined): void => {
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
            enqueueTransition(screen, style, from, true)
          },
        },
      ],
    })
  }

  async function runTransition(next: QueuedTransition): Promise<void> {
    if (closed) return
    if (next.to === currentScreenId && !next.force) {
      if (isCovered && queue.length === 0) await reveal()
      return
    }

    const targetScreen = options.screens.find((s) => s.id === next.to)
    if (!targetScreen) return

    // (1) Load target's files and fonts with LoaderOverlay over the current screen when anything is missing (Q8)
    if (!options.assets.isLoaded(targetScreen.id)) {
      const loader = options.layers.showLoader({
        label: options.copy?.loading ?? 'Loading…',
        slowLabel: options.copy?.slow ?? 'Taking a while…',
      })
      const loadResult = await options.assets
        .load(targetScreen.id, (fraction) => loader.setProgress(fraction))
        .finally(() => loader.close())
      if (closed) return
      if (!loadResult.ok) {
        const isStalled = loadResult.reason._tag === 'LoadStalled'
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
        options.onFailure?.(loadResult.reason)
        return
      }
    }

    // (2) Cover, for `fade`. A veil that fails to cover makes the edge a cut.
    if (next.style === 'fade' && !isCovered) isCovered = await options.veil.cover()
    if (closed) return

    // (3) Remember what had focus on the screen being left, then leave it
    if (currentScreenId !== undefined) {
      const name = focusName(options.layers.screens)
      if (name === undefined) lastFocus.delete(currentScreenId)
      else lastFocus.set(currentScreenId, name)
    }
    leaveScreen()

    // (4) Set `current` to the target before awaiting its enter
    const previousScreen = currentScreenId
    currentScreenId = targetScreen.id
    currentScreenDef = targetScreen

    // (5) Run `enter` with the screen's own undo list, inside the screen layer
    const screen = disposables()
    currentScreen = screen

    const doc =
      options.layers.screens.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined)
    const section = doc ? doc.createElement('section') : ({} as HTMLElement)
    if (section.setAttribute) {
      section.setAttribute('data-screen', targetScreen.id)
      options.layers.screens.appendChild(section)
    }
    // Added first, so it runs last: the screen's own undo functions still find their elements in the page.
    screen.add(() => {
      try {
        if (typeof section.remove === 'function') section.remove()
        else section.parentElement?.removeChild(section)
      } catch {
        // A page that refuses the removal has nothing left to undo.
      }
    })

    const context: ScreenContext = {
      layer: section,
      from: previousScreen,
      screen,
      runtime: keptAcrossScreens,
      services: options.services(),
    }

    let failure: { readonly cause: unknown } | undefined
    try {
      await targetScreen.enter(context)
    } catch (cause) {
      failure = { cause }
    }
    // Disposed while entering: `dispose()` has already left this screen.
    if (closed) return

    if (failure !== undefined) {
      screen.dispose()
      currentScreen = null
      currentScreenDef = undefined
      currentScreenId = undefined
      queue.length = 0
      if (isCovered) await reveal()
      showStartFailure(targetScreen.id, next.style, previousScreen)
      options.onFailure?.(failure.cause)
      return
    }

    // (6) Set or clear Time's `menu` reason from `pausesSim`
    if (targetScreen.pausesSim) options.time.pause('menu')
    else options.time.resume('menu')

    // (7) geometry.remeasure(), then focus: on a return, the control the player left from, matched
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
    if (isCovered && queue.length === 0) await reveal()

    // (9) Publish `screen.entered`
    options.bus.publish('screen.entered', { screen: targetScreen.id, from: previousScreen })
  }

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

      if (transition.to === effectiveScreen) return true

      enqueueTransition(transition.to, transition.transition, effectiveScreen)
      return true
    },
    openMenu(): boolean {
      if (closed || running || queue.length > 0) return false
      if (!currentScreenDef?.openMenu) return false
      return currentScreenDef.openMenu()
    },
    settled: () => idle,
  }

  return {
    flow,
    async start(at) {
      if (closed) return
      const first = at !== undefined && options.graph.screens.includes(at) ? at : options.graph.entry
      enqueueTransition(first, 'cut', undefined, true)
      await idle
    },
    reportFailure(failure) {
      if (closed) return
      if (failure._tag === 'ScreenFailed') showStartFailure(failure.screen, 'cut', failure.screen)
    },
    async dispose() {
      if (closed) return
      closed = true
      queue.length = 0
      leaveScreen()
      if (isCovered) await reveal()
      ownRuntime?.dispose()
      markIdle()
    },
  }
}
