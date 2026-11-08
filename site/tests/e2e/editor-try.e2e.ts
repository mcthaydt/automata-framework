import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// Spec 10.2 and 18.3: the Editor page shows what the editors do and opens the try-it editors, the same page
// `automata editor` serves every game, which starts on a sample game held in the page under the site's headers with
// nothing wrong in the console. Every editor is on its rail, free, and none is marked as missing. What a visitor makes
// is kept in this browser's private storage (reloaded, or the browser closed and opened again, it is still there); Share
// is how a level leaves.
test('the Editor page shows three pictures and opens every try-it editor on a sample game', async ({
  page,
}) => {
  const watch = watchPage(page, `http://127.0.0.1:${SITE_PORT}`)
  await page.goto('/editor')
  await expect(page.locator('main figure')).toHaveCount(3)
  await page.getByRole('link', { name: 'Try the editor' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await expect(page.getByText('A sample game to try.', { exact: false })).toBeVisible()

  // Every editor is there to open, the 3D ones too, and the page holds none back.
  const rail = page.getByRole('tablist', { name: 'Editors' })
  for (const editor of [
    'Tuner',
    'Levels 2D',
    'Characters 2D',
    'Levels 3D',
    'Characters 3D',
    'Feel',
    'Audio',
    'Writer',
    'Sequence',
    'Schematic',
  ])
    await expect(rail.getByRole('tab', { name: editor })).toBeVisible()
  await expect(page.getByText('Not in this build')).toHaveCount(0)
  await rail.getByRole('tab', { name: 'Levels 3D' }).click()
  await expect(page.getByText('content/levels/hall.af-sector.json')).toBeVisible()

  // A level made from the platformer template draws, and Share is how it leaves. Levels 2D opens on the templates.
  await rail.getByRole('tab', { name: 'Levels 2D' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  expect(watch.problems).toEqual([])
})

// The try-it editors keep a visitor's edit: the sample game lives in the browser's private storage, not in the page.
test('an edit made in the try-it editors is still there after a reload and after the browser is closed and opened', async ({
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'a persistent profile is opened through Chromium here')
  const profile = mkdtempSync(join(tmpdir(), 'tryit-profile-'))
  const url = `http://127.0.0.1:${SITE_PORT}/editor/app/`
  const edited = 'Welcome back, friend.'
  const firstLine = (page: import('@playwright/test').Page) => page.getByRole('textbox').first()
  try {
    const first = await chromium.launchPersistentContext(profile)
    const page = await first.newPage()
    await page.goto(url)
    await page.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(page)).toHaveValue('Welcome in. Mind the step.')
    await firstLine(page).fill(edited)
    await firstLine(page).blur()

    // A second tab of the same browser reads the page again until the edit has been written (the first tab is left
    // alone, so a reload never cuts the save short); then it reads back the same.
    const reader = await first.newPage()
    await expect
      .poll(
        async () => {
          await reader.goto(url)
          await reader.getByRole('tab', { name: 'Writer' }).click()
          return firstLine(reader).inputValue()
        },
        { timeout: 15_000 },
      )
      .toBe(edited)
    await page.reload()
    await page.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(page)).toHaveValue(edited)
    await first.close()

    const second = await chromium.launchPersistentContext(profile)
    const again = await second.newPage()
    await again.goto(url)
    await again.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(again)).toHaveValue(edited)
    await second.close()
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})
