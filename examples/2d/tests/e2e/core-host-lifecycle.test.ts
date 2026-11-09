import { examplesPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, test } from '@playwright/test'

// The host's lifecycle under the fake host and Ruken's CSP (EX.4, from the host-lifecycle demo's e2e): when the
// host sends the game to the background (its drawer, an ad, a hidden tab) the runtime stops the sim and opens
// the pause screen, and the game plays on only when the player resumes. The runtime's units pin the rule
// (time.test.ts); this is the same journey on a real page.
const origin = `http://localhost:${examplesPort}`

test('core-host-lifecycle pauses when the host drawer opens and plays on after Resume', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/host-lifecycle/`, 'core-host-lifecycle')
  const setOverlay = (overlay: string) =>
    page.evaluate(
      (name) =>
        (window as unknown as { hostBridge: { setOverlay(o: string): void } }).hostBridge.setOverlay(name),
      overlay,
    )

  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()

  await setOverlay('drawer')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  // The host coming back does not play on by itself: the player is in the pause screen until they resume.
  await setOverlay('none')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()

  await frame.getByTestId('resume').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  expect(errors).toEqual([])
})
