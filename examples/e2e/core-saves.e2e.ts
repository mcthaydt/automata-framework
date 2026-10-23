import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'

// The saves flow under the fake host and Ruken's CSP (M5.2 plan step 16): a game with `saves` lists its slots on the
// title, keeps the one being played saved, and a second session on the same account lists and continues it (S-c).
// Another device's change to the slot being played is told in a Toast and offered at the next pause (M5-D6); the
// fake host pushes a change only through a conflict the player answers "theirs" (Ruken request R-7). Without the
// saves grant, paused says nothing is kept.
//
// The fake host sends a write to its server one second after the last one (Ruken's `SYNC_DEBOUNCE_MS`) and says
// `saved` until then, so a check of the server waits for the value it expects, and a check that nothing was written
// closes the game first: the exit hands the host everything the game holds, and the host's server has it by then.
const origin = `http://localhost:${examplesPort}`
const KEY = 'walk.slot.0'
const START_X = 160
/** Long enough that a frame lands while the key is down, even on a loaded machine. */
const WALK_MS = 500
/** The host's one-second debounce, and the time to run its sync, with room. */
const SYNC_WAIT = { timeout: 10_000 }

interface HostHooks {
  hostSlots(): Record<string, string>
  hostRemoteWrite(key: string, value: string, deviceLabel: string): void
  hostBridge: {
    resolveConflict(key: string, choice: 'mine' | 'theirs'): Promise<void>
    exit(): Promise<void>
  }
}
type Envelope = {
  format: 1
  savedAt: number
  label?: string
  data: { x: number; y: number }
}

const accountSlot = async (page: Page): Promise<string | undefined> =>
  page.evaluate((key) => (window as unknown as HostHooks).hostSlots()[key], KEY)
const status = (frame: Frame) => frame.locator('[data-save-status]')

/** The host closes the game (Ruken's `session.exiting`): the game writes what it holds and the host syncs it. */
const closeGame = (page: Page): Promise<void> =>
  page.evaluate(() => (window as unknown as HostHooks).hostBridge.exit())

/** From the title: New game in the first slot, then play. */
async function startNewGame(frame: Frame): Promise<void> {
  await frame.getByTestId('save-slots-new').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
}

/**
 * Walks right a moment, pauses, and returns what the account holds once the host has synced the walk (the slot's
 * x has moved off the start).
 */
async function walkAndPause(page: Page, frame: Frame): Promise<string> {
  await frame.locator('body').press('ArrowRight', { delay: WALK_MS })
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect
    .poll(async () => (JSON.parse((await accountSlot(page)) ?? 'null') as Envelope | null)?.data.x ?? 0, {
      message: 'the host did not sync the walk',
      ...SYNC_WAIT,
    })
    .toBeGreaterThan(START_X)
  await expect(status(frame)).toHaveAttribute('data-state', 'saved', SYNC_WAIT)
  return (await accountSlot(page)) as string
}

test('a second session lists the slot with its label, and Continue plays equal data (S-c)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves')
  await expect(frame.locator('[data-save-slots] [data-save-slot][data-kind="empty"]')).toHaveCount(3)
  await startNewGame(frame)
  const written = await walkAndPause(page, frame)
  const envelope = JSON.parse(written) as Envelope
  expect(envelope.label).toBe('Walk 1')
  expect(envelope.data.x).toBeGreaterThan(START_X)

  // A new session: the game reloads in its frame, and the host keeps the player's account.
  await frame.evaluate(() => window.location.reload())
  await expect(frame.locator('[data-save-slot="0"][data-kind="ready"]')).toContainText('Walk 1')
  await frame.getByTestId('save-slots-load').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'saved')
  expect(errors).toEqual([])
  // The loaded game is where the first one stopped: pausing it and closing it wrote nothing new.
  await closeGame(page)
  expect(await accountSlot(page)).toBe(written)
})

test('another device changes the slot: a Toast in play, then Load newer at the pause plays their progress (M5-D6)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves')
  await startNewGame(frame)
  const mine = JSON.parse(await walkAndPause(page, frame)) as Envelope
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
  await frame.locator('body').press('ArrowLeft', { delay: WALK_MS })
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'conflict', SYNC_WAIT)

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

  // Opening the pause screen is a save trigger, and the other device's progress is not the game's to write over.
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('load-newer')).toBeVisible()
  await expect(frame.getByTestId('keep-playing')).toBeVisible()
  await frame.getByTestId('load-newer').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  // The host says `recovered` after a conflict answered, and keeps saying it until the next write.
  await expect(status(frame)).toHaveAttribute('data-state', /^(saved|recovered)$/)
  expect(errors).toEqual([])
  // Their progress is what plays, and pausing it and closing the game wrote nothing over it.
  await closeGame(page)
  expect(await accountSlot(page)).toBe(theirs)
})

test('without the saves grant, paused says progress will not be kept', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/saves/`, 'core-saves', {
    grant: [],
  })
  await startNewGame(frame)
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await expect(status(frame)).toHaveAttribute('data-state', 'no-grant')
  await expect(status(frame)).toContainText("Progress won't be kept")
  expect(errors).toEqual([])
})
