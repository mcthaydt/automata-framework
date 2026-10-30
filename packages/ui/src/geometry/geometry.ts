/**
 * The geometry every screen lays out against (M1.6 spec §3.1, §3.2).
 *
 * `measureGeometry` is pure: it turns what the browser and the host report into one answer.
 * `applyGeometry` publishes that answer on the document root, where CSS reads it. The owner
 * (`geometry-owner.ts`) decides when to measure. Built from FloorFifty's `viewport-tracking.svelte.ts`
 * and `ruken/host.ts` `reservedOf` at 122a220.
 */

import type { DisplayMetricsPayload } from '@ruken/sdk'
import { classifyFormFactor, type FormFactor } from './form-factor'
import { classifyHeightTier, type HeightTier } from './height-tier'

/** CSS px on each side, all >= 0. */
export interface Insets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** A rectangle in CSS px: its top-left corner and its size. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
 * Imported from the vendored `@ruken/sdk`, never copied (M1 shared contracts).
 * `scale` is 1.333 on Ruken's TV mode: a hint to enlarge text and targets, never CSS zoom.
 */
export type HostDisplay = Pick<DisplayMetricsPayload, 'safeArea' | 'hostReserved' | 'scale'>

/**
 * What `measureGeometry` reads: the layout viewport, the visual viewport, the safe-area insets, the host's
 * display metrics, a hidden bar's height and the layout before a keyboard shrank it.
 */
export interface GeometryInput {
  /** The layout viewport, `innerWidth x innerHeight`. Form factor and tier come from this alone. */
  readonly layout: { readonly width: number; readonly height: number }
  /** The visual viewport, when the browser has one. The keyboard shrinks this, not the layout. */
  readonly visual?: { readonly height: number; readonly offsetTop: number } | undefined
  /** `env(safe-area-inset-*)`, read by a probe element. */
  readonly envSafeArea: Insets
  /** Absent standalone. */
  readonly host?: HostDisplay | undefined
  /** A bar the browser draws over the page without reporting it (`browser/hidden-browser-bar.ts`). */
  readonly hiddenBarBottom?: number | undefined
  /**
   * The layout viewport before a keyboard shrank it, when one did. Browsers that ignore
   * `interactive-widget=resizes-visual` shrink the page itself for the keyboard; classifying the
   * shrunken page would remount the screen mid-typing, so the class comes from this instead.
   * The owner passes it only while a text field has focus and the width has not changed.
   */
  readonly restingLayout?: { readonly width: number; readonly height: number } | undefined
}

/**
 * The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the
 * usable and visible regions, what covers the page's foot, and the host's scale hint.
 */
