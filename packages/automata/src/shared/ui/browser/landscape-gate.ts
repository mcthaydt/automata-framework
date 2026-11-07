/**
 * A phone held sideways plays fullscreen or not at all.
 *
 * In landscape a phone's browser bar takes a third of a 390 px screen and
 * slides in and out as the page is touched, resizing the game under the
 * player's thumbs. Where the browser can hide it (element fullscreen), the
 * game asks for one tap to do so; where it cannot (Safari on iPhone), the
 * player turns the phone upright or opens the game from the Home Screen.
 *
 * The request itself and the gate's screen belong to the runtime.
 *
 * Only a phone: a touch screen in the phone-landscape form factor. A short
 * desktop window shares that form factor and has no bar to hide.
 */

import type { FullscreenRes } from '../../host/display.schema.ts'
import type { FormFactor } from '../geometry/form-factor'

/** The host's answer to whether this browser can go fullscreen, and how. */
export type FullscreenSupport = FullscreenRes['support']

/** Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen. */
export type LandscapeGateState = 'none' | 'fullscreen' | 'rotate-or-install'

/**
 * What `landscapeGate` decides from: the form factor, whether the pointer is coarse, the browser's fullscreen
 * support and state, and whether the page is installed as an app.
 */
export type GateInputs = {
  formFactor: FormFactor
  /** `(pointer: coarse)`: the primary pointer is a finger. */
  coarse: boolean
  support: FullscreenSupport
  fullscreen: boolean
  /** Installed and opened as an app (`display-mode` standalone or fullscreen): no browser bar. */
  installed: boolean
}

/**
 * What a phone held sideways must do: `none`, `fullscreen` (one tap to go fullscreen) or `rotate-or-install`
 * (turn upright or add to the Home Screen). Only a coarse-pointer phone in landscape that is not installed is
 * ever gated.
 */
export function landscapeGate(inputs: GateInputs): LandscapeGateState {
  if (inputs.formFactor !== 'phone-landscape' || !inputs.coarse || inputs.installed) return 'none'
  if (inputs.support === 'element') return inputs.fullscreen ? 'none' : 'fullscreen'
  if (inputs.support === 'ios-home-screen') return 'rotate-or-install'
  return 'none'
}
