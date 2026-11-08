// Smooth wheel scrolling, for a mouse or trackpad only. Lenis eases the wheel's jumps into a glide; everything else
// stays the browser's: touch, the keyboard, Find in page, #anchors (CSS `scroll-behavior`) and the scrollbar.
import Lenis from 'lenis'
import './smooth-scroll.css'
import { MOTION } from './motion-tokens.ts'

/**
 * Boxes that scroll themselves keep the wheel: an open dialog (the search results) and anything marked
 * `data-native-scroll`. Lenis's `allowNestedScroll` covers the ordinary overflow boxes (the docs sidebar, code blocks).
 */
export function preventSmoothScroll(node: HTMLElement): boolean {
  return node.closest('dialog[open], [data-native-scroll]') !== null
}

export const LENIS_OPTIONS = {
  autoRaf: true,
  lerp: MOTION.lerp,
  smoothWheel: true,
  // A touch screen's own momentum is better than any we could add.
  syncTouch: false,
  // Anchors stay CSS: `:target { scroll-margin-top }` already puts the heading under the header.
  anchors: false,
  allowNestedScroll: true,
  // Leaving a page must not carry the old glide into the new one.
  stopInertiaOnNavigate: true,
  prevent: preventSmoothScroll,
} as const

export interface SmoothScroll {
  /** Stop a glide where it is, so a page change starts from rest. */
  settle(): void
  destroy(): void
}

export function createSmoothScroll(): SmoothScroll {
  const lenis = new Lenis({ ...LENIS_OPTIONS })
  return {
    // Lenis's own `reset` is private; scrolling to where we already are with `force` cancels the glide.
    settle: () => lenis.scrollTo(window.scrollY, { immediate: true, force: true }),
    destroy: () => lenis.destroy(),
  }
}
