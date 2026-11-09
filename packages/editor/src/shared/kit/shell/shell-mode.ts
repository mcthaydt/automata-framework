import type { Geometry, HeightTier } from '@automata/framework'

/**
 * How the shell lays out its regions, chosen by the room the editor has and not by the device (the approved
 * mockup, AUDIT.md E1): `wide` has three columns, `medium` the list beside the stage with the details floating over
 * it, `compact` the stage alone with the tools in a dock and sheets for the rest.
 */
export type ShellMode = 'wide' | 'medium' | 'compact'

/** Whether the dock sits beneath the canvas or is a bottom sheet. */
export type DockPlacement = 'inline' | 'sheet'

export type Detent = 'peek' | 'half' | 'full'

/** The regions that open and close; the top bar, rail, canvas and status line are always there. */
export type ShellRegion = 'panel' | 'inspector' | 'dock'

/** Wide from 1180 px across; compact at 760 px across and narrower, or 520 px high and shorter. */
export const WIDE_MIN_WIDTH = 1180
export const COMPACT_MAX_WIDTH = 760
export const COMPACT_MAX_HEIGHT = 520

/** The mode for a window of this size: compact first (a short window is compact however wide), then wide. */
export function shellModeOf(size: { readonly width: number; readonly height: number }): ShellMode {
  if (size.width <= COMPACT_MAX_WIDTH || size.height <= COMPACT_MAX_HEIGHT) return 'compact'
  return size.width >= WIDE_MIN_WIDTH ? 'wide' : 'medium'
}

/**
 * The mode for the geometry owner's measure, read from the window's size before a keyboard shrank it
 * (`keyboardResize`), so opening the keyboard to type a name never moves the editor to another layout.
 */
export function shellModeAt(geometry: Pick<Geometry, 'layout' | 'keyboardResize'>): ShellMode {
  return shellModeOf({
    width: geometry.layout.width,
    height: geometry.layout.height + geometry.keyboardResize,
  })
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

const HANDLE = 44 // a sheet's handle is a touch target (AGENTS.md)
const PEEK_STRIP = 96 // a panel or inspector: the handle and one row of the region
const DOCK_PEEK_STRIP = 148 + HANDLE // the dock's own 148 px and the handle

/**
 * The height of an open sheet as a CSS length, to be set where a percentage resolves against the room the
 * sheet may use (its grid area). Peek is the region's own strip, never more than that room; half and full
 * are shares of it. CSS does the sum, so a rotation or a keyboard needs no measuring.
 */
export function detentLength(region: ShellRegion, detent: Detent): string {
  if (detent === 'half') return '50%'
  if (detent === 'full') return '92%'
  return `min(${region === 'dock' ? DOCK_PEEK_STRIP : PEEK_STRIP}px, 100%)`
}
