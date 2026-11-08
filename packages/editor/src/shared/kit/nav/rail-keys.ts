// The keyboard rules every switcher of the editors shares (the sidebar, the rail, the tab bar): one tab stop, arrows move
// along it and wrap, Home and End jump, and Cmd or Ctrl with 1 to 9 choose the entry in order from anywhere on the page.

export interface Keyed {
  readonly id: string
}

/** The entry an arrow, Home or End key leads to from `stop`, or `undefined` for any other key. */
export function stepTarget<T extends Keyed>(
  entries: readonly T[],
  stop: string | undefined,
  key: string,
  orientation: 'vertical' | 'horizontal',
): T | undefined {
  const back = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const index = entries.findIndex((entry) => entry.id === stop)
  const next =
    key === back
      ? index - 1
      : key === forward
        ? index + 1
        : key === 'Home'
          ? 0
          : key === 'End'
            ? entries.length - 1
            : undefined
  if (next === undefined || entries.length === 0) return undefined
  return entries[(next + entries.length) % entries.length]
}

/** The entry Cmd or Ctrl with a digit chooses, or `undefined` (a plain digit, Shift, Alt, or a digit past the last entry). */
export function shortcutTarget<T extends Keyed>(entries: readonly T[], event: KeyboardEvent): T | undefined {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return undefined
  const digit = Number.parseInt(event.key, 10)
  return digit >= 1 ? entries[digit - 1] : undefined
}

/** The tab that holds the page's one tab stop: the chosen one, or the first on Home. */
export function tabStop<T extends Keyed>(entries: readonly T[], current: string | undefined): string | undefined {
  return entries.some((entry) => entry.id === current) ? current : entries[0]?.id
}
