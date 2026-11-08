import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cellOnCanvas } from '../harness/canvas-pointer.ts'
import {
  brightestSince,
  framesMeasured,
  gamePixels,
  openEditor,
  pitchesPlayed,
  playFromEditors,
  pressInList,
  publishFromEditors,
  railHas,
  recordBrightness,
  recordPitches,
} from '../harness/complete-game.ts'
import { EMBERWICK, expect, openRoom, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { boxOf } from '../harness/read-png.ts'
import { readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'
import { tilesPng } from '../harness/tiles-picture.ts'

// A complete 2D game, made in the editors alone (the Owner, 2026-11-08: the complete-game test uses every editor). A
// person runs `automata create-game`, then `automata editor`, and works every editor the new game has: Levels 2D (Add
// tiles, a painted cell, the player start in Characters), the Tuner (a key), Feel (a flash when the square bumps a wall)
// and Audio (the bump's pitch). Then Play, where each change is looked for in what the game draws and plays, and Publish,
// whose zip carries them. Nothing here writes a game file.
//
// The editors a new 2D game cannot use yet each have a journey below that does what a person would try and is marked as
// failing, with the reason: Writer and Sequence (not on a new game's rail) and Schematic (the game has no thinking
// characters). Each one's mark comes off when it passes.

const STARTER_TILE = 16
/** The level's background, which the canvas shows around everything else. */
const BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]
/** The picture added in Levels 2D: 4 x 2 tiles of 16 px, each its own colour, so a drawn tile shows which one it is. */
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
const PLAYER_TILE = 2
const PAINTED_TILE = 5
const PAINTED = { col: 10, row: 4 }
/** The pitch the bump starts at once Audio has changed it (the new game's bump starts at 220 Hz). */
const BUMP_PITCH = 880

test('a new 2D game is made with every editor it has, played and published', async ({ page, context }) => {
  test.setTimeout(300_000)
  await recordPitches(context)
  await recordBrightness(context)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    // The rail offers the editors the new game lists: Levels, the Tuner, Feel, Audio and Schematic.
    await page.goto(editor.url)
    for (const name of ['Levels', 'Tuner', 'Feel', 'Audio', 'Schematic'])
      await expect(railHas(page, name)).toBeVisible()

    // Levels 2D: add a picture of tiles, paint a cell of Decor with one, and give the player start another (Characters).
    await openRoom(page, editor, 'Start')
    await page.getByRole('radio', { name: 'Tiles' }).click()
    const addTiles = page.getByRole('button', { name: 'Add tiles' }).first()
    if (!(await addTiles.isVisible())) await page.getByRole('button', { name: 'Panel' }).click()
    await addTiles.click()
    const dialog = page.getByRole('dialog', { name: 'Add tiles' })
    await dialog.getByLabel('Choose a picture').setInputFiles({
      name: 'Kit.png',
      mimeType: 'image/png',
      buffer: tilesPng(STARTER_TILE, 4, 2, KIT),
    })
    await dialog.getByRole('button', { name: 'Add tiles' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('radio', { name: 'Level' }).click()
    const canvas = page.locator('[data-level-canvas]')
    await expect(canvas).toHaveAttribute('data-state', 'drawn')
    const layer = page.getByRole('button', { name: /^Decor/ })
    if (!(await layer.isVisible())) await page.getByRole('button', { name: 'Panel' }).click()
    await layer.click()
    await page.getByRole('button', { name: /^Tiles from/ }).click()
    await page.getByRole('option', { name: 'Kit' }).click()
    await page.getByRole('radio', { name: 'Brush' }).click()
    await page.getByRole('radio', { name: `Tile ${PAINTED_TILE}`, exact: true }).click()
    await expect(canvas).toHaveAttribute('data-state', 'drawn')
    const point = await cellOnCanvas(canvas, PAINTED, STARTER_TILE)
    await page.mouse.click(point.x, point.y)
    await page.getByRole('radio', { name: 'Characters' }).click()
    await page.getByRole('radio', { name: /Player start/ }).click()
    const details = page.getByRole('button', { name: 'Details' })
    if ((await details.getAttribute('aria-expanded')) === 'false') await details.click()
    await page.getByRole('radio', { name: 'Picture' }).click()
    await page.getByRole('button', { name: /^Tile:/ }).click()
    await page.getByRole('option', { name: 'Kit' }).click()
    for (let step = 1; step <= PLAYER_TILE; step++) {
      await page.getByRole('button', { name: 'Increase Tile index' }).click()
      await expect(page.getByRole('spinbutton', { name: 'Tile index' })).toHaveText(String(step))
    }
    const projectFile = join(game.dir, 'content/project.toml')
    await expect
      .poll(() => readFileSync(projectFile, 'utf8'), { timeout: 30_000 })
      .toContain(`index = ${PLAYER_TILE}`)

    // The Tuner: J is added to Left (the person presses the key).
    await openEditor(page, editor, 'Tuner')
    const left = page.getByTestId('controls-row-left')
    await left.getByRole('button', { name: 'Add key' }).click()
    await expect(page.getByText('Press a key on your keyboard.')).toBeVisible()
    await page.keyboard.press('KeyJ')
    await expect(left.getByText('J', { exact: true })).toBeVisible()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/controls.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('"KeyJ"')

    // Feel: the square bumping a wall flashes the screen, long enough to be seen (the limit is raised to match).
    await openEditor(page, editor, 'Feel')
    await pressInList(page, /square bumped/)
    await page.getByRole('button', { name: 'Add an effect' }).click()
    await page.getByRole('button', { name: 'Flash the screen' }).click()
    await page.getByLabel('How many frames').fill('30')
    await pressInList(page, 'Never more than')
    await page.getByLabel('Most flash frames').fill('30')
    await pressInList(page, /square bumped/)
    const feelFile = join(game.dir, 'content/feel/feel.toml')
    await expect
      .poll(() => readFileSync(feelFile, 'utf8'), { timeout: 30_000 })
      .toContain('flash_frames = 30')

    // Audio: the bump starts an octave and more higher.
    await openEditor(page, editor, 'Audio')
    await pressInList(page, 'bump')
    const startsAt = page.getByLabel('Starts at').first()
    await startsAt.fill(String(BUMP_PITCH))
    await startsAt.blur()
    const audioFile = join(game.dir, 'content/audio/audio.toml')
    await expect
      .poll(() => readFileSync(audioFile, 'utf8'), { timeout: 30_000 })
      .toContain(`from = ${BUMP_PITCH}`)

    // Play: the game the command started opens. The level shows the painted tile, and the square wears the added tile.
    const play = await playFromEditors(page, context)
    let picture = await gamePixels(play)
    await expect
      .poll(async () => {
        picture = await gamePixels(play)
        return boxOf(picture, BACKGROUND) !== undefined
      })
      .toBe(true)
    const field = boxOf(picture, BACKGROUND)
    if (field === undefined) throw new Error('the level is not on the canvas')
    const scale = field.w / 512
    const at = (x: number, y: number) =>
      picture.at(Math.round(field.x + x * scale), Math.round(field.y + y * scale))
    expect(
      at((PAINTED.col + 0.5) * STARTER_TILE, (PAINTED.row + 0.5) * STARTER_TILE),
      'the painted cell',
    ).toEqual(KIT[PAINTED_TILE])
    expect(at(48, 256 - 12), 'the player start').toEqual(KIT[PLAYER_TILE])

    // J (the Tuner's key) moves the square left, to the wall.
    const squareX = async (): Promise<number> => boxOf(await gamePixels(play), KIT[PLAYER_TILE])?.x ?? -1
    const before = await squareX()
    await play.keyboard.down('KeyJ')
    try {
      await expect.poll(squareX, { message: 'J moves the square left', timeout: 10_000 }).toBeLessThan(before)
    } finally {
      await play.keyboard.up('KeyJ')
    }
    // Pressed into the wall once more, the square bumps it: the screen flashes (Feel) and the bump plays at the new pitch
    // (Audio). The screen is watched for the next two seconds; a flash lasts half of one.
    const mark = await framesMeasured(play)
    const heardBefore = (await pitchesPlayed(play)).length
    await play.keyboard.down('KeyJ')
    try {
      await expect
        .poll(async () => (await framesMeasured(play)) - mark, { message: 'the game draws frames' })
        .toBeGreaterThan(30)
    } finally {
      await play.keyboard.up('KeyJ')
    }
    const { first, brightest } = await brightestSince(play, mark)
    expect(brightest, 'the bump flashes the screen').toBeGreaterThan(first + 40)
    await expect
      .poll(async () => (await pitchesPlayed(play)).slice(heardBefore), {
        message: 'the bump plays at the pitch set in Audio',
        timeout: 10_000,
      })
      .toContain(BUMP_PITCH)
    await play.close()

    // Publish: one zip, ready to upload, with the page, the added picture and what Feel and Audio made.
    const zip = await publishFromEditors(page, (name) => test.info().outputPath(name))
    expect(zip.name).toBe('my-game-0.1.0-itch.zip')
    const files = readZip(zip.path)
    expect(files.has('index.html')).toBe(true)
    const names = [...files.keys()]
    expect(names.some((name) => /kit.*\.png$/i.test(name))).toBe(true)
    const scripts = names.filter((name) => name.endsWith('.js')).map((name) => files.get(name) ?? '')
    expect(scripts.some((text) => text.includes('flash_frames'))).toBe(true)
    expect(scripts.some((text) => new RegExp(`from:\\s*${BUMP_PITCH}\\b`).test(text))).toBe(true)
  } finally {
    await editor.stop()
    game.remove()
  }
})

// The editors a new 2D game cannot use yet. Each does the first thing a person would try and is marked as failing until
// it passes; the reason is the mark's description.

for (const [name, reason] of [
  ['Writer', 'a new 2D game has no dialogue box, so its editor list does not name Writer'],
  ['Sequence', 'a new 2D game has no cutscenes, so its editor list does not name Sequence'],
] as const)
  test(`${name} is on a new 2D game's rail`, async ({ page }) => {
    test.fail(true, reason)
    const game = await newGame(EMBERWICK)
    const editor = await runEditor(game.dir)
    try {
      await page.goto(editor.url)
      await expect(railHas(page, 'Levels')).toBeVisible()
      await expect(railHas(page, name)).toBeVisible({ timeout: 5_000 })
    } finally {
      await editor.stop()
      game.remove()
    }
  })

test('a character can be added in Schematic on a new 2D game', async ({ page }) => {
  test.fail(true, 'a new 2D game does not use the systems extension: Schematic says to add it first')
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Schematic')
    await expect(page.getByRole('button', { name: 'Add a character' })).toBeEnabled({ timeout: 5_000 })
  } finally {
    await editor.stop()
    game.remove()
  }
})
