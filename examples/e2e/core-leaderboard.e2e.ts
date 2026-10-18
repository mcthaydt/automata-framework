import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

// The leaderboard flow under the fake host and Ruken's CSP (M5.7 plan step 9): a finished run's score reaches the
// host, and paused shows the board the host holds, the player's row marked (L-a). Offline, paused says so and
// shows no board kept on the device (L-b).
const origin = `http://localhost:${examplesPort}`

/**
 * Pauses until the board on paused reads `state`. Paused reads the board from the host each time it opens, so a run
 * that has not ended yet reads `empty`: resume, and look again. No sleeps: each try waits on the panel's state.
 */
async function pauseUntilBoard(frame: Frame, state: string): Promise<void> {
  const board = frame.locator('[data-leaderboard]')
  await expect
    .poll(
      async () => {
        await frame.locator('body').press('Escape')
        await expect(frame.getByTestId('paused-screen')).toBeVisible()
        await expect(board).not.toHaveAttribute('data-state', 'loading')
        const seen = await board.getAttribute('data-state')
        if (seen !== state) {
          await frame.locator('body').press('Escape')
          await expect(frame.getByTestId('play-screen')).toBeVisible()
        }
        return seen
      },
      { timeout: 15_000 },
    )
    .toBe(state)
}

test('core-leaderboard submits a finished run and shows the board on paused', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/leaderboard/`, 'core-leaderboard')
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  // A run ends every 120 ticks (two seconds) and its score goes to the host; until then the board is empty.
  await pauseUntilBoard(frame, 'entries')
  await expect(frame.locator('[data-leaderboard] [data-entry][data-me]')).toContainText('You')
  expect(errors).toEqual([])
})

test('offline, paused says so and shows no board', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/leaderboard/`, 'core-leaderboard', { offline: true })
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  const board = frame.locator('[data-leaderboard]')
  await expect(board).toHaveAttribute('data-state', 'offline')
  await expect(board).toContainText("You're offline")
  await expect(board.locator('[data-entry]')).toHaveCount(0)
  expect(errors).toEqual([])
})
