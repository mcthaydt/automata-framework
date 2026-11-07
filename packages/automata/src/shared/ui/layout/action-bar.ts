import type { Snippet } from 'svelte'

/**
 * The action bar's model.
 *
 * One row of actions that gives way in a fixed order as its container narrows, so the primary
 * action is the last thing to lose its words:
 *   0. every label in full;
 *   1. utility actions drop to their icon;
 *   2. secondary actions take their short label;
 *   3. it wraps, with the primary alone on the first row.
 * Level 3 is a fallback: the layout contracts fail any reference size where a bar reaches it.
 */

export type ActionKind = 'primary' | 'secondary' | 'utility'

/**
 * One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does
 * when selected, and optionally a short label, an icon, a disabled state and a pressed state.
 */
export interface BarAction {
  readonly id: string
  readonly label: string
  /** What a secondary action says from level 2 ("Replay" for "Watch replay"). */
  readonly shortLabel?: string | undefined
  /** A utility's icon; from level 1 the icon alone stands for it, and the label stays its name. */
  readonly icon?: Snippet | undefined
  readonly kind: ActionKind
  /** Receives the click, so an action can act on its own button. */
  readonly onSelect: (event: MouseEvent) => void
  readonly disabled?: boolean | undefined
  /** A toggle's state, rendered as `aria-pressed`. */
  readonly pressed?: boolean | undefined
  /** Defaults to `id`. */
  readonly testId?: string | undefined
}

/**
 * How far an action bar has collapsed: 0 every label in full, 1 utilities as icons, 2 secondaries on their
 * short labels, 3 wrapped with the primary on its own row.
 */
export type CollapseLevel = 0 | 1 | 2 | 3

/** The first level whose one-row width fits. `widths` are the bar's unwrapped widths at levels 0, 1 and 2. */
export function collapseLevel(available: number, widths: readonly [number, number, number]): CollapseLevel {
  if (widths[0] <= available) return 0
  if (widths[1] <= available) return 1
  if (widths[2] <= available) return 2
  return 3
}

/**
 * The default measurement: the bar's own width, and the natural width of each hidden measuring
 * row (`[data-measure="0|1|2"]`), which hold the same buttons laid out unwrapped at that level.
 */
export function measureBar(bar: HTMLElement): { available: number; widths: [number, number, number] } {
  const row = (level: number): number =>
    bar.querySelector<HTMLElement>(`[data-measure="${level}"]`)?.scrollWidth ?? 0
  return { available: bar.clientWidth, widths: [row(0), row(1), row(2)] }
}
