import {
  expect,
  openEditor,
  playStory,
  pressInList,
  savedInto,
  servedWith,
  test,
  walkToKeeper,
} from '../harness/fixtures.ts'

// What a person makes in Feel is what the game feels. In the editors, the cutscene's feel is given a word to show and a
// flash; Feel saves it into the game's folder by itself. The game the editor started is then played to the gate's cutscene,
// and the game's own record of what the player saw shows the word and the flash. Nothing here writes a game file.

const WORD = 'Here we go!'

/** What the dev page recorded of what the player saw (examples/2d-story/src/app/story-feel-audio.ts). */
const felt = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      (globalThis as unknown as { __storyLog: { felt: { shake: number; flash: number; words: string[] } } })
        .__storyLog.felt,
  )

test('a word and a flash given to the cutscene in Feel are what the played game shows', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Feel')
  await pressInList(page, 'When a cutscene starts')

  await page.getByRole('button', { name: 'Add an effect' }).click()
  await page.getByRole('button', { name: 'Show a word' }).click()
  await page.getByLabel('What it says').fill(WORD)
  await page.getByRole('button', { name: 'Add an effect' }).click()
  await page.getByRole('button', { name: 'Flash the screen' }).click()
  // A flash is two frames and the limit allows three, which a slow phone may never draw. The person raises the limit (the
  // "Never more than" page) and asks for a long flash.
  await page.getByLabel('How many frames').fill('30')
  await pressInList(page, 'Never more than')
  await page.getByLabel('Most flash frames').fill('30')
  await pressInList(page, 'When a cutscene starts')
  await savedInto(story, 'content/feel/feel.toml', 'flash_frames = 30')
  await savedInto(story, 'content/feel/feel.toml', WORD)
  await servedWith(editor, WORD)

  // Play the game the editor started: walk to the keeper, ask to see the gate, and the cutscene starts.
  const game = await context.newPage()
  await playStory(game, editor)
  expect((await felt(game)).words).toEqual([])
  await walkToKeeper(game)
  await game.getByRole('button', { name: /Show me the gate/ }).click()
  await game.getByRole('button', { name: 'Next' }).click()
  await expect(game.getByText('A moment later, at the gate.')).toBeVisible()

  await expect.poll(async () => (await felt(game)).words).toContain(WORD)
  const seen = await felt(game)
  expect(seen.flash).toBeGreaterThan(0)
  await game.screenshot({ path: test.info().outputPath('cutscene-with-feel.png') })
})

// What a person gets with no tuning: a feel added for a new event, with a shake given the editor's own numbers under the
// limits it came with, moves the screen. (The first journey raises a limit; this one must not need to.) The guard's changes of
// mode are offered among the events, in words, because the story lists its systems for the Schematic.
test('a shake added in Feel with its default numbers moves the played screen', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Feel')
  // The list is a sheet behind the Panel button on a phone; the picker for the event sits in it.
  const panel = page.getByRole('button', { name: 'Panel', exact: true })
  await expect(panel.or(page.getByRole('button', { name: 'Add a feel' })).first()).toBeVisible()
  if ((await panel.isVisible()) && (await panel.getAttribute('aria-expanded')) !== 'true') await panel.click()
  await page.getByRole('button', { name: 'Add a feel' }).click()
  await expect(page.getByRole('button', { name: 'a character changes mode' })).toBeVisible()
  await page.getByRole('button', { name: 'a conversation offers choices' }).click()
  if ((await panel.isVisible()) && (await panel.getAttribute('aria-expanded')) === 'true') await panel.click()
  await page.getByRole('button', { name: 'Add an effect' }).click()
  await page.getByRole('button', { name: 'Shake the screen', exact: true }).click()
  await savedInto(story, 'content/feel/feel.toml', 'narrative.choices')
  await servedWith(editor, 'narrative.choices')

  const game = await context.newPage()
  await playStory(game, editor)
  expect((await felt(game)).shake).toBe(0)
  await walkToKeeper(game)
  await expect.poll(async () => (await felt(game)).shake).toBeGreaterThan(0)
})
