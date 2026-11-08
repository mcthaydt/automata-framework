import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, type Page, test } from '@playwright/test'
import { serveSuitePage } from '../harness/static-page.ts'

// The web editors keep the person's own games: made, written in, reloaded, the browser closed and opened again, saved as
// a copy, removed and opened from the copy. On the page as the site serves it, with no editor server behind it, in a
// persistent browser context because that is the one that keeps files between a close and an open.

const TYPED = 'Typed and never left the field.'

async function openFromRail(page: Page, name: string): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true })
  await expect(page.getByRole('tab', { name: 'Tuner', exact: true })).toBeVisible()
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await page
    .getByRole('tab', { name: 'More' })
    .or(page.getByRole('button', { name: 'More' }))
    .first()
    .click()
  await page.getByRole('menuitem', { name }).click()
}

test('a web game is made, kept through a reload and a restart, saved as a copy and opened from it', async () => {
  const site = await serveSuitePage()
  const profile = mkdtempSync(join(tmpdir(), 'af-journey-profile-'))
  const copyDir = mkdtempSync(join(tmpdir(), 'af-journey-copy-'))
  const open = () =>
    chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 }, acceptDownloads: true })
  try {
    const first = await open()
    const page = await first.newPage()

    // Nothing made yet: the page asks to make a game, and the new game asks only for a name.
    await page.goto(site.url)
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible()
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByLabel('What’s your game called?').fill("Grandma's Game")
    await expect(page.getByText('grandma-s-game')).toBeVisible()
    await page.getByRole('button', { name: 'Make my game' }).click()

    // The game opens, named, and what is typed in it is on this device.
    await expect(page.getByRole('link', { name: "Grandma's Game: all your games" })).toBeVisible()
    // Its Home starts a level from a template, as the sample's does: there is no folder to find one in.
    await expect(page.getByRole('button', { name: 'New level' })).toBeVisible()
    await openFromRail(page, 'Writer')
    const line = page.getByRole('textbox', { name: 'What it says' }).first()
    await expect(line).toBeVisible()
    await line.click()
    await line.press('ControlOrMeta+A')
    await line.pressSequentially(TYPED)
    await expect(page.getByRole('status').filter({ hasText: /Saved on this device/ })).toBeVisible()

    // A reload keeps the game, the editor and the words.
    await page.reload()
    await openFromRail(page, 'Writer')
    await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
    // The address with nothing in it opens the game left open last, on the editor left open.
    await page.goto(site.url)
    await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)

    // The browser closed and opened again on the same profile.
    await first.close()
    const second = await open()
    const again = await second.newPage()
    await again.goto(site.url)
    await expect(again.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)

    // Back to the list: save a copy, remove the game, open the copy.
    await again.getByRole('link', { name: "Grandma's Game: all your games" }).click()
    await expect(again.getByText('Changed just now').or(again.getByText(/Changed \d+ minutes? ago/))).toBeVisible()
    const download = again.waitForEvent('download')
    await again.getByRole('button', { name: "Save a copy of Grandma's Game" }).click()
    const copy = join(copyDir, 'grandma-s-game.zip')
    await (await download).saveAs(copy)
    await again.getByRole('button', { name: "Remove Grandma's Game" }).click()
    await expect(again.getByText(/Remove Grandma's Game from this browser\?/)).toBeVisible()
    await again.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(again.getByText('You haven’t made a game yet.', { exact: false })).toBeVisible()
    await again.getByLabel('Choose a game copy to open').setInputFiles(copy)
    await openFromRail(again, 'Writer')
    await expect(again.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
    await second.close()
  } finally {
    await site.stop()
    rmSync(profile, { recursive: true, force: true })
    rmSync(copyDir, { recursive: true, force: true })
  }
})
