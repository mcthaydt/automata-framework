import { readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLevels, expect, openRoom, paintWall, test } from '../harness/fixtures.ts'

// Spec section 9, "A conflict stops the save": the project changed on disk after the editor opened it, so the next step
// writes nothing and asks; Use mine then writes the project and its level file, and the two agree.

test('a project changed on disk stops the step from saving, and Use mine writes the project and its level file', async ({
  page,
  game,
  editor,
}) => {
  const projectFile = join(game.dir, 'content/rooms/room-1.af2d.json')
  const levelFile = join(game.dir, 'content/levels/room-1.toml')

  await openRoom(page, editor)

  // Another program saves the project while it is open here: the same text, a later modified time.
  writeFileSync(projectFile, readFileSync(projectFile, 'utf8'))
  const later = new Date(Date.now() + 60_000)
  utimesSync(projectFile, later, later)
  const theirs = readFileSync(projectFile, 'utf8')

  await paintWall(page, { col: 5, row: 2 })

  const dialog = page.getByRole('dialog', { name: 'Emberwick room was changed somewhere else' })
  await expect(dialog).toBeVisible()
  // Nothing was written yet.
  expect(readFileSync(projectFile, 'utf8')).toBe(theirs)
  expect(readFileSync(levelFile, 'utf8')).not.toContain('"1 .*4 1 .*33 1"')

  await dialog.getByRole('button', { name: 'Use mine' }).click()
  await expect(dialog).toBeHidden()

  await expect
    .poll(() => readFileSync(levelFile, 'utf8'), { timeout: 30_000 })
    .toContain('"1 .*38 1", "1 .*4 1 .*33 1", "1 .*38 1"')
  expect(readFileSync(projectFile, 'utf8')).not.toBe(theirs)
  const check = await checkLevels(game.dir)
  expect(check.code, check.output).toBe(0)
})
