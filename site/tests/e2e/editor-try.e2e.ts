import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'
import { makeGame } from './make-game'

// Spec 10.2 and 18.3: the Editor page shows what the editors do and opens the try-it editors, the same page
// `automata editor` serves every game, which starts on a sample game held in the page under the site's headers with
// nothing wrong in the console. Every editor is on its rail, free, and none is marked as missing. What a visitor makes
// is kept in this browser's private storage (reloaded, or the browser closed and opened again, it is still there); Share
// is how a level leaves.
test('the Editor page shows three pictures and opens every editor on a game of the visitor's own', async ({
  page,
}) => {
  const watch = watchPage(page, `http://127.0.0.1:${SITE_PORT}`)
  await page.goto('/editor')
  await expect(page.locator('main figure')).toHaveCount(3)
  await makeGame(page, 'Try Game')

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

// The editors keep a visitor's game and every word typed into it: in this browser's private storage, not in the page.
test('a game made in the editors, and a line changed in it, are there after a reload and after the browser is closed and opened', async ({
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
    await makeGame(page, 'Kept Game')
    await page.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(page)).toHaveValue('Welcome in. Mind the step.')
    // Typed and never left: the line still says it is saved on this device, and a reload brings the words back.
    await firstLine(page).fill(edited)
    await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible()
    await page.reload()
    await page.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(page)).toHaveValue(edited)
    await first.close()

    const second = await chromium.launchPersistentContext(profile)
    const again = await second.newPage()
    await again.goto(url)
    await expect(again.getByRole('link', { name: 'Kept Game: all your games' })).toBeVisible()
    await again.getByRole('tab', { name: 'Writer' }).click()
    await expect(firstLine(again)).toHaveValue(edited)
    await second.close()
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})
