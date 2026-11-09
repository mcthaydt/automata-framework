// The moves: a page settling in after a click, and Home's sections arriving. GSAP core only, loaded after the page is
// live and never for a visitor who asked for less motion. Everything runs in one context, so `finish()` can put every
// element back to exactly what the markup says, with no inline style left behind.
import { gsap } from 'gsap'
import { MOTION } from './motion-tokens.ts'
import type { RevealPart } from './reveal-steps.ts'

export interface Animate {
  /** The new page rises 6 px into place. There is no exit: the old page is already gone. */
  pageIn(target: HTMLElement): void
  /** Hold parts back (invisible, 8 px low) until `reveal`. */
  hide(parts: readonly RevealPart[]): void
  reveal(parts: readonly RevealPart[]): void
  /** Jump every running move to its end and clear what it set. */
  finish(): void
}

const CLEAR = 'opacity,transform'

export function createAnimate(): Animate {
  const context = gsap.context(() => {})
  // `data-motion` marks what a move has touched, so printing can show exactly that at full opacity.
  const marked = new Set<Element>()
  const mark = (element: Element) => {
    marked.add(element)
    element.setAttribute('data-motion', '')
  }
  const unmark = (element: Element) => {
    marked.delete(element)
    element.removeAttribute('data-motion')
  }

  return {
    pageIn(target) {
      mark(target)
      context.add(() => {
        gsap.fromTo(
          target,
          { opacity: 0, y: MOTION.settle },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.page,
            ease: MOTION.ease,
            clearProps: CLEAR,
            onComplete: () => unmark(target),
          },
        )
      })
    },
    hide(parts) {
      context.add(() => {
        for (const { element, product } of parts) {
          mark(element)
          gsap.set(element, { opacity: 0, y: MOTION.rise, scale: product ? MOTION.productScaleFrom : 1 })
        }
      })
    },
    reveal(parts) {
      context.add(() => {
        const timeline = gsap.timeline()
        parts.forEach(({ element }, index) => {
          timeline.to(
            element,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: MOTION.reveal,
              ease: MOTION.ease,
              clearProps: CLEAR,
              onComplete: () => unmark(element),
            },
            Math.min(index, MOTION.staggerCap - 1) * MOTION.stagger,
          )
        })
      })
    },
    finish() {
      for (const tween of context.getTweens()) tween.progress(1)
      context.revert()
      for (const element of [...marked]) unmark(element)
    },
  }
}
