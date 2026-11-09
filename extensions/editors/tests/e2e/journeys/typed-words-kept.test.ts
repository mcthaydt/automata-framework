import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { expect, openEditor, pressInList, savedInto, test } from '../harness/fixtures.ts'
import { serveSuitePage } from '../harness/static-page.ts'

// P14: words typed into a field were written only when the field was left, so a tab closed or a page reloaded with the
// cursor still in the field lost them, while the bar said "Saved". Each of these types without ever leaving the field,
// then reloads or closes the tab, and looks for the words: on the disk of the game the editor serves, and in the page
// the browser keeps.

const LINES = 'content/lines/keeper.toml'
const TYPED = 'Typed and never left the field.'
const FIRST = 'Hello there. Mind the gate on your way out.'

/** Types into the field the way a person does, key by key, and leaves the focus where it is. */
async function typeInto(
  page: Page,
  name: string,
  text: string,
  role: 'textbox' | 'spinbutton' = 'textbox',
): Promise<void> {
  const field = page.getByRole(role, { name }).first()
  await field.click()
  await field.press('ControlOrMeta+A')
  await field.pressSequentially(text)
}

/** Opens an editor from the rail, or from the rail's More menu when a phone's rail has no room for it. */
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

test('served: words typed in Writer and never left are on disk and back after a reload', async ({
  page,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Writer')
  await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(FIRST)
  await typeInto(page, 'What it says', TYPED)
  await savedInto(story, LINES, TYPED)
  await expect(page.getByRole('status').filter({ hasText: /Saved/ })).toHaveText(/Saved in your game folder/)
  await page.reload()
  await openEditor(page, editor, 'Writer')
  await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
})

test('served: a tab closed a moment after the last key still has its words next time', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Writer')
  await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(FIRST)
  await typeInto(page, 'What it says', TYPED)
  await page.close({ runBeforeUnload: false })
  // Nothing waited for a saved line: the page was gone inside the half second. The words arrive from the disk (the
  // keepalive write) or from the draft kept in the browser.
  const again = await context.newPage()
  await openEditor(again, editor, 'Writer')
  await expect(again.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
  await savedInto(story, LINES, TYPED)
})

test('served: a number typed in Feel and never left is on disk and back after a reload', async ({
  page,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Feel')
  await pressInList(page, 'Never more than')
  await typeInto(page, 'Most flash frames', '12', 'spinbutton')
  await savedInto(story, 'content/feel/feel.toml', '12')
  await page.reload()
  await openEditor(page, editor, 'Feel')
  await pressInList(page, 'Never more than')
  await expect(page.getByLabel('Most flash frames')).toHaveValue('12')
})

test('served: a control named in the Tuner and never left is on disk and back after a reload', async ({
  page,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Tuner')
  await typeInto(page, 'Name', 'Hop left')
  await savedInto(story, 'content/controls.toml', 'Hop left')
  await page.reload()
  await openEditor(page, editor, 'Tuner')
  await expect(page.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Hop left')
})

test('on the web, with no editor server: words typed in Writer survive a reload and a closed browser', async () => {
  const site = await serveSuitePage()
  const profile = mkdtempSync(join(tmpdir(), 'af-journey-profile-'))
  const open = () => chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } })
  try {
    const first = await open()
    const page = await first.newPage()
    await page.goto(`${site.url}?sample`)
    await openFromRail(page, 'Writer')
    const line = page.getByRole('textbox', { name: 'What it says' }).first()
    await expect(line).toBeVisible()
    await typeInto(page, 'What it says', TYPED)
    // The line says Saving… while words wait, then that the work is on this device: never "Saved" before it is.
    await expect(page.getByRole('status').filter({ hasText: /Saved on this device/ })).toBeVisible()
    await page.reload()
    // The page opens on the editor that was open, not on Home.
    await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
    // The whole browser closed, then opened again on the same profile.
    await first.close()
    const second = await open()
    const again = await second.newPage()
    await again.goto(`${site.url}?sample`)
    await expect(again.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(TYPED)
    await second.close()
  } finally {
    await site.stop()
    rmSync(profile, { recursive: true, force: true })
  }
})
