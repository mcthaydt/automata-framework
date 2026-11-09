// Smooth wheel scrolling, for a mouse or trackpad only. Lenis eases the wheel's jumps into a glide; everything else

import Lenis from 'lenis'
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

/**
 * Whatever moves the page that is not the wheel: a key, a click on a #link, focus landing on something off screen, a
 * press on the scroll bar. Lenis ignores the browser's own scrolling until its glide has died away (about a second and a
 * half after a wheel), so without this the page would fight a key pressed just after a notch.
 */
const NATIVE_SCROLLERS = ['keydown', 'focusin', 'pointerdown', 'hashchange'] as const

export function createSmoothScroll(): SmoothScroll {
  const lenis = new Lenis({ ...LENIS_OPTIONS })
  // Lenis's own `reset` is private; scrolling to where we already are with `force` cancels the glide.
  const settle = () => lenis.scrollTo(window.scrollY, { immediate: true, force: true })
  const onClick = (event: MouseEvent) => {
    if ((event.target as Element | null)?.closest?.('a[href*="#"]')) settle()
  }
  for (const type of NATIVE_SCROLLERS) window.addEventListener(type, settle, { capture: true, passive: true })
  window.addEventListener('click', onClick, { capture: true, passive: true })
  return {
    settle,
    destroy() {
      for (const type of NATIVE_SCROLLERS) window.removeEventListener(type, settle, { capture: true })
      window.removeEventListener('click', onClick, { capture: true })
      lenis.destroy()
    },
  }
}
