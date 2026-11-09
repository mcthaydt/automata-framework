import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { devices, expect, type Page, test } from '@playwright/test'

// The site's motion, proved in a real browser: the wheel glides but never fights a key, a link or a box that scrolls
// itself; a click's new page settles in; Home's sections arrive as they near; and none of it ever leaves content
// hidden. The suite's other files run with reduced motion (playwright.config.ts) and check the finished page; this
// one asks for motion. Readiness is polled, never slept on.

test.use({ reducedMotion: 'no-preference' })

const manifest = JSON.parse(
  readFileSync(resolve('.svelte-kit/output/client/.vite/manifest.json'), 'utf8'),
) as Record<string, { file: string }>
const MOTION_FILES = ['src/shared/motion/animate.ts', 'src/shared/motion/smooth-scroll.ts'].map(
  (source) => manifest[source]?.file ?? '',
)

/** Every in-page route the sitemap lists, except the playground (a tool with its own journeys). */
const ROUTES = [
  ...readFileSync(resolve('build/sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/[^/]+(\/[^<]*)<\/loc>/g),
]
  .map((match) => match[1] as string)
  .filter((path) => !path.startsWith('/examples/'))

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))

/** Waits for the motion layer to have started on Home: Lenis has put its class on <html> (a fine pointer). */
async function ready(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => document.documentElement.classList.contains('lenis'), undefined, {
    timeout: 15_000,
  })
}

/** Elements inside <main> that something left half-hidden or moved: any inline opacity or transform. */
const leftOver = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>('main, main *')].filter(
        (element) => element.style.opacity !== '' || element.style.transform !== '',
      ).length,
  )

/** Samples `scrollY` once a frame for `ms` and returns every distinct value. */
const sampleScroll = (page: Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<number[]>((done) => {
        const values: number[] = []
        const start = performance.now()
        const tick = () => {
          const y = Math.round(window.scrollY)
          if (values.at(-1) !== y) values.push(y)
          if (performance.now() - start < duration) requestAnimationFrame(tick)
          else done(values)
        }
        tick()
      }),
    ms,
  )

