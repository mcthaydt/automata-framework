import type { FormFactor, HeightTier } from '@mcthaydt/automata-ui'

/** How the shell lays out its regions (kit spec §4.2). Decided from the form factor and nothing else. */
export type ShellMode = 'wide' | 'medium' | 'compact'

/** Whether the dock sits beneath the canvas or is a bottom sheet. */
export type DockPlacement = 'inline' | 'sheet'

export type Detent = 'peek' | 'half' | 'full'

/** The regions that open and close; the top bar, rail, canvas and status line are always there. */
export type ShellRegion = 'panel' | 'inspector' | 'dock'

/** desktop → wide, tablet-portrait → medium, phone-portrait and phone-landscape → compact. */
export function shellModeOf(formFactor: FormFactor): ShellMode {
  switch (formFactor) {
    case 'desktop':
      return 'wide'
    case 'tablet-portrait':
      return 'medium'
    case 'phone-portrait':
    case 'phone-landscape':
      return 'compact'
  }
}

/** Inline only when wide and the height tier is not short or compact: a short window cannot spare 148 px. */
export function dockPlacementOf(mode: ShellMode, tier: HeightTier): DockPlacement {
  return mode === 'wide' && tier === undefined ? 'inline' : 'sheet'
}

/**
 * What the dock does when the editor leaves `dockOpen` unset: open when it sits inline, and open as a
 * peek in `medium`; closed behind its handle in a short window and in `compact`, where the canvas needs the room.
 */
export function defaultDockOpen(mode: ShellMode, tier: HeightTier): boolean {
  return mode === 'medium' || dockPlacementOf(mode, tier) === 'inline'
}

export const DETENTS: readonly Detent[] = ['peek', 'half', 'full']

/** peek → half → full → peek: what the sheet's handle button does when pressed. */
export function nextDetent(detent: Detent): Detent {
  return DETENTS[(DETENTS.indexOf(detent) + 1) % DETENTS.length] as Detent
}

const PEEK_STRIP = 96
const DOCK_PEEK_STRIP = 148 + 20 // the dock's own strip and its handle
const HALF = 0.5
const FULL = 0.92

/**
 * The height of an open sheet, in whole px, never more than the space there is. Peek is the region's own
 * strip; half and full are shares of `available`, the height the sheet may use.
 */
export function detentHeight(region: ShellRegion, detent: Detent, available: number): number {
  const height =
    detent === 'peek'
      ? region === 'dock'
        ? DOCK_PEEK_STRIP
        : PEEK_STRIP
      : Math.round(available * (detent === 'half' ? HALF : FULL))
  return Math.min(height, Math.max(0, available))
}
