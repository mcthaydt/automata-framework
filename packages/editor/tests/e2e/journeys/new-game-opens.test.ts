import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLevels, EMBERWICK, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { runEditor } from '../harness/run-editor.ts'
import { runGame } from '../harness/run-game.ts'

// Plan task 13.3: a game fresh from `automata create-game` opens in `automata editor` with no flags, a wall painted
// into its starter level and saved is in its level file, and the game's dev server compiles it into the content the
// game reads.

const GAME_PORT = 6430 + Number(process.env.TEST_PARALLEL_INDEX ?? 0)
/** The starter level's cells: 512 px across 32 of them. */
const STARTER_TILE = 16
/** Where Vite serves the compiled content module the game imports. */
const CONTENT_MODULE = '@id/__x00__virtual:automata/content'

test('a new game opens in the editor, and a wall saved there reaches the game', async ({ page }) => {
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  const running = await runGame(game.dir, game.dir, GAME_PORT)
  try {
    const levelFile = join(game.dir, 'content/levels/start.toml')
    // Row 2 of the starter level is empty sky.
    expect(readFileSync(levelFile, 'utf8')).toContain('rows = [ ".*32", ".*32", ".*32", ".*32"')

    await openRoom(page, editor, 'Levels')
    await paintWall(page, { col: 5, row: 2 }, STARTER_TILE)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    expect(readFileSync(levelFile, 'utf8')).toContain('rows = [ ".*32", ".*32", ".*5 1 .*26", ".*32"')
    const check = await checkLevels(game.dir)
    expect(check.code, check.output).toBe(0)
    // The compiled level's collision rows: the third now holds the wall.
    await expect
      .poll(async () => (await fetch(`${running.url}${CONTENT_MODULE}`)).text())
      .toContain('".*5 1 .*26"')
  } finally {
    await running.stop()
    await editor.stop()
    game.remove()
  }
})
