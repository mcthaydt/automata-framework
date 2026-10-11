import { describe, expect, it } from 'vitest'
import { bootDeviceClass, classifyDevice } from './device-class'

describe('device class', () => {
  it('a coarse pointer on a short side under 600 is a phone, either way up', () => {
    expect(classifyDevice({ coarse: true, screenWidth: 390, screenHeight: 844 })).toBe('phone')
    expect(classifyDevice({ coarse: true, screenWidth: 844, screenHeight: 390 })).toBe('phone')
  })
  it('a coarse pointer on a larger screen is a tablet, rotated or not', () => {
    expect(classifyDevice({ coarse: true, screenWidth: 820, screenHeight: 1180 })).toBe('tablet')
    expect(classifyDevice({ coarse: true, screenWidth: 1180, screenHeight: 820 })).toBe('tablet')
  })
  it('a fine pointer is a desktop: a touch laptop, and a narrow desktop window', () => {
    expect(classifyDevice({ coarse: false, screenWidth: 1366, screenHeight: 768 })).toBe('desktop')
    expect(classifyDevice({ coarse: false, screenWidth: 390, screenHeight: 844 })).toBe('desktop')
  })
  it('reads the window once, from the screen and not the viewport', () => {
    const win = {
      matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' }),
      screen: { width: 412, height: 915 },
      innerWidth: 1400,
      innerHeight: 900,
    } as unknown as Window
    expect(bootDeviceClass(win)).toBe('phone')
  })
  it('is a desktop when the window cannot be read', () => {
    expect(bootDeviceClass({} as Window)).toBe('desktop')
  })
})
