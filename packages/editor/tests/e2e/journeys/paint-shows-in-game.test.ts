import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cellOnCanvas } from '../harness/canvas-pointer.ts'
import { closePanel, openFromRail, openPanel, pressInList } from '../harness/complete-game.ts'
import { chooseView, EMBERWICK, expect, openRoom, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { boxOf, readPng } from '../harness/read-png.ts'
import { runEditor } from '../harness/run-editor.ts'
import { tilesPng } from '../harness/tiles-picture.ts'

// What a person makes in the editors is what the game shows. A new game is made, a picture of tiles is added, Decor is
// pointed at it and a cell painted with one of its tiles, and the player start is given another tile in Characters, all
// saved by the editor itself; the game's own Play button then opens it, and the pixels on its canvas are looked at:
// the painted cell and the player's square are drawn from the picture the person added. Nothing here writes a game file.

const STARTER_TILE = 16
/** The level's background, which the canvas shows around everything else. */
const BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]
/** The added picture: 4 x 2 tiles of 16 px, each its own colour, so the tile the game drew shows in the pixel. */
const KIT: readonly (readonly [number, number, number])[] = [
  [200, 50, 50],
  [50, 200, 50],
  [50, 50, 200],
  [200, 200, 50],
  [200, 50, 200],
  [50, 200, 200],
  [250, 130, 20],
  [130, 20, 250],
]
/** The tile the player start wears, and the tile painted on Decor: both from the picture the person added. */
const KIT_TILE = 2
const PAINTED_TILE = 5

test('a tile painted with an added picture and a character given one are what the played game draws', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openRoom(page, editor, 'Start')

    // Add a picture of tiles: it is written into the game's assets/ folder.
    await chooseView(page, 'Tiles')
    // Below the wide layout the panel, with Add tiles in it, sits in a sheet behind the top bar's Panel button.
    const addTiles = page.getByRole('button', { name: 'Add tiles' }).first()
    await openPanel(page)
    await addTiles.click()
    const dialog = page.getByRole('dialog', { name: 'Add tiles' })
    await dialog.getByLabel('Choose a picture').setInputFiles({
      name: 'Kit.png',
      mimeType: 'image/png',
      buffer: tilesPng(STARTER_TILE, 4, 2, KIT),
    })
    await dialog.getByRole('button', { name: 'Add tiles' }).click()
    await expect(dialog).toBeHidden()

    // Decor paints with the added picture's tiles now, and one cell of it gets tile 5.
    await chooseView(page, 'Level')
    await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
    const layer = page.getByRole('button', { name: /^Decor/ })
    await openPanel(page)
    await layer.click()
    await page.getByRole('button', { name: /^Tiles from/ }).click()
    await page.getByRole('option', { name: 'Kit' }).click()
    await page.getByRole('radio', { name: 'Brush' }).click()
    await page.getByRole('radio', { name: `Tile ${PAINTED_TILE}`, exact: true }).click()
    const canvas = page.locator('[data-level-canvas]')
    await expect(canvas).toHaveAttribute('data-state', 'drawn')
    const cell = { col: 10, row: 4 }
    await closePanel(page)
    const point = await cellOnCanvas(canvas, cell, STARTER_TILE)
    await page.mouse.click(point.x, point.y)

    // Give the player start one of the added tiles, in Characters.
    await openFromRail(page, 'Characters')
    await pressInList(page, /Player start/, 'radio')
    const details = page.getByRole('button', { name: 'Details' })
    if ((await details.getAttribute('aria-expanded')) === 'false') await details.click()
    await page.getByRole('radio', { name: 'Picture' }).click()
    await page.getByRole('button', { name: /^Tile:/ }).click()
    await page.getByRole('option', { name: 'Kit' }).click()
    // Each press is a step of its own, so wait for the tile to show before the next.
    for (let step = 1; step <= KIT_TILE; step++) {
      await page.getByRole('button', { name: 'Increase Tile index' }).click()
      await expect(page.getByRole('spinbutton', { name: 'Tile index' })).toHaveText(String(step))
    }

    // Both are saved into the game's files by the editor.
    const levelFile = join(game.dir, 'content/levels/start.toml')
    const projectFile = join(game.dir, 'content/project.toml')
    await expect
      .poll(() => readFileSync(levelFile, 'utf8'), { timeout: 30_000 })
      .toMatch(/rows = \[ (?:"[^"]*", )*"[^"]*\.\*10 \d+ [^"]*"/)
    await expect
      .poll(() => readFileSync(projectFile, 'utf8'), { timeout: 30_000 })
      .toContain('assets/kit.png')
    await expect
      .poll(() => readFileSync(projectFile, 'utf8'), { timeout: 30_000 })
      .toContain(`index = ${KIT_TILE}`)

    // Play: the game the command started opens, and its canvas shows both.
    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    const canvasInGame = play.locator('#game canvas')
    await expect(canvasInGame).toBeVisible({ timeout: 30_000 })
    await play.getByRole('button', { name: /play/i }).first().click()
    await play.waitForTimeout(1500)
    const picture = readPng(await canvasInGame.screenshot())

    // The level is drawn at a scale; the background box tells it, and every cell is found from the box's corner.
    const field = boxOf(picture, BACKGROUND)
    expect(field, 'the level is on the canvas').toBeDefined()
    if (field === undefined) return
    const scale = field.w / 512
    const at = (x: number, y: number) =>
      picture.at(Math.round(field.x + x * scale), Math.round(field.y + y * scale))
    const middle = (c: number, r: number): [number, number] => [
      (c + 0.5) * STARTER_TILE,
      (r + 0.5) * STARTER_TILE,
    ]

    expect(at(...middle(cell.col, cell.row)), 'the painted cell').toEqual(KIT[PAINTED_TILE])
    // The player start stands at x 48, y 256 (its bottom edge); the square is drawn from the added picture's tile.
    expect(at(48, 256 - 12), 'the player start').toEqual(KIT[KIT_TILE])
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})
