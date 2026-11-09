import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { expect, test } from '../harness/fixtures.ts'
import { runEditor } from '../harness/run-editor.ts'

// The Tuner's split view in a real browser: the game's dev page runs in a frame beside the settings, and a change to a
// setting reaches the game's folder as it is made (the content plugin of a real game restarts the game on that file, so
// the frame shows the change). Here the dev page is a stand-in server that starts after the editor does, as a
// person's `pnpm dev` does: until it answers, the pane says how to start the game, then the frame appears by itself.
// Chromium at iPad size only, like the rest of the suite (the suite ships with the 3D slice, D3).

const GAME_PAGE = '<!doctype html><title>Stand-in game</title><h1>Stand-in game is running</h1>'

test('the game appears beside the settings once it is running, and a change reaches the game’s file', async ({
  page,
  game,
}, info) => {
  test.skip(
    info.project.name !== 'editor-ipad-chromium',
    'The suite is checked in Chromium at iPad size until it ships (D3).',
  )
  // A free port for the stand-in game, with nothing listening on it yet.
  const probe = createServer()
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const { port } = probe.address() as AddressInfo
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  const dev = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' }).end(GAME_PAGE)
  })

  const suite = await runEditor(game.dir, ['--game-url', `http://127.0.0.1:${port}`])
  try {
    await page.goto(suite.url)
    await page.getByRole('tab', { name: 'Tuner' }).click()
    const pane = page.getByTestId('tuner-game')
    await expect(pane.getByText('Start your game with pnpm dev to see your changes here.')).toBeVisible()
    await expect(pane.locator('iframe')).toHaveCount(0)

    // The person starts their game; the pane looks again every two seconds and shows it.
    await new Promise<void>((resolve) => dev.listen(port, '127.0.0.1', resolve))
    await expect(pane.locator('iframe')).toBeVisible({ timeout: 15_000 })
    await expect(pane.frameLocator('iframe').getByText('Stand-in game is running')).toBeVisible()

    // A setting's slider steps with the arrow keys; the new number is in the game's file at once.
    const tuning = join(game.dir, 'content/tuning.toml')
    const before = readFileSync(tuning, 'utf8')
    await page.getByRole('slider', { name: 'Gravity' }).press('ArrowRight')
    await expect.poll(() => readFileSync(tuning, 'utf8')).not.toBe(before)
    // One arrow key is one step in the setting's own unit (px/s²), more than the file's whole number.
    const gravity = (text: string): number => Number(/^GRAVITY = \{ value = (-?\d+),/m.exec(text)?.[1])
    expect(gravity(readFileSync(tuning, 'utf8'))).toBeGreaterThan(gravity(before))
  } finally {
    await suite.stop()
    await new Promise<void>((resolve) => dev.close(() => resolve()))
  }
})
