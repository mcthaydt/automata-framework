import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { cellOnCanvas } from '../harness/canvas-pointer.ts'
import {
  brightestSince,
  expectOnRail,
  framesMeasured,
  gamePixels,
  openEditor,
  openFromRail,
  pitchesPlayed,
  playFromEditors,
  pressInList,
  publishFromEditors,
  recordBrightness,
  recordPitches,
  servedWith,
} from '../harness/complete-game.ts'
import { EMBERWICK, expect, openRoom, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { boxOf } from '../harness/read-png.ts'
import { expectFontWithCredit, readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'
import { tilesPng } from '../harness/tiles-picture.ts'
import { wordJourney } from '../harness/word-journey.ts'

// A complete 2D game, made in the editors alone (the Owner, 2026-11-08: the complete-game test uses every editor). A
// person runs `automata create-game`, then `automata editor`, and works every editor the new game has: Levels 2D (Add
// tiles, a painted cell, the player start in Characters), the Tuner (a key), Feel (a flash when the square bumps a wall)
// and Audio (the bump's pitch). Then Play, where each change is looked for in what the game draws and plays, and Publish,
// whose zip carries them. Nothing here writes a game file.
//
// A new game also has a story for the three editors it makes: Writer's keeper, Sequence's cutscene and Schematic's guard
// (the journeys below the complete game's).

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
/** A tile's colour in the picture. */
function kit(tile: number): readonly [number, number, number] {
  const colour = KIT[tile]
  if (colour === undefined) throw new Error(`the picture has no tile ${tile}`)
  return colour
}
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
    // The rail offers the editors the new game lists: Levels, Characters, the Tuner, Feel, Audio, Writer, Sequence and Schematic.
    await page.goto(editor.url)
    for (const name of ['Levels', 'Characters', 'Tuner', 'Feel', 'Audio', 'Writer', 'Sequence', 'Schematic'])
      await expectOnRail(page, name)

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
    await openFromRail(page, 'Characters')
    const playerStart = page.getByRole('radio', { name: /Player start/ })
    const panel = page.getByRole('button', { name: 'Panel', exact: true })
    // Where the list is a sheet, choosing another editor closes the sheet (it slides away); then it is opened again.
    const sheet = (await page.locator('[data-editor-shell]').getAttribute('data-mode')) === 'compact'
    if (sheet) {
      await expect(playerStart).toBeHidden()
      await panel.click()
    }
    await playerStart.click()
    // The sheet stays up over the page after a choice; a person closes it with the same button.
    if (sheet) {
      await panel.click()
      await expect(playerStart).toBeHidden()
    }
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
    const squareX = async (): Promise<number> => boxOf(await gamePixels(play), kit(PLAYER_TILE))?.x ?? -1
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
        .poll(async () => (await framesMeasured(play)) - mark, {
          message: 'the game draws frames',
          timeout: 30_000,
        })
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
    // The words Feel draws are set in the baked face, which the zip carries with Geist's credit and licence.
    expectFontWithCredit(files)
    expect(scripts.some((text) => new RegExp(`from:\\s*${BUMP_PITCH}\\b`).test(text))).toBe(true)
  } finally {
    await editor.stop()
    game.remove()
  }
})

// Feel's word, as the player sees it: a word written in Feel reads at a readable size with a sharp edge in the played game,
// and the work is still there after the editor page is reloaded and after the editor is closed and opened again.
test('Feel: a word is sharp and readable in play, and is still there after a reload and a restart', async ({
  page,
  context,
}) => {
  test.setTimeout(420_000)
  await wordJourney(page, context, '2d', EMBERWICK)
})

// Writer, Sequence and Schematic work on the story a new 2D game plays (a keeper to talk to, a cutscene his answer starts, a
// guard who walks). Each journey changes one thing in the editor, as a person would, plays the game from the editors and
// looks for the change in what the game says, shows and does. Nothing here writes a game file.

/** The keeper's first line, as the new game says it until Writer changes it. */
const KEEPER_SAYS = 'Hello there. Mind the gate on your way out.'
/** The guard's colour in Characters, which the played canvas shows him in. */
const GUARD: readonly [number, number, number] = [0xef, 0x44, 0x44]

