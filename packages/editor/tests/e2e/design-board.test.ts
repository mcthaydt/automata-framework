import { expect, test } from '@playwright/test'

// Screenshots the design board, and its dialog, at each size of the config into tests/e2e/screens/ (git-ignored) for a
// person to open and judge. It fails on a page error, on a page that scrolls sideways, and on a board that never loads
// its fonts, the three ways a screenshot would show something other than the kit.
for (const dialog of [false, true]) {
  test(`the board${dialog ? ' with its dialog open' : ''}`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/design.html${dialog ? '?dialog' : ''}`)
    await expect(page.locator('[data-board-ready]')).toBeVisible()
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(sideways).toBe(false)
    await page.screenshot({
      path: `tests/e2e/screens/${info.project.name}${dialog ? '-dialog' : ''}.png`,
      fullPage: !dialog,
    })
    expect(errors).toEqual([])
  })
}
