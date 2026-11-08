import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import {
  framesMeasured,
  openEditor,
  playFromEditors,
  publishFromEditors,
  railHas,
  recordBrightness,
  secondsMoving,
} from '../harness/complete-game.ts'
import { BASE_3D, expect, test } from '../harness/fixtures.ts'
import { chooseSelectTool, openLevels3d, selectRoomAt } from '../harness/levels-3d.ts'
import { newGame } from '../harness/new-game.ts'
import { type Pixels, readPng } from '../harness/read-png.ts'
import { readZip } from '../harness/read-zip.ts'
import { runEditor } from '../harness/run-editor.ts'

// A complete 3D game, made in the editors alone (the Owner, 2026-11-08: one complete-game test for 2D and one for 3D,
// each using every editor the game can). A person runs `automata create-game --template 3d`, then `automata editor`,
// and plays the new game once to see what it is. Then they work every editor it has: Levels 3D (the room's walls),
// Characters (Wick's height) and the Tuner (his walking speed). Played again, each change is looked for in what the game
// draws: the far wall's colour, how tall Wick's blue cloak stands on the screen, and how long he takes to walk to that
// wall. Nothing here writes a game file.
//
// The editors a new 3D game cannot use yet each have a journey below, marked as failing with the reason: Feel, Audio,
// Writer, Sequence and Schematic are not on its rail, Levels 3D has no way to change a floor's material, and Publish
// refuses the game while Pixi 3D is a closed beta. Each one's mark comes off when it passes.

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
    await play.keyboard.down('KeyW')
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
      await play.keyboard.up('KeyW')
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
    // The rail offers the editors the new game lists: Levels, Characters and the Tuner.
    await page.goto(editor.url)
    for (const name of ['Levels', 'Characters', 'Tuner']) await expect(railHas(page, name)).toBeVisible()

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
    const height = page.getByRole('slider', { name: /^Height/ })
    if (!(await height.isVisible())) await page.getByRole('button', { name: 'Details' }).click()
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

// The editors a new 3D game cannot use yet. Each does the first thing a person would try and is marked as failing until
// it passes; the reason is the mark's description. "On the rail" alone proves nothing: each opens the editor and looks
// for what the new game would play.

for (const [name, reason, made] of [
  ['Feel', 'a new 3D game has no feel file to change yet', /bump/i],
  ['Audio', 'a new 3D game has no sounds to change yet', /bump/i],
  ['Writer', 'a new 3D game has no conversation to change yet', /keeper/i],
  ['Sequence', 'a new 3D game has no cutscene to change yet', /look/i],
  ['Schematic', 'a new 3D game has no thinking characters yet', /guard/i],
] as const)
  test(`${name} shows what a new 3D game plays`, async ({ page }) => {
    test.fail(true, reason)
    const game = await newGame(BASE_3D, '3d')
    const editor = await runEditor(game.dir)
    try {
      await page.goto(editor.url)
      await openEditor(page, editor, name)
      await expect(page.getByText(made).first()).toBeVisible({ timeout: 5_000 })
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
