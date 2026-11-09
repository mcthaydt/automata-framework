// QB.3 browser gates on the built site. Run `pnpm build` first; the pages come from the built
// sitemap.xml, so a new page is covered without editing this file.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import {
  axeViolations,
  cookieNames,
  deadButtons,
  horizontalOverflow,
  keyboardProblems,
  smallTapTargets,
  storageKeys,
  watchPage,
} from './gates'

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`
const PAGES = Array.from(
  readFileSync(resolve('build/sitemap.xml'), 'utf8').matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g),
  (match) => match[1] || '/',
)
// Addresses nothing answers, at the top level and nested (the 404 page's links are root-relative so both work).
const MISSING = ['/no-such-page', '/docs/no/such/page']
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'landscape phone', width: 780, height: 270 },
]
const PRIMARY_LINKS = ['Docs', 'Examples', 'Editor', 'Pricing', 'Changelog']

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
      test(`${path}: no horizontal scroll, errors, third-party requests, cookies, storage or axe violations`, async ({
        page,
        context,
      }) => {
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
      const nav = (await desktop.isVisible())
        ? desktop
        : page.getByRole('navigation', { name: 'Mobile navigation' })
      if (nav !== desktop) await page.getByLabel('Menu').click()
      for (const label of PRIMARY_LINKS) {
        const link = nav.getByRole('link', { name: label, exact: true })
        await link.scrollIntoViewIfNeeded()
        await expect(link).toBeInViewport()
      }
    })

    test('a Make a game link is in the header', async ({ page }) => {
      await open(page, '/docs')
      await expect(
        page
          .locator('header.site-header')
          .getByRole('link', { name: 'Make a game', exact: true })
          .locator('visible=true'),
      ).toHaveCount(1)
    })

    test('images are at most twice their rendered width', async ({ page }) => {
      test.setTimeout(120_000)
      // The logo strip moves, and a moving picture is never "stable" to scroll to; sizes are what is measured here.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      for (const path of ['/', '/start', '/examples']) {
        await open(page, path)
        for (const image of await page.locator('img:visible').all()) {
          await image.scrollIntoViewIfNeeded()
          await expect
            .poll(() =>
              image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
            )
            .toBe(true)
          const size = await image.evaluate((element: HTMLImageElement) => ({
            src: element.currentSrc,
            natural: element.naturalWidth,
            rendered: element.getBoundingClientRect().width,
          }))
          expect(
            size.natural,
            `${path}: ${size.src} is ${size.natural}px wide, drawn at ${size.rendered}px`,
          ).toBeLessThanOrEqual(2 * size.rendered)
        }
      }
    })
  })
}

// The six sizes of the site visual audit (M1, L1): phones and tablets as touch screens.
const AUDIT_SIZES = [
  { name: 'phone portrait', width: 390, height: 844, touch: true },
  { name: 'phone landscape', width: 844, height: 390, touch: true },
  { name: 'tablet portrait', width: 820, height: 1180, touch: true },
  { name: 'tablet landscape', width: 1180, height: 820, touch: true },
  { name: 'desktop portrait', width: 1080, height: 1920, touch: false },
  { name: 'desktop landscape', width: 1440, height: 900, touch: false },
]

for (const size of AUDIT_SIZES) {
  test.describe(`${size.name} ${size.width}×${size.height}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch && size.width < 900,
    })

    test('every link and button on every page is big enough to tap', async ({ page }) => {
      test.setTimeout(180_000)
      const small: string[] = []
      for (const path of [...PAGES, ...MISSING]) {
        await open(page, path)
        for (const target of await smallTapTargets(page)) small.push(`${path}: ${target}`)
      }
      expect(small).toEqual([])
    })

    if (size.width < 760)
      test('the open menu is opaque: nothing on the page shows through it', async ({ page }) => {
        await open(page, '/')
        await page.getByLabel('Menu').click()
        const menu = page.getByRole('navigation', { name: 'Mobile navigation' })
        await expect(menu).toBeVisible()
        const background = await menu.evaluate((element) => getComputedStyle(element).backgroundColor)
        // rgb(…) has no alpha; rgba(…, a) and transparent let the page show through.
        expect(background).toMatch(/^rgb\(/)
      })

    test(
      size.touch
        ? 'search shows no keyboard shortcut on a touch screen'
        : 'search shows its keyboard shortcut',
      async ({ page }) => {
        await open(page, '/')
        await expect(page.locator('header kbd').locator('visible=true')).toHaveCount(size.touch ? 0 : 1)
      },
    )
  })
}

