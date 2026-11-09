import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { checkLevels, EMBERWICK, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'
import { runGame } from '../harness/run-game.ts'

// Spec section 9, "Save reaches the game": a wall painted in the real editor and saved is in the game's level file on
// disk, `automata check` agrees with it, and the running game starts over on it. Reopening the editor shows the same
// room: the work is kept, not just written.

// Each journey's game server gets its own port, away from Emberwick's own journeys (6100 to 6300).
const GAME_PORT = 6410 + Number(process.env.TEST_PARALLEL_INDEX ?? 0)

/**
 * The room as drawn: the layers' sheet on a phone closed (it covers the room), the pointer off it and the page's buttons
 * masked (a hover or a focus ring is not the room).
 */
async function roomPicture(page: Page): Promise<Buffer> {
  const layers = page.getByRole('button', { name: 'Layers' })
  const sheetOpen =
    (await layers.isVisible()) &&
    (await page.getByRole('button', { name: 'Collision Walls and floors' }).isVisible())
  if (sheetOpen) await layers.click()
  await page.mouse.move(0, 0)
  const canvas = page.locator('[data-level-canvas]')
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  return canvas.screenshot({ animations: 'disabled', mask: [page.getByRole('button')] })
}

test('a painted wall, saved, is in the level file, passes the check and reaches the running game', async ({
  page,
  game,
  editor,
}) => {
  const levelFile = join(game.dir, 'content/levels/room-1.toml')
  // Row 2 of the room is open floor between its two walls: "1 .*38 1".
  expect(readFileSync(levelFile, 'utf8')).toContain('"1 .*38 1", "1 .*38 1", "1 .*38 1"')

  const running = await runGame(EMBERWICK, game.dir, GAME_PORT)
  try {
    const gamePage = await page.context().newPage()
    await gamePage.goto(running.url)
    const screen = gamePage.locator('#game')
    await expect(screen).toHaveAttribute('data-content-hash', /^[0-9a-f]+$/)
    const before = await screen.getAttribute('data-content-hash')

    await openRoom(page, editor)
    await paintWall(page, { col: 5, row: 2 })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    const saved = await roomPicture(page)

    // On disk: row 2 has a wall at column 5 now (the edge wall, four open cells, the new wall, 33 open, the edge).
    expect(readFileSync(levelFile, 'utf8')).toContain('"1 .*38 1", "1 .*4 1 .*33 1", "1 .*38 1"')
    const check = await checkLevels(game.dir)
    expect(check.code, check.output).toBe(0)
    // The game's dev server compiled the new level and the game started over on it.
    await expect(screen).not.toHaveAttribute('data-content-hash', before ?? '')

    // Close the editor and open it again: the room comes back as it was saved.
    await openRoom(page, editor)
    expect((await roomPicture(page)).equals(saved), 'the saved room came back as it was').toBe(true)
  } finally {
    await running.stop()
  }
})
