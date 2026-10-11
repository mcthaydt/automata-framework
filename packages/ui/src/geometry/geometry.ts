/**
 * The geometry every screen lays out against (M1.6 spec §3.1, §3.2).
 *
 * `measureGeometry` is pure: it turns what the browser and the host report into one answer.
 * `applyGeometry` publishes that answer on the document root, where CSS reads it. The owner
 * (`geometry-owner.ts`) decides when to measure. Built from FloorFifty's `viewport-tracking.svelte.ts`
 * and `ruken/host.ts` `reservedOf` at 122a220.
 */

import { classifyFormFactor, type FormFactor } from './form-factor'
import { classifyHeightTier, type HeightTier } from './height-tier'

/** CSS px on each side, all >= 0. */
export interface Insets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * What the host says about the display: a structural subset of Ruken's `DisplayMetricsPayload`
 * (`packages/protocol/src/meta/types.ts`). Replaced by a `Pick` of the vendored SDK type once
 * lane host vendors `@ruken/sdk` (spec §9).
 */
export interface HostDisplay {
  readonly safeArea: Insets
  /** The strip on one side where Ruken draws its own tab. Only its edge and width matter here. */
  readonly hostReserved: {
    readonly edge: 'left' | 'right'
    readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  }
  /** 1.333 on Ruken's TV mode: a hint to enlarge text and targets, never CSS zoom. */
  readonly scale: 1 | 1.333
}

export interface GeometryInput {
  /** The layout viewport, `innerWidth x innerHeight`. Form factor and tier come from this alone. */
  readonly layout: { readonly width: number; readonly height: number }
  /** The visual viewport, when the browser has one. The keyboard shrinks this, not the layout. */
  readonly visual?: { readonly height: number; readonly offsetTop: number } | undefined
  /** `env(safe-area-inset-*)`, read by a probe element. */
  readonly envSafeArea: Insets
  /** Absent standalone. */
  readonly host?: HostDisplay | undefined
}

export interface Geometry {
  readonly layout: { readonly width: number; readonly height: number }
  readonly formFactor: FormFactor
  readonly heightTier: HeightTier
  /** Per side, the largest of the env inset, the host's safe area and the host's reserved strip. */
  readonly insets: Insets
  readonly hostReserved: { readonly left: number; readonly right: number }
  /** The layout viewport less the insets. */
  readonly usable: Rect
  /** What the browser lays over the page's foot (keyboard, a bottom toolbar), in whole px. */
  readonly visualInsetBottom: number
  /** `usable` less the visual inset: what the player can actually see and reach. */
  readonly visible: Rect
  readonly scale: 1 | 1.333
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`). */
export function hostReservedInsets(host: HostDisplay | undefined): { left: number; right: number } {
  if (host === undefined) return { left: 0, right: 0 }
  const width = Math.max(0, host.hostReserved.rect.w)
  return host.hostReserved.edge === 'left' ? { left: width, right: 0 } : { left: 0, right: width }
}

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
  const visualInsetBottom =
    visual === undefined ? 0 : Math.max(0, Math.round(layout.height - visual.height - visual.offsetTop))
  // The visual inset is measured from the layout's foot, so the bottom safe area already sits
  // inside it: only the part beyond the safe area shortens the usable region.
  const covered = Math.max(0, visualInsetBottom - insets.bottom)
  return {
    layout: { width: layout.width, height: layout.height },
    formFactor: classifyFormFactor(layout.width, layout.height),
    heightTier: classifyHeightTier(layout.height),
    insets,
    hostReserved: reserved,
    usable,
    visualInsetBottom,
    visible: { ...usable, height: Math.max(0, usable.height - covered) },
    scale: host?.scale ?? 1,
  }
}

/** Writes the geometry where CSS reads it (spec §3.2). Only the geometry owner calls this. */
export function applyGeometry(root: HTMLElement, geometry: Geometry): void {
  root.dataset.formFactor = geometry.formFactor
  if (geometry.heightTier === undefined) delete root.dataset.height
  else root.dataset.height = geometry.heightTier
  // A screen frame scrolls what an overlay hides rather than leaving an action under it.
  if (geometry.visualInsetBottom > 0) root.dataset.visualInset = ''
  else delete root.dataset.visualInset
  const px = (name: string, value: number): void => root.style.setProperty(name, `${value}px`)
  px('--af-inset-top', geometry.insets.top)
  px('--af-inset-right', geometry.insets.right)
  px('--af-inset-bottom', geometry.insets.bottom)
  px('--af-inset-left', geometry.insets.left)
  px('--af-host-reserved-left', geometry.hostReserved.left)
  px('--af-host-reserved-right', geometry.hostReserved.right)
  px('--af-visual-inset-bottom', geometry.visualInsetBottom)
  root.style.setProperty('--af-scale', String(geometry.scale))
}
