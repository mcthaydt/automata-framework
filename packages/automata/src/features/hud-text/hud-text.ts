import type { Container } from 'pixi.js'
import type { HudScale } from '../../shared/draw/hud-scale.ts'
import { createLabel, type HudLabel } from './hud-label.ts'
import { loadPage, pageFamilyIfLoaded } from './load-page.ts'
import type { PageId } from './pages.ts'

/** What canvas text draws on: the `hud` layer and how big a logical pixel is. `PixiStage` satisfies it. */
export interface HudSurface {
  readonly hud: Container
  hudScale(): HudScale
}

/** How pages reach Pixi. The real one loads the baked fonts; a test may bring its own. */
export interface PageSource {
  load(page: PageId): Promise<unknown>
  familyIfLoaded(page: PageId): string | undefined
}

/** A pool of canvas text labels on one `hud`. */
export interface HudText {
  /** A new pooled label; it adds nothing to the hud until it is first set. */
  label(): HudLabel
  /** Removes every label. A page that finishes loading afterwards changes nothing. */
  destroy(): void
  /** Settles when the `latin` page is loaded (or failed, in which case labels use the fallback face). */
  readonly ready: Promise<void>
}

const REAL_PAGES: PageSource = { load: loadPage, familyIfLoaded: pageFamilyIfLoaded }

/** The game's own face, as the DOM draws it (`--af-font`), for the characters no baked page holds. */
function deviceFace(): string {
  const read =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue('--af-font').trim()
  return read === '' ? 'system-ui, sans-serif' : read
}

const hex = (ch: string): string =>
  `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

/**
 * Canvas text that stays sharp (spec D2): each string is drawn from the first baked MSDF page that holds every one of
 * its letters, else as one `Text` in the device's face at the screen's own resolution. It draws on `surface.hud`, above
 * the pixel picture and outside every post filter.
 */
export function createHudText(surface: HudSurface, pages: PageSource = REAL_PAGES): HudText {
  const roots = new Set<Container>()
  const noted = new Set<string>()
  let destroyed = false
  let face: string | undefined

  // The first label needs the latin page; starting it here lets a game's first word draw sharp, not in the fallback.
  const ready = Promise.resolve(pages.load('latin')).then(
    () => undefined,
    () => undefined,
  )

  return {
    ready,

    label() {
      return createLabel({
        mount: (root) => {
          roots.add(root)
          surface.hud.addChild(root)
        },
        hudScale: () => surface.hudScale(),
        alive: () => !destroyed && !surface.hud.destroyed,
        family: (page) => {
          const family = pages.familyIfLoaded(page)
          // A page nobody has asked for yet (cyrillic) starts loading now; the string draws in the fallback face
          // until it arrives and switches on its next `set`.
          if (family === undefined) void Promise.resolve(pages.load(page)).catch(() => undefined)
          return family
        },
        face: () => {
          face ??= deviceFace()
          return face
        },
        missing: (codePoints) => {
          if (!import.meta.env?.DEV) return
          for (const ch of codePoints) {
            if (noted.has(ch)) continue
            noted.add(ch)
            console.info(
              `[automata] canvas text: "${ch}" (${hex(ch)}) is not in the baked font; it draws in the device's face.`,
            )
          }
        },
      })
    },

    destroy() {
      destroyed = true
      for (const root of roots) if (!root.destroyed) root.destroy({ children: true })
      roots.clear()
    },
  }
}
