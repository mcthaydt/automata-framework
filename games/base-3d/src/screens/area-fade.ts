// The area change's fade (DESIGN.md §13): a black cover over play that the sim's `area.exit` fades out to and its
// `area.entered` fades back from, 300 ms each way (`AREA_FADE_TICKS` at 60 Hz), at once under reduced motion. It
// never takes a pointer, so the touch overlay and the pause button stay usable through it.
import { Effect, type Scope } from 'effect'
import { AREA_FADE_TICKS, TICK_HZ } from '../constants.ts'

const FADE_MS = Math.round((AREA_FADE_TICKS * 1000) / TICK_HZ)

/** What play tells the cover: fade out (the exit) and back in (the swap). */
export interface AreaFade {
  out(): void
  in(): void
}

/** Adds the cover to `layer` for as long as the scope is open, faded in (clear). */
export function areaFade(layer: HTMLElement): Effect.Effect<AreaFade, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const cover = layer.ownerDocument.createElement('div')
      cover.dataset.testid = 'area-fade'
      cover.setAttribute('aria-hidden', 'true')
      const reduced = layer.ownerDocument.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      Object.assign(cover.style, {
        position: 'absolute',
        inset: '0',
        background: '#000',
        pointerEvents: 'none',
        opacity: '0',
        transition: reduced === true ? 'none' : `opacity ${FADE_MS}ms linear`,
      })
      const set = (state: 'in' | 'out'): void => {
        cover.dataset.state = state
        cover.style.opacity = state === 'out' ? '1' : '0'
      }
      set('in')
      layer.append(cover)
      return { cover, fade: { out: () => set('out'), in: () => set('in') } }
    }),
    ({ cover }) => Effect.sync(() => cover.remove()),
  ).pipe(Effect.map(({ fade }) => fade))
}
