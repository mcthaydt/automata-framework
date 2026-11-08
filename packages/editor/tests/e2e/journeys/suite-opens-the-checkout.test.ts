import { expect, test } from '../harness/fixtures.ts'
import { runEditor } from '../harness/run-editor.ts'

// Spec section 9, "The suite opens the checkout" (E5): `automata editor` on a game opens that game, not the sample one
// the suite page shows when no checkout answers. Chromium at iPad size only: the phone layout, whose top bar leaves out
// the game's name, is task 15.4's.

test('the suite served on a game opens that game, with its room in Levels', async ({ page, game }, info) => {
  test.skip(
    info.project.name !== 'editor-ipad-chromium',
    'The phone top bar leaves out the game’s name until task 15.4.',
  )
  const suite = await runEditor(game.dir)
  try {
    await page.goto(suite.url)
    await expect(page.getByRole('banner').getByText('Emberwick', { exact: true })).toBeVisible()
    // The game's room, by its file's name, under Levels 2D.
    const levels = page.getByRole('region', { name: 'Levels' })
    await expect(levels.getByRole('button', { name: 'Room 1' }).first()).toBeVisible()
    await expect(page.getByText('Sample game')).toHaveCount(0)
  } finally {
    await suite.stop()
  }
})
