/**
 * Layout assertions as plain DOM functions (`expectReachable`, `expectControlsFit`, `expectRowsWhole`,
 * `expectApart`, `expectNoDocumentScroll`).
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
 * What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a
 * press anywhere on it toggles the input), else the control itself.
 */
export function pressedPart(control: HTMLElement): HTMLElement {
  const choice =
    control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')
  return (choice ? control.labels?.[0] : undefined) ?? control
}

/**
 * Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least
 * `minPrimary` tall. A checkbox or radio is pressed through its label too, so the label is its target.
 */
export function findSmallTargets(root: ParentNode, min: number, minPrimary: number): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    const target = pressedPart(node).getBoundingClientRect()
    const primary = node.matches(PRIMARY)
    const tall = primary ? minPrimary : min
    if (target.width < min - SLACK || target.height < tall - SLACK) {
      const size = `${Math.round(target.width)}x${Math.round(target.height)}`
      problems.push(`${nameOf(node)}${primary ? ' (primary)' : ''} is ${size}`)
    }
  }
  return problems
}

/**
 * Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`)
 * clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged
 * where it is drawn, since scrolling the region would never bring it into view.
 */
export function findOffscreenControls(root: ParentNode): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    if (scrollRegionsAround(node).some((region) => clippedBy(node, region))) continue
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

/**
 * No control is cut at a side of a declared scroll region that clips it (see `clippedBy`). A region scrolls up and
 * down, so a control past its side is cut where a player would not think to scroll, as a long language's options
 * were in a Settings list; `findOffscreenControls` passes whatever a region clips, so this is what catches a control
 * cut across. A region that scrolls sideways on purpose (an editor's strip of scenes) declares
 * `data-scroll-region="both"`: a control past its side is reached by scrolling it, and the walk out through the
 * regions around it stops there. A checkbox or radio is judged by its label (`pressedPart`).
 */
export function findCutAtSide(root: ParentNode): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    const target = pressedPart(node)
    const box = target.getBoundingClientRect()
    for (const region of scrollRegionsAround(target)) {
      if (!clippedBy(target, region)) continue
      if (region.getAttribute('data-scroll-region') === 'both') break
      const left = region.getBoundingClientRect().left + region.clientLeft
      if (box.left < left - SLACK || box.right > left + region.clientWidth + SLACK) {
        problems.push(`${nameOf(target)} is cut at the side of its scroll region`)
        break
      }
    }
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

const BAR_REGIONS = ['topbar', 'rail', 'panel', 'dock', 'tools']

/**
 * The selector for the controls a player presses in a bar: the buttons, links, tabs and menu items inside a region a
 * screen or an editor declares with `data-region` (`topbar`, `rail`, `panel`, `dock`, `tools`). `findCutByBar` and
 * `findCovered` take it as their `selector`, and `checkLayout` runs both with it.
 */
export const BAR_ACTIONS = BAR_REGIONS.map(
  (region) => `[data-region=${region}] :is(button, a, [role=tab], [role=menuitem])`,
).join(', ')

/**
 * Each visible control `selector` names is whole inside every ancestor that clips its overflow. `findClipped` measures
 * a node's own vertical overflow, so a button that its bar cuts across (a phone's top bar hid Publish) is never seen
 * by it. An ancestor that is a declared scroll region (`data-scroll-region`) may hold a control past its side: the
 * player scrolls to it, and `findCutAtSide` judges the region.
 */
export function findCutByBar(root: ParentNode, selector: string): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    if (!node.matches(selector)) continue
    const box = node.getBoundingClientRect()
    for (let bar = node.parentElement; bar !== null; bar = bar.parentElement) {
      if (bar.hasAttribute('data-scroll-region')) break
      const style = getComputedStyle(bar)
      const clipsX = style.overflowX !== 'visible'
      const clipsY = style.overflowY !== 'visible'
      if (!clipsX && !clipsY) continue
      const edge = bar.getBoundingClientRect()
      const cut =
        (clipsX && (box.left < edge.left - SLACK || box.right > edge.right + SLACK)) ||
        (clipsY && (box.top < edge.top - SLACK || box.bottom > edge.bottom + SLACK))
      if (cut) {
        problems.push(
          `${nameOf(node)} is cut by its ${bar.getAttribute('data-region') ?? bar.tagName.toLowerCase()}`,
        )
        break
      }
    }
  }
  return problems
}

/**
 * Each visible control `selector` names is on top at its centre: what is drawn there is the control or inside it. A
 * modal dialog may cover it (the page behind a modal is inert), and so may anything `excused` says may: an ErrorPanel
 * that had to rise over the bar, for one. The same rule `findCoveredCorners` holds the corner row to.
 */
export function findCovered(
  root: ParentNode,
  selector: string,
  excused: (cover: Element) => boolean = () => false,
): string[] {
  const problems: string[] = []
  for (const node of visibleControls(root)) {
    if (!node.matches(selector)) continue
    // An open dialog puts a scrim over the page behind it: those controls are covered on purpose, whether or not the
    // page is made inert, so only a control that is not behind a dialog is held to this rule.
    // With several open, the last one is on top: the others are behind its scrim too.
    const dialogs = node.ownerDocument.querySelectorAll('[aria-modal="true"], [role="dialog"], dialog[open]')
    const top = dialogs[dialogs.length - 1]
    if (top !== undefined && !top.contains(node)) continue
    // A control in a declared scroll region is judged by the region's own checks: scrolled out of view is not covered.
    if (scrollRegionsAround(node).length > 0) continue
    const box = node.getBoundingClientRect()
    const hit = node.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    if (hit === null || hit === node || node.contains(hit)) continue
    if (hit.closest('[aria-modal="true"], [role="dialog"], dialog[open]') !== null) continue
    if (excused(hit)) continue
    problems.push(`${nameOf(node)} is covered by ${nameOf(hit)}`)
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
