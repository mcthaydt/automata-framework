import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOTION } from '#src/shared/motion/motion-tokens.ts'
import {
  createSmoothScroll,
  DRIFT_TOLERANCE_PX,
  LENIS_OPTIONS,
  movedByOthers,
  preventSmoothScroll,
} from '#src/shared/motion/smooth-scroll.ts'

const lenisCalls = vi.hoisted(() => ({
  scrollTo: vi.fn(),
  destroy: vi.fn(),
  raf: vi.fn(),
  reset: vi.fn(),
  glide: { isScrolling: false as boolean | 'native' | 'smooth' },
}))
vi.mock('lenis', () => ({
  default: class {
    scrollTo = lenisCalls.scrollTo
    destroy = lenisCalls.destroy
    raf = lenisCalls.raf
    reset = lenisCalls.reset
    get isScrolling() {
      return lenisCalls.glide.isScrolling
    }
  },
}))

afterEach(() => {
  lenisCalls.glide.isScrolling = false
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('Lenis options', () => {
  it('are the plan’s: wheel only, the browser keeps anchors and touch', () => {
    expect(LENIS_OPTIONS).toMatchObject({
      autoRaf: false,
      lerp: MOTION.lerp,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    })
    expect(LENIS_OPTIONS.prevent).toBe(preventSmoothScroll)
  })
})

describe('preventSmoothScroll', () => {
  const inside = (markup: string) => {
    document.body.innerHTML = markup
    return document.querySelector('#target') as HTMLElement
  }
  it('is true inside an open dialog, so the search results keep their own wheel', () => {
    expect(preventSmoothScroll(inside('<dialog open><div id="target"></div></dialog>'))).toBe(true)
  })
  it('is true inside a [data-native-scroll] box', () => {
    expect(preventSmoothScroll(inside('<div data-native-scroll><p id="target"></p></div>'))).toBe(true)
  })
  it('is false inside a closed dialog and in main', () => {
    expect(preventSmoothScroll(inside('<dialog><div id="target"></div></dialog>'))).toBe(false)
    expect(preventSmoothScroll(inside('<main><p id="target"></p></main>'))).toBe(false)
  })
})

describe('smooth-scroll.css', () => {
  // Lenis's stylesheet is part of the page's own CSS, not of the chunk: a dynamic import's CSS is linked by every page,
  // and these rules do nothing until Lenis puts its `lenis` class on <html>.
  it('is Lenis’s own stylesheet, so an upgrade that changes its rules fails here', () => {
    const collapse = (css: string) => css.replace(/\s+/g, ' ').trim()
    const ours = readFileSync(resolve(process.cwd(), 'src/shared/styles/smooth-scroll.css'), 'utf8')
    const theirs = readFileSync(resolve(process.cwd(), 'node_modules/lenis/dist/lenis.css'), 'utf8')
    expect(collapse(ours)).toBe(collapse(theirs))
  })
})

describe('movedByOthers', () => {
  it('is true only while gliding and only when the page is not where Lenis left it', () => {
    expect(movedByOthers(true, 300, 1200)).toBe(true)
    expect(movedByOthers(true, 1200, 300)).toBe(true)
    expect(movedByOthers(true, 300, 300 + DRIFT_TOLERANCE_PX)).toBe(false)
    expect(movedByOthers(true, 300, 300)).toBe(false)
  })
  it('is false when nothing is gliding, because Lenis follows a native scroll then', () => {
    expect(movedByOthers(false, 300, 1200)).toBe(false)
  })
})

describe('Lenis', () => {
  it('still has the private reset we use to let go of a glide without writing the scroll position', async () => {
    const { default: RealLenis } = await vi.importActual<typeof import('lenis')>('lenis')
    expect(typeof (RealLenis.prototype as unknown as { reset?: unknown }).reset).toBe('function')
  })
})

describe('createSmoothScroll', () => {
  const stopped = { immediate: true, force: true }

  it('lets go of a glide when something else moves the page, so a key or a link just after a wheel works', () => {
    document.body.innerHTML =
      '<a id="link" href="/docs#top">top</a><a id="plain" href="/docs">docs</a><input id="field" />'
    const smooth = createSmoothScroll()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    expect(lenisCalls.scrollTo).toHaveBeenLastCalledWith(window.scrollY, stopped)
    lenisCalls.scrollTo.mockClear()
    document.querySelector('#field')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    document.querySelector('#link')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.dispatchEvent(new Event('pointerdown'))
    expect(lenisCalls.scrollTo).toHaveBeenCalledTimes(3)
    lenisCalls.scrollTo.mockClear()
    document.querySelector('#plain')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(lenisCalls.scrollTo).not.toHaveBeenCalled()
    smooth.destroy()
  })

  describe('each frame', () => {
    const frames: FrameRequestCallback[] = []
    const run = (time: number) => {
      for (const frame of frames.splice(0)) frame(time)
    }
    const scrollTo = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    beforeEach(() => {
      frames.length = 0
      vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame))
      vi.stubGlobal('cancelAnimationFrame', () => frames.splice(0))
      scrollTo(0)
    })
    afterEach(() => scrollTo(0))

    it('drives Lenis, and leaves its own writes alone', () => {
      const smooth = createSmoothScroll()
      lenisCalls.glide.isScrolling = 'smooth'
      let written = 100
      lenisCalls.raf.mockImplementation(() => {
        written += 20 // each frame, Lenis writes the page
        scrollTo(written)
      })
      run(16)
      run(32)
      run(48)
      expect(lenisCalls.raf).toHaveBeenCalledTimes(3)
      expect(lenisCalls.reset).not.toHaveBeenCalled()
      smooth.destroy()
    })

    it('lets go of the glide, without writing, when the page moved since Lenis left it', () => {
      const smooth = createSmoothScroll()
      lenisCalls.glide.isScrolling = 'smooth'
      run(16)
      scrollTo(1200) // Find in page or a scrollTo, between two frames
      run(32)
      expect(lenisCalls.reset).toHaveBeenCalledTimes(1)
      expect(lenisCalls.scrollTo).not.toHaveBeenCalled()
      smooth.destroy()
    })

    it('does not let go when nothing is gliding', () => {
      const smooth = createSmoothScroll()
      run(16)
      scrollTo(1200)
      run(32)
      expect(lenisCalls.reset).not.toHaveBeenCalled()
      smooth.destroy()
    })
  })

  it('stops listening and destroys Lenis when it is destroyed', () => {
    const smooth = createSmoothScroll()
    smooth.destroy()
    expect(lenisCalls.destroy).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    expect(lenisCalls.scrollTo).not.toHaveBeenCalled()
  })
})
