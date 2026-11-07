import { examplesPort } from '@automata/examples-runner/host/ports'
import { collectErrors, openHosted } from '@automata/examples-runner/host/testing'
import { expect, type Frame, test } from '@playwright/test'

// Rebinding under the fake host and Ruken's CSP (M4.4 plan step 12): Settings, reached from paused, rebinds a key
// through `Hosting.saves`, and a reload of the game keeps it (I-h). A key taken from another action leaves that
// one Not set (I-i). Action ids follow keys(): act-0 left, act-1 right, act-2 jump, act-3 fire.
const origin = `http://localhost:${examplesPort}`
const JUMP = 'act-2'
const FIRE = 'act-3'

/** From play to Settings' Controls tab: pause, Settings, then the tab. */
async function openSettings(frame: Frame): Promise<void> {
  await frame.getByTestId('play').click()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').press('Escape')
  await expect(frame.getByTestId('paused-screen')).toBeVisible()
  await frame.getByTestId('settings').click()
  await expect(frame.getByTestId('settings-screen')).toBeVisible()
  await frame.getByTestId('settings-tab-controls').click()
  await expect(frame.locator('[data-settings-section="controls"]')).toBeVisible()
}

const keyboardButton = (frame: Frame, action: string) =>
  frame.locator(`[data-control-row="${action}"] [data-rebind="keyboard"]`)
const controls = (frame: Frame) => frame.locator('[data-settings-section="controls"]')

/** Rebinds `action`'s key to `key` and waits for the section to say how it went. */
async function rebind(frame: Frame, action: string, key: string): Promise<void> {
  await keyboardButton(frame, action).click()
  await expect(controls(frame)).toHaveAttribute('data-state', 'capturing')
  await frame.locator('body').press(key)
}

test('a rebind is saved through the host and kept after a reload (I-h)', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/input-rebind/`, 'core-input-rebind')
  await openSettings(frame)
  await expect(keyboardButton(frame, JUMP)).toHaveText('Space')
  await rebind(frame, JUMP, 'KeyK')
  await expect(controls(frame)).toHaveAttribute('data-state', 'saved')
  await expect(keyboardButton(frame, JUMP)).toHaveText('K')

  // The game reloads in its frame; the host keeps the player's saves.
  await frame.evaluate(() => window.location.reload())
  await expect(frame.getByTestId('play')).toBeVisible()
  await openSettings(frame)
  await expect(keyboardButton(frame, JUMP)).toHaveText('K')
  expect(errors).toEqual([])
})

test('a key taken from another action leaves it Not set, and Escape cancels a capture (I-i, I-k)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, `${origin}/core/input-rebind/`, 'core-input-rebind')
  await openSettings(frame)
  await rebind(frame, JUMP, 'KeyF')
  await expect(controls(frame)).toHaveAttribute('data-state', 'saved')
  await expect(keyboardButton(frame, JUMP)).toHaveText('F')
  await expect(keyboardButton(frame, FIRE)).toHaveText('Not set')

  await rebind(frame, FIRE, 'Escape')
  await expect(controls(frame)).toHaveAttribute('data-state', 'list')
  await expect(frame.getByTestId('settings-screen')).toBeVisible()
  await expect(keyboardButton(frame, FIRE)).toHaveText('Not set')
  expect(errors).toEqual([])
})
