// The first run in a browser journey: a game that ships more than one language and has never been opened on this
// device asks for a language, and may warn about flashing lights, before its first screen. A journey passes them the
// way a player does, by pressing; it never turns them off.
import type { Frame, Page } from '@playwright/test'

/**
 * Passes the first-run screens of a game in `page` (or in a frame of it, under Ruken's fake host): waits for the host's
 * ready, then presses the language the device suggested (or `language`, a tag such as `ja`) and Continue on the warning,
 * whichever show and in whichever order, until the game's first screen is in. A game that shows none of them returns as
 * soon as its first screen is in. It waits on the page's state, never on a sleep.
 */
export async function passFirstRun(page: Page | Frame, language?: string): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.state === 'ready')
  for (;;) {
    const handle = await page.waitForFunction(() => {
      if (document.querySelector('[data-testid^="first-language-"]') !== null) return 'language'
      if (document.querySelector('[data-testid="photosensitivity-continue"]') !== null) return 'warning'
      // The opening runs before the first screen enters, so a screen in the screens layer means it is over.
      return (document.querySelector('[data-layer="screens"]')?.childElementCount ?? 0) > 0 ? 'done' : false
    })
    const next = (await handle.jsonValue()) as 'language' | 'warning' | 'done'
    if (next === 'done') return
    if (next === 'warning') {
      await page.locator('[data-testid="photosensitivity-continue"]').click()
    } else {
      // The language screen focuses the suggested language; a journey that names one presses that one.
      await page
        .locator(
          language === undefined
            ? '[data-testid^="first-language-"]:focus'
            : `[data-testid="first-language-${language}"]`,
        )
        .click()
    }
    // The pressed screen goes before the next is looked for, so one screen is never pressed twice. Only the screen
    // pressed is waited on: the one that follows it (the warning after the language) is already there when it goes.
    const pressed =
      next === 'warning' ? '[data-testid="photosensitivity-continue"]' : '[data-testid^="first-language-"]'
    await page.waitForFunction((selector) => document.querySelector(selector) === null, pressed)
  }
}
