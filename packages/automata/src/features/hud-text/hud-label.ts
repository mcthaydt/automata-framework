import { BitmapText, Container, Text } from 'pixi.js'
import type { HudScale } from '../../shared/draw/hud-scale.ts'
import { choosePage, missingFrom, normalise } from './choose-page.ts'
import { hudFontSize, shadowOffset } from './hud-size.ts'
import { HUD_PAGES, type PageId } from './pages.ts'

/** How a label looks. `size` is in logical px; `floor` is the smallest it may be on screen, in CSS px. */
export interface HudTextStyle {
  readonly size: number
  readonly floor: number
  readonly color: number
  readonly shadow: boolean
  /** 0 to 1: which point of the text's box sits at (x, y). Default top-left. */
  readonly anchor?: { readonly x: number; readonly y: number } | undefined
}

/** The box a label took, in logical px, after the floor. */
export interface HudBox {
  readonly width: number
  readonly height: number
}

/** One pooled line of canvas text. `set` draws it again each frame it is wanted; `hide` takes it off the screen. */
export interface HudLabel {
  set(text: string, x: number, y: number, style: HudTextStyle): HudBox
  hide(): void
  /** `bitmap`: sharp letters from a baked page. `fallback`: the whole string in the device's face. */
  readonly kind: 'bitmap' | 'fallback'
}

/** What a label needs from its owner: where to mount, the pages, the face and a place to report. */
export interface LabelHost {
  /** Puts the label's container on the hud, once, when the label is first set. */
  mount(root: Container): void
  hudScale(): HudScale
  /** True until the owner is destroyed or its hud is: a late `set` then adds nothing. */
  alive(): boolean
  /** The family of a loaded page, or `undefined` while it loads (the owner starts the load). */
  family(page: PageId): string | undefined
  /** The device face for the fallback, as CSS `font-family`. */
  face(): string
  /** Code points that are in no page and so drew in the device's face. */
  missing(codePoints: readonly string[]): void
}

const NONE: HudBox = { width: 0, height: 0 }

interface Pair<N extends BitmapText | Text> {
  readonly fill: N
  readonly shadow: N
}

/** Writes `value` only when it differs, so a steady HUD triggers no text layout. */
function assign<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  if (target[key] !== value) target[key] = value
}

export function createLabel(host: LabelHost): HudLabel {
  const root = new Container({ label: 'hud-label' })
  let mounted = false
  let bitmap: Pair<BitmapText> | undefined
  let fallback: Pair<Text> | undefined
  let kind: 'bitmap' | 'fallback' = 'fallback'
  // What the last string turned into, so a HUD that writes the same words each frame does not choose a page again.
  let chosen: { value: string; text: string; page: PageId | undefined } | undefined

  const drawBitmap = (family: string, text: string, size: number, color: number): Pair<BitmapText> => {
    if (bitmap === undefined) {
      const make = () => new BitmapText({ text, style: { fontFamily: family, fontSize: size, fill: color } })
      bitmap = { shadow: make(), fill: make() }
      root.addChild(bitmap.shadow, bitmap.fill)
    }
    for (const part of [bitmap.shadow, bitmap.fill]) {
      assign(part, 'text', text)
      assign(part.style, 'fontFamily', family)
      assign(part.style, 'fontSize', size)
    }
    assign(bitmap.fill.style, 'fill', color)
    assign(bitmap.shadow.style, 'fill', 0x000000)
    return bitmap
  }

  const drawFallback = (text: string, size: number, color: number, scale: HudScale): Pair<Text> => {
    // One texel for one device pixel, so the letters are as sharp as the DOM's.
    const resolution = scale.devicePerCss * scale.cssPerLogical
    if (fallback === undefined) {
      const make = () =>
        new Text({
          text,
          style: { fontFamily: host.face(), fontWeight: '600', fontSize: size, fill: color },
          resolution,
          // Pixel art makes every new texture nearest, which tears a letter at a fractional position.
          textureStyle: { scaleMode: 'linear' },
        })
      fallback = { shadow: make(), fill: make() }
      root.addChild(fallback.shadow, fallback.fill)
    }
    for (const part of [fallback.shadow, fallback.fill]) {
      assign(part, 'text', text)
      assign(part.style, 'fontSize', size)
      assign(part, 'resolution', resolution)
    }
    assign(fallback.fill.style, 'fill', color)
    assign(fallback.shadow.style, 'fill', 0x000000)
    // A colour emoji ignores `fill`; the tint multiplies every glyph, so the shadow is a black shape for them too.
    fallback.shadow.tint = 0x000000
    return fallback
  }

  return {
    get kind() {
      return kind
    },

    hide() {
      root.visible = false
    },

    set(value, x, y, style) {
      if (!host.alive()) return NONE
      if (chosen?.value !== value) {
        const text = normalise(value)
        const page = choosePage(text, HUD_PAGES)
        if (text !== '' && page === undefined) host.missing(missingFrom(text, HUD_PAGES))
        chosen = { value, text, page }
      }
      const { text, page } = chosen
      if (text === '') {
        root.visible = false
        return NONE
      }
      const scale = host.hudScale()
      const size = hudFontSize(style.size, style.floor, scale)
      const family = page === undefined ? undefined : host.family(page)

      if (!mounted) {
        mounted = true
        host.mount(root)
      }
      root.visible = true
      let pair: Pair<BitmapText> | Pair<Text>
      if (family === undefined) {
        pair = drawFallback(text, size, style.color, scale)
        kind = 'fallback'
      } else {
        pair = drawBitmap(family, text, size, style.color)
        kind = 'bitmap'
      }
      // The other kind's pair stays in the pool, hidden, so a slot that switches back and forth allocates nothing.
      for (const [own, active] of [
        [bitmap, kind === 'bitmap'],
        [fallback, kind === 'fallback'],
      ] as const) {
        if (own === undefined) continue
        own.fill.visible = active
        own.shadow.visible = active && style.shadow
      }

      const box: HudBox = { width: pair.fill.width, height: pair.fill.height }
      const left = x - box.width * (style.anchor?.x ?? 0)
      const top = y - box.height * (style.anchor?.y ?? 0)
      const offset = shadowOffset(scale)
      pair.fill.position.set(left, top)
      pair.shadow.position.set(left + offset, top + offset)
      return box
    },
  }
}
