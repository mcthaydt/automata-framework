import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLevels, EMBERWICK, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'
import { cellColour, type LevelFrame } from '../harness/game-screen.ts'
import { newGame } from '../harness/new-game.ts'
import { readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'

// The whole loop a person makes a game in, with nothing copied by hand and one command running: `automata
// create-game`, then `automata editor` on the new game, which opens the editors and starts the game beside them. A
// wall painted in the editor is saved into the game's level file, Play opens the running game with the wall in it,
// and Publish builds the game into one zip, ready to upload, that holds the wall too.

/** The starter level's cells: 512 px across 32 of them. */
const STARTER_TILE = 16
/** Row 2 of the starter level, before and after a wall at column 5. */
const EMPTY_ROW = '".*32", ".*32", ".*32", ".*32"'
const WALLED_ROW = '".*32", ".*32", ".*5 1 .*26", ".*32"'
/** The starter level: 32 by 18 cells of 16 px. */
const STARTER: LevelFrame = { width: 512, height: 288, tile: STARTER_TILE }
/** The starter game's colour for a wall (`features/level/level.view.ts`), and the empty level behind it. */
const WALL_COLOUR = '73737f'
const EMPTY_COLOUR = '000000'
/** Where Vite serves the compiled content module the game imports. */
const CONTENT_MODULE = '@id/__x00__virtual:automata/content'

test('a new game is made, edited, saved, played and published from the editors alone', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    // Edit and save: each step is saved into the game's own level file as it is drawn.
    const levelFile = join(game.dir, 'content/levels/start.toml')
    expect(readFileSync(levelFile, 'utf8')).toContain(EMPTY_ROW)
    await openRoom(page, editor, 'Start')
    await paintWall(page, { col: 5, row: 2 }, STARTER_TILE)
    await expect.poll(() => readFileSync(levelFile, 'utf8'), { timeout: 30_000 }).toContain(WALLED_ROW)
    const check = await checkLevels(game.dir)
    expect(check.code, check.output).toBe(0)

    // Play: the game the command started opens in a new tab, and the level it runs has the wall.
    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    await expect(play.locator('#game canvas')).toBeVisible({ timeout: 30_000 })
    const gameOrigin = new URL(play.url()).origin
    await expect
      .poll(async () => (await fetch(`${gameOrigin}/${CONTENT_MODULE}`)).text(), { timeout: 30_000 })
      .toContain('".*5 1 .*26"')
    await play.close()

    // Publish: the game is built and checked, and the person downloads one zip to upload.
    await page.getByRole('button', { name: 'Publish' }).click()
    const dialog = page.getByRole('dialog', { name: 'Put your game online' })
    await dialog.getByRole('button', { name: 'Build my game' }).click()
    await expect(dialog.getByText('Your game is ready to upload.')).toBeVisible({ timeout: 120_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Download the zip' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('my-game-0.1.0-itch.zip')
    const files = readZip(await download.path())
    expect(files.has('index.html')).toBe(true)
    const code = [...files].filter(([name]) => name.endsWith('.js')).map(([, text]) => text)
    expect(code.some((text) => text.includes('.*5 1 .*26'))).toBe(true)
  } finally {
    await editor.stop()
    game.remove()
  }
})

// The level's tiles, drawn: a tile painted on the starter level's Decor layer, where no wall is, shows in the running
// game. Expected to fail until 2D core draws a level's tile layers (PR #479); the starter game draws only its walls
// today. When this starts passing, take out `test.fail`.
test('a tile painted in the editor is drawn in the running game', async ({ page, context }) => {
  test.fail(true, 'the 2D core draws no tile layers yet (PR #479)')
  test.setTimeout(120_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    const levelFile = join(game.dir, 'content/levels/start.toml')
    await openRoom(page, editor, 'Start')
    await paintWall(page, { col: 5, row: 4 }, STARTER_TILE, 'Decor Tiles')
    // Saved: the Decor layer's fifth row is no longer empty.
    await expect
      .poll(
        () =>
          /def = "decor"[\s\S]*?rows = \[(.*)\]/.exec(readFileSync(levelFile, 'utf8'))?.[1]?.split(', ')[4],
        {
          timeout: 30_000,
        },
      )
      .not.toBe('".*32"')
    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    await play.getByRole('button', { name: 'Play' }).click()
    await expect
      .poll(() => cellColour(play, STARTER, { col: 5, row: 4 }), { timeout: 15_000 })
      .not.toBe(EMPTY_COLOUR)
  } finally {
    await editor.stop()
    game.remove()
  }
})
