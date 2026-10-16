import { readFileSync, writeFileSync } from 'node:fs'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, test } from '@playwright/test'
import { devUrl, e2eRoomFile, GAME_ID, url } from './origin.ts'

// The content demo: its build boots under the fake host, ready and quiet; its dev server swaps the room in place
// on a good save, and on a bad one keeps the last good room and shows the compiler's message until the fix.

test('the build boots under the fake host, ready and quiet, with its content embedded', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await openHosted(page, url, GAME_ID)
  await expect(frame.locator('#game')).toHaveAttribute('data-content-hash', /^[0-9a-f]{16}$/)
  await expect(frame.locator('#game')).toHaveAttribute('data-tick', /\d+/)
  expect(errors).toEqual([])
})

test.describe('the dev server', () => {
  // One test edits the shared copy of the room, so these run one at a time.
  test.describe.configure({ mode: 'serial' })
  let original = ''
  test.beforeAll(() => {
    original = readFileSync(e2eRoomFile, 'utf8')
  })
  test.afterEach(() => writeFileSync(e2eRoomFile, original))

  test('swaps the room in place on a save, keeps it through a bad save, and recovers', async ({ page }) => {
    const errors = await collectErrors(page)
    await page.goto(devUrl)
    await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
    const game = page.locator('#game')
    const first = await game.getAttribute('data-content-hash')

    // A good save: Wick starts one tile further right. The page is not reloaded, so the marker survives.
    await page.evaluate(() => {
      ;(window as unknown as { marker: string }).marker = 'same page'
    })
    writeFileSync(e2eRoomFile, original.replace('"#..P...', '"#...P..'))
    await expect(game).not.toHaveAttribute('data-content-hash', first ?? '')
    const second = await game.getAttribute('data-content-hash')
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('same page')

    // A bad save: a second P. The compiler names it; the room and its hash stay.
    writeFileSync(e2eRoomFile, original.replace('"#..P...', '"#..PP..'))
    await expect(page.getByText("content/room.toml didn't compile")).toBeVisible()
    await expect(page.getByText('needs exactly one P, found 2')).toBeVisible()
    await expect(game).toHaveAttribute('data-content-hash', second ?? '')

    // The fix clears the message and plays the fixed room.
    writeFileSync(e2eRoomFile, original)
    await expect(page.getByText("content/room.toml didn't compile")).toBeHidden()
    await expect(game).toHaveAttribute('data-content-hash', first ?? '')
    // The compiler's error goes to the dev server's log, not the page's console.
    expect(errors).toEqual([])
  })
})
