import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { openEditor, playFromEditors } from '../harness/complete-game.ts'
import { EMBERWICK, expect, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { type RunningEditor, runEditor } from '../harness/run-editor.ts'

// What a person makes in the editors is still there when they come back (the Owner, 2026-11-08: "progress doesn't save").
// A new 2D game gets a new line for the keeper in Writer, a key in the Tuner and the Light look on Home. Then the page is
// reloaded, the tab is closed and another opened, and the editor itself is stopped and started again in a fresh browser:
// each time, the line, the key and the look are what was left. Last, the game is played and the keeper says the new line.

const LINE = 'Back again? The gate is still shut.'

/** Writer's first line, the Tuner's Left keys and the look, as the editors show them now. */
async function expectTheWork(page: Page, editor: RunningEditor): Promise<void> {
  await openEditor(page, editor, 'Writer')
  await expect(page.getByRole('textbox', { name: 'What it says' }).first()).toHaveValue(LINE)
  await openEditor(page, editor, 'Tuner')
  await expect(page.getByTestId('controls-row-left').getByText('J', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
}

test('a line, a key and the look survive a reload, a closed tab and a restarted editor', async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(300_000)
  const game = await newGame(EMBERWICK)
  let editor = await runEditor(game.dir)
  try {
    // The editors open Dark; the person picks Light on Home.
    await page.goto(editor.url)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('radio', { name: 'Light', exact: true }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await openEditor(page, editor, 'Writer')
    const words = page.getByRole('textbox', { name: 'What it says' }).first()
    await words.fill(LINE)
    await words.blur()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/lines/keeper.toml'), 'utf8'), { timeout: 30_000 })
      .toContain(LINE)

    await openEditor(page, editor, 'Tuner')
    const left = page.getByTestId('controls-row-left')
    await left.getByRole('button', { name: 'Add key' }).click()
    await page.keyboard.press('KeyJ')
    await expect(left.getByText('J', { exact: true })).toBeVisible()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/controls.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('"KeyJ"')

    // Reloaded.
    await page.reload()
    await expectTheWork(page, editor)

    // The tab closed, and the editors opened again in another.
    await page.close()
    const again = await context.newPage()
    await again.goto(editor.url)
    await expectTheWork(again, editor)

    // The editor stopped and started again, in a browser that has never seen it (the look is the browser's own choice,
    // so it is chosen again there; the game's work is in its folder).
    await editor.stop()
    editor = await runEditor(game.dir)
    const size = again.viewportSize()
    const fresh = await browser.newContext({
      ...(size === null ? {} : { viewport: size }),
      hasTouch: test.info().project.use.hasTouch ?? false,
      isMobile: test.info().project.use.isMobile ?? false,
    })
    const reopened = await fresh.newPage()
    await reopened.goto(editor.url)
    await expect(reopened.locator('html')).toHaveAttribute('data-theme', 'dark')
    await reopened.getByRole('radio', { name: 'Light', exact: true }).check()
    await expectTheWork(reopened, editor)

    // Played: the keeper says the line written in Writer.
    const play = await playFromEditors(reopened, fresh)
    await play.keyboard.down('ArrowRight')
    try {
      await expect(play.getByText(LINE)).toBeVisible({ timeout: 15_000 })
    } finally {
      await play.keyboard.up('ArrowRight')
    }
    await fresh.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})
