import { examplesPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// Interface sounds (shared polish, item 4): every control sounds by default with no wiring, a control marked
// `data-sfx="back"` sounds differently, and one marked `data-sfx="none"` stays silent. The example's map records each
// name it is asked to play in `window.__uiSounds` before it plays it, so the journey reads what the page heard.
const origin = `http://localhost:${examplesPort}`

test('Play presses, Resume goes back, Mute stays silent', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/audio/ui-sounds/`, 'audio-ui-sounds')
  const heard = () => frame.evaluate(() => (window as unknown as { __uiSounds: string[] }).__uiSounds)

  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  expect(await heard()).toContain('press')

  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  const before = (await heard()).length

  // Mute is marked `none`: its consequence is its own sound.
  await frame.getByTestId('pause-mute').click()
  expect((await heard()).length).toBe(before)

  // Resume is the default press; Settings' Back and the quit dialog's Cancel are `back`.
  await frame.getByTestId('quit').click()
  await frame.getByTestId('quit-cancel').click()
  expect((await heard()).slice(before)).toContain('back')
  expect(errors).toEqual([])
})
