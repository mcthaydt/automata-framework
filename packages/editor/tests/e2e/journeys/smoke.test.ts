import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { type RunningEditor, runEditor } from '../harness/run-editor.ts'
import { copyGame, type TempGame } from '../harness/temp-game.ts'

// The harness works end to end: the real command on a copy of Emberwick serves the editor, and the editor lists the
// game's level by its name.
const EMBERWICK = fileURLToPath(new URL('../../../../../games/emberwick', import.meta.url))

let game: TempGame
let editor: RunningEditor
test.beforeEach(async () => {
  game = copyGame(EMBERWICK)
  editor = await runEditor(game.dir)
})
test.afterEach(async () => {
  await editor?.stop()
  game?.remove()
})

test('automata editor opens on the game and lists its level', async ({ page }) => {
  await page.goto(editor.url)
  await expect(
    page.getByRole('region', { name: 'Levels' }).getByRole('button', { name: 'Room 1' }),
  ).toBeVisible()
})
