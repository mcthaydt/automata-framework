// Full-cover DOM veil for screen transitions.
import type { Clock } from '../../shared/lib/clock.ts'

export const FADE_MS = 350
export const REDUCED_FADE_MS = 100

export interface Veil {
  /** Fades the veil in. Answers false when the page refused it, and the transition becomes a cut. */
  cover(): Promise<boolean>
  /** Fades the veil out and gives the pointer back. */
  reveal(): Promise<void>
  readonly element: HTMLElement
}

export interface VeilOptions {
  readonly overlay: HTMLElement
  readonly reducedMotion: () => boolean
  /** Times the fades. */
  readonly clock: Clock
}

/**
 * Creates the fade veil.
 * Covers with --af-surface over 350 ms (100 ms under reduced motion) and reveals over 350 ms (100 ms).
 * Takes pointer events while covering and releases when reveal finishes.
 * If DOM insertion/writes fail, cover answers false and the transition edge becomes a cut.
 * `dispose()` takes the element out of the page.
 */
export function createVeil(options: VeilOptions): Veil & { dispose(): void } {
  const doc = options.overlay.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined)
  const element = doc ? doc.createElement('div') : ({} as HTMLElement)
  if (element.style) {
    element.setAttribute('data-veil', '')
    element.style.position = 'absolute'
    element.style.inset = '0'
    element.style.background = 'var(--af-surface)'
    element.style.pointerEvents = 'none'
    element.style.opacity = '0'
    element.style.zIndex = '0'
  }

  try {
    options.overlay.insertBefore(element, options.overlay.firstChild)
  } catch {
    // An overlay that refuses the element now refuses it again in cover(), which then answers false.
  }

  const fade = (): Promise<void> =>
    new Promise((resolve) => {
      options.clock.setTimeout(resolve, options.reducedMotion() ? REDUCED_FADE_MS : FADE_MS)
    })

  return {
    element,
    async cover() {
      try {
        if (typeof options.overlay.contains === 'function' && !options.overlay.contains(element)) {
          options.overlay.insertBefore(element, options.overlay.firstChild)
        }
        element.style.pointerEvents = 'auto'
        element.style.opacity = '1'
      } catch {
        return false
      }
      await fade()
      return true
    },
    async reveal() {
      if (element.style) element.style.opacity = '0'
      await fade()
      if (element.style) element.style.pointerEvents = 'none'
    },
    dispose() {
      try {
        if (typeof element.remove === 'function') element.remove()
        else element.parentElement?.removeChild(element)
      } catch {
        // Nothing is left to undo on a page that refuses the removal.
      }
    },
  }
}
