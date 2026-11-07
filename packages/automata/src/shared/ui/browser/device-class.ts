/**
 * Phone, tablet or desktop, from the primary pointer and the screen.
 * Not `form-factor.ts`, which classifies the
 * viewport's shape: a resized laptop window must not count as a second device.
 *
 * Decided once at boot. Rotating or resizing never changes it.
 */
import { PHONE_PORTRAIT_MAX_WIDTH } from '../geometry/form-factor'

/** The kind of device the player holds: `phone`, `tablet` or `desktop`, decided once at boot. */
export type DeviceClass = 'phone' | 'tablet' | 'desktop'

/**
 * A fine primary pointer is a `desktop`; a coarse one is a `phone` when the screen's shorter side is under
 * 600 px, otherwise a `tablet`.
 */
export function classifyDevice(input: {
  coarse: boolean
  screenWidth: number
  screenHeight: number
}): DeviceClass {
  if (!input.coarse) return 'desktop'
  return Math.min(input.screenWidth, input.screenHeight) < PHONE_PORTRAIT_MAX_WIDTH ? 'phone' : 'tablet'
}

/**
 * The device class at boot, read from the window's pointer and screen; `desktop` when the window cannot
 * answer.
 */
export function bootDeviceClass(win: Window = window): DeviceClass {
  try {
    return classifyDevice({
      coarse: win.matchMedia('(pointer: coarse)').matches,
      screenWidth: win.screen.width,
      screenHeight: win.screen.height,
    })
  } catch {
    return 'desktop'
  }
}