test.describe('on a desktop with a mouse', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('a wheel notch glides over several frames and lands where a native one would', async ({ page }) => {
    await ready(page)
    await page.mouse.move(640, 400)
    const sampling = sampleScroll(page, 1500)
    await page.mouse.wheel(0, 300)
    const values = await sampling
    expect(values.length, `the page moved in ${values.length} steps`).toBeGreaterThan(4)
    expect(
      values.some((y) => y > 20 && y < 280),
      'it passed through the middle',
    ).toBe(true)
    expect(values.at(-1)).toBeGreaterThanOrEqual(290)
    expect(values.at(-1)).toBeLessThanOrEqual(310)
  })

  test('PageDown, End and Space still work, also straight after a wheel', async ({ page }) => {
    await ready(page)
    await page.keyboard.press('PageDown')
    await expect.poll(() => scrollY(page)).toBeGreaterThan(400)
    await page.keyboard.press('Home')
    await expect.poll(() => scrollY(page)).toBe(0)
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(200)
    await page.keyboard.press('End')
    const last = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(last - 4)
  })

  // Find in page and a script's `scrollTo` move the page natively. Lenis used to finish its glide over the top of that and
  // leave the page where the wheel was sending it. `window.find` scrolls the way the browser's find bar does, by the
  // page's own `scroll-behavior`, which a bare instant `scrollTo` does not.
  for (const [how, jump] of [
    ['a scrollTo', () => window.scrollTo({ top: 1200, behavior: 'instant' })],
    [
      'Find in page',
      () => {
        getSelection()?.removeAllRanges()
        const heading = [...document.querySelectorAll('main h2')].at(-1)?.textContent ?? ''
        ;(window as unknown as { find(text: string, ...flags: boolean[]): boolean }).find(
          heading,
          true,
          false,
          true,
        )
      },
    ],
  ] as const) {
    test(`${how} soon after a wheel notch holds`, async ({ page }) => {
      await ready(page, '/docs')
      await page.mouse.move(640, 400)
      for (const delay of [50, 150, 400, 700]) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await expect.poll(() => scrollY(page)).toBe(0)
        await expect(page.locator('html')).not.toHaveClass(/lenis-scrolling/)
        await page.mouse.wheel(0, 300)
        await page.waitForTimeout(delay)
        await page.evaluate(jump)
        // Neither the glide's remaining frames nor anything else may pull it back to where the wheel was sending it.
        await expect(page.locator('html')).not.toHaveClass(/lenis-scrolling/)
        expect(await scrollY(page), `${how} ${delay} ms after a notch`).toBeGreaterThan(1000)
      }
    })
  }

  test('a wheel over the docs sidebar scrolls the sidebar and not the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 })
    await ready(page, '/docs/editor')
    const overflow = await page.locator('.docs-sidebar').evaluate((node) => {
      const scroller = [node, ...node.querySelectorAll<HTMLElement>('*')].find(
        (element) =>
          element.scrollHeight > element.clientHeight + 40 &&
          getComputedStyle(element).overflowY !== 'visible',
      )
      scroller?.setAttribute('data-test-scroller', '')
      return scroller !== undefined
    })
    test.skip(!overflow, 'the sidebar does not overflow here')
    const box = (await page.locator('[data-test-scroller]').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 200)
    await expect
      .poll(() => page.locator('[data-test-scroller]').evaluate((node) => node.scrollTop))
      .toBeGreaterThan(20)
    expect(await scrollY(page)).toBe(0)
  })

  test('a wheel over the search results scrolls the results and not the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await ready(page)
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('searchbox')).toBeFocused()
    await page.getByRole('searchbox').fill('a')
    const results = page.locator('.search-results')
    expect(await results.evaluate((node) => node.scrollHeight > node.clientHeight + 40)).toBe(true)
    const box = (await results.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 200)
    await expect.poll(() => results.evaluate((node) => node.scrollTop)).toBeGreaterThan(100)
    expect(await scrollY(page)).toBe(0)
  })

  test('a contents link lands its heading under the header, also right after a wheel', async ({ page }) => {
    await ready(page, '/docs/editor')
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(150)
    const link = page.locator('.doc-toc a[href^="#"]').nth(2)
    const id = (await link.getAttribute('href'))!.slice(1)
    await link.click()
    // 96 px under the top, as the page's own `scroll-margin-top` puts it with or without smoothing.
    const top = () =>
      page.locator(`[id="${id}"]`).evaluate((node) => Math.round(node.getBoundingClientRect().top))
    await expect.poll(async () => Math.abs((await top()) - 96) <= 2, { timeout: 5000 }).toBe(true)
    await page.waitForTimeout(300)
    expect(Math.abs((await top()) - 96)).toBeLessThanOrEqual(2)
  })

  test('a click on Docs starts the new page at its top and settles it in, leaving nothing behind', async ({
    page,
  }) => {
    await ready(page)
    await page.keyboard.press('End')
    await expect.poll(() => scrollY(page)).toBeGreaterThan(2000)
    // Watch every frame from the click: the first frame after the URL changes is at the top and the page is whole.
    await page.evaluate(() => {
      const frames: Array<{ y: number; opacity: number }> = []
      ;(window as unknown as { __frames: typeof frames }).__frames = frames
      const watch = () => {
        if (location.pathname === '/docs') {
          frames.push({
            y: Math.round(window.scrollY),
            opacity: Number(getComputedStyle(document.querySelector('main') as Element).opacity),
          })
        }
        requestAnimationFrame(watch)
      }
      requestAnimationFrame(watch)
    })
    await page.getByRole('banner').getByRole('link', { name: 'Docs', exact: true }).click()
    await expect(page).toHaveURL(/\/docs$/)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-page-change')))
      .toBe(false)
    const frames = await page.evaluate(
      () => (window as unknown as { __frames: Array<{ y: number; opacity: number }> }).__frames,
    )
    expect(frames.length).toBeGreaterThan(0)
    expect(frames[0]?.y, 'the first frame of the new page is at its top').toBe(0)
    await expect
      .poll(() =>
        page.evaluate(() => Number(getComputedStyle(document.querySelector('main') as Element).opacity)),
      )
      .toBe(1)
    await expect.poll(() => leftOver(page), { timeout: 2000 }).toBe(0)
  })

  test('another guide keeps its sidebar fully visible while the article settles', async ({ page }) => {
    await ready(page, '/docs/editor')
    await page.evaluate(() => {
      const seen: number[] = []
      ;(window as unknown as { __sidebar: number[] }).__sidebar = seen
      const watch = () => {
        seen.push(Number(getComputedStyle(document.querySelector('.docs-sidebar') as Element).opacity))
        requestAnimationFrame(watch)
      }
      requestAnimationFrame(watch)
    })
    await page
      .locator('.docs-sidebar nav a')
      .filter({ hasNotText: /^Editor$/ })
      .first()
      .click()
    await expect(page).not.toHaveURL(/\/docs\/editor$/)
    await page.waitForTimeout(500)
    const seen = await page.evaluate(() => (window as unknown as { __sidebar: number[] }).__sidebar)
    expect(Math.min(...seen)).toBe(1)
  })

  test('Back after a wheel lands where the browser restores it and does not drift', async ({ page }) => {
    await ready(page, '/docs/editor')
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(590)
    await page
      .locator('.docs-sidebar nav a')
      .filter({ hasNotText: /^Editor$/ })
      .first()
      .click()
    await expect(page).not.toHaveURL(/\/docs\/editor$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/docs\/editor$/)
    await page.waitForTimeout(1000)
    const settled = await scrollY(page)
    await page.waitForTimeout(500)
    expect(await scrollY(page)).toBe(settled)
  })

  test('Home’s sections arrive as the reader scrolls and leave no inline style', async ({ page }) => {
    await ready(page)
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 10_000,
    })
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y <= height; y += 500) {
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(60)
    }
    await expect.poll(() => leftOver(page), { timeout: 8000 }).toBe(0)
    await expect.poll(() => page.locator('main [data-motion]').count()).toBe(0)
  })

  test('jumping straight to the end and back up leaves every section visible', async ({ page }) => {
    await ready(page)
    // Wait until the sections below the fold are held back, so the jump has something to skip.
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 10_000,
    })
    await page.keyboard.press('End')
    await expect.poll(() => leftOver(page), { timeout: 8000 }).toBe(0)
    await page.keyboard.press('Home')
    await expect.poll(() => scrollY(page)).toBe(0)
    expect(
      await page
        .locator('main .home-section h2')
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).opacity)),
    ).not.toContain('0')
  })

  test('scrolling a late section into view with scrollIntoView shows it', async ({ page }) => {
    await ready(page)
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 10_000,
    })
    await page.locator('main .home-section').nth(3).scrollIntoViewIfNeeded()
    await expect
      .poll(
        () =>
          page
            .locator('main .home-section')
            .nth(3)
            .locator('h2')
            .evaluate((n) => getComputedStyle(n).opacity),
        {
          timeout: 5000,
        },
      )
      .toBe('1')
  })

  test('arriving at Home by a click from Docs hides and reveals its sections as a first visit does', async ({
    page,
  }) => {
    await ready(page, '/docs')
    await page
      .getByRole('banner')
      .getByRole('link', { name: /^automata/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/$/)
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 5000,
    })
    await page.keyboard.press('End')
    await expect.poll(() => leftOver(page), { timeout: 8000 }).toBe(0)
  })

  test('Tab into a section that is still waiting reveals it, and the focused link is visible', async ({
    page,
  }) => {
    await ready(page)
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 10_000,
    })
    const below = await page.evaluate(() => {
      const hidden = [...document.querySelectorAll<HTMLElement>('main .home-section')].filter(
        (section) =>
          section.querySelector('[data-motion]') && section.getBoundingClientRect().top > innerHeight,
      )
      return hidden.length
    })
    expect(below).toBeGreaterThan(0)
    let focusedInside = false
    for (let i = 0; i < 80 && !focusedInside; i++) {
      await page.keyboard.press('Tab')
      focusedInside = await page.evaluate(() => {
        const active = document.activeElement
        return (
          active?.closest('main .home-section') != null &&
          (active.getBoundingClientRect().top > innerHeight * 0.6 || window.scrollY > 300)
        )
      })
    }
    expect(focusedInside, 'Tab reached a section further down').toBe(true)
    await expect
      .poll(() => page.evaluate(() => Number(getComputedStyle(document.activeElement as Element).opacity)), {
        timeout: 800,
      })
      .toBe(1)
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const section = document.activeElement?.closest('.home-section')
            return section ? [...section.querySelectorAll<HTMLElement>('[data-motion]')].length : -1
          }),
        { timeout: 3000 },
      )
      .toBe(0)
  })

  test('every page loads without an error and ends fully visible', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    for (const path of ROUTES) {
      await page.goto(path)
      await page.waitForFunction(() => document.documentElement.classList.contains('lenis'), undefined, {
        timeout: 15_000,
      })
      await page.keyboard.press('End')
      await expect.poll(() => leftOver(page), { message: path, timeout: 8000 }).toBe(0)
      expect(await page.evaluate(() => document.documentElement.hasAttribute('data-page-change')), path).toBe(
        false,
      )
    }
    expect(errors).toEqual([])
  })

  test('the playground keeps the wheel for itself', async ({ page }) => {
    await page.goto('/examples/core-basic-window')
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => document.documentElement.classList.contains('lenis'))).toBe(false)
  })

  test('the demo still plays right after a wheel', async ({ page }) => {
    await ready(page)
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Play it' }).click()
    await expect(page.locator('iframe[title="Emberwick"]')).toBeAttached({ timeout: 40_000 })
  })

  test('Cmd/Ctrl+K opens search with focus in the field at once and Escape closes it at once', async ({
    page,
  }) => {
    await ready(page)
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('searchbox')).toBeFocused()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 300 })
  })

  test('reduced motion turned on mid-visit stops the glide and shows every part', async ({ page }) => {
    await ready(page)
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 10_000,
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('lenis')))
      .toBe(false)
    await expect.poll(() => leftOver(page), { timeout: 3000 }).toBe(0)
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('nothing extra downloads, nothing is hidden and a click leaves no mark', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('End')
    await page.waitForTimeout(800)
    expect(requested.filter((url) => MOTION_FILES.some((file) => url.endsWith(file)))).toEqual([])
    expect(await leftOver(page)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.classList.contains('lenis'))).toBe(false)
    await page.getByRole('banner').getByRole('link', { name: 'Docs', exact: true }).click()
    await expect(page).toHaveURL(/\/docs$/)
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-page-change'))).toBe(false)
  })
})

test.describe('on a phone', () => {
  // A phone's size, touch and user agent; its browser stays the project's (a describe cannot switch engines).
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 13']
  test.use({ ...phone, reducedMotion: 'no-preference' })

  test('has no smooth scrolling and never downloads it; sections still arrive', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))
    await page.goto('/')
    await page.waitForFunction(() => document.querySelector('main [data-motion]') !== null, undefined, {
      timeout: 15_000,
    })
    expect(await page.evaluate(() => document.documentElement.classList.contains('lenis'))).toBe(false)
    expect(requested.some((url) => url.endsWith(MOTION_FILES[1] ?? 'none'))).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})