/** Holds the right arrow, as a person would, until the keeper's box shows `words`; then lets go. */
async function walkToTheKeeper(play: Page, words: string): Promise<void> {
  await play.keyboard.down('ArrowRight')
  try {
    await expect(play.getByText(words)).toBeVisible({ timeout: 15_000 })
  } finally {
    await play.keyboard.up('ArrowRight')
  }
}

test('Writer: the keeper says the words written there', async ({ page, context }) => {
  test.setTimeout(120_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Writer')
    const words = page.getByRole('textbox', { name: 'What it says' })
    await expect(words.first()).toHaveValue(KEEPER_SAYS)
    await words.first().fill('Hello from Writer.')
    await words.first().blur()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/lines/keeper.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('Hello from Writer.')
    await servedWith(editor, 'Hello from Writer.')
    const play = await playFromEditors(page, context)
    await walkToTheKeeper(play, 'Hello from Writer.')
    await expect(play.getByText(KEEPER_SAYS)).toHaveCount(0)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})

test('Sequence: the cutscene shows the caption it was pointed at', async ({ page, context }) => {
  test.setTimeout(120_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Sequence')
    // The words step of the gate's cutscene is pointed at another of the keeper's lines.
    await page.getByRole('button', { name: /^Words on screen, 0.5 s to 5.5 s/ }).click()
    await page.getByRole('combobox', { name: /line/i }).selectOption({ label: 'Safe travels.' })
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/cutscenes/gate.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('keeper.farewell')
    await servedWith(editor, '"line":"keeper.farewell"')
    const play = await playFromEditors(page, context)
    await walkToTheKeeper(play, KEEPER_SAYS)
    await play.getByRole('button', { name: /Show me the gate/ }).click()
    await play.getByRole('button', { name: 'Next' }).click()
    await expect(play.getByText('Safe travels.').last()).toBeVisible({ timeout: 20_000 })
    await expect(play.getByText('A moment later, at the gate.')).toHaveCount(0)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})

test('Schematic: the guard walks at the speed set there', async ({ page, context }) => {
  test.setTimeout(240_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  /**
   * How long a game started from the editors takes to show the guard in the west half of his rounds (he starts at the east
   * end, 400 px, and the west end is 288 px), from the Play button being pressed, in ms. It is the same game time on any
   * size of screen, so two of these compare whatever the frame rate.
   */
  async function msToTheWest(): Promise<number> {
    const play = await playFromEditors(page, context)
    const pressed = Date.now()
    try {
      await expect
        .poll(
          async () => {
            const picture = await gamePixels(play)
            const field = boxOf(picture, BACKGROUND)
            const guard = boxOf(picture, GUARD)
            if (field === undefined || guard === undefined) return Number.POSITIVE_INFINITY
            // The guard's feet are at the middle of his box, so the box's middle is where he stands.
            return (guard.x + guard.w / 2 - field.x) / (field.w / 512)
          },
          { message: 'the guard walks to the west half of his rounds', timeout: 60_000 },
        )
        .toBeLessThan(340)
      return Date.now() - pressed
    } finally {
      await play.close()
    }
  }
  try {
    await page.goto(editor.url)
    const atStart = await msToTheWest()

    await openEditor(page, editor, 'Schematic')
    await page.getByText('Guard', { exact: true }).first().click()
    await page.getByRole('button', { name: /^Patrol, 1 m\/s/ }).click()
    const speed = page.getByLabel('Moves at', { exact: true }).first()
    if (!(await speed.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
    const most = Number(await speed.getAttribute('max'))
    await speed.fill(String(most))
    await speed.press('Tab')
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/systems/guard.toml'), 'utf8'), { timeout: 30_000 })
      .toContain(`patrol = ${most}`)
    await servedWith(editor, `"patrol":${most}`)

    const faster = await msToTheWest()
    expect(faster, 'the guard gets to the west half sooner').toBeLessThan(atStart / 2)
  } finally {
    await editor.stop()
    game.remove()
  }
})
