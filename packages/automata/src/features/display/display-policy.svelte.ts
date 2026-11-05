// The display policy: two covers the runtime keeps over every screen for the session.
//
// - The landscape gate (FloorFifty `LandscapeGate.svelte` at `ac72660`, classified by ui's `landscapeGate`):
//   standalone only. Under Ruken the host frames the game and fullscreen is the host's, so the gate never shows. Its
//   one button asks the page's own browser for fullscreen (`enterFullscreen`); a refusal leaves the gate as it was
//   and the game plays in the window.
// - The rotate hint: a game locked to one orientation (`GameDefinition.orientation`), on a phone held the other way,
//   pauses under `display` while the hint shows, hosted or not. A game that plays either way never sees it. With
//   `rotateHint: 'toast'` (Owner amendment, 2026-10-18) it is FloorFifty's toast instead: advice, no pause.
//
// "A phone" is a coarse pointer in a phone form factor: a short desktop window is classed `phone-landscape` too, and
// has no bar to hide and nothing to turn.

import { Effect, type Scope } from 'effect'
import { mount, unmount } from 'svelte'
import type { Time } from '../../shared/runtime/time/time.manager.js'
import {
  enterFullscreen,
  fullscreenSupport,
  isFullscreen,
  onFullscreenChange,
} from '../../shared/ui/browser/fullscreen.ts'
import { type LandscapeGateState, landscapeGate } from '../../shared/ui/browser/landscape-gate.ts'
import type {
  LandscapeGateCopy,
  RotateHintCopy,
  RotateToastCopy,
} from '../../shared/ui/display/display-copy.ts'
import LandscapeGate from '../../shared/ui/display/LandscapeGate.svelte'
import RotateHint from '../../shared/ui/display/RotateHint.svelte'
import RotateToast from '../../shared/ui/display/RotateToast.svelte'
import type { FormFactor } from '../../shared/ui/geometry/form-factor.ts'
import type { GeometryOwner } from '../../shared/ui/geometry/geometry-owner.svelte.ts'

/** The orientation a game plays in; the ship config writes the same value as `runtime.orientation`. */
export type GameOrientation = 'portrait' | 'landscape' | 'any'

/**
 * The words of the display policy: the landscape gate, the rotate hint for each orientation and the rotate
 * toast.
 */
export interface DisplayCopy {
  readonly gate: LandscapeGateCopy
  readonly rotate: Readonly<Record<'portrait' | 'landscape', RotateHintCopy>>
  readonly toast: RotateToastCopy
}

/** How a game locked to one orientation says so (Owner amendment, 2026-10-18): a blocking cover, or a toast. */
export type RotateHintMode = 'block' | 'toast'

/** English, as the runtime's other words are, until they are localized. */
export const DISPLAY_COPY_EN: DisplayCopy = {
  gate: {
    title: 'Play fullscreen',
    body: 'Sideways, the browser’s bar takes too much of the screen. One tap hides it.',
    go: 'Go fullscreen',
    uprightTitle: 'Turn your phone upright',
    uprightBody: 'Or add the game to your Home Screen to play it sideways.',
  },
  rotate: {
    portrait: { title: 'Turn your phone upright', body: 'This game plays in portrait.' },
    landscape: { title: 'Turn your phone sideways', body: 'This game plays in landscape.' },
  },
  toast: { text: 'Turn your phone for a bigger view', ok: 'OK', dismiss: 'Dismiss the tip' },
}

export interface DisplayPolicyOptions {
  readonly orientation: GameOrientation
  /** Under a host (Ruken): the gate stays off. */
  readonly hosted: boolean
  readonly win: Window
  readonly geometry: GeometryOwner
  /** The page's overlay layer, over every screen. */
  readonly layer: HTMLElement
  readonly time: Time
  readonly copy?: DisplayCopy | undefined
  /** `'block'` (the default) pauses under a cover; `'toast'` says so at the top and lets the game run. */
  readonly rotateHint?: RotateHintMode | undefined
}

/** Whether a phone held in `formFactor` is the wrong way for a game that plays in `orientation`. */
const heldWrong = (orientation: GameOrientation, formFactor: FormFactor): boolean =>
  (orientation === 'portrait' && formFactor === 'phone-landscape') ||
  (orientation === 'landscape' && formFactor === 'phone-portrait')

/** Keeps both covers over the layer for the scope's life: closing it unmounts them and stops every listener. */
export function displayPolicy(options: DisplayPolicyOptions): Effect.Effect<void, never, Scope.Scope> {
  return Effect.gen(function* () {
    const { orientation, hosted, win, geometry, layer, time } = options
    const copy = options.copy ?? DISPLAY_COPY_EN
    const doc = win.document
    // A window without `matchMedia` (a test's, a replay's) is a fine pointer, not installed.
    const query = (
      media: string,
    ): Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> =>
      win.matchMedia?.(media) ?? { matches: false, addEventListener: () => {}, removeEventListener: () => {} }
    const coarse = query('(pointer: coarse)')
    const installed = query('(display-mode: standalone), (display-mode: fullscreen)')

    const gateProps: { state: LandscapeGateState; copy: LandscapeGateCopy; onfullscreen: () => void } =
      $state({
        state: 'none',
        copy: copy.gate,
        onfullscreen: () => void enterFullscreen(doc, win.screen).then(update),
      })
    const hintProps: { shown: boolean; copy: RotateHintCopy } = $state({
      shown: false,
      copy: copy.rotate[orientation === 'portrait' ? 'portrait' : 'landscape'],
    })
    const toastProps: { shown: boolean; copy: RotateToastCopy; ondismiss: () => void } = $state({
      shown: false,
      copy: copy.toast,
      ondismiss: () => {
        dismissed = true
        update()
      },
    })
    const blocking = (options.rotateHint ?? 'block') === 'block'
    // A toast dismissed stays dismissed for the session; saving it would need device storage outside `Hosting`.
    let dismissed = false
    let pausing = false

    function update(): void {
      const formFactor = geometry.geometry.current.formFactor
      gateProps.state = hosted
        ? 'none'
        : landscapeGate({
            formFactor,
            coarse: coarse.matches,
            support: fullscreenSupport(doc, win.navigator),
            fullscreen: isFullscreen(doc),
            installed: installed.matches,
          })
      const wrong = coarse.matches && heldWrong(orientation, formFactor)
      toastProps.shown = !blocking && wrong && !dismissed
      const block = blocking && wrong
      hintProps.shown = block
      if (block && !pausing) time.pause('display')
      if (!block && pausing) time.resume('display')
      pausing = block
    }
    update()

    const stops = [
      geometry.onChange(update),
      onFullscreenChange(doc, update),
      (() => {
        coarse.addEventListener('change', update)
        installed.addEventListener('change', update)
        return () => {
          coarse.removeEventListener('change', update)
          installed.removeEventListener('change', update)
        }
      })(),
    ]
    const covers = [
      mount(RotateHint, { target: layer, props: hintProps }),
      mount(RotateToast, { target: layer, props: toastProps }),
      mount(LandscapeGate, { target: layer, props: gateProps }),
    ]
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        for (const stop of stops) stop()
        if (pausing) time.resume('display')
        pausing = false
        for (const cover of covers) yield* Effect.promise(() => unmount(cover))
      }),
    )
  })
}
