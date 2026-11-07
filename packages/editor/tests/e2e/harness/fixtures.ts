// The journeys' shared start: a fresh copy of Emberwick and the real `automata editor` on it, both torn down after each
// test, and the few steps every journey takes in the editor, by the roles and names a person sees (copy.md).
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { test as base, expect, type Page } from '@playwright/test'
import { cellOnCanvas } from './canvas-pointer.ts'
import { BIN, type RunningEditor, runEditor } from './run-editor.ts'
import { copyGame, type TempGame } from './temp-game.ts'

/** The committed game the journeys copy. */
export const EMBERWICK = fileURLToPath(new URL('../../../../../games/emberwick', import.meta.url))
/** Emberwick's room: 8 px cells (320 px across 40 of them). */
export const ROOM_TILE = 8

export const test = base.extend<{ game: TempGame; editor: RunningEditor }>({
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

/** Opens the editor, then Emberwick's room in the Level view, and waits for the canvas to draw. */
export async function openRoom(page: Page, editor: RunningEditor): Promise<void> {
  await page.goto(editor.url)
  await page.getByText('Emberwick room').first().click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
}

/** Chooses the Collision layer and the Brush, then taps one cell of the room with a pointer. */
export async function paintWall(page: Page, cell: { col: number; row: number }): Promise<void> {
  // Below the wide layout the layers sit in a sheet behind the Layers button.
  const layer = page.getByRole('button', { name: 'Collision Walls and floors' })
  if (!(await layer.isVisible())) await page.getByRole('button', { name: 'Layers' }).click()
  await layer.click()
  await page.getByRole('radio', { name: 'Brush' }).click()
  const canvas = page.locator('[data-level-canvas]')
  // A new layer redraws the canvas; tap where the cell is now.
  await expect(canvas).toHaveAttribute('data-state', 'drawn')
  const point = await cellOnCanvas(canvas, cell, ROOM_TILE)
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
