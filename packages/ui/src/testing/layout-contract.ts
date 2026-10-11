/**
 * The layout contract every primitive passes at every reference size and variant (M1.6 spec §7,
 * plan Task 11). A test sets the browser to the size, publishes the geometry a real owner would
 * measure there, mounts its fixture with production CSS and calls `checkLayout`.
 */

import {
  documentScrolls,
  findIntrusions,
  findOffscreenControls,
  findSmallTargets,
  findUnreachable,
  hostDisplay,
  type LayoutRect,
  type ReferenceSize,
  type Variant,
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

/**
 * The checks every screen shares: the document never scrolls; every control is at least the target
 * (primaries the primary target) at this scale, on screen unless in a declared scroll region and
 * never under a reserved area; and each of `essentials` is reachable without scrolling.
 */
export function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[] {
  const scale = conditions.geometry.scale
  return [
    ...documentScrolls(document),
    ...findSmallTargets(document.body, 44 * scale, 48 * scale, '.af-control--primary'),
    ...findOffscreenControls(document.body),
    ...findIntrusions(document.body, conditions.reserved),
    ...findUnreachable(essentials),
  ]
}

/** The element a test id names; throws when the fixture has none, so a missing part fails loudly. */
export function byTestId(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (element === null) throw new Error(`no [data-testid="${id}"]`)
  return element
}
