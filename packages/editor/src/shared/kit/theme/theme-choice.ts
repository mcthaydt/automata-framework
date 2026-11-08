// The look an editor opens in: Dark, until the person chooses. `<html data-theme>` holds the choice (`dark`, `light` or
// `device`, which follows `prefers-color-scheme`; see tool-theme.css). The choice is kept in this browser only, as a
// per-visitor convenience like the last-opened game: it is not game state and is never written to a game folder.

/** What the person picked: a look, or "Match device". */
export type ThemeChoice = 'light' | 'dark' | 'device'

/** One key for every editor page on the same address, so the choice holds across the 2D, 3D and suite pages. */
export const THEME_KEY = 'automata-editor:theme'

type Reader = () => Pick<Storage, 'getItem'> | undefined
type Writer = () => Pick<Storage, 'setItem'> | undefined

/** The stored choice. A missing key, a missing store, a refusal (a private window may throw) or any other value is Dark. */
export function readThemeChoice(storage: Reader): ThemeChoice {
  try {
    const stored = storage()?.getItem(THEME_KEY)
    return stored === 'light' || stored === 'device' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Remembers the choice. Match device is written as `device`, not forgotten: a missing key means Dark. A store that
 * refuses is not an error: the look still changes for this visit.
 */
export function writeThemeChoice(choice: ThemeChoice, storage: Writer): void {
  try {
    storage()?.setItem(THEME_KEY, choice)
  } catch {
    // The choice holds until the page closes.
  }
}

/** Puts the choice on the page, Match device included: the stylesheet reads the attribute and asks the device itself. */
export function applyThemeChoice(choice: ThemeChoice, root: HTMLElement): void {
  root.dataset.theme = choice
}

/**
 * The text of `public/theme-boot.js`, which every editor page loads first in `<head>`. It runs before the first paint,
 * so a stored choice that differs from the device never flashes the other look. It is a file, not an inline script:
 * the site serves the 2D editor at /editor/app/ under `script-src 'self'`, which refuses inline scripts. A classic
 * script (no `import`), so it blocks and runs at once. A test pins every copy to this text.
 */
export const THEME_BOOT: string = `try {
  const stored = localStorage.getItem('${THEME_KEY}')
  document.documentElement.dataset.theme = stored === 'light' || stored === 'device' ? stored : 'dark'
} catch {
  // Storage refused: the editors open Dark.
  document.documentElement.dataset.theme = 'dark'
}
`
