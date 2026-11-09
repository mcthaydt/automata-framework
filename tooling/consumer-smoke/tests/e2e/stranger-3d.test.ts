import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { pack3d, packAll, sh } from '#src/commands.ts'
import { serveStatic } from '#src/serve.ts'
import { overridesYaml, packOverrides, strangerFolder } from '#src/stranger.ts'

// The stranger's first hour with a 3D game: the same journey as stranger.test.ts, with `create-game --template 3d`.
// @automata/3d is private until Pixi 3D is public, so the journey runs only where it is asked for (AF_BETA_3D=1, the
// same switch that opens the template outside this repository) and packs it beside the published packages.
//
// It cannot pass yet: the 3D package ships its TypeScript sources until the release builds it to `dist/` like the others,
// and Node refuses to run sources under node_modules, so `vite.config.ts` (which reads the 3D content kinds) fails to
// load. Everything before that passes: the game is made, installs, and its boundaries, typecheck, orientation and
// inputs checks pass. The release pull request turns this journey on for every run.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const GAME = 'hall-game'

test.skip(process.env.AF_BETA_3D !== '1', 'The 3D template is behind AF_BETA_3D=1 until Pixi 3D is public.')

test('a stranger makes a 3D game, checks it, plays it and walks Wick', async ({ page }) => {
  const folder = strangerFolder()
  const toolsDir = join(folder, 'tools')
  const gameDir = join(folder, 'work', GAME)
  let overrides: Record<string, string> = {}
  let finished = false
  try {
    await test.step('make a 3D game', () => {
      overrides = { ...packOverrides(folder, packAll(root, folder)), ...pack3d(root, folder) }
      mkdirSync(toolsDir, { recursive: true })
      writeFileSync(
        join(toolsDir, 'package.json'),
        JSON.stringify({ name: 'stranger-tools', private: true, type: 'module' }),
      )
      writeFileSync(join(toolsDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(toolsDir, 'pnpm', ['add', overrides['@automata/tools'] as string])
      mkdirSync(join(folder, 'work'), { recursive: true })
      sh(
        join(folder, 'work'),
        join(toolsDir, 'node_modules/.bin/automata'),
        ['create-game', GAME, '--template', '3d'],
        {
          AF_BETA_3D: '1',
        },
      )
      const written = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
      }
      expect(Object.keys(written.dependencies)).toEqual(expect.arrayContaining(['@automata/3d', '@pixi/3d']))
      expect(existsSync(join(gameDir, 'content/levels/room.af-sector.json'))).toBe(true)
    })

    await test.step('install it', () => {
      writeFileSync(join(gameDir, 'pnpm-workspace.yaml'), overridesYaml(overrides))
      sh(gameDir, 'pnpm', ['install', '--no-frozen-lockfile'])
    })

    await test.step('check it', () => {
      sh(gameDir, 'pnpm', ['check'])
    })

    await test.step('test it', () => {
      sh(gameDir, 'pnpm', ['test'])
    })

    await test.step('play it in a browser and walk Wick', async () => {
      sh(gameDir, 'pnpm', ['build:web'])
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
        await page.getByRole('button', { name: 'Play' }).click()
        await expect(page.getByTestId('play-screen')).toBeVisible()
        const stage = page.locator('[data-layer="stage"] canvas')
        await expect(stage).toBeVisible()
        // The camera follows Wick, so the room's picture moves when he does: the frames before and after holding forward differ.
        await page.waitForTimeout(1500)
        const before = await stage.screenshot()
        await page.keyboard.down('KeyW')
        await page.waitForTimeout(700)
        await page.keyboard.up('KeyW')
        await page.waitForTimeout(500)
        expect((await stage.screenshot()).equals(before), 'Wick walked, so the picture changed').toBe(false)
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('paused-screen')).toBeVisible()
        expect(errors).toEqual([])
      } finally {
        await server.close()
      }
    })
    finished = true
  } finally {
    if (finished) rmSync(folder, { recursive: true, force: true })
    else await test.info().attach('the stranger folder', { body: folder, contentType: 'text/plain' })
  }
})
