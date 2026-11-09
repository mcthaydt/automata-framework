import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLevels, expect, openRoom, test } from '../harness/fixtures.ts'
import { solidPng } from '../harness/tiles-picture.ts'

// Add tiles in a real game folder: the picture of tiles is written into the game, the level project points at it, Save
// keeps both, and `automata check` agrees. B1 of the build audit: this refused every write with "not one the editor may
// write" and only the site's browser storage worked.

test('a picture of tiles added in the editor is on disk after Save, and the check passes', async ({
  page,
  game,
  editor,
}) => {
  await openRoom(page, editor)
  // The views are tabs from an iPad up; on a phone they are one menu button named after the open view.
  const tabs = page.getByRole('radio', { name: 'Tiles' })
  if (await tabs.count()) await tabs.click()
  else {
    await page.getByRole('button', { name: 'Level', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Tiles' }).click()
  }
  await page.getByRole('button', { name: 'Add tiles' }).first().click()

  const dialog = page.getByRole('dialog', { name: 'Add tiles' })
  // 64 x 32 px: eight 16 px tiles.
  await dialog.getByLabel('Choose a picture').setInputFiles({
    name: 'My Tiles.png',
    mimeType: 'image/png',
    buffer: solidPng(64, 32, [40, 160, 90]),
  })
  await expect(dialog.getByText('This makes 8 tiles.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Add tiles' }).click()
  await expect(dialog).toBeHidden()

  // The picture is in the game now, before any Save (the tile pictures are the game's files, not the level's draft).
  const picture = join(game.dir, 'assets/my-tiles.png')
  expect(existsSync(picture)).toBe(true)

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  expect(readFileSync(join(game.dir, 'content/rooms/room-1.af2d.json'), 'utf8')).toContain(
    'assets/my-tiles.png',
  )
  expect(readFileSync(join(game.dir, 'content/project.toml'), 'utf8')).toContain('assets/my-tiles.png')
  const check = await checkLevels(game.dir)
  expect(check.code, check.output).toBe(0)
})
