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

/** What a player can press or reach with Tab. */
const CONTROLS =
  "button, input, select, textarea, summary, a[href], [role='button'], [role='link'], [role='tab'], [tabindex]:not([tabindex='-1'])"

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
export function visibleControls(root: ParentNode): HTMLElement[] {
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

/** How far inside an edge its hit test is taken: clear of a 1 px border and the rounding slack. */
const EDGE_INSET = 2

/**
 * Where a player's tap must land on the element: its centre and the middle of each edge, just
 * inside. Mid-edges rather than corners, so a rounded or pill-shaped control is not marked down for
 * its own corners. A control a scroller or an overlay hides even partly fails at the edge it loses.
 */
function hitPoints(rect: DOMRect): [string, number, number][] {
  const midX = rect.left + rect.width / 2
  const midY = rect.top + rect.height / 2
  return [
    ['centre', midX, midY],
    ['top edge', midX, rect.top + EDGE_INSET],
    ['bottom edge', midX, rect.bottom - EDGE_INSET],
    ['left edge', rect.left + EDGE_INSET, midY],
    ['right edge', rect.right - EDGE_INSET, midY],
  ]
}

/**
 * Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre
 * and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.
 */
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
    for (const [where, x, y] of hitPoints(rect)) {
      const hit = element.ownerDocument.elementFromPoint(x, y)
      if (hit === null || (hit !== element && !element.contains(hit))) {
        problems.push(`${name} is covered or clipped at its ${where}`)
        break
      }
    }
  }
  return problems
}

/** The one marker of a primary action. The theme sizes a primary by the same attribute. */
const PRIMARY = '[data-kind="primary"]'

/**
 * Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least
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
    const primary = node.matches(PRIMARY)
    const tall = primary ? minPrimary : min
    if (target.width < min - SLACK || target.height < tall - SLACK) {
      const size = `${Math.round(target.width)}x${Math.round(target.height)}`
      problems.push(`${nameOf(node)}${primary ? ' (primary)' : ''} is ${size}`)
    }
  }
  return problems
}

/** Every visible control is on screen, unless it sits in a declared scroll region (`[data-scroll-region]`). */
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

/** Whether two boxes share more than the rounding slack on both axes; touching edges do not count. */
function intersects(a: LayoutRect, b: LayoutRect): boolean {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return across > SLACK && down > SLACK
}

function boxOf(element: Element): LayoutRect {
  const rect = element.getBoundingClientRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** Two elements' boxes do not overlap. */
export function findOverlaps(a: Element, b: Element): string[] {
  return intersects(boxOf(a), boxOf(b)) ? [`${nameOf(a)} overlaps ${nameOf(b)}`] : []
}

/** The declared scroll regions around `node`, innermost first. */
function scrollRegionsAround(node: Element): Element[] {
  const regions: Element[] = []
  let region = node.parentElement?.closest('[data-scroll-region]') ?? null
  while (region !== null) {
    regions.push(region)
    region = region.parentElement?.closest('[data-scroll-region]') ?? null
  }
  return regions
}

/**
 * Whether `region` clips `node`: whether the region sits in the chain of containing blocks from the
 * node up. An overflow box clips only the descendants it contains, so a `position: fixed` element
 * (contained by the viewport) and an absolute one whose positioned ancestor lies outside the region
 * escape it, and scrolling the region would never move them.
 * Simplified on purpose: a transform or filter that would contain a fixed element is not followed,
 * so such an element is treated as escaping, the stricter answer.
 */
function clippedBy(node: Element, region: Element): boolean {
  let element: Element | null = node
  while (element !== null && element !== region) {
    const position = getComputedStyle(element).position
    if (position === 'fixed') return false
    let parent: Element | null = element.parentElement
    if (position === 'absolute') {
      // The containing block is the nearest positioned ancestor. A static region on the way is
      // passed over too: it does not contain the element, so it does not clip it.
      while (parent !== null && getComputedStyle(parent).position === 'static') parent = parent.parentElement
    }
    element = parent
  }
  return element === region
}

/**
 * No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its
 * whole box. The one exception is a control that a declared scroll region clips (see `clippedBy`)
 * where that region is itself clear of every area: scrolling brings it into view. An undeclared
 * scroller earns nothing, and a fixed control is measured where it is drawn, whatever it sits inside.
 */
export function findIntrusions(root: ParentNode, rects: readonly LayoutRect[]): string[] {
  const areas = rects.filter((rect) => rect.width > 0 && rect.height > 0)
  const clear = (box: LayoutRect): boolean => !areas.some((rect) => intersects(box, rect))
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    if (clear(boxOf(node))) continue
    if (scrollRegionsAround(node).some((region) => clippedBy(node, region) && clear(boxOf(region)))) continue
    problems.push(`${nameOf(node)} is under a reserved area`)
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
