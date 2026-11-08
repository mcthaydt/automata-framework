import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { checkLevels, EMBERWICK, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'
import { cellColours, type LevelFrame } from '../harness/game-screen.ts'
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
/** The starter game's colour for a wall (`features/level/level.view.ts`), and the empty level behind it. */
const WALL_COLOUR = '73737f'
const EMPTY_COLOUR = '000000'
/** The starter level: 32 by 18 cells of 16 px. */
const STARTER: LevelFrame = { width: 512, height: 288, tile: STARTER_TILE, wall: WALL_COLOUR }
/**
 * Plays or publishes: where the top bar has room these are two buttons, and on a phone they are the two choices of the
 * Game menu. Either way it is what a person presses.
 */
async function pressGame(page: Page, action: 'Play' | 'Publish'): Promise<void> {
  const menu = page.getByRole('button', { name: 'Game' })
  if (await menu.isVisible()) {
    await menu.click()
    await page
      .getByRole('menuitem', { name: action === 'Play' ? 'Play your game' : 'Make it ready to upload' })
      .click()
  } else if (action === 'Play') await page.getByRole('link', { name: 'Play' }).click()
  else await page.getByRole('button', { name: 'Publish' }).click()
}

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

    // Play: the game the command started opens in a new tab, the level it runs has the wall, and past the game's own
    // title screen the wall is on the screen where it was painted.
    const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
    await expect(play.locator('#game canvas')).toBeVisible({ timeout: 30_000 })
    const gameOrigin = new URL(play.url()).origin
    await expect
      .poll(async () => (await fetch(`${gameOrigin}/${CONTENT_MODULE}`)).text(), { timeout: 30_000 })
      .toContain('".*5 1 .*26"')
    await play.getByRole('button', { name: 'Play' }).click()
    // The wall's cell is drawn as a wall, and the cell beside it is still empty.
    await expect
      .poll(
        () =>
          cellColours(play, STARTER, [
            { col: 5, row: 2 },
            { col: 6, row: 2 },
          ]),
        { timeout: 15_000 },
      )
      .toEqual([WALL_COLOUR, EMPTY_COLOUR])
    await play.close()

    // Publish: the game is built and checked, and the person downloads one zip to upload.
    await pressGame(page, 'Publish')
    const dialog = page.getByRole('dialog', { name: 'Make your game ready to upload' })
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

// The level's tiles, drawn. Today the starter game draws only its walls, so a tile painted on the Decor layer is saved
// but not drawn (2D core draws no tile layers until PR #479). This test says what happens now: the tile is saved, the
// game runs and draws its floor, and the tile's cell is still empty. It does not use `test.fail`, which would pass for
// any failure, such as a game that never started. When #479 lands this fails at the last line: change it to expect a
// drawn tile (`not.toBe(EMPTY_COLOUR)`).
test('a tile painted in the editor is saved, but the game does not draw tiles yet', async ({
  page,
  context,
}) => {
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
    const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
    await play.getByRole('button', { name: 'Play' }).click()
    // Reading a cell needs the floor on the screen (it throws until the game has drawn it), so this also proves the
    // game started and ran. The tile's own cell is empty today.
    await expect
      .poll(async () => (await cellColours(play, STARTER, [{ col: 5, row: 4 }]))[0], { timeout: 30_000 })
      .toBe(EMPTY_COLOUR)
  } finally {
    await editor.stop()
    game.remove()
  }
})
