import { examplesPort } from '@automata/examples-runner/host/ports'
import { collectErrors } from '@automata/examples-runner/host/testing'
import ja from '@automata/framework/words/ja.json' with { type: 'json' }
import { passFirstRun } from '@automata/tools/e2e'
import { expect, test } from '@playwright/test'
import { drawsIn } from './draws-in.ts'

// A first run (shared polish, items 2 and 3), opened directly rather than under the fake host: the Ruken adapter's
// standalone session reads the browser's language, so the language screen shows (a Ruken host supplies its own
// language and skips it). Language first with the suggested one focused, then the flashing warning, then the title; a
// second visit goes straight in.
test.use({ locale: 'ko' })
const origin = `http://localhost:${examplesPort}`

test('language, then the warning, then the title; the second run goes straight in', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(`${origin}/core/first-run/`)
  await page.waitForFunction(() => document.documentElement.dataset.state === 'ready')

  // The device's language is the one with focus.
  await expect(page.getByTestId('first-language-ko')).toBeFocused()
  await drawsIn(page.locator('html'), 'ko ko')
  await page.getByTestId('first-language-ja').click()

  // The warning is read in the language just picked.
  await expect(page.getByTestId('photosensitivity-continue')).toBeVisible()
  await expect(page.getByRole('heading', { name: ja.first_run_warning_title })).toBeVisible()
  // It says what this game has (it declares `flashing`), in Japanese, and not what it does not.
  const warning = page.getByTestId('photosensitivity-warning')
  await expect(warning).toContainText(ja.first_run_warning_effects_flashing)
  await expect(warning).not.toContainText(ja.first_run_warning_effects_shaking)
  await drawsIn(page.locator('html'), 'ja ja')
  await page.getByTestId('photosensitivity-continue').click()

  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('play')).toHaveText(ja.title_play)
  // Held the other way up on a short phone, the game first asks to go fullscreen and that gate takes focus; otherwise Play has it.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
    .toMatch(/^(play|landscape-gate-fullscreen)$/)

  // The same device again: neither first-run screen shows.
  await page.reload()
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('photosensitivity-continue')).toHaveCount(0)
  await expect(page.locator('[data-testid^="first-language-"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

// `passFirstRun` is the helper a game's own journeys use: it presses through whatever first-run screens show, the way a
// player does, and returns once the first screen is in. This is its first run against a real browser.
test('passFirstRun presses through the language and the warning', async ({ page }) => {
  await page.goto(`${origin}/core/first-run/`)
  await passFirstRun(page, 'ja')
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('play')).toHaveText(ja.title_play)
})
