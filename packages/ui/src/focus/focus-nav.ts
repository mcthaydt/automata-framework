/**
 * Keyboard and controller focus navigation over the page's own DOM (M1.6 spec §3.5; from
 * FloorFifty `ui/focus-nav.ts` at 122a220, with `steer`, `page` and `adjust` from `ac72660` and the
 * keyboard repeat guard of M4 spec §4.7).
 *
 * Deliberately DOM order, the same order Tab walks: one order to keep right, so a keyboard player
 * and a controller player never disagree about what comes next. Only a `[data-focus-grid]` steers
 * spatially. An open modal is the whole world
 * while it is open. Input sources (M4's gamepad, a game's own bindings) call `move`, `confirm` and
 * `back`; this module never reads a device.
 */

const TABBABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Whether CSS hides the element: `visibility: hidden` (inherited, so the element's own computed
 * value says) or `display: none` on it or any ancestor. Read from computed style rather than box
 * size so it also holds where nothing is laid out (jsdom).
 */
function hiddenByCss(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView
  if (view === null) return false
  if (view.getComputedStyle(element).visibility === 'hidden') return true
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    if (view.getComputedStyle(node).display === 'none') return true
  }
  return false
}

/** Everything Tab can reach under `root`, in DOM order: not disabled, inert or hidden. */
export function tabbables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !(element as HTMLButtonElement).disabled &&
      element.closest('[inert], [hidden]') === null &&
      !hiddenByCss(element),
  )
}

/**
 * Keydown events the navigator sent itself. Back reaches the page as Escape so every dialog
 * handles it once, but it is not a keyboard: an input-method tracker skips these, or one press of
 * a controller's B would teach keyboard controls to a controller player.
 */
export const padKeyEvents: WeakSet<Event> = new WeakSet<Event>()

/**
 * The topmost open dialog: the last in the document, as a sheet opened over a page is. One that is
 * leaving (inert from its exit's first frame) is passed over, or it would hold focus through its exit.
 */