test.describe('phone 375×667', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the primary action is visible without scrolling', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByRole('link', { name: 'Make a game' }).first()).toBeInViewport()
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
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 375, height: 667 },
      baseURL: ORIGIN,
    })
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

  test('a missing address shows "Page not found" in the first paint, before any script runs', async ({
    request,
  }) => {
    const response = await request.get('/no-such-page')
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Page not found')
  })

  test('/app at 390 × 844 stacks the two prices and nothing reaches past the screen’s edge', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/app')
    const boxes = await page
      .locator('.price')
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()))
    expect(boxes).toHaveLength(2)
    expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom - 1)
    expect(boxes[0].left).toBe(boxes[1].left)
    expect(await horizontalOverflow(page)).toEqual([])
  })

  test('a missing address is branded, with ways back', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
    for (const name of ['Go to the home page', 'Read the docs']) {
      await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible()
    }
  })

  test('a nested missing address is styled and its links work', async ({ page }) => {
    const failed: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/_app/') && response.status() !== 200) failed.push(response.url())
    })
    await page.goto('/docs/nope/deeper', { waitUntil: 'networkidle' })
    expect(failed).toEqual([])
    // Styled: the lime button has its fill, which a page without its stylesheet does not.
    const fill = await page
      .getByRole('link', { name: 'Go to the home page' })
      .evaluate((a) => getComputedStyle(a).backgroundColor)
    expect(fill).not.toBe('rgba(0, 0, 0, 0)')
    await page.getByRole('link', { name: 'Go to the home page' }).click()
    await expect(page).toHaveURL(`${ORIGIN}/`)
  })

  test('the demo runner shows its loading state, then its failure state', async ({ page }) => {
    let fail = () => {}
    const failed = new Promise<void>((release) => {
      fail = release
    })
    // Hold the bundle until the loading state is asserted, then answer as a bundle whose boot failed.
    await page.route('**/demos/emberwick/index.html**', async (route) => {
      await failed
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html data-state="failed"><body>boot failed</body></html>',
      })
    })
    await open(page, '/')
    const runner = page.getByTestId('demo-runner-container')
    await runner.getByRole('button', { name: 'Play it' }).click()
    await expect(runner.getByRole('status')).toHaveText('Starting Emberwick…')
    fail()
    await expect(runner.getByRole('alert')).toHaveText("Emberwick didn't start.")
    await expect(runner.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('search shows an empty state when nothing matches', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Search the docs and the API' }).click()
    await page.getByLabel('Search pages, docs, API and demos').fill('qqzzxxnothing')
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Nothing found. Try another word.')
  })
})

test('on a slow 3G connection the home page heading and primary action appear', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'network throttling needs the Chrome DevTools Protocol')
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  // Chrome DevTools' "Slow 3G" preset: 400 ms latency, about 50 KB/s each way.
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 50 * 1024,
  })
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/', { waitUntil: 'commit', timeout: 60_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Make a game' }).first()).toBeInViewport({
    timeout: 30_000,
  })
})

