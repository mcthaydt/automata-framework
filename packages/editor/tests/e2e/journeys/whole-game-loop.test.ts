import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cellOnScreen, LEVEL_BACKGROUND, pressGame } from '../harness/complete-game.ts'
import { checkLevels, EMBERWICK, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'

// The whole loop a person makes a game in, with nothing copied by hand and one command running: `automata
// create-game`, then `automata editor` on the new game, which opens the editors and starts the game beside them. A
// wall painted in the editor is saved into the game's level file, Play opens the running game with the wall in it,
// and Publish builds the game into one zip, ready to upload, that holds the wall too.

/** The starter level's cells: 512 px across 32 of them. */
const STARTER_TILE = 16
/** Row 2 of the starter level, before and after a wall at column 5. The starter's own wall down column 16 is in every row. */
const EMPTY_ROW = '".*32", ".*32", ".*32", ".*32"'
const WALLED = '".*5 1 .*10 1 .*15"'
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
    await expect.poll(() => readFileSync(levelFile, 'utf8'), { timeout: 30_000 }).toContain(WALLED)
    const check = await checkLevels(game.dir)
    expect(check.code, check.output).toBe(0)

    // Play: the game the command started opens in a new tab, the level it runs has the wall, and past the game's own
    // title screen the wall is on the screen where it was painted.
    const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
    await expect(play.locator('#game canvas')).toBeVisible({ timeout: 30_000 })
    const gameOrigin = new URL(play.url()).origin
    await expect
      .poll(async () => (await fetch(`${gameOrigin}/${CONTENT_MODULE}`)).text(), { timeout: 30_000 })
      .toContain(WALLED)
    await play.getByRole('button', { name: 'Play' }).click()
    // The wall's cell is drawn, and the cell beside it is still the empty level behind.
    const cell = (col: number) => cellOnScreen(play, { col, row: 2 }, STARTER_TILE)
    await expect.poll(() => cell(6), { timeout: 15_000 }).toEqual(LEVEL_BACKGROUND)
    expect(await cell(5)).toBeDefined()
    expect(await cell(5)).not.toEqual(LEVEL_BACKGROUND)
    await play.close()

    // Publish: the game is built and checked, and the person downloads one zip to upload.
    await pressGame(page, 'Publish')
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
    expect(code.some((text) => text.includes('.*5 1 .*10 1 .*15'))).toBe(true)
  } finally {
    await editor.stop()
    game.remove()
  }
})

// The level's tiles, drawn: a tile painted on the Decor layer is saved and drawn by the running game.
test('a tile painted in the editor is drawn in the running game', async ({ page, context }) => {
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
        { timeout: 30_000 },
      )
      .not.toBe('".*32"')
    const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
    await play.getByRole('button', { name: 'Play' }).click()
    // The level is on the screen (the cell is undefined until it is), and the tile's cell is drawn over its background.
    await expect
      .poll(() => cellOnScreen(play, { col: 5, row: 4 }, STARTER_TILE), { timeout: 30_000 })
      .toBeDefined()
    await expect
      .poll(() => cellOnScreen(play, { col: 5, row: 4 }, STARTER_TILE), { timeout: 30_000 })
      .not.toEqual(LEVEL_BACKGROUND)
  } finally {
    await editor.stop()
    game.remove()
  }
})
