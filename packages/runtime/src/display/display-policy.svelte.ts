// The display policy (M4 spec §4.9, §5, §6, M4-D5): two covers the runtime keeps over every screen for the session.
//
// - The landscape gate (FloorFifty `LandscapeGate.svelte` at `ac72660`, classified by ui's `landscapeGate`):
//   standalone only. Under Ruken the host frames the game and fullscreen is the host's, so the gate never shows. Its
//   one button asks the page's own browser for fullscreen (`enterFullscreen`); a refusal leaves the gate as it was
//   and the game plays in the window.
// - The rotate hint: a game locked to one orientation (`GameDefinition.orientation`), on a phone held the other way,
//   pauses under `display` while the hint shows, hosted or not. A game that plays either way never sees it.
//
// "A phone" is a coarse pointer in a phone form factor: a short desktop window is classed `phone-landscape` too, and
// has no bar to hide and nothing to turn.

import {
  enterFullscreen,
  type FormFactor,
  fullscreenSupport,
  type GeometryOwner,
  isFullscreen,
  LandscapeGate,
  type LandscapeGateCopy,
  type LandscapeGateState,
  landscapeGate,
  onFullscreenChange,
  RotateHint,
  type RotateHintCopy,
} from '@mcthaydt/automata-ui'
import { Effect, type Scope } from 'effect'
import { mount, unmount } from 'svelte'
import type { Time } from '../time/time.manager.js'

/** The orientation a game plays in; the ship config writes the same value as `runtime.orientation`. */
export type GameOrientation = 'portrait' | 'landscape' | 'any'

export interface DisplayCopy {
  readonly gate: LandscapeGateCopy
  readonly rotate: Readonly<Record<'portrait' | 'landscape', RotateHintCopy>>
}

/** English, as the runtime's other words are, until PRODUCT.L localizes them. */
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
      hintProps.shown = wrong
      if (wrong && !pausing) time.pause('display')
      if (!wrong && pausing) time.resume('display')
      pausing = wrong
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
