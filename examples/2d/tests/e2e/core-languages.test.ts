import { examplesPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import en from '@automata/framework/words/en.json' with { type: 'json' }
import ja from '@automata/framework/words/ja.json' with { type: 'json' }
import { expect, test } from '@playwright/test'

// The menus in six languages (shared polish, item 1): Settings' Language group offers all six in their own script, the
// choice changes the words at once and is kept through the host across a reload. The words compared are the
// framework's own catalogs, read here, never typed into the test.
const origin = `http://localhost:${examplesPort}`

test('picking 日本語 in Settings changes the menus and is kept after a reload', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/languages/`, 'core-languages')
  await expect(frame.getByTestId('play')).toHaveText(en.title_play)

  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await frame.getByTestId('settings').click()
  await expect(frame.getByTestId('settings-screen')).toBeVisible()

  // All six languages are offered, each in its own script.
  for (const tag of ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
    await expect(frame.getByTestId(`language-${tag}`)).toBeVisible()
  await frame.getByTestId('language-ja').click()
  await expect(frame.getByRole('heading', { name: ja.settings_screen_title })).toBeVisible()

  // The game reloads in its frame; the host keeps the player's saves, so the choice stands and the title speaks Japanese.
  await frame.evaluate(() => window.location.reload())
  await expect(frame.getByTestId('play')).toHaveText(ja.title_play)
  expect(errors).toEqual([])
})
