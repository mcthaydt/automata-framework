import {
  expect,
  openEditor,
  playStory,
  pressInList,
  savedInto,
  test,
  walkToKeeper,
} from '../harness/fixtures.ts'

// What a person sets up in Audio is what the game plays. Two music files are dropped into the game's folder (the editors
// import music, they never make it), Audio is told to use both, and the music rules are made: chase music while the game's
// `mode` is chase, calm music otherwise. Audio saves into the game's folder by itself. The game the editor started is then
// played to the guard, and the game's own record of what it played goes from the calm track to the chase one.

test.use({ tracks: ['calm.wav', 'chase.wav'] })

/** What the dev page recorded of what played (examples/2d-story/src/app/story-feel-audio.ts). */
const played = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      (globalThis as unknown as { __storyLog: { music: string | null; cues: string[]; tracks: string[] } })
        .__storyLog,
  )

test('music tracks and rules made in Audio are what the played game plays', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Audio')
  await pressInList(page, 'What music plays when')
  const tracks = page.getByRole('region', { name: 'Tracks in your game folder' })
  await expect(tracks.getByText('assets/music/calm.wav')).toBeVisible()
  await expect(tracks.getByText('assets/music/chase.wav')).toBeVisible()

  // Use both tracks. Using one opens it, so the rules page is opened again for the next.
  await tracks.getByRole('button', { name: 'Use this track' }).first().click()
  await expect(page.getByText('This track plays the file assets/music/calm.wav.')).toBeVisible()
  await pressInList(page, 'What music plays when')
  await page.getByRole('button', { name: 'Use this track' }).click()
  await expect(page.getByText('This track plays the file assets/music/chase.wav.')).toBeVisible()
  await pressInList(page, 'What music plays when')

  // Calm music otherwise, and chase music when the game's mode is chase, which must come first.
  await page.getByRole('button', { name: 'Add a rule' }).click()
  await expect(page.getByRole('article', { name: 'Otherwise: play calm' })).toBeVisible()
  await page.getByRole('button', { name: 'Add a rule' }).click()
  const second = page.getByRole('article', { name: 'Otherwise: play calm' }).nth(1)
  await second.getByLabel('Play').selectOption('chase')
  const chase = page.getByRole('article', { name: 'Otherwise: play chase' })
  await chase.getByRole('button', { name: 'Wait for something' }).click()
  await chase.getByLabel('What does the game keep track of?').fill('mode')
  await chase.getByLabel('Value').fill('chase')
  await chase.getByRole('button', { name: 'Add', exact: true }).click()
  await savedInto(story, 'content/audio/audio.toml', 'when = {mode = "chase"}')
  await page
    .getByRole('article', { name: 'When mode is chase: play chase' })
    .getByRole('button', { name: 'Move up' })
    .click()
  await expect(page.getByRole('article').first()).toHaveAccessibleName('When mode is chase: play chase')
  await savedInto(story, 'content/audio/audio.toml', 'chase')

  // Play the game the editor started. The story is calm; walking past the keeper into the yard, the guard sees the player.
  const game = await context.newPage()
  await playStory(game, editor)
  expect((await played(game)).tracks.sort()).toEqual(['calm', 'chase'])
  await expect.poll(async () => (await played(game)).music).toBe('calm')

  // The keeper speaks (the story's own sound plays), and the player passes on into the yard, where the guard hunts.
  await walkToKeeper(game)
  await expect.poll(async () => (await played(game)).cues).toContain('talk')
  await game.getByRole('button', { name: /Just passing through/ }).click()
  await game.getByRole('button', { name: 'Next' }).click()
  await game.keyboard.down('ArrowRight')
  try {
    await expect.poll(async () => (await played(game)).music, { timeout: 45_000 }).toBe('chase')
  } finally {
    await game.keyboard.up('ArrowRight')
  }
})
