import { openFromRail } from '../harness/complete-game.ts'
import { EMBERWICK, expect, openRoom, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { runEditor } from '../harness/run-editor.ts'
import { framesPng } from '../harness/tiles-picture.ts'

// The Tuner opens when it is the next thing a person does after working in Levels. A new game is made, the player start
// is given a picture in Characters (a change the editor saves), and the Tuner tab is opened for the first time. It must
// show the game's controls, not a list that does nothing when tapped (build audit M3: the suite lost the news that the
// Tuner had opened when another editor was already open).

test('the Tuner shows the controls when it is first opened after working in Characters', async ({ page }) => {
  // The Characters steps below are driven at the iPad's size, as the other Characters journeys are.
  test.skip((page.viewportSize()?.width ?? 0) < 600, 'Characters is not driven at phone size by journeys yet')
  test.setTimeout(120_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openRoom(page, editor, 'Start')
    await openFromRail(page, 'Characters')
    await page.getByRole('radio', { name: /Player start/ }).click()
    const details = page.getByRole('button', { name: 'Details' })
    if ((await details.getAttribute('aria-expanded')) === 'false') await details.click()
    await page.getByLabel('Choose a picture of frames').setInputFiles({
      name: 'Hero.png',
      mimeType: 'image/png',
      buffer: framesPng(16, 24, 2, [
        [200, 50, 50],
        [50, 200, 50],
      ]),
    })
    await expect(page.getByText('The picture has 2 frames.')).toBeVisible()

    await page.getByRole('tab', { name: 'Tuner' }).click()
    await expect(page.getByTestId('controls-row-left')).toBeVisible({ timeout: 15_000 })
    // The page shows the settings beside the game, not the list of files.
    await expect(page.getByTestId('tuner-split')).toBeVisible()
  } finally {
    await editor.stop()
    game.remove()
  }
})