export interface Geometry {
  readonly layout: { readonly width: number; readonly height: number }
  readonly formFactor: FormFactor
  readonly heightTier: HeightTier
  /** Per side, the largest of the env inset, the host's safe area and the host's reserved strip. */
  readonly insets: Insets
  readonly hostReserved: { readonly left: number; readonly right: number }
  /** The layout viewport less the insets. */
  readonly usable: Rect
  /** What the browser lays over the page's foot (keyboard, a bottom toolbar, a hidden bar), in whole px. */
  readonly visualInsetBottom: number
  /** The part of `visualInsetBottom` that is a bar the browser does not report, in whole px. */
  readonly hiddenBarBottom: number
  /** How much a keyboard shrank the layout viewport itself (see `restingLayout`), in whole px. */
  readonly keyboardResize: number
  /** `usable` less the visual inset: what the player can actually see and reach. */
  readonly visible: Rect
  readonly scale: HostDisplay['scale']
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`). */
export function hostReservedInsets(host: HostDisplay | undefined): { left: number; right: number } {
  if (host === undefined) return { left: 0, right: 0 }
  const width = Math.max(0, host.hostReserved.rect.w)
  return host.hostReserved.edge === 'left' ? { left: width, right: 0 } : { left: 0, right: width }
}

/**
 * Turns what the browser and the host report into one `Geometry`. Pure. Each inset is the largest of the
 * browser's safe area, the host's and (at the sides) the host's reserved strip; the visible region is the
 * usable one less whatever covers the page's foot.
 */
export function measureGeometry(input: GeometryInput): Geometry {
  const { layout, visual, envSafeArea, host } = input
  const safe = host?.safeArea ?? NO_INSETS
  const reserved = hostReservedInsets(host)
  const insets: Insets = {
    top: Math.max(envSafeArea.top, safe.top),
    right: Math.max(envSafeArea.right, safe.right, reserved.right),
    bottom: Math.max(envSafeArea.bottom, safe.bottom),
    left: Math.max(envSafeArea.left, safe.left, reserved.left),
  }
  const usable: Rect = {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, layout.width - insets.left - insets.right),
    height: Math.max(0, layout.height - insets.top - insets.bottom),
  }
  // Whatever covers the layout viewport's foot. The keyboard shrinks the visual viewport and,
  // on iOS, scrolls it (offsetTop); what is left below it is covered.
  // A hidden bar is reported by nothing the page can read, so it is added on top (spec §3.9).
  const keyboard = visual === undefined ? 0 : Math.max(0, layout.height - visual.height - visual.offsetTop)
  const hiddenBarBottom = Math.max(0, Math.round(input.hiddenBarBottom ?? 0))
  const visualInsetBottom = Math.round(keyboard) + hiddenBarBottom
  // The visual inset is measured from the layout's foot, so the bottom safe area already sits
  // inside it: only the part beyond the safe area shortens the usable region.
  const covered = Math.max(0, visualInsetBottom - insets.bottom)
  const classed = input.restingLayout ?? layout
  return {
    layout: { width: layout.width, height: layout.height },
    formFactor: classifyFormFactor(classed.width, classed.height),
    heightTier: classifyHeightTier(classed.height),
    insets,
    hostReserved: reserved,
    usable,
    visualInsetBottom,
    hiddenBarBottom,
    keyboardResize: Math.max(0, Math.round(classed.height - layout.height)),
    visible: { ...usable, height: Math.max(0, usable.height - covered) },
    scale: host?.scale ?? 1,
  }
}

/** Writes the geometry where CSS reads it (spec §3.2). Only the geometry owner calls this. */
export function applyGeometry(root: HTMLElement, geometry: Geometry): void {
  root.dataset.formFactor = geometry.formFactor
  if (geometry.heightTier === undefined) delete root.dataset.height
  else root.dataset.height = geometry.heightTier
  // A screen frame scrolls what a keyboard hides rather than leaving an action under it, whether
  // the keyboard lies over the page's foot or shrank the page.
  if (geometry.visualInsetBottom > 0 || geometry.keyboardResize > 0) root.dataset.visualInset = ''
  else delete root.dataset.visualInset
  const px = (name: string, value: number): void => root.style.setProperty(name, `${value}px`)
  px('--af-inset-top', geometry.insets.top)
  px('--af-inset-right', geometry.insets.right)
  px('--af-inset-bottom', geometry.insets.bottom)
  px('--af-inset-left', geometry.insets.left)
  px('--af-host-reserved-left', geometry.hostReserved.left)
  px('--af-host-reserved-right', geometry.hostReserved.right)
  px('--af-visual-inset-bottom', geometry.visualInsetBottom)
  px('--af-hidden-bar-bottom', geometry.hiddenBarBottom)
  root.style.setProperty('--af-scale', String(geometry.scale))
}

/**
 * Reads back the visible region `applyGeometry` published on `root`, for a component that must keep something it
 * draws inside it (the touch stick's floating ring, M4.12b). The same region as `Geometry.visible`: the layout less
 * the insets, and above whatever covers the page's foot. Where nothing was published, the whole layout.
 */
export function publishedVisibleRect(
  root: HTMLElement,
  layout: { readonly width: number; readonly height: number },
): Rect {
  const read = (name: string): number => Number.parseFloat(root.style.getPropertyValue(name)) || 0
  const top = read('--af-inset-top')
  const left = read('--af-inset-left')
  // The visual inset is measured from the layout's foot, so it already holds the bottom safe area.
  const bottom = Math.max(read('--af-inset-bottom'), read('--af-visual-inset-bottom'))
  return {
    x: left,
    y: top,
    width: Math.max(0, layout.width - left - read('--af-inset-right')),
    height: Math.max(0, layout.height - top - bottom),
  }
}
