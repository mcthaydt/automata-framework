import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import {
  brightestSince,
  expectOnRail,
  framesMeasured,
  gamePixels,
  openEditor,
  pitchesPlayed,
  playFromEditors,
  pressInList,
  publishFromEditors,
  recordBrightness,
  recordPitches,
  secondsMoving,
  servedWith,
} from '../harness/complete-game.ts'
import { BASE_3D, expect, test } from '../harness/fixtures.ts'
import { chooseSelectTool, openLevels3d, selectRoomAt } from '../harness/levels-3d.ts'
import { newGame } from '../harness/new-game.ts'
import { type Pixels, readPng } from '../harness/read-png.ts'
import { readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'
import { wordJourney } from '../harness/word-journey.ts'

// A complete 3D game, made in the editors alone (the Owner, 2026-11-08: one complete-game test for 2D and one for 3D,
// each using every editor the game can). A person runs `automata create-game --template 3d`, then `automata editor`,
// and plays the new game once to see what it is. Then they work every editor it has: Levels 3D (the room's walls),
// Characters (Wick's height) and the Tuner (his walking speed). Played again, each change is looked for in what the game
// draws: the far wall's colour, how tall Wick's blue cloak stands on the screen, and how long he takes to walk to that
// wall. Nothing here writes a game file.
//
// Feel and Audio, Writer, Sequence and Schematic each have a journey below. The two things a new 3D game cannot do yet are
// marked as failing with the reason: Levels 3D has no way to change a floor's material, and Publish refuses the game while
// Pixi 3D is a closed beta. Each one's mark comes off when it passes.

/**
 * How much the picture's mean brightness (0 to 255) may change from one frame to the next while nothing moves but Wick
 * breathing: his idle sway moves it by up to about 0.16 at phone size; the camera following his walk moves it by more.
 */
const STILL = 0.25

/** What a played game shows that the editors change: the far wall's colour, Wick's size and his walk to that wall. */
interface Seen {
  readonly wall: readonly [number, number, number]
  readonly cloak: number
  readonly walk: number
}

/**
 * The far wall's colour just below the top edge of what the game draws, in the middle (Wick's head is further down).
 * Above that edge is the page's letterbox, the colour of the canvas's top-left corner.
 */
function wallOf(picture: Pixels): readonly [number, number, number] {
  const x = Math.round(picture.width / 2)
  const letterbox = picture.at(2, 2)
  const isLetterbox = (colour: readonly number[]) =>
    colour.every((channel, c) => Math.abs(channel - (letterbox[c] ?? 0)) < 8)
  let top = 0
  while (top < picture.height - 1 && isLetterbox(picture.at(x, top))) top += 1
  const y = top + Math.round(picture.height * 0.02)
  const sum = [0, 0, 0]
  let count = 0
  for (let dx = -10; dx <= 10; dx++) {
    const colour = picture.at(x + dx, y)
    for (const c of [0, 1, 2]) sum[c] = (sum[c] ?? 0) + (colour[c] ?? 0)
    count += 1
  }
  return [0, 1, 2].map((c) => Math.round((sum[c] ?? 0) / count)) as unknown as [number, number, number]
}

/** How tall Wick's blue cloak stands on the screen, in rows: the cloak is the only strong blue in the room. */
function cloakOf(picture: Pixels): number {
  let top = picture.height
  let bottom = -1
  for (let y = 0; y < picture.height; y += 2)
    for (let x = 0; x < picture.width; x += 2) {
      const [r, g, b] = picture.at(x, y)
      if (b > r + 60 && b > g + 20) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  return Math.max(0, bottom - top)
}

/** Waits until the game's picture stops changing: the game has started and the camera has settled behind Wick. */
async function settled(play: Page): Promise<void> {
  const mark = await framesMeasured(play)
  await expect
    .poll(async () => (await framesMeasured(play)) - mark, {
      message: 'the game draws frames',
      timeout: 30_000,
    })
    .toBeGreaterThan(5)
  await expect
    .poll(async () => secondsMoving(play, (await framesMeasured(play)) - 5, STILL), { timeout: 30_000 })
    .toBe(0)
}

/** The game is played sideways; on a phone held upright it asks to be turned, so the person turns it. */
function sideways(play: Page): Promise<void> | undefined {
  const size = play.viewportSize()
  if (size === null || size.width >= size.height) return undefined
  return play.setViewportSize({ width: size.height, height: size.width })
}

/** Plays the game from the editors and looks at it: the wall and Wick at the start, then the walk to the far wall. */
async function look(page: Page): Promise<Seen> {
  const play = await playFromEditors(page, page.context(), sideways)
  try {
    await settled(play)
    const shot = await play.locator('#game canvas').screenshot()
    await test.info().attach('the game at the start', { body: shot, contentType: 'image/png' })
    const picture = readPng(shot)
    const mark = await framesMeasured(play)
    // Sideways, to the room's side wall: straight ahead is the keeper, who stops Wick to talk.
    await play.keyboard.down('KeyD')
    try {
      // Long enough at the slowest walk (2 m/s) to reach the wall and stand there.
      await expect
        .poll(async () => (await framesMeasured(play)) - mark, {
          message: 'the game draws frames',
          timeout: 30_000,
        })
        .toBeGreaterThan(10)
      await expect
        .poll(
          async () => {
            const frames = await framesMeasured(play)
            return frames - mark > 10 && (await secondsMoving(play, frames - 5, STILL)) === 0
          },
          { message: 'Wick reaches the wall', timeout: 30_000 },
        )
        .toBe(true)
    } finally {
      await play.keyboard.up('KeyD')
    }
    return { wall: wallOf(picture), cloak: cloakOf(picture), walk: await secondsMoving(play, mark, STILL) }
  } finally {
    await play.close()
  }
}

test('a new 3D game is made with every editor it has and played', async ({ page, context }) => {
  test.setTimeout(300_000)
  await recordBrightness(context)
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  try {
    // The rail offers the editors the new game lists: Levels, Characters, the Tuner, Feel, Audio, Writer, Sequence and Schematic.
    await page.goto(editor.url)
    for (const name of ['Levels', 'Characters', 'Tuner', 'Feel', 'Audio', 'Writer', 'Sequence', 'Schematic'])
      await expectOnRail(page, name)

    // The new game, played as it comes: dark blue walls, Wick in his blue cloak, a walk to the far wall.
    const before = await look(page)
    expect(before.wall[2], 'the new game’s walls are dark blue').toBeGreaterThan(before.wall[0])
    expect(before.cloak, 'Wick is on the screen').toBeGreaterThan(0)
    expect(before.walk, 'Wick walks').toBeGreaterThan(0)

    // Levels 3D: the room's walls made of the crates' wood.
    await openLevels3d(page, editor, 'Room')
    await chooseSelectTool(page)
    await selectRoomAt(page, [0, 0])
    const details = page.getByRole('button', { name: 'Details' })
    if (!(await page.getByRole('button', { name: 'Change materials' }).isVisible())) await details.click()
    await page.getByRole('button', { name: 'Change materials' }).click()
    const sheet = page.getByRole('dialog', { name: 'Material' })
    await sheet.getByRole('radio', { name: /^Crate/ }).click()
    await sheet.getByRole('radio', { name: 'This room' }).click()
    await sheet.getByRole('button', { name: 'Apply' }).click()
    const room = join(game.dir, 'content/levels/room.af-sector.json')
    await expect
      .poll(() => readFileSync(room, 'utf8'), { timeout: 30_000 })
      .toContain('"wallTexture": "crate"')

    // Characters: Wick as tall as he can be.
    await openEditor(page, editor, 'Characters')
    // The new game has three people (the guard, the keeper and Wick): Wick's is the one to change.
    await pressInList(page, /^wick$/)
    const height = page.getByRole('slider', { name: /^Height/ })
    if (!(await height.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
    await expect(page.getByRole('heading', { name: 'wick', level: 2 })).toBeVisible()
    await height.focus()
    await page.keyboard.press('End')
    const wick = join(game.dir, 'content/figures/wick.toml')
    await expect.poll(() => readFileSync(wick, 'utf8'), { timeout: 30_000 }).toMatch(/^height = 240$/m)

    // The Tuner: Wick walks as fast as the Tuner lets him.
    await openEditor(page, editor, 'Tuner')
    const speed = page.getByRole('slider', { name: /Walking speed/ })
    await speed.focus()
    await page.keyboard.press('End')
    const tuning = join(game.dir, 'content/tuning.toml')
    await expect
      .poll(() => readFileSync(tuning, 'utf8'), { timeout: 30_000 })
      .toMatch(/WALK_SPEED = \{ value = 8\b/)

    // Played again: the wall is the crates' brown, Wick stands taller on the screen, and he reaches the wall sooner.
    const after = await look(page)
    expect(after.wall[0], 'the wall is the crates’ wood').toBeGreaterThan(after.wall[2])
    expect(after.cloak, 'Wick is taller').toBeGreaterThan(before.cloak * 1.6)
    expect(after.walk, 'Wick walks faster').toBeLessThan(before.walk * 0.8)
  } finally {
    await editor.stop()
    game.remove()
  }
})

/** The pitch the bump starts at once Audio has changed it (the new game's bump starts at 220 Hz). */
const BUMP_PITCH = 880

test('Feel and Audio change what Wick bumping a wall looks and sounds like', async ({ page, context }) => {
  test.setTimeout(300_000)
  await recordBrightness(context)
  await recordPitches(context)
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  try {
    await page.goto(editor.url)
    // Feel: Wick bumping a wall flashes the screen, long enough to be seen (the limit is raised to match).
    await openEditor(page, editor, 'Feel')
    await pressInList(page, /wick bumped/i)
    await page.getByRole('button', { name: 'Add an effect' }).click()
    await page.getByRole('button', { name: 'Flash the screen' }).click()
    await page.getByLabel('How many frames').fill('30')
    await pressInList(page, 'Never more than')
    await page.getByLabel('Most flash frames').fill('30')
    await pressInList(page, /wick bumped/i)
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/feel/feel.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('flash_frames = 30')

    // Audio: the bump starts an octave and more higher.
    await openEditor(page, editor, 'Audio')
    await pressInList(page, 'bump')
    const startsAt = page.getByLabel('Starts at').first()
    await startsAt.fill(String(BUMP_PITCH))
    await startsAt.blur()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/audio/audio.toml'), 'utf8'), { timeout: 30_000 })
      .toContain(`from = ${BUMP_PITCH}`)

    // Play, and walk Wick into the side wall: the screen flashes and the bump plays at the pitch Audio was given.
    const play = await playFromEditors(page, context, sideways)
    try {
      await settled(play)
      const mark = await framesMeasured(play)
      const heardBefore = (await pitchesPlayed(play)).length
      // Sideways, into the side wall: straight ahead is the keeper, who stops Wick to talk.
      await play.keyboard.down('KeyD')
      try {
        await expect
          .poll(async () => (await pitchesPlayed(play)).slice(heardBefore), {
            message: 'the bump plays at the pitch set in Audio',
            timeout: 30_000,
          })
          .toContain(BUMP_PITCH)
      } finally {
        await play.keyboard.up('KeyD')
      }
      const { first, brightest } = await brightestSince(play, mark)
      expect(brightest, 'the bump flashes the screen').toBeGreaterThan(first + 40)
    } finally {
      await play.close()
    }
  } finally {
    await editor.stop()
    game.remove()
  }
})

// Writer, Sequence and Schematic work on the story a new 3D game plays (a keeper to talk to, a cutscene his answer starts, a
// guard who walks). Each journey changes one thing in the editor, as a person would, plays the game from the editors and looks
// for the change in what the game says, shows and does. Nothing here writes a game file.

/** The keeper's first line, as the new game says it until Writer changes it. */
const KEEPER_SAYS = 'Hello there. Mind the crates on your way past.'

/** Holds the forward key, as a person would, until the keeper's box shows `words`; then lets go. */
async function walkToTheKeeper(play: Page, words: string): Promise<void> {
  await play.keyboard.down('KeyW')
  try {
    await expect(play.getByText(words)).toBeVisible({ timeout: 30_000 })
  } finally {
    await play.keyboard.up('KeyW')
  }
}

test('Feel: a word is sharp and readable in play, and is still there after a reload and a restart', async ({
  page,
  context,
}) => {
  test.setTimeout(420_000)
  await wordJourney(page, context, '3d', BASE_3D)
})

test('Writer: the keeper says the words written there', async ({ page, context }) => {
  test.setTimeout(180_000)
  const game = await newGame(BASE_3D, '3d')
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
    const play = await playFromEditors(page, context, sideways)
    await walkToTheKeeper(play, 'Hello from Writer.')
    await expect(play.getByText(KEEPER_SAYS)).toHaveCount(0)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})

test('Sequence: the cutscene shows the caption it was pointed at', async ({ page, context }) => {
  test.setTimeout(180_000)
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Sequence')
    // The words step of the look-around cutscene is pointed at another of the keeper's lines.
    await page.getByRole('button', { name: /^Words on screen, 0.5 s to 5.5 s/ }).click()
    await page.getByRole('combobox', { name: /line/i }).selectOption({ label: 'Safe travels.' })
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/cutscenes/look.toml'), 'utf8'), { timeout: 30_000 })
      .toContain('keeper.farewell')
    // Only the cutscene's caption has a "line" of the farewell (the conversation says it by "say"), so this waits for the scene.
    await servedWith(editor, '"line":"keeper.farewell"')
    const play = await playFromEditors(page, context, sideways)
    await walkToTheKeeper(play, KEEPER_SAYS)
    await play.getByRole('button', { name: /Show me around/ }).click()
    await play.getByRole('button', { name: 'Next' }).click()
    await expect(play.getByText('Safe travels.').last()).toBeVisible({ timeout: 30_000 })
    await expect(play.getByText('The keeper shows you around the room.')).toHaveCount(0)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})

/** Where the guard stands across the screen, 0 at its left edge to 1 at its right, or undefined while he is not drawn: the guard's red cloak is the only strong red in the room. */
function guardAcross(picture: Pixels): number | undefined {
  let sum = 0
  let count = 0
  for (let y = 0; y < picture.height; y += 2)
    for (let x = 0; x < picture.width; x += 2) {
      const [r, g, b] = picture.at(x, y)
      if (r > g + 70 && r > b + 70) {
        sum += x
        count += 1
      }
    }
  return count < 6 ? undefined : sum / count / picture.width
}

test('Schematic: the guard walks at the speed set there', async ({ page, context }) => {
  test.setTimeout(300_000)
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  /**
   * How long the guard takes to walk from the east side of his rounds to the west side, in ms: the time between the last
   * picture that shows him in the east and the first that shows him in the west. Both ends are measured on the same game,
   * so neither the time the page takes to load nor how long he waits at the end counts.
   */
  async function msToCross(): Promise<number> {
    const play = await playFromEditors(page, context, sideways)
    try {
      let lastEast: number | undefined
      let crossed = 0
      await expect
        .poll(
          async () => {
            const across = guardAcross(await gamePixels(play))
            const now = Date.now()
            if (across === undefined) return false
            if (across > 0.55) lastEast = now
            else if (across < 0.45 && lastEast !== undefined) {
              crossed = now - lastEast
              return true
            }
            return false
          },
          { message: 'the guard walks across the room', timeout: 60_000, intervals: [50] },
        )
        .toBe(true)
      return crossed
    } finally {
      await play.close()
    }
  }
  try {
    await page.goto(editor.url)
    const atStart = await msToCross()

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

    const faster = await msToCross()
    expect(faster, 'the guard crosses the room sooner').toBeLessThan(atStart * 0.7)
  } finally {
    await editor.stop()
    game.remove()
  }
})

test('a room’s floor can be given another material in Levels 3D', async ({ page }) => {
  test.fail(
    true,
    'the room card’s Change materials changes only the walls; nothing opens the sheet for a floor or ceiling',
  )
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  try {
    await openLevels3d(page, editor, 'Room')
    await chooseSelectTool(page)
    await selectRoomAt(page, [0, 0])
    const details = page.getByRole('button', { name: 'Details' })
    if (!(await page.getByRole('button', { name: 'Change materials' }).isVisible())) await details.click()
    await expect(page.getByRole('button', { name: /floor.*material|material.*floor/i })).toBeVisible({
      timeout: 5_000,
    })
  } finally {
    await editor.stop()
    game.remove()
  }
})

test('a new 3D game is published as one zip to upload', async ({ page }) => {
  test.setTimeout(180_000)
  test.fail(true, 'Pixi 3D is a closed beta, so Publish refuses to ship it until it is public')
  const game = await newGame(BASE_3D, '3d')
  const editor = await runEditor(game.dir)
  try {
    await page.goto(editor.url)
    const zip = await publishFromEditors(page, (name) => test.info().outputPath(name))
    expect(zip.name).toBe('my-game-0.1.0-itch.zip')
    expect(readZip(zip.path).has('index.html')).toBe(true)
  } finally {
    await editor.stop()
    game.remove()
  }
})
