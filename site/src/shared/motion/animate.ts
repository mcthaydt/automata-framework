// The moves: a page settling in after a click, and Home's sections arriving. Motion's mini `animate` (the browser's own
// Web Animations underneath), loaded after the page is live and never for a visitor who asked for less motion. Every
// move is tracked, so `finish()` can put each element back to exactly what the markup says, with no inline style left.
import { animate as move } from 'motion/mini'
import { MOTION } from './motion-tokens.ts'
import type { RevealPart } from './reveal-steps.ts'

export interface Animate {
  /** The new page rises 6 px into place. There is no exit: the old page is already gone. */
  pageIn(target: HTMLElement): void
  /** Hold parts back (invisible, 8 px low) until `reveal`. */
  hide(parts: readonly RevealPart[]): void
  reveal(parts: readonly RevealPart[]): void
  /** Stop every running move and put each element back to the markup, which is where its move would have ended. */
  finish(): void
}

interface Running {
  cancel(): void
  finished: Promise<unknown>
}

// A move's two ends name the same transform functions, so the browser interpolates each one and not a matrix.
const held = (travel: number, scale: number) =>
  `translateY(${travel}px)${scale === 1 ? '' : ` scale(${scale})`}`
const rest = (scale: number) => `translateY(0px)${scale === 1 ? '' : ' scale(1)'}`

export function createAnimate(): Animate {
  // `data-motion` marks what a move has touched, so printing can show exactly that at full opacity.
  const marked = new Set<HTMLElement>()
  const running = new Map<HTMLElement, Running>()
  const clear = (element: HTMLElement) => {
    element.style.removeProperty('opacity')
    element.style.removeProperty('transform')
    element.removeAttribute('data-motion')
    marked.delete(element)
    running.delete(element)
  }
  const mark = (element: HTMLElement) => {
    marked.add(element)
    element.setAttribute('data-motion', '')
  }
  /** Start a move; when it ends, the element goes back to the markup, unless a newer move has taken it over. */
  const start = (
    element: HTMLElement,
    keyframes: { opacity: [number, number]; transform: [string, string] },
    duration: number,
    delay: number,
  ) => {
    const current = move(element, keyframes, { duration, ease: [...MOTION.ease], delay })
    running.set(element, current)
    current.finished.then(() => {
      if (running.get(element) === current) clear(element)
    })
  }

  return {
    pageIn(target) {
      mark(target)
      start(target, { opacity: [0, 1], transform: [held(MOTION.settle, 1), rest(1)] }, MOTION.page, 0)
    },
    hide(parts) {
      for (const { element, product } of parts) {
        const target = element as HTMLElement
        mark(target)
        target.style.opacity = '0'
        target.style.transform = held(MOTION.rise, product ? MOTION.productScaleFrom : 1)
      }
    },
    reveal(parts) {
      parts.forEach(({ element, product }, index) => {
        const scale = product ? MOTION.productScaleFrom : 1
        start(
          element as HTMLElement,
          { opacity: [0, 1], transform: [held(MOTION.rise, scale), rest(scale)] },
          MOTION.reveal,
          Math.min(index, MOTION.staggerCap - 1) * MOTION.stagger,
        )
      })
    },
    finish() {
      // Cancel, not complete: Motion writes a completed move's last frame as inline style when the browser reports it
      // finished, a frame after this has cleared the element. A cancelled move writes nothing.
      for (const current of [...running.values()]) current.cancel()
      for (const element of [...marked]) clear(element)
    },
  }
}
