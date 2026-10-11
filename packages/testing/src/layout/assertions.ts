/**
 * Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's
 * `tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`,
 * `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).
 *
 * Each returns a list of human-readable problems; `[]` is a pass. They take no test framework, so
 * the same code runs in Vitest browser mode and inside a Playwright `page.evaluate` bundle. They
 * measure what a player meets: no scrolling, at the centre of what they would tap. They need a real
 * layout engine; in jsdom every box is 0x0.
 */

export interface LayoutRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** What a player can press. */
const CONTROLS = "button, input, select, textarea, [role='button']"

/** Half a pixel of rounding slack, as FloorFifty's checks allow. */
const SLACK = 0.5

/** A name a problem can be read by: the test id, else the start of the text, else the tag. */
function nameOf(element: Element): string {
  const testId = element.getAttribute('data-testid')
  if (testId !== null) return testId
  const text = (element.textContent ?? '').trim().slice(0, 24)
  return text === '' ? element.tagName.toLowerCase() : text
}

/** Controls a player could see and reach: laid out, not hidden, not in an inert subtree. */
function visibleControls(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CONTROLS)].filter((node) => {
    const rect = node.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    if (getComputedStyle(node).visibility === 'hidden') return false
    return node.closest('[inert]') === null
  })
}

function viewport(element: Element): { width: number; height: number } {
  const view = element.ownerDocument.defaultView
  return { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 }
}

/** Each element is fully inside the viewport, and a tap at its centre lands on it or inside it. */
export function findUnreachable(elements: readonly Element[]): string[] {
  const problems: string[] = []
  for (const element of elements) {
    const name = nameOf(element)
    const rect = element.getBoundingClientRect()
    const view = viewport(element)
    if (rect.width === 0 || rect.height === 0) {
      problems.push(`${name} is not visible`)
      continue
    }
    if (rect.top < -SLACK) problems.push(`${name} starts above the screen`)
    if (rect.left < -SLACK) problems.push(`${name} starts left of the screen`)
    if (rect.bottom > view.height + SLACK) problems.push(`${name} is below the fold`)
    if (rect.right > view.width + SLACK) problems.push(`${name} runs off the right edge`)
    const hit = element.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    if (hit === null || (hit !== element && !element.contains(hit))) {
      problems.push(`${name} is covered or clipped at its centre`)
    }
  }
  return problems
}

/**
 * Every visible control is at least `min` square, and a primary one (`[data-primary]`) at least
 * `minPrimary` tall. A checkbox or radio is pressed through its label too, so the label is its target.
 */
export function findSmallTargets(root: ParentNode, min: number, minPrimary: number): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    const input =
      node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio')
        ? node
        : undefined
    const target = input?.labels?.[0]?.getBoundingClientRect() ?? node.getBoundingClientRect()
    const primary = node.hasAttribute('data-primary')
    const tall = primary ? minPrimary : min
    if (target.width < min - SLACK || target.height < tall - SLACK) {
      const size = `${Math.round(target.width)}x${Math.round(target.height)}`
      problems.push(`${nameOf(node)}${primary ? ' (primary)' : ''} is ${size}`)
    }
  }
  return problems
}

/** Every visible control is on screen, unless it sits in a declared scroll region. */
export function findOffscreenControls(root: ParentNode): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    if (node.closest('[data-scroll-region]') !== null) continue
    const rect = node.getBoundingClientRect()
    const view = viewport(node)
    const off =
      rect.left < -SLACK ||
      rect.top < -SLACK ||
      rect.right > view.width + SLACK ||
      rect.bottom > view.height + SLACK
    if (off) problems.push(`${nameOf(node)} is off screen`)
  }
  return problems
}

/** Each element `selector` names is tall enough for what it holds (a crushed row clips its content). */
export function findClipped(root: ParentNode, selector: string): string[] {
  const problems: string[] = []
  for (const node of root.querySelectorAll<HTMLElement>(selector)) {
    if (node.scrollHeight > node.clientHeight + 1) {
      problems.push(`${nameOf(node)} clips ${node.scrollHeight - node.clientHeight}px`)
    }
  }
  return problems
}

function intersects(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function boxOf(element: Element): LayoutRect {
  const rect = element.getBoundingClientRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** Two elements' boxes do not overlap. */
export function findOverlaps(a: Element, b: Element): string[] {
  return intersects(boxOf(a), boxOf(b)) ? [`${nameOf(a)} overlaps ${nameOf(b)}`] : []
}

/** No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px. */
export function findIntrusions(root: ParentNode, rects: readonly LayoutRect[]): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    const box = boxOf(node)
    if (rects.some((rect) => rect.width > 0 && rect.height > 0 && intersects(box, rect))) {
      problems.push(`${nameOf(node)} is under a reserved area`)
    }
  }
  return problems
}

/** The document itself never scrolls; screens scroll inside declared regions. */
export function documentScrolls(doc: Document): string[] {
  const root = doc.documentElement
  const problems: string[] = []
  if (root.scrollHeight > root.clientHeight) problems.push('the page scrolls vertically')
  if (root.scrollWidth > root.clientWidth) problems.push('the page scrolls horizontally')
  return problems
}
