import {
  expect,
  openEditor,
  playStory,
  savedInto,
  servedWith,
  test,
  walkToKeeper,
} from '../harness/fixtures.ts'

// What a person writes in Writer is what the game says. The keeper's first line and the cutscene's caption are rewritten in
// the editor, which saves them into the game's folder by itself. The game the editor started is then played: the keeper
// speaks the new words in the dialogue box, and the cutscene shows the new caption. Nothing here writes a game file.

const HELLO = 'Welcome, traveller. The gate is that way.'
const CAPTION = 'Later, at the old gate.'

test('the keeper’s words and the caption written in Writer are what the played game says', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Writer')
  const words = page.getByRole('textbox', { name: 'What it says' })
  await expect(words.first()).toHaveValue('Hello there. Mind the gate on your way out.')
  await words.first().fill(HELLO)
  await words.first().blur()
  // The caption is the last line of the keeper's scene.
  await words.last().fill(CAPTION)
  await words.last().blur()
  await savedInto(story, 'content/lines/keeper.toml', HELLO)
  await savedInto(story, 'content/lines/keeper.toml', CAPTION)
  await servedWith(editor, CAPTION)
  await servedWith(editor, HELLO)

  const game = await context.newPage()
  await playStory(game, editor)
  await walkToKeeper(game)
  await expect(game.getByText(HELLO)).toBeVisible()
  await game.getByRole('button', { name: /Show me the gate/ }).click()
  await game.getByRole('button', { name: 'Next' }).click()
  await expect(game.getByText(CAPTION)).toBeVisible()
  await expect(game.getByText('A moment later, at the gate.')).toHaveCount(0)
  await game.screenshot({ path: test.info().outputPath('caption-from-writer.png') })
})
