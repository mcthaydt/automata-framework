import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { paintWall } from '../../../../../packages/editor/tests/e2e/harness/fixtures.ts'
import { boxOf, readPng } from '../../../../../packages/editor/tests/e2e/harness/read-png.ts'
import { readZip } from '../../../../../packages/editor/tests/e2e/harness/read-zip.ts'
import { expect, openEditor, savedInto, servedWith, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { runEditor } from '../harness/run-editor.ts'

// A game made and played with the editors in the dark look, on a device that asks for the light one and with no choice
// stored: the editors open dark all the same, from the first paint to Publish, what is changed in them is saved into the game, and the game itself, which is never themed, plays
// it and ships it. Levels (a wall painted) and Feel (a word rewritten) change the game; Tuner and Audio are only opened,
// because a new game has no settings file yet and no sounds to edit. Play is pressed, and the painted wall is looked for in the pixels of the played game.

test.use({ colorScheme: 'light' })

/** The starter level's cells: 512 px across 32 of them. */
const STARTER_TILE = 16
/** The level's background, which the played canvas shows around everything else. */
const BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]
/** Row 2 of the new game's level once the wall is painted: the template's own wall stands at column 16. */
const WALL_CELLS = '.*5 1 .*10 1 .*15'
const WALLED_ROW = `"${WALL_CELLS}"`
const WORD = 'Bump in the dark!'
/** Where Vite serves the compiled content module the game imports. */
const CONTENT_MODULE = '@id/__x00__virtual:automata/content'

/** The editors' own field colour and the look the browser was told to draw controls in. */
const look = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const probe = document.createElement('i')
    probe.style.background = 'var(--bg)'
    document.body.append(probe)
    const field = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { scheme: root.colorScheme, field, chosen: document.documentElement.dataset.theme }
  })

test('a new game is made, edited, played and published in the dark editors', async ({ page, context }) => {
  test.setTimeout(240_000)
  const game = await newGame()
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Tuner')
    // Dark on a light device, chosen by nobody: the field is the dark one and the controls are drawn dark too.
    expect(await look(page)).toEqual({ scheme: 'dark', field: 'rgb(11, 12, 14)', chosen: 'dark' })
    await expect(page.getByTestId('tuner-rows')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('dark-tuner.png') })

    // Levels: a wall is painted and saved into the level file.
    await openEditor(page, editor, 'Levels')
    await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
    await paintWall(page, { col: 5, row: 2 }, STARTER_TILE)
    await savedInto(game, 'content/levels/start.toml', WALLED_ROW)
    await page.screenshot({ path: test.info().outputPath('dark-levels.png') })

    // Feel: the bump's word is rewritten.
    await openEditor(page, editor, 'Feel')
    const words = page.getByLabel('What it says')
    await words.fill(WORD)
    await words.blur()
    await savedInto(game, 'content/feel/feel.toml', WORD)
    await page.screenshot({ path: test.info().outputPath('dark-feel.png') })

    // The editor list a new game starts with names no Writer; Audio is on it, and opens dark.
    await openEditor(page, editor, 'Audio')
    expect((await look(page)).field).toBe('rgb(11, 12, 14)')

    await servedWith(editor, WORD)
    await servedWith(editor, WALL_CELLS)

    // Play: the editor's own Play link opens the running game. It carries none of the editors' colours, and the wall
    // painted in the dark editor is on its screen: the cell is not the background, and the cell beside it is.
    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    const canvasInGame = play.locator('#game canvas')
    await expect(canvasInGame).toBeVisible({ timeout: 30_000 })
    const gameLook = await play.evaluate(() => ({
      chosen: document.documentElement.dataset.theme,
      field: getComputedStyle(document.documentElement).getPropertyValue('--bg'),
    }))
    expect(gameLook).toEqual({ chosen: undefined, field: '' })
    await play.getByRole('button', { name: /play/i }).first().click()
    await expect
      .poll(
        async () => {
          const picture = readPng(await canvasInGame.screenshot())
          const field = boxOf(picture, BACKGROUND)
          if (field === undefined) return 'no level on the canvas yet'
          const scale = field.w / 512
          const at = (col: number, row: number) =>
            picture.at(
              Math.round(field.x + (col + 0.5) * STARTER_TILE * scale),
              Math.round(field.y + (row + 0.5) * STARTER_TILE * scale),
            )
          const wall = at(5, 2)
          const beside = at(9, 2)
          return {
            wallIsNotBackground: wall.join() !== BACKGROUND.join(),
            besideIsBackground: beside.join() === BACKGROUND.join(),
          }
        },
        { timeout: 30_000 },
      )
      .toEqual({ wallIsNotBackground: true, besideIsBackground: true })
    await play.screenshot({ path: test.info().outputPath('game-played.png') })
    // The word is Feel's, shown when the player bumps; the played screen has no bump yet, so the module the game runs holds it.
    expect(await (await fetch(`${editor.gameUrl}${CONTENT_MODULE}`)).text()).toContain(WORD)
    await play.close()

    // Publish in the dark: the dialog is dark, and the zip holds the wall and the word.
    await page.getByRole('button', { name: 'Publish' }).click()
    const dialog = page.getByRole('dialog', { name: 'Put your game online' })
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('dark-publish.png') })
    await dialog.getByRole('button', { name: 'Build my game' }).click()
    await expect(dialog.getByText('Your game is ready to upload.')).toBeVisible({ timeout: 120_000 })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Download the zip' }).click(),
    ])
    const files = readZip(await download.path())
    const code = [...files].filter(([name]) => name.endsWith('.js')).map(([, text]) => text)
    expect(code.some((text) => text.includes(WALL_CELLS))).toBe(true)
    expect(code.some((text) => text.includes(WORD))).toBe(true)
    // The level file the zip was built from is the one the editor saved.
    expect(readFileSync(join(game.dir, 'content/levels/start.toml'), 'utf8')).toContain(WALLED_ROW)
  } finally {
    await editor.stop()
    game.remove()
  }
})
