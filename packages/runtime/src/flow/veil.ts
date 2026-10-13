// FloorFifty managers/veil.ts createDomVeil: full-cover DOM veil for screen transitions (spec §3.6)
import { Duration, Effect, type Scope } from 'effect'

export const FADE_MS = 350
export const REDUCED_FADE_MS = 100

export interface Veil {
  cover(): Effect.Effect<boolean>
  reveal(): Effect.Effect<void>
  readonly element: HTMLElement
}

export interface MakeVeilOptions {
  readonly overlay: HTMLElement
  readonly reducedMotion: () => boolean
}

/**
 * Creates the fade veil (FloorFifty veil.ts createDomVeil; spec §3.6).
 * Covers with --af-surface over 350 ms (100 ms under reduced motion) and reveals over 350 ms (100 ms).
 * Takes pointer events while covering and releases when reveal finishes.
 * If DOM insertion/writes fail, cover returns false and the transition edge becomes a cut.
 */
export function makeVeil(options: MakeVeilOptions): Effect.Effect<Veil, never, Scope.Scope> {
  return Effect.gen(function* () {
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
      // Insertion might fail if overlay throws; cover() handles this via Effect.try
    }

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        try {
          if (typeof element.remove === 'function') {
            element.remove()
          } else if (element.parentElement) {
            element.parentElement.removeChild(element)
          }
        } catch {
          // ignore cleanup failures
        }
      }),
    )

    const veil: Veil = {
      element,
      cover(): Effect.Effect<boolean> {
        return Effect.gen(function* () {
          const ok = yield* Effect.try({
            try: () => {
              if (typeof options.overlay.contains === 'function' && !options.overlay.contains(element)) {
                options.overlay.insertBefore(element, options.overlay.firstChild)
              }
              element.style.pointerEvents = 'auto'
              element.style.opacity = '1'
            },
            catch: () => false,
          }).pipe(
            Effect.map(() => true),
            Effect.orElseSucceed(() => false),
          )

          if (!ok) {
            return false
          }

          const duration = options.reducedMotion() ? REDUCED_FADE_MS : FADE_MS
          yield* Effect.sleep(Duration.millis(duration))
          return true
        })
      },
      reveal(): Effect.Effect<void> {
        return Effect.gen(function* () {
          yield* Effect.try({
            try: () => {
              if (element.style) {
                element.style.opacity = '0'
              }
            },
            catch: () => {},
          }).pipe(Effect.orElseSucceed(() => {}))

          const duration = options.reducedMotion() ? REDUCED_FADE_MS : FADE_MS
          yield* Effect.sleep(Duration.millis(duration))

          yield* Effect.try({
            try: () => {
              if (element.style) {
                element.style.pointerEvents = 'none'
              }
            },
            catch: () => {},
          }).pipe(Effect.orElseSucceed(() => {}))
        })
      },
    }

    return veil
  })
}
