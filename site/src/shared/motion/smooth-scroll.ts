// Smooth wheel scrolling, for a mouse or trackpad only. Lenis eases the wheel's jumps into a glide; everything else
// (keys, links, Find in page, a script's scrollTo) moves the page natively and is left alone, or hands the page back.

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
  // The frame is ours (see `createSmoothScroll`).
  autoRaf: false,
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

/** How far the page may drift between two frames of a glide before it is not Lenis moving it: rounding, no more. */
export const DRIFT_TOLERANCE_PX = 0.5

/**
 * True when something other than the glide moved the page since Lenis last wrote it: Find in page, a script's
 * `scrollTo`, scroll anchoring. `leftAt` is where the page sat right after Lenis's last write.
 */
export function movedByOthers(isGliding: boolean, leftAt: number, scrollY: number): boolean {
  return isGliding && Math.abs(scrollY - leftAt) > DRIFT_TOLERANCE_PX
}

export function createSmoothScroll(): SmoothScroll {
  // We run Lenis's frame ourselves (`autoRaf` is off) to look at the page just before each write.
  const lenis = new Lenis({ ...LENIS_OPTIONS })
  // Lenis's own `reset` is private. It ends the glide without writing the scroll position, which the browser's own
  // animated scroll (Find in page) needs: any write cancels it.
  const release = () => (lenis as unknown as { reset(): void }).reset()
  // Scrolling to where we already are with `force` also ends the glide, but writes; it suits a key or a click, which
  // have not scrolled anything yet.
  const settle = () => lenis.scrollTo(window.scrollY, { immediate: true, force: true })
  const onClick = (event: MouseEvent) => {
    if ((event.target as Element | null)?.closest?.('a[href*="#"]')) settle()
  }
  for (const type of NATIVE_SCROLLERS) window.addEventListener(type, settle, { capture: true, passive: true })
  window.addEventListener('click', onClick, { capture: true, passive: true })
  // Lenis ignores native scrolling while it glides and then finishes the glide over the top of it, so a jump made in
  // that time was undone. If the page is not where Lenis left it, the jump wins and the glide lets go.
  let leftAt = window.scrollY
  let frame = 0
  const tick = (time: number) => {
    if (movedByOthers(lenis.isScrolling === 'smooth', leftAt, window.scrollY)) release()
    lenis.raf(time)
    leftAt = window.scrollY
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return {
    settle,
    destroy() {
      cancelAnimationFrame(frame)
      for (const type of NATIVE_SCROLLERS) window.removeEventListener(type, settle, { capture: true })
      window.removeEventListener('click', onClick, { capture: true })
      lenis.destroy()
    },
  }
}
