import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnimate } from '#src/shared/motion/animate.ts'
import { MOTION } from '#src/shared/motion/motion-tokens.ts'
import type { RevealPart } from '#src/shared/motion/reveal-steps.ts'

// Motion itself is proved in a real browser (tests/e2e/motion.e2e.ts); here a stand-in records what is asked of it and
// lets a test finish a move by hand, so the contract (what moves, how far, how long, what is left behind) is held.
interface Call {
  element: HTMLElement
  keyframes: Record<string, unknown>
  options: { duration: number; ease: unknown; delay?: number }
  done(): void
  completed: boolean
}
const fake = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('motion/mini', () => ({
  animate: (element: HTMLElement, keyframes: Record<string, unknown>, options: Call['options']) => {
    let resolve = () => {}
    const finished = new Promise<void>((done) => {
      resolve = done
    })
    const call: Call = {
      element,
      keyframes,
      options,
      completed: false,
      done: () => {
        call.completed = true
        resolve()
      },
    }
    fake.calls.push(call)
    return { finished, complete: call.done, cancel: call.done }
  },
}))
const calls = () => fake.calls as Call[]

function parts(count: number, productFrom = count): RevealPart[] {
  document.body.innerHTML = Array.from({ length: count }, (_, i) => `<p id="p${i}">part ${i}</p>`).join('')
  return Array.from({ length: count }, (_, i) => ({
    element: document.querySelector(`#p${i}`) as Element,
    product: i >= productFrom,
  }))
}

beforeEach(() => {
  fake.calls.length = 0
})

describe('createAnimate', () => {
  it('hides parts 8 px low, and a product also a little small', () => {
    const list = parts(2, 1)
    createAnimate().hide(list)
    const [word, product] = list.map((part) => part.element as HTMLElement)
    expect(word?.style.opacity).toBe('0')
    expect(word?.style.transform).toBe('translateY(8px)')
    expect(product?.style.transform).toBe('translateY(8px) scale(0.985)')
    expect(word?.hasAttribute('data-motion')).toBe(true)
  })

  it('reveals a part from where it was held to the markup, over 0.48 s on the kit’s ease', () => {
    const list = parts(1, 0)
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    const [call] = calls()
    expect(call?.element).toBe(list[0]?.element)
    expect(call?.keyframes).toEqual({
      opacity: [0, 1],
      transform: ['translateY(8px) scale(0.985)', 'translateY(0px) scale(1)'],
    })
    expect(call?.options).toMatchObject({ duration: MOTION.reveal, ease: [...MOTION.ease], delay: 0 })
    animate.finish()
  })

  it('leaves no inline style and no mark once a reveal finishes', async () => {
    const list = parts(3)
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    for (const call of calls()) call.done()
    await Promise.resolve()
    await Promise.resolve()
    for (const { element } of list) {
      expect((element as HTMLElement).getAttribute('style') ?? '').toBe('')
      expect(element.hasAttribute('data-motion')).toBe(false)
    }
  })

  it('settles a page in 6 px, over 0.22 s, and leaves it clean', async () => {
    document.body.innerHTML = '<main id="m">x</main>'
    const main = document.querySelector('#m') as HTMLElement
    const animate = createAnimate()
    animate.pageIn(main)
    const [call] = calls()
    expect(call?.keyframes).toEqual({ opacity: [0, 1], transform: ['translateY(6px)', 'translateY(0px)'] })
    expect(call?.options).toMatchObject({ duration: MOTION.page, ease: [...MOTION.ease] })
    expect(main.hasAttribute('data-motion')).toBe(true)
    call?.done()
    await Promise.resolve()
    await Promise.resolve()
    expect(main.getAttribute('style') ?? '').toBe('')
    expect(main.hasAttribute('data-motion')).toBe(false)
  })

  it('finish() completes every running move and clears what they set', () => {
    const list = parts(2)
    document.body.insertAdjacentHTML('beforeend', '<main id="m">x</main>')
    const main = document.querySelector('#m') as HTMLElement
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    animate.pageIn(main)
    animate.finish()
    expect(calls().every((call) => call.completed)).toBe(true)
    for (const element of [...list.map((part) => part.element as HTMLElement), main]) {
      expect(element.getAttribute('style') ?? '').toBe('')
      expect(element.hasAttribute('data-motion')).toBe(false)
    }
  })

  it('keeps working after finish(), and an old move finishing late does not clear the new one', async () => {
    document.body.innerHTML = '<main id="m">x</main>'
    const main = document.querySelector('#m') as HTMLElement
    const animate = createAnimate()
    animate.pageIn(main)
    animate.finish()
    animate.pageIn(main)
    await Promise.resolve()
    await Promise.resolve()
    expect(main.hasAttribute('data-motion')).toBe(true)
    animate.finish()
    expect(main.hasAttribute('data-motion')).toBe(false)
  })

  it('staggers at most six parts: the eighth starts with the sixth', () => {
    const list = parts(8)
    const animate = createAnimate()
    animate.hide(list)
    animate.reveal(list)
    const delay = (index: number) => calls()[index]?.options.delay as number
    expect(delay(7)).toBe(delay(5))
    expect(delay(5)).toBeCloseTo(5 * MOTION.stagger)
    expect(delay(1)).toBeCloseTo(MOTION.stagger)
    expect(delay(0)).toBe(0)
    animate.finish()
  })
})
