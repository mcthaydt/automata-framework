import { describe, expect, it } from 'vitest'
import { CAMERA_SETTINGS_DEFAULT, CAMERA_TURN_SPEED, cameraSettingsSchema } from './camera-settings.schema.js'

// "Camera turn speed" and "Invert camera" (M4 spec §16.3.6, M3 spec §4.2): 0.25° a pixel by default, as a settings
// field that falls back like every other.
describe('camera settings', () => {
  it('defaults to 0.25° a pixel, not inverted', () => {
    expect(CAMERA_SETTINGS_DEFAULT).toEqual({ degPerPixel: 0.25, invert: false })
    expect(CAMERA_TURN_SPEED).toEqual({ min: 0.05, max: 1, step: 0.05, default: 0.25 })
    expect(cameraSettingsSchema.parse({})).toEqual(CAMERA_SETTINGS_DEFAULT)
    expect(cameraSettingsSchema.parse(undefined)).toEqual(CAMERA_SETTINGS_DEFAULT)
  })

  it('keeps a saved speed and invert', () => {
    expect(cameraSettingsSchema.parse({ degPerPixel: 0.5, invert: true })).toEqual({
      degPerPixel: 0.5,
      invert: true,
    })
    expect(cameraSettingsSchema.parse({ degPerPixel: 0.05 })).toEqual({ degPerPixel: 0.05, invert: false })
    expect(cameraSettingsSchema.parse({ degPerPixel: 1 })).toEqual({ degPerPixel: 1, invert: false })
  })

  it('reads a bad or out-of-range field as its default, keeping the other (A-l)', () => {
    expect(cameraSettingsSchema.parse({ degPerPixel: 5, invert: true })).toEqual({
      degPerPixel: 0.25,
      invert: true,
    })
    expect(cameraSettingsSchema.parse({ degPerPixel: 0.01 })).toEqual(CAMERA_SETTINGS_DEFAULT)
    expect(cameraSettingsSchema.parse({ degPerPixel: 'x' })).toEqual(CAMERA_SETTINGS_DEFAULT)
    expect(cameraSettingsSchema.parse({ degPerPixel: Number.NaN })).toEqual(CAMERA_SETTINGS_DEFAULT)
    expect(cameraSettingsSchema.parse({ degPerPixel: 0.5, invert: 'yes' })).toEqual({
      degPerPixel: 0.5,
      invert: false,
    })
    expect(cameraSettingsSchema.parse(null)).toEqual(CAMERA_SETTINGS_DEFAULT)
    expect(cameraSettingsSchema.parse('fast')).toEqual(CAMERA_SETTINGS_DEFAULT)
  })
})
