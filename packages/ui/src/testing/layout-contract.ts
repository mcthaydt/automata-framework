/**
 * The layout contract every primitive passes at every reference size and variant (M1.6 spec §7,
 * plan Task 11). A test sets the browser to the size, publishes the geometry a real owner would
 * measure there, mounts its fixture with production CSS and calls `checkLayout`.
 */

import {
  documentScrolls,
  findClipped,
  findIntrusions,
  findOffscreenControls,
  findOverlaps,
  findSmallTargets,
  findUnreachable,
  hostDisplay,
  type LayoutRect,
  type ReferenceSize,
  type Variant,
  visibleControls,
} from '@mcthaydt/automata-testing'
import { applyGeometry, type Geometry, measureGeometry } from '../geometry/geometry'

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

export interface Conditions {
  readonly geometry: Geometry
  /** What covers the page in this variant: the keyboard, Ruken's strip. Nothing may sit under it. */
  readonly reserved: LayoutRect[]
}

/** Measures and publishes the geometry for `size` under `variant`, as the owner would. */
export function publishConditions(root: HTMLElement, size: ReferenceSize, variant: Variant): Conditions {
  const keyboard = variant.keyboard?.(size) ?? 0
  const strip = variant.hostReserved
  const host =
    strip === undefined && variant.scale === undefined
      ? undefined
      : hostDisplay({ edge: strip?.edge ?? 'right', width: strip?.width ?? 0, scale: variant.scale ?? 1 })
  const geometry = measureGeometry({
    layout: { width: size.width, height: size.height },
    visual: keyboard > 0 ? { height: size.height - keyboard, offsetTop: 0 } : undefined,
    envSafeArea: NO_INSETS,
    host,
  })
  applyGeometry(root, geometry)
  const reserved: LayoutRect[] = []
  if (keyboard > 0) reserved.push({ x: 0, y: size.height - keyboard, width: size.width, height: keyboard })
  // Ruken's strip reserves its whole edge: the insets keep the screen out of that column.
  if (strip !== undefined) {
    const x = strip.edge === 'right' ? size.width - strip.width : 0
    reserved.push({ x, y: 0, width: strip.width, height: size.height })
  }
  return { geometry, reserved }
}

/** An ActionBar that had to wrap, putting its primary on a row of its own (spec §3.4: never level 3). */
function findWrappedBars(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-action-bar][data-collapse="3"]')].map(
    (bar) => `${bar.getAttribute('data-testid') ?? 'action bar'} collapsed to level 3`,
  )
}

/**
 * A control of the same screen drawn over its corner row (spec §3.4: the corner row never sits
 * over content). Only the screen's own content counts: an overlay above the screen (an ErrorPanel,
 * a Dialog) interrupts the whole screen, corner row included.
 */
function findCornerOverlaps(root: ParentNode): string[] {
  const problems: string[] = []
  for (const row of root.querySelectorAll('[data-corner-controls]')) {
    const screen = row.closest('[data-screen-frame]') ?? row.parentElement
    if (screen === null) continue
    for (const control of visibleControls(screen)) {
      if (row.contains(control)) continue
      if (findOverlaps(control, row).length > 0) {
        problems.push(
          `${control.getAttribute('data-testid') ?? control.tagName.toLowerCase()} overlaps corner row`,
        )
      }
    }
  }
  return problems
}

const px = (value: string): number => Number.parseFloat(value) || 0

/**
 * An ErrorPanel that had to rise over the corner row (spec §3.4). The panel publishes the least
 * floor of the layouts it could take (`data-fit-floor`); the room is measured here. A panel that
 * scrolls as a whole (`data-overflow`) had to when no layout fits the room its layer normally
 * leaves it (the layer's gutters taken off). Any other panel had to rise when no layout fits under
 * the corner row (the layer's `[data-corner-gap]` taken off too), and it is at its floor (its
 * inline min-height) and still fills its layer's room: with room under it, or taller than its
 * floor, it could have stayed lower.
 */
function roseBecauseItHadTo(panel: HTMLElement): boolean {
  const layer = panel.parentElement
  if (layer === null) return false
  const fit = Number.parseFloat(panel.dataset.fitFloor ?? '')
  const style = getComputedStyle(layer)
  if (panel.hasAttribute('data-overflow')) {
    const gutter = px(style.getPropertyValue('--af-gutter'))
    const top = Math.max(gutter, px(style.getPropertyValue('--af-inset-top')))
    return fit > layer.clientHeight - top - gutter
  }
  const gap = layer.querySelector('[data-corner-gap]')
  const room = layer.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
  const underCorner = room - (gap === null ? 0 : px(getComputedStyle(gap).flexBasis))
  if (!(fit > underCorner)) return false
  const floor = Number.parseFloat(panel.style.minHeight)
  if (!(panel.offsetHeight <= floor + 1)) return false
  const contentBottom = layer.getBoundingClientRect().bottom - px(style.paddingBottom)
  return Math.abs(panel.getBoundingClientRect().bottom - contentBottom) <= 1
}

/**
 * The corner row's controls (Back, above all), and any other control a screen marks as its way out
 * (`data-way-out`, for a screen without a corner row), stay reachable: nothing covers them but a modal
 * dialog, which makes the page behind it inert, or an ErrorPanel that had to rise over them.
 */
function findCoveredCorners(root: ParentNode): string[] {
  // Panels that had to rise are set aside while the corner row is hit tested, so whatever else
  // covers it (or clips it) still counts.
  const risen = [...document.querySelectorAll<HTMLElement>('[role="alert"]')].filter(roseBecauseItHadTo)
  const visibility = risen.map((panel) => panel.style.visibility)
  for (const panel of risen) panel.style.visibility = 'hidden'
  const problems: string[] = []
  for (const row of root.querySelectorAll('[data-corner-controls]')) {
    if (row.closest('[inert]') !== null) continue
    problems.push(...findUnreachable(visibleControls(row)))
  }
  // A screen without a corner row marks its own way out.
  const ownWays = [...root.querySelectorAll<HTMLElement>('[data-way-out]')].filter(
    (control) => control.closest('[inert], [data-corner-controls]') === null,
  )
  problems.push(...findUnreachable(ownWays))
  risen.forEach((panel, index) => {
    panel.style.visibility = visibility[index] ?? ''
  })
  return problems
}

/**
 * The checks every screen shares: the document never scrolls; every control is at least the target
 * (primaries the primary target) at this scale, on screen unless in a declared scroll region,
 * never under a reserved area and never over the corner row; the corner row's controls and any
 * `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no
 * ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; and each of `essentials`
 * is reachable without scrolling.
 */
export function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[] {
  const scale = conditions.geometry.scale
  return [
    ...documentScrolls(document),
    ...findSmallTargets(document.body, 44 * scale, 48 * scale),
    ...findOffscreenControls(document.body),
    ...findIntrusions(document.body, conditions.reserved),
    ...findCornerOverlaps(document.body),
    ...findCoveredCorners(document.body),
    ...findWrappedBars(document.body),
    ...findClipped(document.body, '[data-row]'),
    ...findUnreachable(essentials),
  ]
}

/** The element a test id names; throws when the fixture has none, so a missing part fails loudly. */
export function byTestId(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (element === null) throw new Error(`no [data-testid="${id}"]`)
  return element
}
