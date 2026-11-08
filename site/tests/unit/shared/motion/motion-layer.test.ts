import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Animate } from '#src/shared/motion/animate.ts'
import { createMotionLayer, isPageChange, type MotionLoaders } from '#src/shared/motion/motion-layer.ts'
import { FINE_POINTER, REDUCE } from '#src/shared/motion/motion-preference.ts'
import { MOTION } from '#src/shared/motion/motion-tokens.ts'
import type { SmoothScroll } from '#src/shared/motion/smooth-scroll.ts'

class FakeObserver {
  static instances: FakeObserver[] = []
  observed = new Set<Element>()
  disconnected = false
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this)
  }
  observe(element: Element) {
    this.observed.add(element)
  }
  unobserve(element: Element) {
    this.observed.delete(element)
  }
  disconnect() {
    this.disconnected = true
    this.observed.clear()
  }
  takeRecords() {
    return []
  }
  intersect(element: Element) {
    this.callback([{ isIntersecting: true, target: element } as IntersectionObserverEntry], this as never)
  }
}

interface Fakes {
  animate: { [K in keyof Animate]: ReturnType<typeof vi.fn> }
  smooth: { settle: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
  loaders: MotionLoaders
  loadAnimate: ReturnType<typeof vi.fn>
  loadSmooth: ReturnType<typeof vi.fn>
}

function fakes(): Fakes {
  const animate = { pageIn: vi.fn(), hide: vi.fn(), reveal: vi.fn(), finish: vi.fn() }
  const smooth = { settle: vi.fn(), destroy: vi.fn() }
  const loadAnimate = vi.fn(async () => ({ createAnimate: () => animate as Animate }))
  const loadSmooth = vi.fn(async () => ({ createSmoothScroll: () => smooth as SmoothScroll }))
  return {
    animate,
    smooth,
    loadAnimate,
    loadSmooth,
    loaders: { animate: loadAnimate, smoothScroll: loadSmooth },
  }
}

let reduceListeners: Array<(event: { matches: boolean }) => void>
function environment(options: { reduce?: boolean; fine?: boolean; saveData?: boolean } = {}) {
  reduceListeners = []
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      query === REDUCE ? (options.reduce ?? false) : query === FINE_POINTER ? (options.fine ?? false) : false,
    addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => {
      if (query === REDUCE) reduceListeners.push(fn)
    },
    removeEventListener: (_: string, fn: (event: { matches: boolean }) => void) => {
      reduceListeners = reduceListeners.filter((listener) => listener !== fn)
    },
  }))
  Object.defineProperty(window.navigator, 'connection', {
    value: { saveData: options.saveData ?? false },
    configurable: true,
  })
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => {
    fn()
    return 0
  })
  vi.stubGlobal('IntersectionObserver', FakeObserver)
}

