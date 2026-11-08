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
import { newGame } from '../harness/new-game.ts'
import { runEditor } from '../harness/run-editor.ts'
import { runGame } from '../harness/run-game.ts'

// The make-and-play check for a game fresh from `automata create-game --template 3d` (the Owner's rule that a build is
// audited by making and playing): the room is opened in Levels 3D, given the night, a crate moved and a floor raised,
// each saved into the room's file; the game, run from the new folder, plays the room darker than it played before.

// Away from the other journeys' ports (6100 to 6430 and the day copy's 6435).
const GAME_PORT = 6450 + Number(process.env.TEST_PARALLEL_INDEX ?? 0)
const DAY_PORT = GAME_PORT + 5
/** The game is played landscape (a portrait window shows its "turn your device" hint over it), whatever the editor's size. */
const LANDSCAPE = { width: 1194, height: 834 }

/** Presses Play on the title, then reads the brightness of the game's canvas once the room has drawn (black until). */
async function lit(play: Page): Promise<number> {
  await play.getByRole('button', { name: 'Play' }).click()
  const canvas = play.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => meanLuminance(play, canvas), { timeout: 30_000 }).toBeGreaterThan(0.03)
  await play.waitForTimeout(1000)
  return meanLuminance(play, canvas)
}

test('a new 3D game plays the night, the crate and the floor an editor gave its room', async ({ page }) => {
  test.setTimeout(240_000)
  const game = await newGame(BASE_3D, 'hall-game', '3d')
  const editor = await runEditor(game.dir)
  try {
    const room = join(game.dir, 'content/levels/room.af-sector.json')
    expect(readFileSync(room, 'utf8')).not.toContain('"time"')

    // The room as `create-game` made it, played first: the picture the night below is compared with.
    const day = await runGame(game.dir, game.dir, DAY_PORT)
    let dayLight = 0
    try {
      const play = await page.context().newPage()
      await play.setViewportSize(LANDSCAPE)
      await play.goto(day.url)
      dayLight = await lit(play)
      await play.close()
    } finally {
      await day.stop()
    }

    await openLevels3d(page, editor, 'Room')

    await setTimeOfDay(page, 'Night')
    await expect.poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 }).toContain('"time": "night"')
    await chooseThingsTool(page)
    await dragThing(page, [3.5, 2.8], [2.5, 2.8])
    await chooseSelectTool(page)
    await selectRoomAt(page, [0, 0.5])
    await setCardField(page, 'Floor', '0.5')
    await expect.poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 }).toMatch(/"floor": 0\.5/)
    expect(readFileSync(room, 'utf8')).toContain('"at": [2.5, 2.8]')

    const night = await runGame(game.dir, game.dir, GAME_PORT)
    let nightLight = 0
    try {
      const play = await page.context().newPage()
      await play.setViewportSize(LANDSCAPE)
      await play.goto(night.url)
      nightLight = await lit(play)
    } finally {
      await night.stop()
    }
    expect(nightLight).toBeLessThan(dayLight * 0.8)
  } finally {
    await editor.stop()
    game.remove()
  }
})
