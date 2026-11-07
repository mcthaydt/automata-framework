// What the default screens share: mounting a component for the screen's life, a window
// listener, the menu's controller and arrow keys, and the system back gesture.

import { type Component, flushSync, mount, unmount } from 'svelte'
import {
  createInput,
  type HostInputMode,
  type Input,
  type InputOptions,
} from '../../features/input/input.manager.ts'
import type { InputProfile } from '../../features/input/input-profile.schema.ts'
import type { Hosting } from '../../shared/host/hosting.ts'
import type { Clock } from '../../shared/lib/clock.ts'
import type { Disposables } from '../../shared/lib/disposables.ts'
import type { Subscribable } from '../../shared/lib/subscribable.ts'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.ts'
import { interceptBackGesture } from '../../shared/ui/focus/back-gesture.ts'
import { FocusNavigator } from '../../shared/ui/focus/focus-nav.ts'
import Toast from '../../shared/ui/status/Toast.svelte'
import { menuInput } from './menu-input.ts'

/** A game without an input map still pauses with Escape and the pad's Start: the menu actions need no profile. */
export const NO_BINDINGS: InputProfile = { id: 'none', bindings: {} }

/** Mounts a screen component into the screen's layer for as long as the screen is open. */
export function show<Props extends Record<string, unknown>>(
  screen: Disposables,
  component: Component<Props>,
  target: HTMLElement,
  props: Props,
): void {
  const instance = mount(component, { target, props })
  // Rendered now, so the flow's focus step (runtime flow step 7) finds the primary action.
  flushSync()
  screen.add(() => void unmount(instance))
}

/** A window listener for as long as the screen is open. */
export function listen(
  screen: Disposables,
  target: Window,
  type: 'keydown',
  listener: (event: KeyboardEvent) => void,
): void {
  target.addEventListener(type, listener)
  screen.add(() => target.removeEventListener(type, listener))
}

/**
 * A menu's controller and arrow keys while it is open: an Input in the `menu` context, read each
 * animation frame, steers a `FocusNavigator`. The navigator's guard is armed for the screen change (F-a), so an Enter
 * held from the last screen does not click this one's focused button. `own` is a menu Input the screen made itself
 * (Settings', with the game's bindings); without one it makes one with none.
 */
export function driveMenu(
  screen: Disposables,
  target: Window,
  services: { readonly bus: PresentationBus; readonly clock: Clock },
  own?: Input,
): void {
  const input =
    own ?? ownInput(screen, { target, profile: NO_BINDINGS, bus: services.bus, clock: services.clock })
  input.setContext('menu')
  const navigator = new FocusNavigator()
  const menu = menuInput(input, navigator)
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
  screen.add(() => {
    if (frame !== undefined) target.cancelAnimationFrame(frame)
    menu.stop()
    detach()
  })
}

/**
 * The system back gesture (an edge swipe, a mouse's back button) as the screen's Back while it is open.
 * Standalone only: hosted, the host owns system back (M4-D10, Ruken request R-2), so nothing is added to history.
 */
export function backGesture(
  screen: Disposables,
  target: Window,
  hosting: Pick<Hosting, 'kind'>,
  onBack: () => boolean,
): void {
  if (hosting.kind !== 'standalone') return
  screen.add(interceptBackGesture(target, onBack))
}

export const windowOf = (layer: HTMLElement): Window => layer.ownerDocument.defaultView ?? window

/** A plain key press, not one held down repeating, nor one with a modifier the browser may own. */
export const plain = (event: KeyboardEvent): boolean =>
  !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey

/** The host's input mode for the screens' Input: under Ruken only; standalone the page decides. */
export const hostInput = (
  hosting: Pick<Hosting, 'kind' | 'input'>,
): Subscribable<HostInputMode> | undefined => (hosting.kind === 'standalone' ? undefined : hosting.input)

/** An Input for as long as the screen is open. */
export function ownInput(screen: Disposables, options: InputOptions): Input {
  const input = createInput(options)
  screen.add(() => input.dispose())
  return input
}

/** How long a passing message stays on a screen, in milliseconds. */
const TOAST_MS = 4000

/** What a pad without the standard mapping is told. */
export const PAD_UNSUPPORTED = 'This controller isn’t supported yet'

/** A Toast on the layer for four seconds, taken away with the screen if it is left sooner. */
function tell(screen: Disposables, clock: Clock, layer: HTMLElement, text: string, testId: string): void {
  const toast = mount(Toast, { target: layer, props: { text, testId } })
  let removed = false
  const remove = (): void => {
    if (removed) return
    removed = true
    void unmount(toast)
  }
  const handle = clock.setTimeout(() => {
    takeBack()
    remove()
  }, TOAST_MS)
  const takeBack = screen.add(() => {
    clock.clearTimeout(handle)
    remove()
  })
}

/**
 * A pad without the standard mapping cannot drive bindings: while this screen is open, the first time
 * such a pad connects the player is told so, in a Toast on the screen for four seconds. `told` is the game's, shared
 * by every screen, so each pad is told once a session (by id and index).
 */
export function noticeUnsupportedPads(
  screen: Disposables,
  services: { readonly bus: PresentationBus; readonly clock: Clock },
  layer: HTMLElement,
  told: Set<string>,
  /** The words, read when a pad is told: the screens' copy in the player's language. */
  text: () => string = () => PAD_UNSUPPORTED,
): void {
  screen.add(
    services.bus.subscribe('input.pad.connected', (pad) => {
      const key = `${pad.index} ${pad.id}`
      if (pad.standard || told.has(key)) return
      told.add(key)
      tell(screen, services.clock, layer, text(), 'pad-unsupported')
    }),
  )
}

/**
 * While this screen is open, a change to the save `key` that another device made is told in a Toast for four seconds
 * (M5-D6). Nothing is reloaded: the paused screen offers the choice.
 */
export function noticeChangedElsewhere(
  screen: Disposables,
  services: { readonly bus: PresentationBus; readonly clock: Clock },
  layer: HTMLElement,
  key: string,
  text: string,
): void {
  screen.add(
    services.bus.subscribe('save.changedElsewhere', (fact) => {
      if (fact.key === key) tell(screen, services.clock, layer, text, 'changed-elsewhere')
    }),
  )
}
