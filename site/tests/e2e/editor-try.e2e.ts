import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// Spec 10.2 and 18.3: the Editor page shows what the editor does and opens the try-it editor, the same page
// `automata editor` serves, which starts on a sample game held in the page under the site's headers with nothing wrong
// in the console. Nothing is kept there: Share is how a level leaves.
test('the Editor page shows three pictures and opens the try-it editor on a sample game', async ({
  page,
}) => {
  const watch = watchPage(page, `http://127.0.0.1:${SITE_PORT}`)
  await page.goto('/editor')
  await expect(page.locator('main figure')).toHaveCount(3)
  await page.getByRole('link', { name: 'Try the editor' }).click()
  await expect(page).toHaveURL(/\/editor\/app\/$/)
  await expect(page.getByText('This is a sample game, not yours.', { exact: false })).toBeVisible()

  // A level made from the platformer template draws, and Share is how it leaves.
  await page.getByRole('button', { name: 'New level' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  expect(watch.problems).toEqual([])
})

const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
]

/** The try-it editor on a new platformer, drawn. */
async function openLevel(page: Page): Promise<void> {
  await page.goto('/editor/app/')
  await page.getByRole('button', { name: 'New level' }).click()
  await page.getByRole('button', { name: /Platformer/ }).click()
  await expect(page.locator('[data-level-canvas]')).toHaveAttribute('data-state', 'drawn')
}

// Both of these fail on the editors' code today (the plan audit's screens, A13): a phone shows the game's name cut off and
// controls past the edge. They are marked `fail` so the suite stays green and turns red the day the editors fix it, and the
// marker goes then. The site does not own that code.
test.describe('the try-it editor on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('nothing reaches past the screen’s edge and the game’s name reads whole', async ({ page }) => {
    test.fail(
      true,
      'the editors’ top bar cuts the name ("Sa…") and shows controls past 390 px (plan audit A13)',
    )
    await openLevel(page)
    const past = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('button, a, input, [role=tab]'))
        .filter((element) => element.offsetParent !== null && element.getBoundingClientRect().width > 0)
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 0.5)
        .map(
          (element) => element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName,
        ),
    )
    expect(past).toEqual([])
    const name = page.getByRole('banner').getByText('Sample game')
    expect(await name.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  })
})

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}, touch`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true })

    test('every control is at least 44 px', async ({ page }) => {
      await openLevel(page)
      const small = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>('button, a[href], input, select, [role=tab], [role=radio]'),
        )
          .filter((element) => element.offsetParent !== null)
          .map((element) => ({
            box: element.getBoundingClientRect(),
            label: element.textContent?.trim() || element.getAttribute('aria-label') || element.tagName,
          }))
          .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
          .map(({ box, label }) => `${label} ${Math.round(box.width)}×${Math.round(box.height)}`),
      )
      expect(small).toEqual([])
    })
  })
}

test('no page but the try-it editor offers a template', async ({ request }) => {
  const sitemap = readFileSync(resolve('build/sitemap.xml'), 'utf8')
  const pages = Array.from(
    sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g),
    (match) => match[1] || '/',
  )
  const offers: string[] = []
  for (const path of pages) {
    const html = await (await request.get(path)).text()
    for (const match of html.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const text = match[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (/^(Platformer|Top-down|Blank)\b|template/i.test(text)) offers.push(`${path}: ${text}`)
    }
  }
  expect(offers).toEqual([])
})
