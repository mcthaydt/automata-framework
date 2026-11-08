import { gsap } from 'gsap'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAnimate } from '#src/shared/motion/animate.ts'
import type { RevealPart } from '#src/shared/motion/reveal-steps.ts'

function parts(count: number, productFrom = count): RevealPart[] {
  document.body.innerHTML = Array.from({ length: count }, (_, i) => `<p id="p${i}">part ${i}</p>`).join('')
  return Array.from({ length: count }, (_, i) => ({
    element: document.querySelector(`#p${i}`) as Element,
    product: i >= productFrom,
  }))
}

beforeEach(() => {
  gsap.globalTimeline.clear()
})

describe('createAnimate', () => {
  it('hides parts 8 px low, and a product also a little small', () => {
    const list = parts(2, 1)
    createAnimate().hide(list)
    const [word, product] = list.map((part) => part.element as HTMLElement)
    expect(word?.style.opacity).toBe('0')
    expect(word?.style.transform).toMatch(/translate\(0px, 8px\)/)
    expect(word?.style.transform).not.toMatch(/scale\(0\.985/)
    expect(product?.style.transform).toMatch(/scale\(0\.985/)
    expect(word?.hasAttribute('data-motion')).toBe(true)
  })

  it('leaves no inline style once a reveal finishes', () => {
    const list = parts(3)
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    animate.finish()
    for (const { element } of list) {
      expect((element as HTMLElement).style.opacity).toBe('')
      expect((element as HTMLElement).style.transform).toBe('')
      expect(element.hasAttribute('data-motion')).toBe(false)
    }
  })

  it('settles a page in and leaves it clean', () => {
    document.body.innerHTML = '<main id="m">x</main>'
    const main = document.querySelector('#m') as HTMLElement
    const animate = createAnimate()
    animate.pageIn(main)
    expect(main.style.opacity).toBe('0')
    expect(main.style.transform).toMatch(/translate\(0px, 6px\)/)
    animate.finish()
    expect(main.getAttribute('style') ?? '').toBe('')
  })

  it('keeps working after finish()', () => {
    document.body.innerHTML = '<main id="m">x</main>'
    const main = document.querySelector('#m') as HTMLElement
    const animate = createAnimate()
    animate.pageIn(main)
    animate.finish()
    animate.pageIn(main)
    expect(main.style.opacity).toBe('0')
    expect(main.hasAttribute('data-motion')).toBe(true)
    animate.finish()
    expect(main.getAttribute('style') ?? '').toBe('')
    expect(main.hasAttribute('data-motion')).toBe(false)
  })

  it('staggers at most six parts: the eighth starts with the sixth', () => {
    const list = parts(8)
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    const start = (index: number) =>
      gsap
        .getTweensOf(list[index]?.element)
        .filter((tween) => tween.duration() > 0)[0]
        ?.startTime()
    expect(start(7)).toBe(start(5))
    expect(start(5)).toBeGreaterThan(start(1) as number)
    animate.finish()
  })
})
