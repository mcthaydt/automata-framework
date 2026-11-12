import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test'
import { serveSuitePage } from '../harness/static-page.ts'
import { newGame, openFromRail, readField, shown, typeKeep } from '../harness/web-editing.ts'

// The first journeys for typed words only ever typed into the first field of a kind, so a draft kept under the field's
// label went unnoticed: many fields share a label, and a tab closed mid-typing put the words in another one (Schematic's
// window waits 7 s and the door got the 7), or lost them (Writer's third line). These type into the fields after the
// first, and into two fields that hold the same value, and close the tab inside the half second, as Safari on an iPad
// does when it is put away.

test.use({ actionTimeout: 15_000 })

test('a tab closed mid-typing keeps the words in the line they were typed in, and in no other', async () => {
  const site = await serveSuitePage()
  const profile = mkdtempSync(join(tmpdir(), 'af-fields-profile-'))
  const open = (): Promise<BrowserContext> =>
    chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } })
  try {
    const context = await open()
    let page: Page = await context.newPage()
    await newGame(page, site.url, 'Lines Game')
    await openFromRail(page, 'Writer')
    const before = [
      await readField(page, 'textbox', 'What it says', 0),
      await readField(page, 'textbox', 'What it says', 1),
      await readField(page, 'textbox', 'What it says', 2),
    ]
    await typeKeep(page, page.getByRole('textbox', { name: 'What it says' }).nth(2), 'Closed mid typing.')
    await page.close({ runBeforeUnload: false })

    page = await context.newPage()
    await page.goto(site.url)
    await openFromRail(page, 'Writer')
    await expect(page.getByRole('textbox', { name: 'What it says' }).nth(2)).toHaveValue('Closed mid typing.')
    // The other lines still read what they read, and the first did not take the draft away.
    expect(await readField(page, 'textbox', 'What it says', 0)).toBe(before[0])
    expect(await readField(page, 'textbox', 'What it says', 1)).toBe(before[1])
    // It is the person's edit now, in the saved file: it survives one more reload.
    await page.reload()
    await openFromRail(page, 'Writer')
    await expect(page.getByRole('textbox', { name: 'What it says' }).nth(2)).toHaveValue('Closed mid typing.')
    await context.close()
  } finally {
    await site.stop()
    rmSync(profile, { recursive: true, force: true })
  }
})

test('a tab closed mid-typing in the window keeps the 7 with the window, not the door that waits the same', async () => {
  const site = await serveSuitePage()
  const profile = mkdtempSync(join(tmpdir(), 'af-fields-profile-'))
  const open = (): Promise<BrowserContext> =>
    chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } })
  try {
    const context = await open()
    let page: Page = await context.newPage()
    await newGame(page, site.url, 'Waits Game')
    await openFromRail(page, 'Schematic')
    const door = await readField(page, 'spinbutton', 'Waits', 0)
    const windowWaits0 = await readField(page, 'spinbutton', 'Waits', 2)
    expect(windowWaits0).toBe(door)
    await typeKeep(page, page.getByRole('spinbutton', { name: 'Waits' }).nth(2), '7')
    await page.close({ runBeforeUnload: false })

    page = await context.newPage()
    await page.goto(site.url)
    await openFromRail(page, 'Schematic')
    const windowWaits = page.getByRole('spinbutton', { name: 'Waits', exact: true }).nth(2)
    await shown(page, windowWaits)
    await expect(windowWaits).toHaveValue('7')
    expect(await readField(page, 'spinbutton', 'Waits', 0)).toBe(door)
    await context.close()
  } finally {
    await site.stop()
    rmSync(profile, { recursive: true, force: true })
  }
})
