import type { Audio } from './audio.manager.js'

// Interface sounds: one set of listeners on the root of the game's overlay makes every control sound without wiring.
// A control says otherwise with `data-sfx`: `back` for leaving or cancelling, `none` where the consequence has its own
// sound, or a name of the game's own. The names map to sounds in the game's content; nothing mapped, nothing heard, so
// no existing game changes. Everything plays on the `ui` bus, so the interface volume and mute apply.

/** What counts as a control: the things a player presses or moves focus onto. A slider and a text box are not. */
const UI_CONTROL = "button, a[href], [role='button'], select, input:not([type='range']):not([type='text'])"

/** The names the framework itself asks for; a game may add any other. */
export const UI_SOUND_NAMES = ['press', 'back', 'focus', 'open', 'close', 'error'] as const

/** A sound: the asset it plays, or the asset with a gain (0..1). */
export type UiSoundEntry = string | { readonly alias: string; readonly gain?: number }

/**
 * The interface's sounds by name, or one function that plays a name (for a game whose sounds are cues in its own
 * mixer). A name the map lacks plays nothing.
 */
export type UiSounds = Readonly<Record<string, UiSoundEntry>> | ((name: string) => void)

/** The event `requestUiSound` sends; it bubbles to the root. */
const REQUEST_EVENT = 'automata-sfx'

/** Two focus ticks are never closer than this, so a held arrow key ticks as a rattle, not a buzz. */
const FOCUS_SPACING_MS = 90
/** The focus a press brings is part of the press: it stays silent for this long. */
const PRESS_QUIET_MS = 400
/** Scrolling moves focus under a still pointer; that is not the player choosing a control. */
const SCROLL_QUIET_MS = 250
/** The default level of a focus tick, under a press. */
const FOCUS_GAIN = 0.5

/**
 * Asks for a sound from inside a component that has no press behind it (an error arriving, a panel opening). The
 * request bubbles to the root `installUiSounds` listens on. `open` and `close` also quiet the focus ticks for 400 ms,
 * since the panel moving focus is part of the opening.
 */
export function requestUiSound(from: Element, name: string): void {
  from.dispatchEvent(new CustomEvent(REQUEST_EVENT, { bubbles: true, detail: name }))
}

/**
 * Listens on `root` (capture phase, passive) and plays the game's interface sounds through `audio` on the `ui` bus.
 * `now` is the clock, injected in tests. Returns the function that removes every listener.
 */
export function installUiSounds(
  root: HTMLElement,
  audio: Pick<Audio, 'sound'>,
  sounds: UiSounds,
  now: () => number = () => performance.now(),
): () => void {
  let lastFocused: Element | null = null
  let lastTick = Number.NEGATIVE_INFINITY
  let quietUntil = Number.NEGATIVE_INFINITY
  // What last moved the player: a touch never ticks, and the next key press hands focus back to the keyboard.
  let touching = false

  const play = (name: string, defaultGain?: number): void => {
    // `none` is the control saying its consequence has its own sound, so even a function map is not asked.
    if (name === 'none') return
    if (typeof sounds === 'function') {
      sounds(name)
      return
    }
    const entry = Object.hasOwn(sounds, name) ? sounds[name] : undefined
    if (entry === undefined) return
    const alias = typeof entry === 'string' ? entry : entry.alias
    const gain = typeof entry === 'string' ? defaultGain : (entry.gain ?? defaultGain)
    audio.sound(alias, { bus: 'ui', ...(gain === undefined ? {} : { gain }) })
  }

  const controlOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(UI_CONTROL) : null

  const quiet = (ms: number): void => {
    quietUntil = Math.max(quietUntil, now() + ms)
  }

  const onPointerDown = (event: Event): void => {
    touching = (event as PointerEvent).pointerType === 'touch'
    quiet(PRESS_QUIET_MS)
  }
  const onKeyDown = (): void => {
    touching = false
  }
  const onScroll = (): void => quiet(SCROLL_QUIET_MS)

  const onClick = (event: Event): void => {
    const control = controlOf(event.target)
    if (control === null || control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true')
      return
    play(control.closest<HTMLElement>('[data-sfx]')?.dataset.sfx ?? 'press')
  }

  const onFocusIn = (event: Event): void => {
    const control = controlOf(event.target)
    if (control === null) return
    // Focus coming back to the control that last had it (a window regaining focus) is not a move.
    const returning = control === lastFocused
    lastFocused = control
    const at = now()
    if (returning || touching || at < quietUntil || at - lastTick < FOCUS_SPACING_MS) return
    lastTick = at
    play('focus', FOCUS_GAIN)
  }

  const onRequest = (event: Event): void => {
    const name = (event as CustomEvent<unknown>).detail
    if (typeof name !== 'string') return
    if (name === 'open' || name === 'close') quiet(PRESS_QUIET_MS)
    play(name)
  }

  const options = { capture: true, passive: true } as const
  const listeners: ReadonlyArray<readonly [string, (event: Event) => void]> = [
    ['pointerdown', onPointerDown],
    ['keydown', onKeyDown],
    ['click', onClick],
    ['focusin', onFocusIn],
    ['scroll', onScroll],
    ['wheel', onScroll],
    [REQUEST_EVENT, onRequest],
  ]
  for (const [type, listener] of listeners) root.addEventListener(type, listener, options)
  return () => {
    for (const [type, listener] of listeners) root.removeEventListener(type, listener, options)
  }
}
