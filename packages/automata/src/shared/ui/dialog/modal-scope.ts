/**
 * How a modal holds the page (its own module so Dialog, Modal and Sheet share one set of rules): the page behind is inert, only the topmost modal answers Escape
 * and holds focus, Tab wraps inside it, focus starts on the safe control and goes back to the
 * opener when the modal goes away.
 */

/** Anything a keyboard can reach. (No layout in jsdom, so this does not look at visibility.) */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function tabStops(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/**
 * Whether `panel` is the topmost open modal: the last `aria-modal` in the document that is not
 * inert. A modal opened over another comes later in the document, as a sibling (which inerts the
 * first) or inside it.
 */
export function isTopmost(panel: Element): boolean {
  const open = [...document.querySelectorAll('[aria-modal="true"]')].filter(
    (d) => d.closest('[inert]') === null,
  )
  return open.at(-1) === panel
}

/**
 * Marks everything outside `node` inert: the siblings of `node` and of each ancestor up to the
 * body. Returns how to undo it; only what this call marked is unmarked, so an element that was
 * already inert (or that an inner modal marked) keeps its state.
 */
export function inertOutside(node: Element): () => void {
  const marked: Element[] = []
  let current: Element = node
  while (current.parentElement !== null && current !== document.body) {
    for (const sibling of current.parentElement.children) {
      if (sibling === current || sibling.hasAttribute('inert')) continue
      sibling.setAttribute('inert', '')
      marked.push(sibling)
    }
    current = current.parentElement
  }
  return () => {
    for (const element of marked) element.removeAttribute('inert')
  }
}

/**
 * Keeps a Tab keydown inside `panel`: from the last control Tab goes to the first, from the first
 * (or the panel itself) Shift+Tab goes to the last, and a panel with no controls keeps focus.
 * Any other Tab is left to the browser.
 */
export function wrapTab(event: KeyboardEvent, panel: HTMLElement): void {
  const controls = tabStops(panel)
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (first === undefined || last === undefined) {
    event.preventDefault()
    panel.focus()
  } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/** Focuses the control marked `data-initial-focus` (the safe one), else the first control, else the panel. */
export function focusInitial(panel: HTMLElement): void {
  const marked = panel.querySelector<HTMLElement>('[data-initial-focus]')
  ;(marked ?? tabStops(panel)[0] ?? panel).focus()
}

/**
 * Where focus goes when a modal closes and its opener is gone: where a screen puts it on entry
 * (runtime's flow), the `data-autofocus` control, else the first primary one. A cover
 * held from boot needs this: the screen behind it mounted inert, so its own focus call did nothing.
 */
function focusPageDefault(): void {
  const target =
    document.querySelector<HTMLElement>('[data-autofocus]') ??
    document.querySelector<HTMLElement>('[data-kind="primary"]')
  target?.focus()
}

/**
 * Holds the page for a modal whose scrim is `scrim` and whose `aria-modal` element is `panel`,
 * from now until the returned release is called (a component calls it from `onMount`'s cleanup).
 * Escape calls `onclose`; the focus navigator's Back arrives as Escape, so a controller closes it
 * the same way.
 */
export function holdModal(scrim: HTMLElement, panel: HTMLElement, onclose: () => void): () => void {
  const opener = document.activeElement
  const release = inertOutside(scrim)
  // False once the modal starts to go away, so giving focus back is not undone by the trap
  // pulling it into a modal that is closing.
  let trapping = true

  function onKeydown(event: KeyboardEvent): void {
    if (!isTopmost(panel)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onclose()
    } else if (event.key === 'Tab') {
      wrapTab(event, panel)
    }
  }

  function onFocusIn(event: FocusEvent): void {
    if (!trapping || !isTopmost(panel)) return
    if (event.target instanceof Node && !panel.contains(event.target)) focusInitial(panel)
  }

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('focusin', onFocusIn)
  focusInitial(panel)
  return () => {
    trapping = false
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('focusin', onFocusIn)
    release()
    if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) opener.focus()
    else focusPageDefault()
  }
}
