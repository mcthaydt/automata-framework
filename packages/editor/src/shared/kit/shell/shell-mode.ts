import type { FormFactor, HeightTier } from '@mcthaydt/automata'

/** How the shell lays out its regions. Decided from the form factor and nothing else. */
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
