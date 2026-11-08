import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { type ServedFolder, serveFolder } from '../harness/serve-folder.ts'

// Share in a real browser, where a level has no game folder to be saved into (the site's "Try the editor"): the
// level leaves by Download, Copy or Share, and Share is the bar's one primary button, so a person who just drew a level
// sees at once how to keep it. The built suite is served as the site serves it: no editor server answers, so it opens
// the sample game, which has no level until the visitor starts one from a template. Build first: `pnpm build`.

const EDITOR = fileURLToPath(new URL('../../../dist/suite', import.meta.url))

let site: ServedFolder
test.beforeAll(async () => {
  site = await serveFolder(EDITOR)
})
test.afterAll(async () => {
  await site.stop()
})

async function newPlatformer(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(site.url)
  await page.getByRole('button', { name: 'Open Levels' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  // The level is the sample's first change, so the suite asks what to call the change first.
  const title = page.getByRole('dialog', { name: 'Name this change' })
  await title.getByRole('textbox', { name: 'Title' }).fill('My level')
  await title.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
}

test('Share is the primary button, and Download hands over the level as a file', async ({ page }) => {
  await newPlatformer(page)
  const share = page.getByRole('button', { name: 'Share' })
  await expect(share).toHaveAttribute('data-kind', 'primary')

  await share.click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('untitled-platformer.af2d.json')
  const level = JSON.parse(readFileSync((await file.path()) ?? '', 'utf8')) as { levels?: unknown[] }
  expect(level.levels?.length, 'the file holds the level that was drawn').toBeGreaterThan(0)
  await expect(page.getByText('Downloaded your level.')).toBeVisible()
})

test('Copy puts the level on the clipboard, ready to paste anywhere', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are granted to Chromium only.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(site.url).origin })
  await newPlatformer(page)
  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByRole('menuitem', { name: 'Copy' }).click()
  await expect(page.getByText(/Copied/)).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(JSON.parse(text).levels.length).toBeGreaterThan(0)
})

test('the level a visitor made is still there after a reload, kept in this browser', async ({ page }) => {
  await newPlatformer(page)
  await page.reload()
  const levels = page.getByRole('region', { name: 'Levels' })
  await levels.getByRole('button', { name: 'Untitled platformer' }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
})
