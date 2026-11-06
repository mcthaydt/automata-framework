// Focus helpers for the dialog (kit spec §4.6): where focus goes when something opens, and keeping Tab inside it.
// jsdom has no layout, so "focusable" here means the markup says so; a widget that is disabled with `aria-disabled`
// stays in, because the kit keeps those focusable on purpose.

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]'

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false
  if (element instanceof HTMLInputElement && element.type === 'hidden') return false
  return element.closest('[hidden], [inert]') === null
}

/** Everything inside `root` that Tab can reach, in document order. */
export function tabbableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isTabbable)
}

/** The first `[data-autofocus]`, else the first tabbable element, else `root` itself. */
export function initialFocusIn(root: HTMLElement): HTMLElement {
  return root.querySelector<HTMLElement>('[data-autofocus]') ?? tabbableIn(root)[0] ?? root
}

/**
 * Keeps a Tab press inside `root`: from the last element it goes to the first, from the first (or from `root`
 * itself) Shift+Tab goes to the last, and from outside it comes in at the nearer end. Anywhere else the browser
 * moves focus as usual.
 */
export function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== 'Tab') return
  const items = tabbableIn(root)
  const first = items[0]
  const last = items[items.length - 1]
  if (first === undefined || last === undefined) {
    event.preventDefault()
    root.focus()
    return
  }
  const active = document.activeElement
  const outside = !root.contains(active)
  if (event.shiftKey ? outside || active === first || active === root : outside || active === last) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}