/** A page: the given sections, each placed `top` px from the window's top. */
function page(tops: number[]): HTMLElement[] {
  document.body.innerHTML = `<main>${tops
    .map(
      (_, i) =>
        `<section class="home-section" id="s${i}"><h2>Title ${i}</h2><p class="home-sub">Sub ${i}</p><button id="b${i}">Go</button></section>`,
    )
    .join('')}</main>`
  return tops.map((top, i) => {
    const section = document.querySelector(`#s${i}`) as HTMLElement
    section.getBoundingClientRect = () => ({ top }) as DOMRect
    return section
  })
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const root = document.documentElement

beforeEach(() => {
  // jsdom has no layout: a page 5,000 px tall, scrolled to its top.
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  FakeObserver.instances = []
  root.removeAttribute('data-page-change')
  root.style.scrollBehavior = ''
  document.body.innerHTML = '<main><p>plain</p></main>'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('what loads', () => {
  it('loads nothing for a visitor who asked for less motion', async () => {
    environment({ reduce: true, fine: true })
    const f = fakes()
    createMotionLayer(window, f.loaders).start('/')
    await flush()
    expect(f.loadAnimate).not.toHaveBeenCalled()
    expect(f.loadSmooth).not.toHaveBeenCalled()
  })

  it('loads nothing when the connection saves data', async () => {
    environment({ fine: true, saveData: true })
    const f = fakes()
    createMotionLayer(window, f.loaders).start('/')
    await flush()
    expect(f.loadAnimate).not.toHaveBeenCalled()
    expect(f.loadSmooth).not.toHaveBeenCalled()
  })

  it('loads the moves but not the smoothing for a coarse pointer', async () => {
    environment()
    const f = fakes()
    createMotionLayer(window, f.loaders).start('/')
    await flush()
    expect(f.loadAnimate).toHaveBeenCalledTimes(1)
    expect(f.loadSmooth).not.toHaveBeenCalled()
  })

  it('loads the smoothing for a fine pointer, except on the playground', async () => {
    environment({ fine: true })
    const f = fakes()
    createMotionLayer(window, f.loaders).start('/examples/x')
    await flush()
    expect(f.loadSmooth).not.toHaveBeenCalled()
    createMotionLayer(window, f.loaders).start('/')
    await flush()
    expect(f.loadSmooth).toHaveBeenCalledTimes(1)
  })

  it('drops the smoothing on the playground and brings it back after', async () => {
    environment({ fine: true })
    const f = fakes()
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await flush()
    layer.afterPageChange('/examples/x', false)
    expect(f.smooth.destroy).toHaveBeenCalledTimes(1)
    layer.afterPageChange('/docs', false)
    await flush()
    expect(f.loadSmooth).toHaveBeenCalledTimes(2)
  })

  it('hides nothing and marks nothing when the moves fail to download', async () => {
    environment({ fine: true })
    const f = fakes()
    f.loadAnimate.mockRejectedValue(new Error('offline'))
    const sections = page([2000])
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await flush()
    layer.beforePageChange(false)
    expect(root.hasAttribute('data-page-change')).toBe(false)
    expect(sections[0]?.querySelector('h2')?.getAttribute('style')).toBeNull()
  })
})

describe('a page change', () => {
  async function started() {
    environment({ fine: true })
    const f = fakes()
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await flush()
    return { f, layer }
  }

  it('marks the page, stops a glide and turns the browser’s smooth anchors off for the instant', async () => {
    const { f, layer } = await started()
    layer.beforePageChange(false)
    expect(root.getAttribute('data-page-change')).toBe('other')
    expect(f.smooth.settle).toHaveBeenCalled()
    expect(root.style.scrollBehavior).toBe('auto')
    expect(f.animate.finish).toHaveBeenCalled()
  })

  it('settles the new page in, then clears the mark', async () => {
    const { f, layer } = await started()
    layer.beforePageChange(false)
    layer.afterPageChange('/docs', false)
    expect(f.animate.pageIn).toHaveBeenCalledWith(document.querySelector('main'))
    expect(root.hasAttribute('data-page-change')).toBe(false)
    expect(root.style.scrollBehavior).toBe('')
  })

  it('settles only the article when the same route shows another page', async () => {
    const { f, layer } = await started()
    document.body.innerHTML = '<main><aside>side</aside><article data-page-content>text</article></main>'
    layer.beforePageChange(true)
    expect(root.getAttribute('data-page-change')).toBe('same')
    layer.afterPageChange('/docs/b', true)
    expect(f.animate.pageIn).toHaveBeenCalledWith(document.querySelector('[data-page-content]'))
  })

  it('treats a same-route change with nothing to settle as a whole-page change', async () => {
    const { f, layer } = await started()
    layer.beforePageChange(true)
    expect(root.getAttribute('data-page-change')).toBe('other')
    layer.afterPageChange('/examples/b', true)
    expect(f.animate.pageIn).toHaveBeenCalledWith(document.querySelector('main'))
  })

  it('removes the mark after 1,000 ms if the page never arrives', async () => {
    vi.useFakeTimers()
    environment({ fine: true })
    const f = fakes()
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await vi.advanceTimersByTimeAsync(0)
    layer.beforePageChange(false)
    expect(root.getAttribute('data-page-change')).toBe('other')
    await vi.advanceTimersByTimeAsync(1000)
    expect(root.hasAttribute('data-page-change')).toBe(false)
    expect(root.style.scrollBehavior).toBe('')
  })

  it('sets no mark before the moves have loaded', () => {
    environment({ fine: true })
    const layer = createMotionLayer(window, fakes().loaders)
    layer.beforePageChange(false)
    expect(root.hasAttribute('data-page-change')).toBe(false)
  })
})

describe('reveals', () => {
  async function onHome(tops: number[]) {
    environment()
    const sections = page(tops)
    const f = fakes()
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await flush()
    return { f, layer, sections }
  }

  it('hides the sections below the window and observes them with the plan’s margin', async () => {
    const { f, sections } = await onHome([2000, 3000])
    expect(f.animate.hide).toHaveBeenCalledTimes(2)
    const observer = FakeObserver.instances.at(-1) as FakeObserver
    expect(observer.options?.rootMargin).toBe(MOTION.revealMargin)
    expect([...observer.observed]).toEqual(sections)
  })

  it('reveals a section once when it comes into view', async () => {
    const { f, sections } = await onHome([2000])
    const observer = FakeObserver.instances.at(-1) as FakeObserver
    observer.intersect(sections[0] as Element)
    observer.intersect(sections[0] as Element)
    expect(f.animate.reveal).toHaveBeenCalledTimes(1)
    expect(observer.observed.has(sections[0] as Element)).toBe(false)
  })

  it('never hides a section that is already in or above the window', async () => {
    const { f } = await onHome([100, -400])
    expect(f.animate.hide).not.toHaveBeenCalled()
  })

  it('reveals a hidden section at once when focus moves into it', async () => {
    const { f, sections } = await onHome([2000])
    sections[0]
      ?.querySelector<HTMLElement>('#b0')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(f.animate.reveal).toHaveBeenCalledTimes(1)
    const observer = FakeObserver.instances.at(-1) as FakeObserver
    expect(observer.observed.has(sections[0] as Element)).toBe(false)
  })

  it('reveals what is left when the reader reaches the bottom of the page', async () => {
    const { f } = await onHome([2000])
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 3000 - window.innerHeight, configurable: true })
    window.dispatchEvent(new Event('scroll'))
    expect(f.animate.reveal).toHaveBeenCalledTimes(1)
  })

  it('reveals a section the reader jumped past without it ever being on screen', async () => {
    const { f, sections } = await onHome([2000, 3000])
    sections[0]!.getBoundingClientRect = () => ({ top: -900 }) as DOMRect
    window.dispatchEvent(new Event('scroll'))
    expect(f.animate.reveal).toHaveBeenCalledTimes(1)
    expect(f.animate.reveal).toHaveBeenCalledWith(expect.any(Array))
    // The one still below the window keeps waiting.
    sections[1]!.getBoundingClientRect = () => ({ top: 2500 }) as DOMRect
    window.dispatchEvent(new Event('scroll'))
    expect(f.animate.reveal).toHaveBeenCalledTimes(1)
  })

  it('finishes and disconnects before a page change, and scans the new page after it', async () => {
    const { f, layer } = await onHome([2000])
    const first = FakeObserver.instances.at(-1) as FakeObserver
    layer.beforePageChange(false)
    expect(f.animate.finish).toHaveBeenCalled()
    expect(first.disconnected).toBe(true)
    page([2500, 3500])
    layer.afterPageChange('/', false)
    const second = FakeObserver.instances.at(-1) as FakeObserver
    expect(second).not.toBe(first)
    expect(second.observed.size).toBe(2)
  })

  it('observes nothing on a page with no sections', async () => {
    const { layer } = await onHome([2000])
    layer.beforePageChange(false)
    document.body.innerHTML = '<main><p>docs</p></main>'
    layer.afterPageChange('/docs', false)
    const latest = FakeObserver.instances.at(-1) as FakeObserver
    expect(latest.observed.size).toBe(0)
  })
})

describe('reduced motion switched on mid-visit', () => {
  it('finishes, stops the smoothing, and starts nothing new; switching back starts again', async () => {
    environment({ fine: true })
    const sections = page([2000])
    const f = fakes()
    const layer = createMotionLayer(window, f.loaders)
    layer.start('/')
    await flush()
    const observer = FakeObserver.instances.at(-1) as FakeObserver
    expect(sections).toHaveLength(1)
    for (const listener of reduceListeners) listener({ matches: true })
    expect(f.animate.finish).toHaveBeenCalled()
    expect(f.smooth.destroy).toHaveBeenCalled()
    expect(observer.disconnected).toBe(true)
    layer.beforePageChange(false)
    expect(root.hasAttribute('data-page-change')).toBe(false)
    // The visitor changes their mind: the browser now reports no reduction.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === FINE_POINTER,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    for (const listener of reduceListeners) listener({ matches: false })
    await flush()
    expect(f.loadAnimate).toHaveBeenCalledTimes(2)
  })
})

describe('isPageChange', () => {
  const url = (path: string) => new URL(path, 'https://example.com')
  it('is true only when the path changes', () => {
    expect(isPageChange(url('/docs'), url('/docs#a'))).toBe(false)
    expect(isPageChange(url('/'), url('/docs'))).toBe(true)
    expect(isPageChange(undefined, url('/'))).toBe(false)
  })
})
