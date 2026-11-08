// Which pieces of a Home section arrive, and in what order. Words come first, so the reader has the claim before the
// picture; then the panels and pictures; then the cards of a grid. Nothing outside a `.home-section` is ever a part, so
// the hero, the facts, the logo strip and the closing band are on screen from the first paint.
export interface RevealPart {
  readonly element: Element
  /** A panel or picture: it also grows a hair, where a line of words only rises. */
  readonly product: boolean
}

export const REVEAL_SECTIONS = 'main .home-section'

const WORDS = '.home-kicker, h2, .home-sub, .home-points > li, .home-more > a, p.more'
const PRODUCTS = '.show, .home-panel'
const ITEMS = 'ul:not(.home-points) > li'

/** Parts never nest: a panel arrives whole, so its words and list items are not parts of their own. */
export function revealSteps(section: Element): RevealPart[] {
  const inside = (candidates: Element[], among: readonly Element[]) =>
    candidates.filter((candidate) => !among.some((other) => other !== candidate && other.contains(candidate)))
  const products = inside([...section.querySelectorAll(PRODUCTS)], [...section.querySelectorAll(PRODUCTS)])
  const words = inside([...section.querySelectorAll(WORDS)], products)
  // An item that holds a nested list or a word part would nest; keep the innermost holder out.
  const items = inside([...section.querySelectorAll(ITEMS)], [...products, ...words]).filter(
    (item) => !item.querySelector(WORDS) && !item.querySelector(ITEMS),
  )
  return [
    ...words.map((element) => ({ element, product: false })),
    ...products.map((element) => ({ element, product: true })),
    ...items.map((element) => ({ element, product: false })),
  ]
}

/** Only a part that is wholly below the window waits: anything already in view stays put. */
export function isBelowWindow(element: Element, windowHeight: number): boolean {
  return element.getBoundingClientRect().top >= windowHeight
}
