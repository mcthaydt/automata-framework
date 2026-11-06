import { expect, type Page, test } from '@playwright/test'
import { newGameUrl } from './origin.ts'

// The path a new developer takes, end to end: the game `automata create-game my-game` writes, built for the web
// and previewed (serve-new-game.ts), opens on its title screen, plays, draws, and pauses on Escape.

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** True when the canvas shows more than one colour: something was drawn on the cleared stage. */
async function canvasDrew(page: Page): Promise<boolean> {
  const png = await page.locator('[data-layer="stage"] canvas').screenshot()
  return page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (context === null) return false
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      for (let i = 4; i < data.length; i += 4)
        if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) return true
      return false
    },
    [...png],
  )
}

test('a new game opens on its title, plays, draws and pauses on Escape', async ({ page }) => {
  const errors = await collectErrors(page)
  await page.goto(newGameUrl)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready')

  await expect(page.getByTestId('title-screen')).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('play-screen')).toBeVisible()
  await expect.poll(() => canvasDrew(page), { timeout: 20_000 }).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('paused-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
  expect(errors).toEqual([])
})
