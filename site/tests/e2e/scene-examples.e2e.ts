// The 3D example page on a site built from tests/fixtures/scene-examples (`pnpm test:e2e:scenes`): the words above the
// frame, no horizontal scroll, a Play button a thumb can hit, and focus into the frame and back out.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { JSDOM } from 'jsdom'
import { BANNED_PHRASES, FRAMING_PHRASES, ownText, STANDALONE_NAMES } from '../../scripts/site-checks/copy.ts'
import { horizontalOverflow } from './gates'

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
]

const stage = (page: Page) => page.locator('.scene-frame .stage')
const play = (page: Page) => page.getByRole('button', { name: 'Play', exact: true })

for (const size of SIZES) {
  test.describe(`at ${size.width} × ${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    test('says what it shows above the frame, scrolls sideways nowhere, and has a Play button a thumb can hit', async ({
      page,
    }) => {
      await page.goto('/examples/scene-lamp')
      const words = await page.locator('.spec-list').boundingBox()
      const frame = await stage(page).boundingBox()
      expect(words && frame && words.y + words.height <= frame.y + 1).toBe(true)
      expect(await horizontalOverflow(page)).toEqual([])
      const button = await play(page).boundingBox()
      expect(button!.height).toBeGreaterThanOrEqual(48)
      expect(button!.width).toBeGreaterThanOrEqual(48)
      // The stage's title and the button sit one above the other, never one over the other.
      const title = await page.locator('.scene-frame .cover p').boundingBox()
      expect(title!.y + title!.height).toBeLessThanOrEqual(button!.y + 1)
      await play(page).scrollIntoViewIfNeeded()
      const inside = await play(page).boundingBox()
      expect(inside!.x).toBeGreaterThanOrEqual(0)
      expect(inside!.x + inside!.width).toBeLessThanOrEqual(size.width)
      expect(inside!.y).toBeGreaterThanOrEqual(0)
      expect(inside!.y + inside!.height).toBeLessThanOrEqual(size.height)
    })

    test('loads nothing of the 3D build until Play is pressed', async ({ page }) => {
      const requests: string[] = []
      page.on('request', (request) => requests.push(new URL(request.url()).pathname))
      await page.goto('/examples/scene-lamp')
      await page.waitForLoadState('networkidle')
      expect(requests.filter((path) => path.startsWith('/scenes/'))).toEqual([])
      await play(page).click()
      await expect(page.locator('.scene-frame iframe')).toHaveAttribute(
        'src',
        '/scenes/scene/lamp/index.html',
      )
      await expect.poll(() => requests.some((path) => path.startsWith('/scenes/scene/lamp/'))).toBe(true)
    })

    test('moves focus into the frame on Play and back out with Escape', async ({ page }) => {
      await page.goto('/examples/scene-lamp')
      await play(page).click()
      const frame = page.locator('.scene-frame iframe')
      await expect(frame).toBeVisible()
      // The frame's own document has the focus once it has loaded.
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Stop' })).toBeFocused()
    })
  })
}

test('the page’s words pass the copy check the site build runs', async () => {
  const html = readFileSync(resolve('build-scenes/examples/scene-lamp.html'), 'utf8')
  const text = ownText(new JSDOM(html).window.document)
  const failures = [
    ...BANNED_PHRASES.filter((phrase) => phrase.pattern.test(text)).map((phrase) => phrase.label),
    ...STANDALONE_NAMES.filter((name) => name.pattern.test(text)).map((name) => name.label),
    ...FRAMING_PHRASES.filter((phrase) => phrase.pattern.test(text)).map((phrase) => phrase.label),
  ]
  expect(failures).toEqual([])
  expect(text).toContain('Play')
})

test('leaves the private example without a page', async ({ page }) => {
  const response = await page.goto('/examples/scene-panel')
  expect(response?.status()).toBe(404)
})
