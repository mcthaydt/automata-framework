import { passFirstRun } from '@automata/tools/e2e'
import { expect, type Page, test } from '@playwright/test'
import { devUrl } from './origins.ts'

// The title screen stands on black, as the old game's did (`--c-void: #000000`): the page behind it and the frame that holds its
// name and Play are both black, and the bars round the picture are the same black, so nothing about the title is a lighter slab.
// It reads what the player sees (a screenshot's pixels) and the computed colours, and waits on the screen, never on a sleep.

/** The sRGB bytes of the pixels of a PNG at the given points (a tiny page-side decoder, so the test needs no image library). */
async function pixelsAt(page: Page, shot: Buffer, points: readonly (readonly [number, number])[]) {
  return page.evaluate(
    async ([base64, at]) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('no 2d context')
      context.drawImage(bitmap, 0, 0)
      return at.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)])
    },
    [shot.toString('base64'), points] as const,
  )
}

test('the title screen stands on black', async ({ page }) => {
  await page.goto(devUrl)
  await passFirstRun(page)
  const title = page.getByTestId('title-screen')
  await expect(title).toBeVisible({ timeout: 60_000 })
  const { width, height } = page.viewportSize() ?? { width: 844, height: 390 }
  // The four corners and the middle of each edge: no text sits on them, so each is the background itself.
  const points = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [Math.floor(width / 2), height - 3],
    [2, Math.floor(height / 2)],
    [width - 3, Math.floor(height / 2)],
  ] as const
  const pixels = await pixelsAt(page, await page.screenshot(), points)
  for (const pixel of pixels) expect(pixel).toEqual([0, 0, 0])
  // And the page says it in CSS too, so a screenshot taken while a font loads cannot hide a navy page.
  const colours = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
  }))
  expect(colours).toEqual({ html: 'rgb(0, 0, 0)', body: 'rgb(0, 0, 0)' })
})
