/**
 * The letterbox's side bars, published where CSS and components read them.
 *
 * In a view wider than the level's shape the renderer fits the whole level and leaves an empty bar each side. The
 * touch buttons stand in those bars when they hold one, so no button covers the level. The renderer writes the bar
 * widths here (`publishSideBars`); the play screen reads the room they leave (`publishedSideBarRoom`). Beside the
 * geometry owner's insets so one reader finds both.
 */

/** The width of each side bar, in CSS px. */
export interface SideBars {
  readonly left: number
  readonly right: number
}

/** The space kept each side of a button standing in a bar, in CSS px. */
export const TOUCH_BAR_GAP = 8

const LEFT = '--af-bar-left'
const RIGHT = '--af-bar-right'

/** Writes the bar widths on `root`. */
export function publishSideBars(root: HTMLElement, bars: SideBars): void {
  root.style.setProperty(LEFT, `${bars.left}px`)
  root.style.setProperty(RIGHT, `${bars.right}px`)
}

/** Takes the bar widths off `root`: no renderer, no bars. */
export function clearSideBars(root: HTMLElement): void {
  root.style.removeProperty(LEFT)
  root.style.removeProperty(RIGHT)
}

/**
 * The width a button column can use in each bar: the narrower bar, less the safe area or the host's strip beside it.
 * 0 where nothing was published.
 */
export function publishedSideBarRoom(root: HTMLElement): number {
  const read = (name: string): number => Number.parseFloat(root.style.getPropertyValue(name)) || 0
  return Math.max(0, Math.min(read(LEFT) - read('--af-inset-left'), read(RIGHT) - read('--af-inset-right')))
}
