import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MOTION } from '#src/shared/motion/motion-tokens.ts'
import { LENIS_OPTIONS, preventSmoothScroll } from '#src/shared/motion/smooth-scroll.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Lenis options', () => {
  it('are the plan’s: wheel only, the browser keeps anchors and touch', () => {
    expect(LENIS_OPTIONS).toMatchObject({
      autoRaf: true,
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
  it('is Lenis’s own stylesheet, so an upgrade that changes its rules fails here', () => {
    const collapse = (css: string) => css.replace(/\s+/g, ' ').trim()
    const ours = readFileSync(resolve(process.cwd(), 'src/shared/motion/smooth-scroll.css'), 'utf8')
    const theirs = readFileSync(resolve(process.cwd(), 'node_modules/lenis/dist/lenis.css'), 'utf8')
    expect(collapse(ours)).toBe(collapse(theirs))
  })
})
