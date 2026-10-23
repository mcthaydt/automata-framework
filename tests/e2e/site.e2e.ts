// QB.3 browser gates on the built site (quality-bar spec §4.2). Run `pnpm build` first; the pages come from the built
// sitemap.xml, so a new page is covered without editing this file.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { axeViolations, cookieNames, deadButtons, horizontalOverflow, keyboardProblems, storageKeys, watchPage } from './gates'

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`
const PAGES = Array.from(readFileSync(resolve('build/sitemap.xml'), 'utf8').matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g), match => match[1] || '/')
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'landscape phone', width: 780, height: 270 },
]
const PRIMARY_LINKS = ['Start', 'Examples', 'Showcase', 'Docs', 'AI']

/** Loads a page and waits for semantic readiness: no network in flight and the web fonts applied. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

test('the sitemap lists the pages under test', () => {
  expect(PAGES).toContain('/')
  expect(PAGES).toContain('/privacy')
  expect(PAGES.length).toBeGreaterThan(20)
})

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const path of PAGES) {
      test(`${path}: no horizontal scroll, errors, third-party requests, cookies, storage or axe violations`, async ({ page, context }) => {
        const watch = watchPage(page, ORIGIN)
        await open(page, path)
        expect(await horizontalOverflow(page)).toEqual([])
        // axe at the narrowest and widest layouts; the middle two share their CSS.
        if (viewport.width === 375 || viewport.width === 1280) expect(await axeViolations(page)).toEqual([])
        expect(await cookieNames(context)).toEqual([])
        expect(await storageKeys(page)).toEqual([])
        expect(watch.problems).toEqual([])
      })
    }

    test('the main navigation shows every primary link', async ({ page }) => {
      await open(page, '/')
      const desktop = page.getByRole('navigation', { name: 'Main navigation' })
      const nav = await desktop.isVisible() ? desktop : page.getByRole('navigation', { name: 'Mobile navigation' })
      if (nav !== desktop) await page.locator('.mobile-nav summary').click()
      for (const label of PRIMARY_LINKS) {
        const link = nav.getByRole('link', { name: label, exact: true })
        await link.scrollIntoViewIfNeeded()
        await expect(link).toBeInViewport()
      }
    })

    test('a Start link is in the header', async ({ page }) => {
      await open(page, '/docs')
      await expect(page.locator('header.site-header').getByRole('link', { name: 'Start', exact: true }).locator('visible=true')).toHaveCount(1)
    })

    test('images are at most twice their rendered width', async ({ page }) => {
      for (const path of ['/', '/start', '/showcase']) {
        await open(page, path)
        for (const image of await page.locator('img:visible').all()) {
          await image.scrollIntoViewIfNeeded()
          await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
          const size = await image.evaluate((element: HTMLImageElement) => ({ src: element.currentSrc, natural: element.naturalWidth, rendered: element.getBoundingClientRect().width }))
          expect(size.natural, `${path}: ${size.src} is ${size.natural}px wide, drawn at ${size.rendered}px`).toBeLessThanOrEqual(2 * size.rendered)
        }
      }
    })
  })
}

test.describe('phone 375×667', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the primary action is visible without scrolling', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByRole('link', { name: 'Make your first change' }).first()).toBeInViewport()
  })

  for (const path of PAGES) {
    test(`${path}: every visible button does something`, async ({ page }) => {
      test.setTimeout(300_000)
      await open(page, path)
      expect(await deadButtons(page)).toEqual([])
    })
  }

  test('with JavaScript off every page shows its heading, content and links', async ({ browser }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 667 }, baseURL: ORIGIN })
    const page = await context.newPage()
    for (const path of PAGES) {
      await page.goto(path)
      await expect(page.locator('h1'), path).toBeVisible()
      expect((await page.locator('main').innerText()).length, path).toBeGreaterThan(100)
      expect(await page.locator('main a[href], header a[href]').count(), path).toBeGreaterThan(0)
      expect(await horizontalOverflow(page), path).toEqual([])
    }
    await context.close()
  })
})

test.describe('desktop 1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const path of PAGES) {
    test.describe(() => {
      // Reduced motion keeps the pages still. (/examples used to start its WebGL demo on arrival, and the demo's own
      // controls belong to the framework example; it now waits for Play, so no demo runs while the keys are pressed.)
      test.use({ reducedMotion: 'reduce' })
      test(`${path}: the keyboard reaches every control and each shows a focus ring`, async ({ page }) => {
        test.setTimeout(180_000)
        await open(page, path)
        expect(await keyboardProblems(page)).toEqual([])
      })
    })

    test.describe(() => {
      // As above. /examples has a button per source file, and each click re-highlights code; with a software-rendered
      // WebGL demo also running on a loaded machine that took over two minutes (first full run, before the demo waited for Play).
      test.use({ reducedMotion: 'reduce' })
      test(`${path}: every visible button does something`, async ({ page }) => {
        test.setTimeout(300_000)
        await open(page, path)
        expect(await deadButtons(page)).toEqual([])
      })
    })
  }

  test('an unknown path returns the branded 404 page with ways back', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lost your place?')
    for (const name of ['Back to overview', 'Read the docs', 'Explore examples']) {
      await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible()
    }
  })

  test('the demo runner shows its loading state, then its failure state', async ({ page }) => {
    let fail = () => {}
    const failed = new Promise<void>(release => { fail = release })
    // Hold the bundle until the loading state is asserted, then answer as a bundle whose boot failed.
    await page.route('**/demos/first-change/index.html', async route => {
      await failed
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-state="failed"><body>boot failed</body></html>' })
    })
    await open(page, '/start')
    const runner = page.getByTestId('demo-runner-container')
    await runner.getByRole('button', { name: 'Play demo' }).click()
    await expect(runner.getByRole('status')).toHaveText('Starting the demo…')
    fail()
    await expect(runner.getByRole('alert')).toHaveText("This demo couldn't start. Try again or open it in a new tab.")
    await expect(runner.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('search shows an empty state when nothing matches', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Search documentation and API' }).click()
    await page.getByLabel('Search pages, docs, API and demos').fill('qqzzxxnothing')
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('No matches. Try a function name or topic.')
  })
})

test('on a slow 3G connection the home page heading and primary action appear', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'network throttling needs the Chrome DevTools Protocol')
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  // Chrome DevTools' "Slow 3G" preset: 400 ms latency, about 50 KB/s each way.
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 })
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/', { waitUntil: 'commit', timeout: 60_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Make your first change' }).first()).toBeInViewport({ timeout: 30_000 })
})

// QB.3j. Chromium 153 fetches `loading="lazy"` pictures 1,500 to 2,000 px below the fold right after the poster, and
// Lighthouse charges them to the poster's LCP (3.4 s against 2.1 s without them). The home page therefore asks for a
// picture only when the reader is near it.
test('the home page requests only the poster picture until the reader scrolls toward the others', async ({ page }) => {
  const requested: string[] = []
  page.on('request', request => {
    const name = /\/previews\/([^/]+)$/.exec(new URL(request.url()).pathname)?.[1]
    if (name) requested.push(name)
  })
  await page.setViewportSize({ width: 412, height: 823 })
  await open(page, '/')
  const notThePoster = () => requested.filter(name => !name.startsWith('emberwick'))
  expect(requested.length, 'the poster is requested').toBeGreaterThan(0)
  expect(notThePoster()).toEqual([])

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(notThePoster, { message: 'pictures near the reader are requested' }).not.toEqual([])
  await expect(page.locator('img[src*="/previews/"]:visible').last()).toHaveJSProperty('complete', true)
})

// The prerendered page has no picture of its own below the poster, so a reader without script gets the noscript copies.
test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  test('the home page still shows its example pictures', async ({ page }) => {
    await page.goto('/')
    const pictures = page.locator('.lazy-picture img')
    expect(await pictures.count()).toBeGreaterThanOrEqual(3)
    for (const alt of await pictures.evaluateAll(images => images.map(image => image.getAttribute('alt')))) expect(alt, 'every picture has alt text').toBeTruthy()
    await pictures.last().scrollIntoViewIfNeeded()
    await expect.poll(() => pictures.last().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  })
})
