import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { BASE_3D, expect, test } from '../harness/fixtures.ts'
import { chooseSelectTool, dragThing, openLevels3d, selectRoomAt } from '../harness/levels-3d.ts'
import { readPng } from '../harness/read-png.ts'
import { runGame } from '../harness/run-game.ts'

// Levels 3D in the dark look, on a device that asks for it (the audit rule: make it, play it, confirm it shows). The
// editor is dark from the first paint; every view of the room (Plan, 3D and Walk) draws in it; the room's north wall
// is dragged a metre in Plan; the change is saved into the room's file; and the game, which is never themed,
// plays the room with the wall moved: its picture is not the one it drew before the edit.

// Away from the other 3D journeys (6430 to 6440).
const GAME_PORT = 6450 + Number(process.env.TEST_PARALLEL_INDEX ?? 0)
const BEFORE_PORT = GAME_PORT + 5

test.use({ source: BASE_3D, colorScheme: 'dark' })

/** The game is played landscape (a portrait window shows its "turn your device" hint over it), whatever the editor's size. */
const LANDSCAPE = { width: 1194, height: 834 }

/** The editors' field colour and the look the browser was told to draw controls in. */
const look = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('i')
    probe.style.background = 'var(--bg)'
    document.body.append(probe)
    const field = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      scheme: getComputedStyle(document.documentElement).colorScheme,
      field,
      chosen: document.documentElement.dataset.theme,
    }
  })

/** Shows `name` ("Plan", "3D" or "Walk") by the control the screen has: three segments, or the View menu on a phone. */
async function chooseView(page: Page, name: string): Promise<void> {
  const menu = page.getByRole('button', { name: /^View/ })
  if (await menu.isVisible()) {
    await menu.click()
    await page.getByRole('menuitem', { name: new RegExp(`^${name}`) }).click()
  } else await page.getByRole('radio', { name, exact: true }).click()
}

