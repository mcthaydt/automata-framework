// The one piece of motion code in the layout's own bundle (a few hundred bytes). After the page is live and the
// browser is idle it decides whether this visitor gets motion, and only then fetches the two chunks that do the work.
// Anything that goes wrong (a failed download, a navigation that never finishes) must leave the page fully visible, so
// every hiding step has a way back: `finish()`, the 1,000 ms mark fallback, `focusin`, and reaching the page's end.
import type { Animate } from './animate.ts'
import { onReduceChange, smoothScrollAllowed, wantsMotion, wantsSmoothScroll } from './motion-preference.ts'
import { MOTION } from './motion-tokens.ts'
import { isBelowWindow, REVEAL_SECTIONS, type RevealPart, revealSteps } from './reveal-steps.ts'
import type { SmoothScroll } from './smooth-scroll.ts'

export interface MotionLoaders {
  animate(): Promise<{ createAnimate(): Animate }>
  smoothScroll(): Promise<{ createSmoothScroll(): SmoothScroll }>
}

export const DEFAULT_LOADERS: MotionLoaders = {
  animate: () => import('./animate.ts'),
  smoothScroll: () => import('./smooth-scroll.ts'),
}

export interface MotionLayer {
  start(pathname: string): void
  /** `sameRoute`: the next page is the same kind of page (another guide), so only its content settles. */
  beforePageChange(sameRoute: boolean): void
  afterPageChange(pathname: string, sameRoute: boolean): void
  destroy(): void
}

/** A hash change or a query change on one path is the same page; so is the first load (no `from`). */
export function isPageChange(from: URL | undefined, to: URL | undefined): boolean {
  return from !== undefined && to !== undefined && from.pathname !== to.pathname
}

/** The page stays hidden for at most this long if SvelteKit never says the new page arrived. */
const MARK_FALLBACK_MS = 1000

export function createMotionLayer(
  win: Window & typeof globalThis,
  loaders: MotionLoaders = DEFAULT_LOADERS,
): MotionLayer {
  const doc = win.document
  const root = doc.documentElement
  let pathname = ''
  let animate: Animate | undefined
  let smooth: SmoothScroll | undefined
  let observer: IntersectionObserver | undefined
  let markTimer: number | undefined
  let markedAs: 'same' | 'other' | undefined
  let stopListening: (() => void) | undefined
  // A download that finishes after motion was switched off must be thrown away: each teardown moves this on.
  let epoch = 0
  const hidden = new Map<Element, RevealPart[]>()

  function reveal(section: Element) {
    const parts = hidden.get(section)
    if (!parts) return
    hidden.delete(section)
    observer?.unobserve(section)
    animate?.reveal(parts)
  }

  // Tab into a section that is still waiting: it must not take focus while invisible.
  function onFocusIn(event: Event) {
    const section = (event.target as Element | null)?.closest?.('.home-section')
    if (section) reveal(section)
  }

  // The observer only sees a section while it is on screen. A jump (End, a #link, dragging the scroll bar) can skip it
  // altogether, and the last section can sit closer to the page's end than the observer's margin; neither may leave
  // anything hidden, so every scroll also reveals whatever the reader has reached or passed.
  function onScroll() {
    if (hidden.size === 0) return
    const atEnd = win.scrollY + win.innerHeight >= root.scrollHeight - 2
    for (const section of [...hidden.keys()]) {
      if (atEnd || section.getBoundingClientRect().top < win.innerHeight * 0.85) reveal(section)
    }
  }

  function stopRevealing() {
    observer?.disconnect()
    observer = undefined
    hidden.clear()
    doc.removeEventListener('focusin', onFocusIn)
    win.removeEventListener('scroll', onScroll)
  }

  /** Hide the parts of every section still wholly below the window, and bring each in as it nears. */
  function scanReveals() {
    stopRevealing()
    if (!animate) return
    const sections = [...doc.querySelectorAll(REVEAL_SECTIONS)].filter((section) =>
      isBelowWindow(section, win.innerHeight),
    )
    if (sections.length === 0) return
    observer = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target)
      },
      { rootMargin: MOTION.revealMargin },
    )
    for (const section of sections) {
      const parts = revealSteps(section)
      if (parts.length === 0) continue
      hidden.set(section, parts)
      animate.hide(parts)
      observer.observe(section)
    }
    doc.addEventListener('focusin', onFocusIn)
    win.addEventListener('scroll', onScroll, { passive: true })
  }

  async function startSmoothScroll(current: number) {
    if (smooth || !wantsSmoothScroll(win, pathname)) return
    try {
      const { createSmoothScroll } = await loaders.smoothScroll()
      if (current === epoch && !smooth && wantsSmoothScroll(win, pathname)) smooth = createSmoothScroll()
    } catch {
      // No smoothing: the browser's own scrolling is what the page was built for.
    }
  }

  async function load() {
    const current = epoch
    void startSmoothScroll(current)
    try {
      const { createAnimate } = await loaders.animate()
      if (current !== epoch || animate) return
      animate = createAnimate()
      scanReveals()
    } catch {
      // No moves: nothing was hidden, so nothing needs undoing.
    }
  }

  function begin() {
    if (!wantsMotion(win)) return
    const run = () => void load()
    // After the page is live and the browser has nothing better to do, never competing with the first paint.
    if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(run, { timeout: 2000 })
    else win.setTimeout(run, 1)
  }

  function clearMark() {
    if (markTimer !== undefined) win.clearTimeout(markTimer)
    markTimer = undefined
    markedAs = undefined
    root.removeAttribute('data-page-change')
    root.style.removeProperty('scroll-behavior')
  }

  function teardown() {
    epoch += 1
    clearMark()
    stopRevealing()
    animate?.finish()
    animate = undefined
    smooth?.destroy()
    smooth = undefined
  }

  return {
    start(path) {
      pathname = path
      stopListening ??= onReduceChange(win, (reduce) => {
        if (reduce) teardown()
        else begin()
      })
      begin()
    },

    beforePageChange(sameRoute) {
      if (!animate) return
      stopRevealing()
      animate.finish()
      smooth?.settle()
      // Another guide keeps its sidebar still; with nothing to settle in place the whole page does.
      markedAs = sameRoute && doc.querySelector('[data-page-content]') ? 'same' : 'other'
      root.setAttribute('data-page-change', markedAs)
      // A page always starts at its top at once, never gliding there from the old page's position.
      root.style.scrollBehavior = 'auto'
      markTimer = win.setTimeout(clearMark, MARK_FALLBACK_MS)
    },

    afterPageChange(path, _sameRoute) {
      pathname = path
      if (smooth && !smoothScrollAllowed(path)) {
        smooth.destroy()
        smooth = undefined
      } else if (!smooth) void startSmoothScroll(epoch)
      if (animate && markedAs) {
        const target =
          (markedAs === 'same' ? doc.querySelector<HTMLElement>('[data-page-content]') : null) ??
          doc.querySelector<HTMLElement>('main')
        // The settle starts the new page at opacity 0 before the mark goes, so it never flashes.
        if (target) animate.pageIn(target)
      }
      clearMark()
      scanReveals()
    },

    destroy() {
      stopListening?.()
      stopListening = undefined
      teardown()
    },
  }
}
