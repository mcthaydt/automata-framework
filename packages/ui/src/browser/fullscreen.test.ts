import { describe, expect, it, vi } from 'vitest'
import { enterFullscreen, fullscreenSupport, isFullscreen, onFullscreenChange } from './fullscreen'

// Standalone fullscreen (M4 spec §4.9, M4-D5), from FloorFifty apps/client/src/ui/fullscreen.ts at ac72660 without
// its hosted branch: under Ruken the landscape gate is off and fullscreen is the host's, so this is only ever the
// standalone page asking its own browser.

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari'
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'

function fakeDocument(options: { enabled?: boolean; request?: () => Promise<void> } = {}) {
  const listeners = new Set<() => void>()
  const doc = {
    fullscreenEnabled: options.enabled ?? true,
    fullscreenElement: null as Element | null,
    documentElement: { requestFullscreen: options.request ?? vi.fn(async () => undefined) },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  const fire = () => {
    for (const listener of listeners) listener()
  }
  return { doc: doc as unknown as Document, raw: doc, fire, listeners }
}
const nav = (userAgent: string, extra: object = {}) =>
  ({ userAgent, maxTouchPoints: 5, ...extra }) as unknown as Navigator

describe('fullscreenSupport', () => {
  it('is element fullscreen where the browser has it', () => {
    expect(fullscreenSupport(fakeDocument().doc, nav(PIXEL))).toBe('element')
  })

  it('is the Home Screen on iOS, and none once opened from it', () => {
    expect(fullscreenSupport(fakeDocument().doc, nav(IPHONE))).toBe('ios-home-screen')
    expect(fullscreenSupport(fakeDocument().doc, nav(IPHONE, { standalone: true }))).toBe('none')
  })

  it('is none without the API', () => {
    expect(fullscreenSupport(fakeDocument({ enabled: false }).doc, nav(PIXEL))).toBe('none')
  })
})

describe('isFullscreen and onFullscreenChange', () => {
  it('follow the document', () => {
    const { doc, raw, fire, listeners } = fakeDocument()
    expect(isFullscreen(doc)).toBe(false)
    const heard = vi.fn()
    const stop = onFullscreenChange(doc, heard)
    raw.fullscreenElement = {} as Element
    fire()
    expect(isFullscreen(doc)).toBe(true)
    expect(heard).toHaveBeenCalledOnce()
    stop()
    expect(listeners.size).toBe(0)
  })
})

describe('enterFullscreen', () => {
  it('requests fullscreen and a landscape lock', async () => {
    const { doc, raw } = fakeDocument()
    const lock = vi.fn(async () => undefined)
    await enterFullscreen(doc, { orientation: { lock } } as unknown as Screen)
    expect(raw.documentElement.requestFullscreen).toHaveBeenCalledOnce()
    expect(lock).toHaveBeenCalledWith('landscape')
  })

  it('changes nothing when the browser refuses either', async () => {
    const { doc } = fakeDocument({ request: async () => Promise.reject(new Error('no gesture')) })
    const lock = vi.fn(async () => Promise.reject(new Error('not installed')))
    await expect(
      enterFullscreen(doc, { orientation: { lock } } as unknown as Screen),
    ).resolves.toBeUndefined()
  })
})
