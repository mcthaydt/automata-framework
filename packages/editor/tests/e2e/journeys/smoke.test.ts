import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'
import { openRoom } from '../harness/fixtures.ts'
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
  // Home's Levels card opens the editor, whose list names the level; choosing it draws the room.
  await openRoom(page, editor)
})