// QB.3j. Lighthouse charges to the poster's LCP every picture fetched before it paints. The home page's one other
// picture, the editor, is far below the poster; `loading="lazy"` alone let Chromium fetch it at once, so NearView keeps
// it out of the page until the reader is near it, and the first load asks for the poster alone.
test('the home page requests only the poster picture until the reader scrolls toward the editor', async ({
  page,
}) => {
  const requested: string[] = []
  page.on('request', (request) => {
    const name = /\/previews\/([^/]+)$/.exec(new URL(request.url()).pathname)?.[1]
    if (name) requested.push(name)
  })
  await page.setViewportSize({ width: 412, height: 823 })
  await open(page, '/')
  const notThePoster = () => requested.filter((name) => !name.startsWith('emberwick'))
  expect(requested.length, 'the poster is requested').toBeGreaterThan(0)
  expect(notThePoster()).toEqual([])
  // The box holds the picture's place; the picture joins the page once the reader is near it (NearView).
  await page
    .locator('main .near-view')
    .evaluate((box) => box.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const editor = page.locator('main .near-view picture img')
  await expect(editor).toHaveJSProperty('complete', true, { timeout: 15_000 })
  expect(notThePoster().some((name) => name.startsWith('editor'))).toBe(true)
})

// QB.3j. Lighthouse charges to the first paint every request that finished before it. On a fast host the thirty or so
// module requests of hydration finish in under 100 ms, so when they start at once they all count against the poster's
// LCP (2.6 to 3.2 s on the Mac against 1.4 to 1.8 s once hydration waits). `hydrateAfterFirstPaint` makes the start
// script wait. The stylesheet is held back here so the first paint is late enough that a request made at once would have
// finished before it; the hydration modules must still start after it, and must start.
test('hydration requests its modules only after the first contentful paint', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Lighthouse, which this protects, measures Chromium')
  await page.route('**/*.css', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  await open(page, '/')
  const { paint, chunkStarts } = await page.evaluate(() => ({
    paint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    chunkStarts: performance
      .getEntriesByType('resource')
      .filter((entry) => /\/_app\/immutable\/chunks\//.test(entry.name))
      .map((entry) => entry.startTime),
  }))
  expect(paint, 'the page painted').not.toBeNull()
  expect(chunkStarts.length, 'hydration requested its modules').toBeGreaterThan(10)
  expect(
    chunkStarts.filter((start) => start < (paint ?? 0)),
    'module requests that began before the first paint',
  ).toEqual([])
})

// Without script the home page's pictures are still there: they are plain pictures, not drawn by script.
test.describe('without script', () => {
  test.use({ javaScriptEnabled: false })

  test('the home page still shows its pictures', async ({ page }) => {
    await page.goto('/')
    const pictures = page.locator('main picture img')
    expect(await pictures.count()).toBeGreaterThanOrEqual(1)
    // A picture has alt text, or it is decorative: hidden from readers (a repeat in the logo strip) or a picture inside a
    // link that already says in words where it goes (an example's card).
    const unnamed = await pictures.evaluateAll((images) =>
      images
        .filter((image) => !image.getAttribute('alt'))
        .filter((image) => !image.closest('[aria-hidden="true"]'))
        .filter((image) => !image.closest('a')?.textContent?.trim())
        .map((image) => image.getAttribute('src')),
    )
    expect(unnamed, 'every picture has alt text or is decorative').toEqual([])
    await pictures.last().scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        pictures.last().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
  })
})

// One shell: every page starts at the header logo's left edge, titles are one weight, and the header does
// not move from page to page.
const SHELL_PAGES = [
  '/',
  '/start',
  '/docs/how-it-works',
  '/examples',
  '/examples/shapes-rects',
  '/api',
  '/api/0.0.5/framework',
  '/privacy',
  '/terms',
  '/editor',
]

for (const width of [390, 820, 1440]) {
  test.describe(`one shell at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test("every page's content starts at the logo's x", async ({ page }) => {
      for (const path of SHELL_PAGES) {
        await open(page, path)
        const edges = await page.evaluate(() => ({
          logo: document.querySelector('.site-header .logo')?.getBoundingClientRect().left ?? -1,
          content: document.querySelector('main .page-wrap')?.getBoundingClientRect().left ?? -2,
        }))
        expect(
          Math.abs(edges.content - edges.logo),
          `${path}: logo ${edges.logo}, content ${edges.content}`,
        ).toBeLessThanOrEqual(1)
      }
    })

    test('h1 has font-weight 600 on every page', async ({ page }) => {
      for (const path of SHELL_PAGES) {
        await open(page, path)
        const weight = await page
          .locator('main h1')
          .first()
          .evaluate((h1) => getComputedStyle(h1).fontWeight)
        expect(weight, path).toBe('600')
      }
    })
  })
}

test.describe('the header', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the header links do not move between pages', async ({ page }) => {
    const linkEdges = async (path: string) => {
      await open(page, path)
      return page
        .locator('.site-header nav.links a')
        .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().left * 10) / 10))
    }
    const home = await linkEdges('/')
    expect(await linkEdges('/docs/how-it-works')).toEqual(home)
    expect(await linkEdges('/examples')).toEqual(home)
  })
})

test.describe('the command on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the command copies whole at 390 px', async ({ page }) => {
    // The clipboard is stubbed in the page so WebKit and Firefox run this too (only Chromium can grant clipboard-read).
    await page.addInitScript(() => {
      ;(window as unknown as { copied: string[] }).copied = []
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => (window as unknown as { copied: string[] }).copied.push(text),
        },
      })
    })
    await open(page, '/')
    const shown = await page
      .locator('main code.ellipsis')
      .first()
      .evaluate((code) => ({
        text: code.textContent ?? '',
        cut: code.scrollWidth > code.clientWidth,
      }))
    await page.getByRole('button', { name: 'Copy command' }).first().click()
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied)
    expect(copied).toEqual([shown.text])
    expect(shown.text.length).toBeGreaterThan(20)
    // On a 390 px phone the command may be cut, but only with an ellipsis, never wrapped.
    const style = await page
      .locator('main code.ellipsis')
      .first()
      .evaluate((code) => {
        const css = getComputedStyle(code)
        return { overflow: css.overflow, ellipsis: css.textOverflow, wrap: css.whiteSpace }
      })
    expect(style).toEqual({ overflow: 'hidden', ellipsis: 'ellipsis', wrap: 'nowrap' })
  })
})