/** Gets to the room as a player does (a key at the title, "New game" in the slot list), and returns the canvas's picture. */
async function playedPicture(play: Page): Promise<ReturnType<typeof readPng>> {
  const title = play.getByText('Press any key or tap')
  const newGame = play.getByRole('button', { name: 'New game' })
  const playing = play.getByRole('button', { name: 'Pause' })
  await expect(title.or(newGame).or(playing)).toBeVisible({ timeout: 30_000 })
  if (await title.isVisible()) await play.keyboard.press('Enter')
  await expect(newGame.or(playing)).toBeVisible()
  if (await newGame.isVisible()) await newGame.click()
  await expect(playing).toBeVisible()
  const canvas = play.locator('canvas').first()
  await expect(canvas).toBeVisible()
  // The room has filled the canvas once its picture is no longer the title's black: wait on that, never on a sleep.
  await expect
    .poll(
      async () => {
        const picture = readPng(await canvas.screenshot())
        let bright = 0
        for (let y = 0; y < picture.height; y += 8)
          for (let x = 0; x < picture.width; x += 8)
            if (picture.at(x, y).some((value) => value > 40)) bright++
        return bright
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(50)
  return readPng(await canvas.screenshot())
}

/** How many of the sampled pixels of two pictures of the same size differ by more than a few levels. */
function differing(a: ReturnType<typeof readPng>, b: ReturnType<typeof readPng>): number {
  expect([b.width, b.height]).toEqual([a.width, a.height])
  let count = 0
  for (let y = 0; y < a.height; y += 2)
    for (let x = 0; x < a.width; x += 2) {
      const left = a.at(x, y)
      const right = b.at(x, y)
      if (left.some((value, index) => Math.abs(value - (right[index] as number)) > 6)) count++
    }
  return count
}

test('a wall moved in the dark Levels 3D is what the game plays', async ({ page, browser, game, editor }) => {
  test.setTimeout(240_000)
  const room = join(game.dir, 'content/levels/room.af-sector.json')
  const before = readFileSync(room, 'utf8')

  // The room as the game ships it: the picture the edited room is compared with.
  const first = await runGame(BASE_3D, game.dir, BEFORE_PORT, { VITE_AF_JOURNEYS: '1' })
  let shipped: ReturnType<typeof readPng>
  try {
    const play = await page.context().newPage()
    await play.setViewportSize(LANDSCAPE)
    await play.goto(first.url)
    shipped = await playedPicture(play)
    await play.close()
  } finally {
    await first.stop()
  }

  // The Studio (Characters) is dark too, and its stage, which is the game's picture of Wick, is the same in both looks.
  const stageOf = async (studio: Page) => {
    await studio.goto(editor.url)
    await studio.getByRole('region', { name: 'Characters' }).getByRole('button').first().click()
    const stage = studio.getByTestId('studio-stage')
    await expect(stage).toBeVisible()
    await expect(stage).toHaveAttribute('data-status', 'ready', { timeout: 30_000 })
    return stage
  }
  const darkStage = await stageOf(page)
  expect((await look(page)).field).toBe('rgb(19, 20, 23)')
  await page.screenshot({ path: test.info().outputPath('dark-studio.png') })
  const inDark = readPng(await darkStage.screenshot())
  const viewport = page.viewportSize()
  const lightContext = await browser.newContext({ colorScheme: 'light', ...(viewport ? { viewport } : {}) })
  try {
    const lightPage = await lightContext.newPage()
    const lightStage = await stageOf(lightPage)
    expect((await look(lightPage)).field).not.toBe('rgb(19, 20, 23)')
    await lightPage.screenshot({ path: test.info().outputPath('light-studio.png') })
    const inLight = readPng(await lightStage.screenshot())
    // The stage's corner is the stage's own colour; the figure in the middle may be mid-gait, so the corner is the proof.
    expect(inLight.at(3, 3)).toEqual(inDark.at(3, 3))
  } finally {
    await lightContext.close()
  }

  // The editor opens dark, with no choice made, and every view of the room is drawn in it.
  await openLevels3d(page, editor, 'Room')
  expect(await look(page)).toEqual({ scheme: 'dark', field: 'rgb(19, 20, 23)', chosen: undefined })
  await page.screenshot({ path: test.info().outputPath('dark-3d-plan.png') })
  await chooseView(page, '3D')
  await expect(page.locator('[data-testid="dollhouse-canvas"]')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('dark-3d-dollhouse.png') })
  await chooseView(page, 'Walk')
  await expect(page.locator('[data-testid="walk-canvas"]')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('dark-3d-walk.png') })
  await chooseView(page, 'Plan')
  await expect(page.locator('[data-testid="plan-canvas"]')).toBeVisible()

  // The first room's north wall is moved a metre south by taking its two corners in Plan (the room is selected first, so
  // its corners can be taken). The game reads only rectangles, and the corners snap to each other's lines, so it stays one.
  await chooseSelectTool(page)
  await selectRoomAt(page, [0, 4])
  await dragThing(page, [5, 0], [5, 1])
  await dragThing(page, [-5, 0], [-5, 1])
  const north = (): number[] => {
    const level = JSON.parse(readFileSync(room, 'utf8')) as { sectors: { id: string; corners: number[][] }[] }
    const start = level.sectors.find((sector) => sector.id === 'start')?.corners
    return [start?.[0]?.[1] ?? NaN, start?.[1]?.[1] ?? NaN].map((z) => Math.round(z * 10) / 10)
  }
  await expect.poll(north, { timeout: 30_000 }).toEqual([1, 1])
  await page.screenshot({ path: test.info().outputPath('dark-3d-plan-moved.png') })
  expect(readFileSync(room, 'utf8')).not.toBe(before)

  // Play: the game the checkout runs over that copy draws a different room than the one it shipped.
  const running = await runGame(BASE_3D, game.dir, GAME_PORT, { VITE_AF_JOURNEYS: '1' })
  try {
    const play = await page.context().newPage()
    await play.setViewportSize(LANDSCAPE)
    await play.goto(running.url)
    const edited = await playedPicture(play)
    await play.screenshot({ path: test.info().outputPath('game-played.png') })
    expect(
      differing(shipped, edited),
      'pixels of the played room that the moved wall changed',
    ).toBeGreaterThan(200)
    // The game is never themed.
    expect(
      await play.evaluate(
        () =>
          document.documentElement.dataset.theme ??
          getComputedStyle(document.documentElement).getPropertyValue('--bg'),
      ),
    ).toBe('')
  } finally {
    await running.stop()
  }
})
