import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { BASE_3D, expect, test } from '../harness/fixtures.ts'
import {
  chooseSelectTool,
  chooseThingsTool,
  dragThing,
  meanLuminance,
  openLevels3d,
  selectRoomAt,
  setCardField,
  setTimeOfDay,
} from '../harness/levels-3d.ts'
import { runGame } from '../harness/run-game.ts'

// Levels 3D, "an edit reaches the game" (plan 16.1e; the Owner's rule that a build is audited by making and playing): a
// crate moved, a floor raised and the time of day changed in the real editor are saved into the room's file on disk, and
// the game, run from the checkout over that copy, draws the crate and the floor where the editor put them, in the time
// it was given. The time is checked on the picture: the game at Night draws darker than the same room played first, by day.

// Away from Emberwick's journeys (6100 to 6300) and the save journey (6410 to 6420).
const GAME_PORT = 6430 + Number(process.env.TEST_PARALLEL_INDEX ?? 0)
/** The same room played by day, for the picture to be compared with. */
const DAY_PORT = GAME_PORT + 5

test.use({ source: BASE_3D })

/** The game is played landscape (a portrait window shows its "turn your device" hint over it), whatever the editor's size. */
const LANDSCAPE = { width: 1194, height: 834 }

/** The lines the file has now that it did not have before (a member added shifts the rest, so this is not by position). */
const changedLines = (before: string, after: string): number => {
  const old = new Map<string, number>()
  for (const line of before.split('\n')) old.set(line, (old.get(line) ?? 0) + 1)
  return after.split('\n').filter((line) => {
    const left = old.get(line) ?? 0
    old.set(line, left - 1)
    return left <= 0
  }).length
}

/**
 * Gets to the room as a player does (a key at the title, "New game" in the slot list; a copy that already has a save
 * goes straight in), then reads the room's brightness.
 */
async function litPicture(play: Page): Promise<number> {
  const title = play.getByText('Press any key or tap')
  const newGame = play.getByRole('button', { name: 'New game' })
  const playing = play.getByRole('button', { name: 'Pause' })
  await expect(title.or(newGame).or(playing)).toBeVisible({ timeout: 30_000 })
  if (await title.isVisible()) await play.keyboard.press('Enter')
  await expect(newGame.or(playing)).toBeVisible()
  if (await newGame.isVisible()) await newGame.click()
  await expect(playing).toBeVisible()
  const canvas = play.locator('canvas').first()
  await expect(canvas).toBeVisible()
  // The room fills the canvas with its colours; the title and the slot list were words on black.
  await expect.poll(() => meanLuminance(play, canvas), { timeout: 30_000 }).toBeGreaterThan(0.05)
  await play.waitForTimeout(1000)
  return meanLuminance(play, canvas)
}

test('a crate moved, a floor raised and a new time of day in Levels 3D are what the game plays', async ({
  page,
  game,
  editor,
}) => {
  // Two copies of the game are started, one for each time of day.
  test.setTimeout(240_000)
  const room = join(game.dir, 'content/levels/room.af-sector.json')
  const before = readFileSync(room, 'utf8')

  // The room as the game ships it, played first: the picture the Night below is compared with.
  const byDay = await runGame(BASE_3D, game.dir, DAY_PORT, { VITE_AF_JOURNEYS: '1' })
  let dayLight = 0
  try {
    const play = await page.context().newPage()
    await play.setViewportSize(LANDSCAPE)
    await play.goto(byDay.url)
    await expect(play.locator('html')).toHaveAttribute('data-time', 'day')
    dayLight = await litPicture(play)
    await play.close()
  } finally {
    await byDay.stop()
  }

  await openLevels3d(page, editor, 'Room')

  await setTimeOfDay(page, 'Night')
  await expect.poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 }).toContain('"time": "night"')

  await chooseThingsTool(page)
  await dragThing(page, [4, 6.5], [3, 6.5])
  await chooseSelectTool(page)
  await selectRoomAt(page, [0, 14])
  await setCardField(page, 'Floor', '0.5')

  await expect.poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 }).toContain('"at": [3, 6.5]')
  await expect.poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 }).toMatch(/"floor": 0\.5/)
  expect(changedLines(before, readFileSync(room, 'utf8'))).toBeLessThanOrEqual(4)

  let nightLight = 0
  // The game's dev server from the checkout, reading the copy's content, with the journeys' flag for what it writes.
  const running = await runGame(BASE_3D, game.dir, GAME_PORT, { VITE_AF_JOURNEYS: '1' })
  try {
    const play = await page.context().newPage()
    await play.setViewportSize(LANDSCAPE)
    await play.goto(running.url)
    await expect(play.locator('html')).toHaveAttribute('data-props', /crate-2:3\.00,6\.50/)
    await expect(play.locator('html')).toHaveAttribute('data-floors', /middle:0\.50/)
    await expect(play.locator('html')).toHaveAttribute('data-time', 'night')
    nightLight = await litPicture(play)
  } finally {
    await running.stop()
  }

  // The Night is on the picture, not only in the page's words: darker than the room played before the edit.
  expect(nightLight).toBeLessThan(dayLight * 0.8)
})
