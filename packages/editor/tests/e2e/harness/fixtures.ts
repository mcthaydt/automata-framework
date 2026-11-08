// The journeys' shared start: a fresh copy of Emberwick and the real `automata editor` on it, both torn down after each
// test, and the few steps every journey takes in the editor, by the roles and names a person sees (copy.md).
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  test as base,
  expect,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestType,
} from '@playwright/test'
import { cellOnCanvas } from './canvas-pointer.ts'
import { BIN, type RunningEditor, runEditor } from './run-editor.ts'
import { copyGame, type TempGame } from './temp-game.ts'

/** The committed game the journeys copy. */
export const EMBERWICK: string = fileURLToPath(new URL('../../../../../games/emberwick', import.meta.url))
/** Emberwick's room: 8 px cells (320 px across 40 of them). */
export const ROOM_TILE: number = 8

type JourneyFixtures = { game: TempGame; editor: RunningEditor }

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & JourneyFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = base.extend<JourneyFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixture signature takes the other fixtures first.
  game: async ({}, use) => {
    const game = copyGame(EMBERWICK)
    await use(game)
    game.remove()
  },
  editor: async ({ game }, use) => {
    const editor = await runEditor(game.dir)
    await use(editor)
    await editor.stop()
  },
})
export { expect }

/**
 * Opens the editor, then a level (Emberwick's room unless named, by its name in words as Home shows it) in the Level
 * view, and waits for the canvas to draw.
 */
export async function openRoom(page: Page, editor: RunningEditor, level = 'Room 1'): Promise<void> {
  await page.goto(editor.url)
  await page.getByRole('region', { name: 'Levels' }).getByRole('button', { name: level }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
}

/**
 * Chooses a layer (the Collision layer unless named, by its button's name) and the Brush, then taps one cell of the
 * level (`tile` px cells) with a pointer.
 */
export async function paintWall(
  page: Page,
  cell: { col: number; row: number },
  tile: number = ROOM_TILE,
  layerName = 'Collision Walls and floors',
): Promise<void> {
  // Below the wide layout the layers sit in a sheet behind the top bar's Panel button.
  const layer = page.getByRole('button', { name: layerName })
  if (!(await layer.isVisible())) await page.getByRole('button', { name: 'Panel' }).click()
  await layer.click()
  await page.getByRole('radio', { name: 'Brush' }).click()
  const canvas = page.locator('[data-level-canvas]')
  // A new layer redraws the canvas; tap where the cell is now.
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  const point = await cellOnCanvas(canvas, cell, tile)
  await page.mouse.click(point.x, point.y)
}

/** `automata check --only levels` on the game: its exit code and what it printed. */
export async function checkLevels(gameDir: string): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [
      BIN,
      'check',
      gameDir,
      '--only',
      'levels',
    ])
    return { code: 0, output: stdout + stderr }
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string }
    return { code: failed.code ?? 1, output: (failed.stdout ?? '') + (failed.stderr ?? '') }
  }
}
