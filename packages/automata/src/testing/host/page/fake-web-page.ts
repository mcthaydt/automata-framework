// A page for the web adapter's Node tests: real `EventTarget`s for the window, the
// document and the visual viewport, and a Map-backed `localStorage` that can be blocked or filled. Internal to the
// host package's tests; not exported from `./testing`.
import type { StorageLike, WebPage } from '../../../features/targets/web/hosting-web'

export interface FakeWebPageOptions {
  /** 'blocked' makes reading `localStorage` throw a SecurityError, as a frame denied storage does. */
  readonly storage?: 'available' | 'blocked'
  /** Bytes the origin may store (keys plus values, one byte per UTF-16 unit); a write past it throws QuotaExceededError. */
  readonly quotaBytes?: number
  /** Whether the browser allows element fullscreen (`document.fullscreenEnabled`). */
  readonly fullscreenEnabled?: boolean
  /** What the browser does with `requestFullscreen()`: enter, or refuse (no user gesture). */
  readonly fullscreenRequest?: 'enter' | 'refuse'
  readonly language?: string
  /** `(pointer: coarse)`, as a phone reports it. */
  readonly coarsePointer?: boolean
  readonly width?: number
  readonly height?: number
}

export interface FakeWebPage {
  readonly page: WebPage
  /** Everything in the origin's storage, including other games' keys. */
  readonly stored: Map<string, string>
  /** Every key the page wrote, in order (including the storage probe's). */
  readonly writes: string[]
  setVisibility(state: DocumentVisibilityState): void
  setFocus(focused: boolean): void
  resize(width: number, height: number): void
  /** Dispatches `type` on the window, with extra fields copied onto the event (for example `pointerType`). */
  dispatch(type: string, fields?: Record<string, unknown>): void
}

export function fakeWebPage(options: FakeWebPageOptions = {}): FakeWebPage {
  const win = new EventTarget()
  const doc = new EventTarget()
  const viewport = new EventTarget()
  const stored = new Map<string, string>()
  const writes: string[] = []
  let visibility: DocumentVisibilityState = 'visible'
  let focused = true
  let width = options.width ?? 1280
  let height = options.height ?? 720
  let fullscreenElement: object | null = null
  const root = {
    requestFullscreen: async () => {
      if (options.fullscreenRequest === 'refuse') throw new TypeError('Permissions check failed')
      fullscreenElement = root
      doc.dispatchEvent(new Event('fullscreenchange'))
    },
  }

  const usedBytes = () => [...stored].reduce((total, [key, value]) => total + key.length + value.length, 0)
  const storage: StorageLike = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => {
      const next = usedBytes() - (stored.get(key)?.length ?? 0) + key.length + value.length
      if (options.quotaBytes !== undefined && next > options.quotaBytes) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
      writes.push(key)
      stored.set(key, value)
    },
    removeItem: (key) => void stored.delete(key),
    key: (index) => [...stored.keys()][index] ?? null,
    get length() {
      return stored.size
    },
  }

  const page: WebPage = {
    addEventListener: (type, listener, opts) => win.addEventListener(type, listener, opts),
    removeEventListener: (type, listener, opts) => win.removeEventListener(type, listener, opts),
    get innerWidth() {
      return width
    },
    get innerHeight() {
      return height
    },
    get localStorage(): StorageLike {
      if (options.storage === 'blocked') throw new DOMException('Access is denied', 'SecurityError')
      return storage
    },
    navigator: options.language === undefined ? {} : { language: options.language },
    matchMedia: (query) => ({ matches: query === '(pointer: coarse)' && options.coarsePointer === true }),
    visualViewport: {
      addEventListener: (type, listener, opts) => viewport.addEventListener(type, listener, opts),
      removeEventListener: (type, listener, opts) => viewport.removeEventListener(type, listener, opts),
      get width() {
        return width
      },
      get height() {
        return height
      },
    },
    document: {
      addEventListener: (type, listener, opts) => doc.addEventListener(type, listener, opts),
      removeEventListener: (type, listener, opts) => doc.removeEventListener(type, listener, opts),
      get visibilityState() {
        return visibility
      },
      hasFocus: () => focused,
      fullscreenEnabled: options.fullscreenEnabled ?? true,
      get fullscreenElement() {
        return fullscreenElement
      },
      exitFullscreen: async () => {
        fullscreenElement = null
        doc.dispatchEvent(new Event('fullscreenchange'))
      },
      documentElement: root,
    },
  }

  return {
    page,
    stored,
    writes,
    setVisibility: (state) => {
      visibility = state
      doc.dispatchEvent(new Event('visibilitychange'))
    },
    setFocus: (next) => {
      focused = next
      win.dispatchEvent(new Event(next ? 'focus' : 'blur'))
    },
    resize: (nextWidth, nextHeight) => {
      width = nextWidth
      height = nextHeight
      viewport.dispatchEvent(new Event('resize'))
    },
    dispatch: (type, fields = {}) => {
      win.dispatchEvent(Object.assign(new Event(type), fields))
    },
  }
}
