import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Screenshots the design board, and its dialog, at each size of the config, in both looks, into tests/e2e/screens/
// (git-ignored) for a person to open and judge. It fails on a page error, on a page that scrolls sideways, on a board
// that never loads its fonts and on a board whose field is not the look's own, the ways a screenshot would show something
// other than the kit.
const theme = JSON.parse(
  readFileSync(new URL('../../src/shared/kit/tokens/tool-theme.json', import.meta.url), 'utf8'),
) as Record<'light' | 'dark', Record<string, string>>
const rgb = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

for (const look of ['light', 'dark'] as const) {
  for (const dialog of [false, true]) {
    test(`the board in ${look}${dialog ? ' with its dialog open' : ''}`, async ({ page }, info) => {
      // The editors open Dark whatever the device says, so a look is asked for the way a person asks: by choosing it.
      await page.emulateMedia({ colorScheme: look === 'dark' ? 'light' : 'dark' })
      await page.addInitScript((choice) => localStorage.setItem('automata-editor:theme', choice), look)
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/design.html${dialog ? '?dialog' : ''}`)
      await expect(page.locator('[data-board-ready]')).toBeVisible()
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(sideways).toBe(false)
      // The look is the person's choice, not the device's (the emulated device asks for the other look): the field is the
      // look's own `--tool-bg`, and the page says which look it is in.
      const field = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(field).toBe(rgb(theme[look]['tool-bg'] as string))
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(look)
      await page.screenshot({
        path: `tests/e2e/screens/${info.project.name}-${look}${dialog ? '-dialog' : ''}.png`,
        fullPage: !dialog,
      })
      expect(errors).toEqual([])
    })
  }
}
