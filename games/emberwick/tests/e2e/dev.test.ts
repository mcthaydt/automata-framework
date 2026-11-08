import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { devTuningFile, devUrl } from './origins.ts'

// Emberwick on its dev server (`pnpm dev`), the page the Tuner shows beside its settings. A saved tuning file
// starts the game over on the new tuning without reloading the page (main.ts accepts the content plugin's HMR
// update). The server compiles a copy of content/ (`pnpm e2e:dev`), so the committed tuning is never touched.

test.describe('the dev server', () => {
  let original = ''
  test.beforeAll(() => {
    original = readFileSync(devTuningFile, 'utf8')
  })
  test.afterEach(() => writeFileSync(devTuningFile, original))

  test('a saved setting restarts the game on the new tuning, on the same page', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(devUrl)
    const game = page.locator('#game')
    await expect(game).toHaveAttribute('data-content-hash', /^[0-9a-f]+$/)
    await expect(game).toHaveAttribute('data-screen', /splash|menu/)
    const first = await game.getAttribute('data-content-hash')
    // A reload would lose this.
    await page.evaluate(() => {
      ;(window as unknown as { marker: string }).marker = 'same page'
    })

    // What the Tuner writes when Running speed is dragged from 384 to 400.
    writeFileSync(devTuningFile, original.replace(/^MAX_RUN = \{ value = 384,/m, 'MAX_RUN = { value = 400,'))
    await expect(game).not.toHaveAttribute('data-content-hash', first ?? '')
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('same page')
    // The new game is running: it starts over at its first screen, and one game, not two, is in the root.
    await expect(game).toHaveAttribute('data-screen', /splash|menu/)
    await expect(game.locator('canvas')).toHaveCount(1)
    expect(errors).toEqual([])
  })
})
