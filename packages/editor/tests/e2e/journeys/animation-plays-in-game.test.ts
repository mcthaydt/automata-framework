import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openFromRail, pressInList } from '../harness/complete-game.ts'
import { EMBERWICK, expect, openRoom, test } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'
import { boxOf, readPng } from '../harness/read-png.ts'
import { runEditor } from '../harness/run-editor.ts'
import { framesPng } from '../harness/tiles-picture.ts'

// An animation made in Characters is what the played game shows moving. A new game is made, the player start is given a
// picture of four frames and a clip over all of them in Characters, saved by the editor itself, and the game's Play button
// opens it. The square's pixels are read over time: each is one frame's colour, and the colour changes as the clip plays.

const BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]
const FRAMES: readonly (readonly [number, number, number])[] = [
  [200, 50, 50],
  [50, 200, 50],
  [50, 50, 200],
  [200, 200, 50],
]
const key = (color: readonly number[]): string => color.join(',')

test('a clip made in Characters plays in the game, frame after frame', async ({ page, context }) => {
  test.setTimeout(180_000)
  const game = await newGame(EMBERWICK)
  const editor = await runEditor(game.dir)
  try {
    await openRoom(page, editor, 'Start')
    await openFromRail(page, 'Characters')
    await pressInList(page, /Player start/, 'radio')
    const details = page.getByRole('button', { name: 'Details' })
    if ((await details.getAttribute('aria-expanded')) === 'false') await details.click()

    // The picture of four 16 x 24 frames is added, and the clip plays all four in order.
    await page.getByLabel('Choose a picture of frames').setInputFiles({
      name: 'Hero.png',
      mimeType: 'image/png',
      buffer: framesPng(16, 24, FRAMES.length, FRAMES),
    })
    await expect(page.getByText('The picture has 4 frames.')).toBeVisible()
    for (const frame of [1, 2, 3]) {
      await page.getByRole('button', { name: `Frame ${frame}`, exact: true }).click()
      await expect(page.getByLabel('Frames of idle')).toHaveText(
        `Frames: ${[0, ...Array.from({ length: frame }, (_, i) => i + 1)].join(', ')}`,
      )
    }

    const projectFile = join(game.dir, 'content/project.toml')
    await expect
      .poll(() => readFileSync(projectFile, 'utf8'), { timeout: 30_000 })
      .toContain('frames = [ 0, 1, 2, 3 ]')

    const [play] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Play' }).click(),
    ])
    const canvas = play.locator('#game canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    await play.getByRole('button', { name: /play/i }).first().click()

    // Read the square's colour again and again: every reading is one frame's colour, and more than one frame shows.
    const seen = new Set<string>()
    for (let reading = 0; reading < 14; reading++) {
      await play.waitForTimeout(110)
      const picture = readPng(await canvas.screenshot())
      const field = boxOf(picture, BACKGROUND)
      expect(field, 'the level is on the canvas').toBeDefined()
      if (field === undefined) return
      const scale = field.w / 512
      const color = picture.at(Math.round(field.x + 48 * scale), Math.round(field.y + (256 - 12) * scale))
      expect(FRAMES.map(key), `the square at reading ${reading}`).toContain(key(color))
      seen.add(key(color))
    }
    expect(seen.size, 'the square changed frame').toBeGreaterThan(1)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})
