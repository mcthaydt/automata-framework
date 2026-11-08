import {
  BitmapFont,
  BitmapText,
  Cache,
  CanvasTextMetrics,
  Container,
  Text,
  Texture,
  TextureSource,
} from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FONT as CYRILLIC_FONT } from '#src/features/hud-text/fonts/cyrillic-font.ts'
import { FONT as LATIN_FONT } from '#src/features/hud-text/fonts/latin-font.ts'
import { shadowOffset } from '#src/features/hud-text/hud-size.ts'
import { createHudText, type PageSource } from '#src/features/hud-text/hud-text.ts'
import type { PageId } from '#src/features/hud-text/pages.ts'
import type { HudScale } from '#src/shared/draw/hud-scale.ts'

// jsdom has no 2D canvas, so Pixi cannot measure a `Text`; a fixed advance per letter stands in, the same for every
// label, and the baked pages are installed with an empty atlas (their metrics are real, their pixels are not drawn).
const ADVANCE = 5
let measure: ReturnType<typeof vi.spyOn>

const FONTS = { latin: LATIN_FONT, cyrillic: CYRILLIC_FONT }

/** Pages that load when `release` is called, the way the real ones load when their chunk arrives. */
function fakePages(hold: boolean) {
  const loaded = new Set<PageId>()
  const requested: PageId[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  if (!hold) release()
  const pages: PageSource = {
    load: async (page) => {
      requested.push(page)
      await gate
      const key = `${FONTS[page].fontFamily}-bitmap`
      Cache.remove(key)
      const source = new TextureSource({ width: 512, height: 512 })
      Cache.set(key, new BitmapFont({ data: FONTS[page], textures: [new Texture({ source })] }))
      loaded.add(page)
    },
    familyIfLoaded: (page) => (loaded.has(page) ? FONTS[page].fontFamily : undefined),
  }
  return { pages, release, requested }
}

const PHONE: HudScale = { cssPerLogical: 0.77, devicePerCss: 3, hostScale: 1 }
const STYLE = { size: 10, floor: 14, color: 0xffffff, shadow: true } as const

/** `hold`: the pages stay unloaded until `release()`. */
function setup(options: { hold?: boolean } = {}) {
  const hud = new Container()
  const current = { scale: PHONE }
  const fake = fakePages(options.hold ?? false)
  const text = createHudText({ hud, hudScale: () => current.scale }, fake.pages)
  return { hud, text, current, ready: text.ready, ...fake }
}

/** Every text object under `hud` that is visible all the way up. */
function shown(hud: Container): (BitmapText | Text)[] {
  const out: (BitmapText | Text)[] = []
  const walk = (node: Container, parentVisible: boolean): void => {
    const visible = parentVisible && node.visible
    if ((node instanceof BitmapText || node instanceof Text) && visible) out.push(node)
    for (const child of node.children) walk(child as Container, visible)
  }
  walk(hud, true)
  return out
}
const count = (node: Container): number => node.children.reduce((n, c) => n + 1 + count(c as Container), 0)

beforeEach(() => {
  measure = vi.spyOn(CanvasTextMetrics, 'measureText').mockImplementation(((
    value: string,
    style: { fontSize: number },
  ) => ({
    width: [...value].length * ADVANCE,
    height: style.fontSize * 1.2,
  })) as never)
})
afterEach(() => {
  measure.mockRestore()
  vi.restoreAllMocks()
  TextureSource.defaultOptions.scaleMode = 'linear'
})

describe('createHudText', () => {
  it('draws a string every page covers as sharp bitmap text with a shadow one offset right and down', async () => {
    const { hud, text, ready } = setup()
    await ready
    const label = text.label()
    label.set('Bump!', 20, 30, STYLE)
    expect(label.kind).toBe('bitmap')
    const [shadow, fill] = shown(hud)
    expect(shown(hud)).toHaveLength(2)
    expect(shadow).toBeInstanceOf(BitmapText)
    const off = shadowOffset(PHONE)
    expect(shadow?.position.x).toBeCloseTo((fill?.position.x ?? 0) + off, 5)
    expect(shadow?.position.y).toBeCloseTo((fill?.position.y ?? 0) + off, 5)
  })

  it('draws no shadow when the style has none', async () => {
    const { hud, text, ready } = setup()
    await ready
    text.label().set('Bump!', 0, 0, { ...STYLE, shadow: false })
    expect(shown(hud)).toHaveLength(1)
  })

  it('puts the right edge of the box at x when anchored right', async () => {
    const { hud, text, ready } = setup()
    await ready
    const box = text.label().set('Bump!', 100, 0, { ...STYLE, anchor: { x: 1, y: 0 } })
    const fill = shown(hud).at(-1)
    expect((fill?.position.x ?? 0) + box.width).toBeCloseTo(100, 5)
  })

  it('grows the box to the floor on a phone held upright, and not on a large screen', async () => {
    const { text, current, ready } = setup()
    await ready
    const label = text.label()
    const phone = label.set('Bump!', 0, 0, STYLE)
    current.scale = { cssPerLogical: 3.06, devicePerCss: 2, hostScale: 1 }
    const wide = label.set('Bump!', 0, 0, STYLE)
    expect(phone.height / wide.height).toBeCloseTo(14 / 0.77 / 10, 1)
  })

  it('returns a zero box and draws nothing for an empty string', async () => {
    const { hud, text, ready } = setup()
    await ready
    const label = text.label()
    expect(label.set('', 0, 0, STYLE)).toEqual({ width: 0, height: 0 })
    expect(shown(hud)).toHaveLength(0)
  })

  it('hides a label that is no longer set', async () => {
    const { hud, text, ready } = setup()
    await ready
    const label = text.label()
    label.set('Bump!', 0, 0, STYLE)
    label.hide()
    expect(shown(hud)).toHaveLength(0)
  })

  it('adds nothing to the hud until a label is first set', () => {
    const { hud, text } = setup()
    text.label()
    expect(hud.children).toHaveLength(0)
  })

  it('keeps French typing on the latin page: a narrow no-break space before ! is widened, not lost', async () => {
    const { text, ready } = setup()
    await ready
    const label = text.label()
    label.set('mur !', 0, 0, STYLE)
    expect(label.kind).toBe('bitmap')
  })

  describe('the fallback face', () => {
    it('draws the whole string in the device face when a letter is in no page, and tells a developer once', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      const { hud, text, ready } = setup()
      await ready
      const label = text.label()
      for (let frame = 0; frame < 3; frame++) label.set('Aïe, un mur ! 好', 0, 0, STYLE)
      expect(label.kind).toBe('fallback')
      expect(shown(hud).every((part) => part instanceof Text)).toBe(true)
      expect(info).toHaveBeenCalledTimes(1)
      expect(info.mock.calls[0]?.[0]).toBe(
        '[automata] canvas text: "好" (U+597D) is not in the baked font; it draws in the device\'s face.',
      )
    })

    it('draws a string whose page is still loading in the fallback, then switches when it arrives', async () => {
      const { text, ready, release } = setup({ hold: true })
      const label = text.label()
      label.set('Bump!', 0, 0, STYLE)
      expect(label.kind).toBe('fallback')
      release()
      await ready
      label.set('Bump!', 0, 0, STYLE)
      expect(label.kind).toBe('bitmap')
    })

    it('asks for the cyrillic page only when a string needs it', async () => {
      const { text, ready, requested } = setup()
      await ready
      const label = text.label()
      label.set('Bump!', 0, 0, STYLE)
      expect(requested).toEqual(['latin'])
      label.set('Привет', 0, 0, STYLE)
      expect(requested).toEqual(['latin', 'cyrillic'])
      await vi.waitFor(() => {
        label.set('Привет', 0, 0, STYLE)
        expect(label.kind).toBe('bitmap')
      })
    })

    it('rasterises at one device pixel per screen pixel and samples linearly whatever pixel art set', async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest'
      const { hud, text, ready } = setup()
      await ready
      text.label().set('好', 0, 0, STYLE)
      const fill = shown(hud).at(-1) as Text
      expect(fill.resolution).toBeCloseTo(0.77 * 3, 5)
      expect(fill.textureStyle?.scaleMode).toBe('linear')
    })

    it('follows the scale when the screen turns', async () => {
      const { hud, text, current, ready } = setup()
      await ready
      const label = text.label()
      label.set('好', 0, 0, STYLE)
      current.scale = { cssPerLogical: 2, devicePerCss: 2, hostScale: 1 }
      label.set('好', 0, 0, STYLE)
      expect((shown(hud).at(-1) as Text).resolution).toBe(4)
    })
  })

  describe('a pooled slot', () => {
    it('switches kind and back without leaking: one visible fill each frame, no new children after the second', async () => {
      const { hud, text, ready } = setup()
      await ready
      const label = text.label()
      const kinds: string[] = []
      const sizes: number[] = []
      const visibleFills: number[] = []
      for (const word of ['Bump!', '好', 'Bump!']) {
        label.set(word, 0, 0, { ...STYLE, shadow: false })
        kinds.push(label.kind)
        sizes.push(count(hud))
        visibleFills.push(shown(hud).length)
      }
      expect(kinds).toEqual(['bitmap', 'fallback', 'bitmap'])
      expect(visibleFills).toEqual([1, 1, 1])
      expect(sizes[2]).toBe(sizes[1])
    })
  })

  describe('being destroyed', () => {
    it('leaves the hud empty when it is destroyed before the page loads, and a late load adds nothing', async () => {
      const { hud, text, ready, release } = setup({ hold: true })
      const label = text.label()
      label.set('Bump!', 0, 0, STYLE)
      text.destroy()
      expect(hud.children).toHaveLength(0)
      release()
      await ready
      label.set('Bump!', 0, 0, STYLE)
      expect(hud.children).toHaveLength(0)
    })

    it('adds nothing once the hud itself is destroyed', async () => {
      const { hud, text, ready } = setup()
      await ready
      const label = text.label()
      label.set('Bump!', 0, 0, STYLE)
      hud.destroy({ children: true })
      expect(label.set('Bump!', 0, 0, STYLE)).toEqual({ width: 0, height: 0 })
    })
  })
})
