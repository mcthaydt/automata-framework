// Browser gates for the QB.3 suite. Each returns a list of problems (empty means it passed) so the same helper serves
// the site suite (expects none) and the fixture suite (expects its planted problem). gates.e2e.ts proves each one bites.
import AxeBuilder from '@axe-core/playwright'
import type { BrowserContext, Page } from '@playwright/test'

/** A short CSS path for messages: tag, id, or first class. */
const DESCRIBE = `function describe(element) {
  if (element.id) return element.tagName.toLowerCase() + '#' + element.id
  const className = typeof element.className === 'string' ? element.className.trim().split(/\\s+/)[0] : ''
  return element.tagName.toLowerCase() + (className ? '.' + className : '')
}`

/**
 * Collects console errors, uncaught page errors and requests to any origin other than `origin` for as long as the
 * page lives. Read `problems` after the page has settled.
 */
export function watchPage(page: Page, origin: string): { problems: string[] } {
  const problems: string[] = []
  page.on('console', message => { if (message.type() === 'error') problems.push('console error: ' + message.text()) })
  page.on('pageerror', error => problems.push('page error: ' + error.message))
  page.on('request', request => {
    const url = request.url()
    if (/^(data|blob|about):/.test(url)) return
    if (new URL(url).origin !== origin) problems.push('third-party request: ' + url)
  })
  return { problems }
}

/** Elements that stick out past the right edge when the page is wider than the viewport (no horizontal scroll). */
export async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const root = document.documentElement
    if (root.scrollWidth <= root.clientWidth) return []
    const offenders = Array.from(document.body.querySelectorAll('*'))
      .filter(element => element.getBoundingClientRect().right > root.clientWidth + 0.5)
      .filter(element => !element.parentElement || element.parentElement.getBoundingClientRect().right <= root.clientWidth + 0.5)
      .slice(0, 5).map(describe)
    return ['page is ' + root.scrollWidth + 'px wide in a ' + root.clientWidth + 'px viewport: ' + (offenders.join(', ') || 'unknown element')]
  })()`)
}

export async function cookieNames(context: BrowserContext): Promise<string[]> {
  return (await context.cookies()).map(cookie => cookie.name).sort()
}

/** Keys the page left in localStorage and sessionStorage. */
export async function storageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...Object.keys(localStorage).map(key => 'localStorage:' + key),
    ...Object.keys(sessionStorage).map(key => 'sessionStorage:' + key),
  ].sort())
}

/**
 * Tabs through the page from the top. Every visible interactive element must receive focus, and each must show a
 * focus ring (a computed outline that is not `none` and wider than 0). WebKit, like Safari, skips links on plain Tab;
 * Alt+Tab is its "every control" key, so WebKit uses that.
 */
export async function keyboardProblems(page: Page): Promise<string[]> {
  const isWebKit = page.context().browser()?.browserType().name() === 'webkit'
  const candidates: string[] = await page.evaluate(`(() => {
    ${DESCRIBE}
    const selector = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, iframe, [tabindex]:not([tabindex="-1"])'
    let index = 0
    return Array.from(document.querySelectorAll(selector))
      .filter(element => element.checkVisibility({ visibilityProperty: true }) && !element.closest('[inert], dialog:not([open])') && element.tabIndex >= 0)
      .map(element => { element.setAttribute('data-qb-focus', String(index++)); return describe(element) })
  })()`)
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0) })
  const reached = new Set<number>()
  const problems: string[] = []
  let previous = -2
  let repeats = 0
  for (let presses = 0; presses < candidates.length * 2 + 10 && reached.size < candidates.length; presses++) {
    await page.keyboard.press(isWebKit ? 'Alt+Tab' : 'Tab')
    const focused: { index: number; ring: boolean } | null = await page.evaluate(() => {
      const element = document.activeElement
      const index = element?.getAttribute('data-qb-focus')
      if (!element || index === null || index === undefined) return null
      const style = getComputedStyle(element)
      return { index: Number(index), ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 }
    })
    if (!focused) continue
    if (!focused.ring && !reached.has(focused.index)) problems.push('no focus ring: ' + candidates[focused.index])
    reached.add(focused.index)
    // Focus that stops moving is a keyboard trap (or an iframe that kept it); stop rather than spin.
    repeats = focused.index === previous ? repeats + 1 : 0
    previous = focused.index
    if (repeats >= 3) break
  }
  candidates.forEach((description, index) => { if (!reached.has(index)) problems.push('not reachable by keyboard: ' + description) })
  return problems
}

/**
 * Clicks every visible, enabled button and expects something to happen: a DOM change, a navigation, a popup or a
 * fullscreen change. After each click the page is put back (navigate back, close a dialog, leave fullscreen).
 * A button that marks the current choice (aria-pressed="true", aria-selected="true" or aria-current) is skipped:
 * choosing what is already chosen is a no-op by design.
 */
export async function deadButtons(page: Page): Promise<string[]> {
  const start = page.url()
  const count = await page.locator('button:visible').count()
  const dead: string[] = []
  for (let index = 0; index < count; index++) {
    const button = page.locator('button:visible').nth(index)
    if (!(await button.isVisible()) || !(await button.isEnabled())) continue
    if (await button.evaluate(element => element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-selected') === 'true' || element.hasAttribute('aria-current'))) continue
    const label = ((await button.getAttribute('aria-label')) ?? (await button.innerText())).trim().replace(/\s+/g, ' ')
    await page.evaluate(() => {
      const state = window as unknown as { __qbChanges: number; __qbObserver?: MutationObserver }
      state.__qbObserver?.disconnect()
      state.__qbChanges = 0
      state.__qbObserver = new MutationObserver(records => { state.__qbChanges += records.length })
      state.__qbObserver.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
      document.addEventListener('fullscreenchange', () => { state.__qbChanges++ }, { once: true })
    })
    const popup = page.context().waitForEvent('page', { timeout: 1500 }).catch(() => null)
    await button.click()
    const changed = await page.waitForFunction(
      url => location.href !== url || (window as unknown as { __qbChanges: number }).__qbChanges > 0,
      start, { timeout: 1500 },
    ).then(() => true, () => false)
    const opened = await popup
    if (opened) await opened.close()
    if (!changed && !opened) dead.push(`button "${label}" changed nothing`)
    if (page.url() !== start) await page.goto(start)
    else {
      if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape')
      await page.evaluate(() => document.fullscreenElement ? document.exitFullscreen() : undefined).catch(() => undefined)
    }
  }
  return dead
}

/** axe-core at WCAG 2.2 AA (and the 2.0/2.1 rules it builds on). */
export async function axeViolations(page: Page, exclude: string[] = []): Promise<string[]> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  for (const selector of exclude) builder = builder.exclude(selector)
  const results = await builder.analyze()
  return results.violations.map(violation =>
    `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.slice(0, 3).map(node => node.target.join(' ')).join(', ')}`)
}