const modalOrDocument = (): ParentNode =>
  [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((dialog) => dialog.closest('[inert]') === null)
    .at(-1) ?? document

/**
 * How the navigator focuses: with a ring, and without scrolling the page. `focusVisible` because a
 * browser draws no ring for script focus after a click or tap; `preventScroll` because the game owns
 * the viewport. (`focusVisible` is not yet in TypeScript's DOM types; Chromium, Firefox and Safari
 * take it.)
 */
export const PAD_FOCUS: FocusOptions = { preventScroll: true, focusVisible: true } as FocusOptions

/** Brings `element` into view by scrolling its nearest scroll box, never the document. */
export function scrollWithin(element: HTMLElement): void {
  for (let box = element.parentElement; box !== null; box = box.parentElement) {
    if (box === document.body || box === document.documentElement) return
    const { overflowY } = getComputedStyle(box)
    if ((overflowY !== 'auto' && overflowY !== 'scroll') || box.scrollHeight <= box.clientHeight) continue
    const outer = box.getBoundingClientRect()
    const inner = element.getBoundingClientRect()
    if (inner.top < outer.top) box.scrollTop -= outer.top - inner.top
    else if (inner.bottom > outer.bottom) box.scrollTop += inner.bottom - outer.bottom
    return
  }
}

/** A direction a d-pad or an arrow key walks a menu. */
export type NavDirection = 'up' | 'down' | 'left' | 'right'

const ARROWS: Readonly<Record<string, NavDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** The keys that click a focused button. */
const CONFIRM_KEYS = new Set(['Enter', 'Space'])

/** Inputs that take Left and Right for themselves: a slider's step, a radio group's choice. */
const SIDEWAYS_INPUTS = new Set(['range', 'radio'])

/** Inputs with a caret, which Left and Right move until it reaches an end. */
const CARET_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/**
 * The menu direction an arrow key walks, as a d-pad would, or undefined when the key is not a bare
 * arrow or its target keeps that arrow. Up and Down always walk off an input, so no slider, radio
 * group or text field can hold focus; Left and Right stay with a slider or radio group, and with a
 * text field until its caret meets the end the arrow points at. Multi-line text keeps every arrow.
 */
export function arrowKeyNav(event: KeyboardEvent): NavDirection | undefined {
  const nav = ARROWS[event.code]
  if (nav === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return undefined
  const target = event.target
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return undefined
  if (target instanceof HTMLElement && target.isContentEditable) return undefined
  if (!(target instanceof HTMLInputElement) || nav === 'up' || nav === 'down') return nav
  if (SIDEWAYS_INPUTS.has(target.type)) return undefined
  if (CARET_INPUTS.has(target.type)) {
    const { selectionStart, selectionEnd, value } = target
    // `number` reports no selection; its caret is out of reach, so it walks.
    if (selectionStart === null || selectionEnd === null) return nav
    if (selectionStart !== selectionEnd) return undefined
    const atEnd = nav === 'left' ? selectionStart === 0 : selectionEnd === value.length
    return atEnd ? nav : undefined
  }
  return nav
}

function centre(element: HTMLElement): { x: number; y: number } {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/**
 * Moves focus the way a d-pad would: `move` walks Tab order, `steer` walks a `[data-focus-grid]` spatially,
 * `page` offers a page turn, and `recover` puts focus back on the first control when a screen change dropped
 * it. `attach` listens for the player's own pointer and keys, so the navigator steps back from them.
 */
export class FocusNavigator {
  /**
   * Whether the navigator is the one moving focus: set by any navigator action, cleared by a
   * pointer or real key press. Only then does `recover` step in, so a mouse or keyboard player's
   * focus is never moved for them.
   */
  private engaged = false
  private paused = false
  /** Armed by `guard()` on a screen change; a confirm key held from the last screen is cancelled until it comes up. */
  private guarded = false
  private readonly root: () => ParentNode

  constructor(root: () => ParentNode = modalOrDocument) {
    this.root = root
  }

  /** Stops `recover` once the player presses anything that is not the navigator. */
  attach(target: EventTarget = window): () => void {
    const onPointer = (): void => {
      this.engaged = false
    }
    // The navigator's own Back arrives here as Escape; it is still the navigator.
    const onKey = (event: Event): void => {
      if (!padKeyEvents.has(event)) this.engaged = false
      if (!this.guarded || !(event instanceof KeyboardEvent) || !CONFIRM_KEYS.has(event.code)) return
      // A repeat is the key held over from the last screen: the browser would click the new screen's button.
      if (event.repeat) event.preventDefault()
      else this.guarded = false
    }
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && CONFIRM_KEYS.has(event.code)) this.guarded = false
    }
    target.addEventListener('pointerdown', onPointer, { capture: true })
    target.addEventListener('keydown', onKey, { capture: true })
    target.addEventListener('keyup', onKeyUp, { capture: true })
    return () => {
      target.removeEventListener('pointerdown', onPointer, { capture: true })
      target.removeEventListener('keydown', onKey, { capture: true })
      target.removeEventListener('keyup', onKeyUp, { capture: true })
    }
  }

  /**
   * Arms the pad guard (M4 spec §4.7, F-a): called on a screen change, it cancels repeating Enter and Space
   * keydowns until the key comes up or is pressed afresh. A pad's own confirm is an edge from `Input`, which
   * cannot repeat, so only the keyboard needs this; `attach` must be listening.
   */
  guard(): void {
    this.guarded = true
  }

  /** Paused while a screen transition covers the screen. */
  setPaused(paused: boolean): void {
    this.paused = paused
  }

  /**
   * Puts focus back on the first control, in Tab's order, when it has fallen to the page (the
   * screen it stood on was replaced) or out of an open dialog. Called each frame while the
   * navigator is in use; a controller player otherwise saw nothing selected after every screen change.
   */
  recover(): void {
    if (this.paused || !this.engaged) return
    const root = this.root()
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body && root.contains(active)) return
    const first = tabbables(root)[0]
    if (first === undefined) return
    first.focus(PAD_FOCUS)
    scrollWithin(first)
  }

  move(direction: 'next' | 'previous'): void {
    if (this.paused) return
    this.engaged = true
    const items = tabbables(this.root())
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    const step = direction === 'next' ? 1 : -1
    const next = at === -1 ? (step === 1 ? 0 : items.length - 1) : (at + step + items.length) % items.length
    const target = items[next] as HTMLElement
    target.focus(PAD_FOCUS)
    scrollWithin(target)
  }

  /**
   * One step in `direction` (M4 spec §4.7). Inside a `[data-focus-grid]` the move is spatial: the nearest control
   * whose centre lies that way, scored by distance along the direction plus twice the sideways offset, so a
   * straight line wins over a diagonal. Elsewhere it is DOM order: down and right go next, up and left previous.
   * Returns false when nothing lies that way in the grid, so the caller can page or stay put.
   */
  steer(direction: NavDirection): boolean {
    if (this.paused) return false
    const focused = document.activeElement
    const grid = focused instanceof HTMLElement ? focused.closest<HTMLElement>('[data-focus-grid]') : null
    if (grid === null || !(focused instanceof HTMLElement)) {
      this.move(direction === 'down' || direction === 'right' ? 'next' : 'previous')
      return true
    }
    this.engaged = true
    const from = centre(focused)
    let best: HTMLElement | undefined
    let bestScore = Number.POSITIVE_INFINITY
    for (const candidate of tabbables(grid)) {
      if (candidate === focused) continue
      const to = centre(candidate)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const along = direction === 'down' ? dy : direction === 'up' ? -dy : direction === 'right' ? dx : -dx
      if (along <= 0) continue
      const score = along + 2 * Math.abs(direction === 'up' || direction === 'down' ? dx : dy)
      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (best === undefined) return false
    best.focus(PAD_FOCUS)
    scrollWithin(best)
    return true
  }

  /**
   * Offers a page turn (PageUp/PageDown, the shoulder buttons, a page swipe) to the focused control. A
   * `[data-pager]` region above it takes the cancelable `af-page` event; returns whether one did.
   */
  page(delta: -1 | 1): boolean {
    if (this.paused) return false
    const focused = document.activeElement
    if (!(focused instanceof HTMLElement) || focused === document.body) return false
    this.engaged = true
    const event = new CustomEvent('af-page', { detail: { delta }, bubbles: true, cancelable: true })
    focused.dispatchEvent(event)
    return event.defaultPrevented
  }

  /**
   * Changes the focused slider or option group by one step without leaving it (from FloorFifty's `adjust`, plus
   * radio groups for OptionGroup). Fires the event a pointer or arrow key would (`input` on a range, `change` on a
   * radio). Returns false when nothing adjustable has focus, so the caller steers instead.
   */
  adjust(delta: -1 | 1): boolean {
    if (this.paused) return false
    const focused = document.activeElement
    if (!(focused instanceof HTMLInputElement)) return false
    if (focused.type === 'range') {
      if (delta === 1) focused.stepUp()
      else focused.stepDown()
      focused.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    if (focused.type !== 'radio' || focused.name === '') return false
    const group = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter(
      (radio) => radio.name === focused.name && radio.form === focused.form && !radio.disabled,
    )
    const next = group[(group.indexOf(focused) + delta + group.length) % group.length] as HTMLInputElement
    next.checked = true
    next.focus(PAD_FOCUS)
    next.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  confirm(): void {
    if (this.paused) return
    this.engaged = true
    const focused = document.activeElement
    if (!(focused instanceof HTMLElement) || focused === document.body) return
    focused.click()
  }

  /** Sends Escape to the focused element, marked as the navigator's, so dialogs close through one path. */
  back(): void {
    if (this.paused) return
    this.engaged = true
    const target = document.activeElement ?? document
    const event = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
    padKeyEvents.add(event)
    target.dispatchEvent(event)
  }
}
