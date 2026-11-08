import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMBERWICK, expect, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { boxOf, readPng } from '../harness/read-png.ts'
import { runEditor } from '../harness/run-editor.ts'

// A control added in the Tuner is a control the played game has. A new game is made, "J" is added to Left in the Tuner's
// Controls section (the person presses the key themselves), saved by the editor, and the game's Play button opens it: held,
// J moves the square left. Nothing here writes a game file.

/** The player start's colour: the square is drawn as the player start looks in Characters. */
const SQUARE: readonly [number, number, number] = [0x22, 0xc5, 0x5e]

test('a key added to Left in the Tuner moves the played game’s square left', async ({ page, context }) => {
  test.setTimeout(180_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await page.goto(editor.url)
    await page.getByRole('tab', { name: 'Tuner' }).click()
    const left = page.getByTestId('controls-row-left')
    await left.getByRole('button', { name: 'Add key' }).click()
    await expect(page.getByText('Press a key on your keyboard.')).toBeVisible()
    await page.keyboard.press('KeyJ')
    await expect(left.getByText('J', { exact: true })).toBeVisible()
    const controls = join(game.dir, 'content/controls.toml')
    await expect
      .poll(() => readFileSync(controls, 'utf8'), { timeout: 30_000 })
      .toContain('keys = ["ArrowLeft", "KeyA", "KeyJ"]')

    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    const canvas = play.locator('#game canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    await play.getByRole('button', { name: /play/i }).first().click()
    await play.waitForTimeout(1500)
    const squareX = async (): Promise<number> => {
      const found = boxOf(readPng(await canvas.screenshot()), SQUARE)
      expect(found, 'the square is on the canvas').toBeDefined()
      return found?.x ?? 0
    }
    const before = await squareX()
    // Held, J moves the square a step a tick: look again until it has, so a slow page start is not a failure.
    await play.keyboard.down('KeyJ')
    await expect
      .poll(squareX, { message: 'the square moved left while J was held', timeout: 10_000 })
      .toBeLessThan(before)
    await play.keyboard.up('KeyJ')
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})
