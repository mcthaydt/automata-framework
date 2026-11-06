import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { packAll, sh } from '#src/commands.ts'
import { serveStatic } from '#src/serve.ts'
import { overridesYaml, packOverrides, strangerFolder } from '#src/stranger.ts'

// A stranger's first hour, from an empty folder to an itch.io zip, using only what the repository publishes:
//   make a game, install it, check it, test it, play it in a browser, make the itch.io zip.
// Nothing here links into the repository. The packs stand in for the registry (a `pnpm-workspace.yaml` of overrides,
// the one thing the journey adds to what `create-game` wrote), and the folder sits outside any pnpm workspace.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const GAME = 'my-game'

/** One named step. A failing step attaches everything its command printed, then fails the journey. */
async function step(name: string, run: () => void | Promise<void>): Promise<void> {
  await test.step(name, async () => {
    try {
      await run()
    } catch (error) {
      await test.info().attach(`${name}: output`, {
        body: error instanceof Error ? error.message : String(error),
        contentType: 'text/plain',
      })
      throw error
    }
  })
}

/** The yellow square's centre on the stage canvas, in screen pixels, or null while it is not on the screen yet. */
async function squareAt(page: Page): Promise<{ x: number; y: number } | null> {
  const png = await page.locator('[data-layer="stage"] canvas').screenshot()
  return page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (context === null) return null
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      let sumX = 0
      let sumY = 0
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        // The square is 0xffc825: strong red and green, little blue. The level's walls are slate, so they never count.
        if ((data[i] ?? 0) > 200 && (data[i + 1] ?? 0) > 160 && (data[i + 2] ?? 255) < 90) {
          sumX += (i / 4) % bitmap.width
          sumY += Math.floor(i / 4 / bitmap.width)
          count += 1
        }
      }
      return count === 0 ? null : { x: sumX / count, y: sumY / count }
    },
    [...png],
  )
}

/** Holds `key` for a moment and lets go. */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}

test('a stranger makes a game, checks it, plays it and makes the itch.io zip', async ({ page }) => {
  const folder = strangerFolder()
  const toolsDir = join(folder, 'tools')
  const gameDir = join(folder, 'work', GAME)
  let overrides: Record<string, string> = {}
  let finished = false
  try {
    await step('make a game', () => {
      // The packs: what `pnpm publish` would upload, from the packages turbo built before this test.
      const packs = packAll(root, folder)
      overrides = packOverrides(folder, packs)
      // The command a stranger runs is `pnpm dlx <tools> create-game my-game`. A pack's own dependencies are not on a
      // registry, so the tools are installed once from the packs (as dlx would from a registry) and run from there.
      mkdirSync(toolsDir, { recursive: true })
      writeFileSync(
        join(toolsDir, 'package.json'),
        JSON.stringify({ name: 'stranger-tools', private: true, type: 'module' }),
      )
      writeFileSync(join(toolsDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(toolsDir, 'pnpm', ['add', overrides['@mcthaydt/automata-tools'] as string])
      mkdirSync(join(folder, 'work'), { recursive: true })
      sh(join(folder, 'work'), join(toolsDir, 'node_modules/.bin/automata'), ['create-game', GAME])

      // What was written must install outside the repository: no workspace links, the running version of each package.
      const written = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      const version = (
        JSON.parse(readFileSync(join(root, 'packages/tools/package.json'), 'utf8')) as { version: string }
      ).version
      const wanted = { ...written.dependencies, ...written.devDependencies }
      const ours = Object.entries(wanted).filter(([name]) => name.startsWith('@mcthaydt/automata'))
      expect(ours.length, 'the game depends on the framework').toBeGreaterThan(0)
      for (const [name, spec] of ours)
        expect(spec, `${name} must ask for the running version, not a workspace link`).toBe(`^${version}`)
      expect(Object.keys(wanted), 'no dependency on Ruken for a web and itch.io game').not.toContain(
        '@ruken/sdk',
      )
    })

    await step('install it', () => {
      writeFileSync(join(gameDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(gameDir, 'pnpm', ['install', '--no-frozen-lockfile'])
    })

    await step('check it', () => {
      sh(gameDir, 'pnpm', ['check'])
    })

    await step('test it', () => {
      sh(gameDir, 'pnpm', ['test'])
    })

    await step('play it in a browser', async () => {
      sh(gameDir, 'pnpm', ['build:web'])
      // The checks every public host shares: what a stranger runs before putting `dist/` on a static host.
      sh(gameDir, 'pnpm', ['prepare:web'])
      const server = await serveStatic(join(gameDir, 'dist'), {})
      try {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(String(error)))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.goto(`${server.url}/`)
        await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')
        await expect(page.getByTestId('title-screen')).toBeVisible()
        await page.getByRole('button', { name: 'Play' }).click()
        await expect(page.getByTestId('play-screen')).toBeVisible()
        await expect.poll(() => squareAt(page), { timeout: 20_000 }).not.toBeNull()
        const start = (await squareAt(page)) as { x: number; y: number }
        // Hold the key for a moment: the square moves 2 pixels a tick, so a long hold would carry it to the far wall.
        await hold(page, 'ArrowRight', 150)
        await expect
          .poll(async () => ((await squareAt(page))?.x ?? start.x) - start.x, { timeout: 10_000 })
          .toBeGreaterThan(4)
        // The square starts on the level's floor, so holding down moves it nowhere: the wall the editor drew stops it.
        // Holding right after it, and waiting for that move, makes sure the frames after the down key are on the screen.
        const moved = (await squareAt(page)) as { x: number; y: number }
        await hold(page, 'ArrowDown', 300)
        await hold(page, 'ArrowRight', 150)
        await expect
          .poll(async () => ((await squareAt(page))?.x ?? moved.x) - moved.x, { timeout: 10_000 })
          .toBeGreaterThan(4)
        expect(((await squareAt(page)) as { x: number; y: number }).y).toBeCloseTo(moved.y, 0)
        // Escape pauses, and the Resume button is where the focus lands.
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('paused-screen')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
        expect(errors).toEqual([])
      } finally {
        await server.close()
      }
    })

    await step('make the itch.io zip', () => {
      sh(gameDir, 'pnpm', ['build:itch'])
      sh(gameDir, 'pnpm', ['prepare:itch'])
      expect(existsSync(join(gameDir, `${GAME}-0.1.0-itch.zip`)), 'the zip is beside the build').toBe(true)
    })
    finished = true
  } finally {
    // A failed run keeps its folder for a look (its path is attached to the report); a passing one leaves nothing behind.
    if (finished) rmSync(folder, { recursive: true, force: true })
    else await test.info().attach('the stranger folder', { body: folder, contentType: 'text/plain' })
  }
})
