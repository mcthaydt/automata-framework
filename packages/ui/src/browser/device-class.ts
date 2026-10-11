/**
 * Phone, tablet or desktop, from the primary pointer and the screen
 * (FloorFifty unlockables spec §3). Not `form-factor.ts`, which classifies the
 * viewport's shape: a resized laptop window must not count as a second device.
 *
 * Decided once at boot. Rotating or resizing never changes it.
 */
import { PHONE_PORTRAIT_MAX_WIDTH } from '../geometry/form-factor'

export type DeviceClass = 'phone' | 'tablet' | 'desktop'

export function classifyDevice(input: {
  coarse: boolean
  screenWidth: number
  screenHeight: number
}): DeviceClass {
  if (!input.coarse) return 'desktop'
  return Math.min(input.screenWidth, input.screenHeight) < PHONE_PORTRAIT_MAX_WIDTH ? 'phone' : 'tablet'
}

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
