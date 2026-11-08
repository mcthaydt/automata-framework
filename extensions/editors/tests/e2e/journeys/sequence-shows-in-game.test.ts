import {
  expect,
  openEditor,
  playStory,
  playToCutscene,
  savedInto,
  servedWith,
  test,
} from '../harness/fixtures.ts'

// What a person changes in Sequence is what the cutscene shows. The words step of the gate's cutscene is pointed at another
// line, and given a later start; Sequence saves into the game's folder by itself. The game the editor started is then
// played to the cutscene: the caption is the other line, and it is not there at the old time.

test('the caption a cutscene step is pointed at in Sequence is what the played game shows', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Sequence')
  await page.getByRole('button', { name: /^Words on screen, 0.5 s to 5.5 s/ }).click()
  await page.getByRole('spinbutton', { name: 'From' }).fill('2')
  await page.getByRole('spinbutton', { name: 'From' }).blur()
  await page.getByRole('combobox', { name: /line/i }).selectOption({ label: 'Safe travels.' })
  await savedInto(story, 'content/cutscenes/gate.toml', 'keeper.farewell')
  await savedInto(story, 'content/cutscenes/gate.toml', 't = 2')
  await servedWith(editor, 'keeper.farewell')

  const game = await context.newPage()
  await playStory(game, editor)
  await playToCutscene(game)
  await expect(game.getByText('Safe travels.').last()).toBeVisible()
  await expect(game.getByText('A moment later, at the gate.')).toHaveCount(0)
  await game.screenshot({ path: test.info().outputPath('caption-from-sequence.png') })
})
