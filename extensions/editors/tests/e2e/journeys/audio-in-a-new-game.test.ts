import { join } from 'node:path'
import { expect, openEditor, pressInList, savedInto, servedWith, test as base } from '../harness/fixtures.ts'
import { heardParams, recordAudioParams } from '../harness/audio-graph-probe.ts'
import { newGame } from '../harness/new-game.ts'
import { runEditor } from '../harness/run-editor.ts'

// A game made with `create-game` plays what Audio sets, with nothing copied by hand. The new game ships a `bump` sound for
// the square meeting a wall; the overall volume is turned down in Mix, and the square is walked into the wall of the
// starter level. The browser is asked what levels the game set when the sound played.

const test = base

test('a new game plays the bump sound at the overall volume set in Mix', async ({ page, context }) => {
  test.setTimeout(180_000)
  const game = await newGame()
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Audio')
    await expect(page.getByRole('heading', { name: 'bump' })).toBeVisible()
    await pressInList(page, 'Mix')
    const volume = page.getByLabel('Overall volume')
    await volume.fill('0.4')
    await volume.press('Enter')
    await savedInto({ dir: game.dir, remove: game.remove }, join('content/audio/audio.toml'), 'master_gain = 0.4')
    await servedWith(editor, '"master_gain": 0.4')

    const play = await context.newPage()
    await play.addInitScript(recordAudioParams)
    await play.goto(editor.gameUrl)
    await expect(play.locator('#game canvas')).toBeVisible({ timeout: 30_000 })
    // The page may play sound after a tap: Play on the menu is that tap. The square is then pushed left into the wall.
    await play.getByRole('button', { name: 'Play' }).click()
    await play.keyboard.down('ArrowLeft')
    try {
      await expect
        .poll(
          async () =>
            (await heardParams(play)).some((one) => one.how === 'value' && Math.abs(one.level - 0.4) < 1e-6),
          { timeout: 30_000, message: 'the new game plays its bump through the overall volume 0.4' },
        )
        .toBe(true)
    } finally {
      await play.keyboard.up('ArrowLeft')
    }
  } finally {
    await editor.stop()
    game.remove()
  }
})
