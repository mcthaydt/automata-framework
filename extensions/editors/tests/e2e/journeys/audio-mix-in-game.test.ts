import { heardParams, recordAudioParams } from '../harness/audio-graph-probe.ts'
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

// What a person sets in Audio's Mix is what the played game plays. The overall volume is turned down and a duck is made
// (a menu sound quiets the music by 12 dB); the game the editor started is then played to the keeper, whose line plays the
// story's own sound on the menu bus. The browser is asked what levels the game set: the overall volume, and the glide the
// duck makes. Check the sounds renders the sounds in the real page, finds a sound turned up too loud, and marks the
// finding out of date once the sound changes.

const AUDIO = 'content/audio/audio.toml'

test('the overall volume and a duck set in Mix are what the played game plays', async ({
  page,
  context,
  editor,
  story,
}) => {
  await openEditor(page, editor, 'Audio')
  await pressInList(page, 'Mix')
  const volume = page.getByLabel('Overall volume')
  await volume.fill('0.3')
  await volume.press('Enter')
  await savedInto(story, AUDIO, 'master_gain = 0.3')

  await page.getByRole('button', { name: 'Quiet something while a sound plays' }).click()
  const duck = page.getByRole('group', { name: /While a voice plays/ })
  await duck.getByLabel('While this plays').selectOption('ui')
  const drop = page.getByRole('group', { name: /While a menu sound plays/ }).getByLabel('It drops by')
  await drop.fill('12')
  await drop.press('Enter')
  await savedInto(story, AUDIO, 'db = -12')
  // The duck is a section like the file's other tables, never an inline table at the top.
  await savedInto(story, AUDIO, '[[duck]]')
  await servedWith(editor, '"master_gain": 0.3')

  const game = await context.newPage()
  await game.addInitScript(recordAudioParams)
  await playStory(game, editor)
  await walkToKeeper(game)
  await expect
    .poll(
      async () =>
        (await heardParams(game)).some((one) => one.how === 'value' && Math.abs(one.level - 0.3) < 1e-6),
      { message: 'the game plays its sounds through the overall volume 0.3' },
    )
    .toBe(true)
  const twelve = 10 ** (-12 / 20)
  await expect
    .poll(
      async () =>
        (await heardParams(game)).some(
          (one) => one.how === 'setTargetAtTime' && Math.abs(one.level - twelve) < 1e-6,
        ),
      { message: 'the music glides down by 12 dB while the menu sound plays' },
    )
    .toBe(true)
})

test('Check the sounds finds a sound that is too loud, in the real page, and marks it out of date after a change', async ({
  page,
  editor,
}) => {
  await openEditor(page, editor, 'Audio')
  await page.getByRole('button', { name: 'Check the sounds' }).click()
  await expect(page.getByText('Checked: nothing to fix.')).toBeVisible({ timeout: 30_000 })

  const loudness = page.getByRole('article', { name: 'Tone' }).getByLabel('Loudness')
  await loudness.fill('1')
  await loudness.press('Enter')
  await expect(page.getByText('Changed since it was checked. Check the sounds again.')).toBeVisible()
  await page.getByRole('button', { name: 'Check the sounds' }).click()
  await expect(page.getByText(/^Too loud at its peak: /)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('article', { name: 'Tone' }).getByLabel('Loudness').fill('0.2')
  await page.getByRole('article', { name: 'Tone' }).getByLabel('Loudness').press('Enter')
  await expect(page.getByText('Changed since it was checked. Check the sounds again.')).toBeVisible()
  await expect(page.getByText(/^Too loud at its peak: /)).toBeHidden()
})
