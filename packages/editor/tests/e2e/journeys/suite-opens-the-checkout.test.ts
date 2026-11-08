import { expect, test } from '../harness/fixtures.ts'
import { runEditor } from '../harness/run-editor.ts'

// Spec section 9, "The suite opens the checkout" (E5): `automata editor --app suite` on a game opens that game, not the
// sample one the suite page shows when no checkout answers. Chromium at iPad size only: the suite ships with the 3D
// slice (D3), and its phone layout, whose top bar leaves out the game's name, is that slice's too.

test('the suite served on a game opens that game, with its room in Levels 2D', async ({
  page,
  game,
}, info) => {
  test.skip(
    info.project.name !== 'editor-ipad-chromium',
    'The suite is checked in Chromium at iPad size until it ships (D3).',
  )
  const suite = await runEditor(game.dir, ['--app', 'suite'])
  try {
    await page.goto(suite.url)
    await expect(page.getByRole('banner').getByText('Emberwick', { exact: true })).toBeVisible()
    // The game's room, by its file's name, under Levels 2D.
    const levels = page.getByRole('region', { name: 'Levels 2D' })
    await expect(levels.getByRole('button', { name: 'Room 1' }).first()).toBeVisible()
    await expect(page.getByText('Sample game')).toHaveCount(0)
  } finally {
    await suite.stop()
  }
})
