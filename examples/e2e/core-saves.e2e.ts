import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'

// The saves flow under the fake host and Ruken's CSP (M5.2 plan step 16): a game with `saves` lists its slots on the
// title, keeps the one being played saved, and a second session on the same account lists and continues it (S-c).
// Another device's change to the slot being played is told in a Toast and offered at the next pause (M5-D6); the
// fake host pushes a change only through a conflict the player answers "theirs" (Ruken request R-7). Without the
// saves grant, paused says nothing is kept.
const origin = `http://localhost:${examplesPort}`
const KEY = 'walk.slot.0'

interface HostHooks {
  hostSlots(): Record<string, string>
  hostRemoteWrite(key: string, value: string, deviceLabel: string): void
  hostBridge: { resolveConflict(key: string, choice: 'mine' | 'theirs'): Promise<void> }
}
type Envelope = { format: 1; savedAt: number; label?: string; data: { x: number; y: number } }

const accountSlot = async (page: Page): Promise<string | undefined> =>
  page.evaluate((key) => (window as unknown as HostHooks).hostSlots()[key], KEY)
const status = (frame: Frame) => frame.locator('[data-save-status]')

/** From the title: New game in the first slot, then play. */
async function startNewGame(frame: Frame): Promise<void> {
  await frame.getByTestId('save-slots-new').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
}

/** Walks right a moment, then pauses and waits for the host to say it has the progress. */
async function walkAndPause(frame: Frame): Promise<void> {
  await frame.locator('body').press('ArrowRight', { delay: 300 })
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'saved')
}

test('a second session lists the slot with its label, and Continue plays equal data (S-c)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves')
  await expect(frame.locator('[data-save-slots] [data-save-slot][data-kind="empty"]')).toHaveCount(3)
  await startNewGame(frame)
  await walkAndPause(frame)
  const written = await accountSlot(page)
  const envelope = JSON.parse(written ?? 'null') as Envelope
  expect(envelope.label).toBe('Walk 1')
  expect(envelope.data.x).toBeGreaterThan(160)

  // A new session: the game reloads in its frame, and the host keeps the player's account.
  await frame.evaluate(() => window.location.reload())
  await expect(frame.locator('[data-save-slot="0"][data-kind="ready"]')).toContainText('Walk 1')
  await frame.getByTestId('save-slots-load').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'saved')
  // The loaded game is where the first one stopped: pausing it wrote nothing new.
  expect(await accountSlot(page)).toBe(written)
  expect(errors).toEqual([])
})

test('another device changes the slot: a Toast in play, then Load newer at the pause plays their progress (M5-D6)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves')
  await startNewGame(frame)
  await walkAndPause(frame)
  const mine = JSON.parse((await accountSlot(page)) ?? 'null') as Envelope
  const theirs = JSON.stringify({
    ...mine,
    label: 'Desk PC',
    savedAt: mine.savedAt + 1,
    data: { x: 300, y: 90 },
  })

  await frame.getByTestId('resume').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await page.evaluate(
    ([key, value]) =>
      (window as unknown as HostHooks).hostRemoteWrite(key as string, value as string, 'Desk PC'),
    [KEY, theirs],
  )
  // This game's progress moves, and pausing writes it: that write loses to the other device's.
  await frame.locator('body').press('ArrowLeft', { delay: 300 })
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'conflict')

  // The player answers the host's question "theirs": the host tells the game the slot changed.
  await frame.getByTestId('resume').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await page.evaluate(
    (key) => (window as unknown as HostHooks).hostBridge.resolveConflict(key, 'theirs'),
    KEY,
  )
  await expect(frame.getByTestId('changed-elsewhere')).toContainText(
    'Your progress changed on another device',
  )
  await expect(frame.getByTestId('play-screen')).toBeVisible()

  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('load-newer')).toBeVisible()
  await expect(frame.getByTestId('keep-playing')).toBeVisible()
  await frame.getByTestId('load-newer').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  // The host says `recovered` after a conflict answered, and keeps saying it until the next write.
  await expect(status(frame)).toHaveAttribute('data-state', /^(saved|recovered)$/)
  // Their progress is what plays, and pausing it wrote nothing over it.
  expect(await accountSlot(page)).toBe(theirs)
  expect(errors).toEqual([])
})

test('without the saves grant, paused says progress will not be kept', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves', { grant: [] })
  await startNewGame(frame)
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'no-grant')
  await expect(status(frame)).toContainText("Progress won't be kept")
  expect(errors).toEqual([])
})
