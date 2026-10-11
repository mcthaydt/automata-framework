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

/**
 * The checks every screen shares: the document never scrolls; every control is at least the target
 * (primaries the primary target) at this scale, on screen unless in a declared scroll region,
 * never under a reserved area and never over the corner row; no ActionBar wraps (level 3); no row
 * (`[data-row]`) clips what it holds; and each of `essentials` is reachable without scrolling.
 */
export function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[] {
  const scale = conditions.geometry.scale
  return [
    ...documentScrolls(document),
    ...findSmallTargets(document.body, 44 * scale, 48 * scale),
    ...findOffscreenControls(document.body),
    ...findIntrusions(document.body, conditions.reserved),
    ...findCornerOverlaps(document.body),
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
