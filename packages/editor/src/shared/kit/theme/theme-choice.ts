// The look an editor opens in. `<html data-theme>` forces one; no attribute follows the device
// (`prefers-color-scheme`, see tool-theme.css). The choice is kept in this browser only, as a per-visitor
// convenience like the last-opened game: it is not game state and is never written to a game folder.

/** What the person picked: a look, or "Match device". */
export type ThemeChoice = 'light' | 'dark' | 'device'

/** One key for every editor page on the same address, so the choice holds across the 2D, 3D and suite pages. */
export const THEME_KEY = 'automata-editor:theme'

type Reader = () => Pick<Storage, 'getItem'> | undefined
type Writer = () => Pick<Storage, 'setItem' | 'removeItem'> | undefined

/** The stored choice. A missing store, a refusal (a private window may throw) or any other value is Match device. */
export function readThemeChoice(storage: Reader): ThemeChoice {
  try {
    const stored = storage()?.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'device'
  } catch {
    return 'device'
  }
}

/** Remembers the choice; Match device forgets it. A store that refuses is not an error: the look still changes for this visit. */
export function writeThemeChoice(choice: ThemeChoice, storage: Writer): void {
  try {
    if (choice === 'device') storage()?.removeItem(THEME_KEY)
    else storage()?.setItem(THEME_KEY, choice)
  } catch {
    // The choice holds until the page closes.
  }
}

/** Puts the choice on the page: a forced look sets `data-theme`, Match device removes it so the device decides. */
export function applyThemeChoice(choice: ThemeChoice, root: HTMLElement): void {
  if (choice === 'device') root.removeAttribute('data-theme')
  else root.dataset.theme = choice
}

/**
 * The text of `public/theme-boot.js`, which every editor page loads first in `<head>`. It runs before the first paint,
 * so a stored choice that differs from the device never flashes the other look. It is a file, not an inline script:
 * the site serves the 2D editor at /editor/app/ under `script-src 'self'`, which refuses inline scripts. A classic
 * script (no `import`), so it blocks and runs at once. A test pins every copy to this text.
 */
export const THEME_BOOT: string = `try {
  const stored = localStorage.getItem('${THEME_KEY}')
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored
} catch {
  // Storage refused: the device decides.
}
`
