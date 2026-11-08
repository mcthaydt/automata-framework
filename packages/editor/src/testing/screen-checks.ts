// What every v2 screen must hold at every window size, in one place so the screens are measured the same way: the page
// never scrolls sideways, the top bar keeps everything it holds, every control is a whole target (44 px with touch, a
// primary 48), at most one lime button shows in a layer (the screen, or the dialog over it), and no text is too faint to
// read. It returns the problems it finds as sentences, so a test says `expect(await screenChecks(...)).toEqual([])` and
// a failure names the control. It runs in a real browser (it measures); it imports no test runner.
import axe from 'axe-core'
import type { WindowSize } from './kit/at-every-size'

export interface ScreenCheckOptions {
  /** Look for low-contrast text with axe (slower; the spec asks for it at 1440 × 900 and 390 × 844). */
  readonly contrast?: boolean
  /** The lime buttons the screen is expected to show in its top layer; at most one when unsaid. */
  readonly lime?: number
}

const CONTROLS =
  'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="slider"]'

const nameOf = (element: HTMLElement): string =>
  (element.getAttribute('aria-label') ?? element.textContent ?? element.tagName).trim().slice(0, 40)

/** Whether a person can see and press it: laid out, not hidden, not inert, and not a screen-reader-only mark. */
function shown(element: HTMLElement): boolean {
  if (element.closest('[inert], [hidden], [aria-hidden="true"]') !== null) return false
  const style = getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const box = element.getBoundingClientRect()
  return box.width > 1 && box.height > 1
}

/** The layer a person is working in: the topmost open dialog, else the whole page. */
function topLayer(doc: Document): ParentNode {
  const dialogs = [...doc.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].filter(shown)
  return dialogs.at(-1) ?? doc
}

export async function screenChecks(
  doc: Document,
  size: WindowSize,
  options: ScreenCheckOptions = {},
): Promise<string[]> {
  const problems: string[] = []
  const at = `at ${size.name}`
  const root = doc.documentElement

  if (root.scrollWidth > window.innerWidth + 1) problems.push(`the page scrolls sideways ${at}`)

  for (const bar of doc.querySelectorAll<HTMLElement>('[data-region="topbar"]')) {
    if (shown(bar) && bar.scrollWidth > bar.clientWidth + 1 && getComputedStyle(bar).overflowX === 'visible')
      problems.push(`the top bar holds more than it shows ${at}`)
  }

  const layer = topLayer(doc)
  const floor = size.touch ? 44 : 28
  for (const control of layer.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (!shown(control) || control.closest('canvas') !== null) continue
    const box = control.getBoundingClientRect()
    const primary = control.getAttribute('data-kind') === 'primary'
    const need = primary && size.touch ? 48 : floor
    if (box.height < need - 0.5)
      problems.push(`"${nameOf(control)}" is ${Math.round(box.height)} px tall, not ${need} ${at}`)
    if (box.width < floor - 0.5)
      problems.push(`"${nameOf(control)}" is ${Math.round(box.width)} px wide, not ${floor} ${at}`)
  }

  const lime = [...layer.querySelectorAll<HTMLElement>('[data-kind="primary"]')].filter(shown)
  const expected = options.lime ?? 1
  if (lime.length > expected)
    problems.push(`${lime.length} lime buttons show (${lime.map(nameOf).join(', ')}), not ${expected} ${at}`)
  else if (options.lime !== undefined && lime.length !== options.lime)
    problems.push(`${lime.length} lime buttons show, not ${options.lime} ${at}`)

  if (options.contrast === true) {
    const result = await axe.run(root, { runOnly: ['color-contrast'] })
    for (const violation of result.violations)
      for (const node of violation.nodes)
        problems.push(
          `low contrast ${at}: ${node.target.join(' ')} (${node.any[0]?.message ?? violation.help})`,
        )
  }
  return problems
}
