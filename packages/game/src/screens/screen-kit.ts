// What the default screens share (DX spec §7, M4 spec §4.7): mounting a component for the screen's life, a window
// listener, the menu's controller and arrow keys, and the system back gesture.
import { Hosting } from '@mcthaydt/automata-host'
import { type Input, type InputProfile, makeInput, PresentationBus } from '@mcthaydt/automata-runtime'
import { FocusNavigator, interceptBackGesture, Toast } from '@mcthaydt/automata-ui'
import { Duration, Effect, Runtime, type Scope } from 'effect'
import { type Component, flushSync, mount, unmount } from 'svelte'
import { menuInput } from './menu-input.ts'

/** A game without an input map still pauses with Escape and the pad's Start: the menu actions need no profile. */
export const NO_BINDINGS: InputProfile = { id: 'none', bindings: {} }

/** Mounts a screen component into the screen's layer for as long as the screen is open. */
export function show<Props extends Record<string, unknown>>(
  component: Component<Props>,
  target: HTMLElement,
  props: Props,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const instance = mount(component, { target, props })
      // Rendered now, so the flow's focus step (runtime flow step 7) finds the primary action.
      flushSync()
      return instance
    }),
    (instance) => Effect.promise(() => unmount(instance)),
  ).pipe(Effect.asVoid)
}

/** A window listener for as long as the screen is open. */
export function listen(
  target: Window,
  type: 'keydown',
  listener: (event: KeyboardEvent) => void,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => target.addEventListener(type, listener)),
    () => Effect.sync(() => target.removeEventListener(type, listener)),
  )
}

/**
 * A menu's controller and arrow keys while it is open (M4 spec §4.7): an Input in the `menu` context, read each
 * animation frame, steers a `FocusNavigator`. The navigator's guard is armed for the screen change (F-a), so an Enter
 * held from the last screen does not click this one's focused button. `own` is a menu Input the screen made itself
 * (Settings', with the game's bindings); without one it makes one with none.
 */
export function driveMenu(
  target: Window,
  own?: Input,
): Effect.Effect<void, never, Scope.Scope | PresentationBus> {
  return Effect.gen(function* () {
    const bus = yield* PresentationBus
    const input = own ?? (yield* makeInput({ target, profile: NO_BINDINGS, bus }))
    input.setContext('menu')
    const navigator = new FocusNavigator()
    const menu = menuInput(input, navigator)
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const detach = navigator.attach(target)
        navigator.guard()
        let frame: number | undefined
        if (typeof target.requestAnimationFrame === 'function') {
          const poll = (nowMs: number): void => {
            menu.poll(nowMs)
            frame = target.requestAnimationFrame(poll)
          }
          frame = target.requestAnimationFrame(poll)
        }
        return () => {
          if (frame !== undefined) target.cancelAnimationFrame(frame)
          menu.stop()
          detach()
        }
      }),
      (stop) => Effect.sync(stop),
    )
  })
}

/**
 * The system back gesture (an edge swipe, a mouse's back button) as the screen's Back while it is open (M4 spec §4.7).
 * Standalone only: hosted, the host owns system back (M4-D10, Ruken request R-2), so nothing is added to history.
 */
export function backGesture(
  target: Window,
  onBack: () => boolean,
): Effect.Effect<void, never, Scope.Scope | Hosting> {
  return Effect.gen(function* () {
    const hosting = yield* Hosting
    if (hosting.kind !== 'standalone') return
    yield* Effect.acquireRelease(
      Effect.sync(() => interceptBackGesture(target, onBack)),
      (stop) => Effect.sync(stop),
    )
  })
}

export const windowOf = (layer: HTMLElement): Window => layer.ownerDocument.defaultView ?? window

/** A plain key press, not one held down repeating, nor one with a modifier the browser may own. */
export const plain = (event: KeyboardEvent): boolean =>
  !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey

/** The host's input mode for the screens' Input (M4 spec §4.2): under Ruken only; standalone the page decides. */
export const hostInput: Effect.Effect<Hosting['input'] | undefined, never, Hosting> = Effect.map(
  Hosting,
  (hosting) => (hosting.kind === 'standalone' ? undefined : hosting.input),
)

/** How long a passing message stays on a screen. */
const TOAST_FOR = Duration.seconds(4)

/** What a pad without the standard mapping is told (M4 spec §6). */
export const PAD_UNSUPPORTED = 'This controller isn’t supported yet'

/** A Toast on the layer for four seconds, taken away with it. */
const tell = (layer: HTMLElement, text: string, testId: string): Effect.Effect<void> =>
  Effect.acquireUseRelease(
    Effect.sync(() => mount(Toast, { target: layer, props: { text, testId } })),
    () => Effect.sleep(TOAST_FOR),
    (toast) => Effect.promise(() => unmount(toast)),
  )

/**
 * A pad without the standard mapping cannot drive bindings (M4 spec §6): while this screen is open, the first time
 * such a pad connects the player is told so, in a Toast on the screen for four seconds. `told` is the game's, shared
 * by every screen, so each pad is told once a session (by id and index).
 */
export function noticeUnsupportedPads(
  layer: HTMLElement,
  told: Set<string>,
): Effect.Effect<void, never, Scope.Scope | PresentationBus> {
  return Effect.gen(function* () {
    const bus = yield* PresentationBus
    const runtime = yield* Effect.runtime<never>()
    const scope = yield* Effect.scope
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        bus.subscribe('input.pad.connected', (pad) => {
          const key = `${pad.index} ${pad.id}`
          if (pad.standard || told.has(key)) return
          told.add(key)
          // In the screen's scope: leaving the screen takes the toast away with it.
          Runtime.runFork(runtime)(Effect.forkIn(tell(layer, PAD_UNSUPPORTED, 'pad-unsupported'), scope))
        }),
      ),
      (stop) => Effect.sync(stop),
    )
  })
}

/**
 * While this screen is open, a change to the save `key` that another device made is told in a Toast for four seconds
 * (M5-D6). Nothing is reloaded: the paused screen offers the choice.
 */
export function noticeChangedElsewhere(
  layer: HTMLElement,
  key: string,
  text: string,
): Effect.Effect<void, never, Scope.Scope | PresentationBus> {
  return Effect.gen(function* () {
    const bus = yield* PresentationBus
    const runtime = yield* Effect.runtime<never>()
    const scope = yield* Effect.scope
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        bus.subscribe('save.changedElsewhere', (fact) => {
          if (fact.key === key)
            Runtime.runFork(runtime)(Effect.forkIn(tell(layer, text, 'changed-elsewhere'), scope))
        }),
      ),
      (stop) => Effect.sync(stop),
    )
  })
}
