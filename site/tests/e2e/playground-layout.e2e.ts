// the playground's layouts, its controls' sizes, the Preview
// toggle, Fullscreen and the 50-edit soak, in real browsers.
import { expect, type Page, test } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { axeViolations, horizontalOverflow, watchPage } from './gates'

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`
const LAYOUTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'landscape phone', width: 780, height: 270 },
]
const root = (page: Page) => page.locator('.playground')
const frame = (page: Page) => page.locator('.playground iframe.shown')

/** Opens shapes-rects at `size` and waits for the original to run (the preview starts once it is near the screen). */
async function running(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size)
  await page.goto('/examples/shapes-rects')
  await page.locator('.preview-panel').scrollIntoViewIfNeeded()
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
}

const box = async (page: Page) => {
  const { x, y, width, height } = (await frame(page).boundingBox())!
  const scrolled = await page.evaluate(() => window.scrollY)
  return { x, y: y + scrolled, width, height }
}

test('at phone width, changing only the viewport height leaves the preview as it was', async ({ page }) => {
  await running(page, { width: 375, height: 667 })
  const before = await box(page)
  for (const height of [400, 667]) {
    await page.setViewportSize({ width: 375, height })
    await page.waitForTimeout(300)
    expect(await box(page)).toEqual(before)
  }
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
})

test('the Preview toggle hides the preview without resizing or reloading it, and shows it again', async ({
  page,
}) => {
  await running(page, { width: 375, height: 667 })
  const toggle = page.getByRole('button', { name: 'Preview', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const size = await frame(page).evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }))
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  const wrapper = page.locator('.playground-preview')
  await expect(wrapper).toHaveAttribute('inert', '')
  expect((await wrapper.boundingBox())?.height ?? 0).toBe(0)
  expect(
    await frame(page).evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight })),
  ).toEqual(size)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(wrapper).not.toHaveAttribute('inert')
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
})

test('there is no Preview toggle when code and preview sit side by side', async ({ page }) => {
  await running(page, { width: 1280, height: 800 })
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeHidden()
})

for (const layout of LAYOUTS) {
  test(`${layout.name} ${layout.width}×${layout.height}: the layout, no overflow, and every control at least 44 px`, async ({
    page,
  }) => {
    await running(page, layout)
    const code = (await page.locator('.playground-code').boundingBox())!
    const preview = (await page.locator('.playground-preview').boundingBox())!
    if (layout.width < 700) expect(preview.y + preview.height).toBeLessThanOrEqual(code.y)
    else expect(preview.x).toBeGreaterThanOrEqual(code.x + code.width)
    if (layout.height < 500) {
      // The panel fits below the site header, so the whole game is on screen at once.
      const header = (await page.locator('header').first().boundingBox())!
      expect((await page.locator('.preview-panel').boundingBox())!.height).toBeLessThanOrEqual(
        layout.height - header.height,
      )
    }
    if (layout.width >= 700) {
      // Sticky: scrolling the code leaves the preview on screen.
      await page.locator('.playground-code').evaluate((element) => element.scrollIntoView({ block: 'end' }))
      const after = (await page.locator('.preview-panel').boundingBox())!
      expect(after.y).toBeGreaterThanOrEqual(0)
      expect(after.y).toBeLessThan(layout.height)
    }
    await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible()
    expect(await horizontalOverflow(page)).toEqual([])
    const small = await page.locator('.playground').evaluate((element) =>
      [...element.querySelectorAll('button, a')]
        .filter((control) => (control as HTMLElement).offsetParent !== null)
        .map((control) => ({
          text: control.textContent!.trim(),
          ...control.getBoundingClientRect().toJSON(),
        }))
        .filter((control) => control.width < 44 || control.height < 44)
        .map((control) => `${control.text}: ${Math.round(control.width)}×${Math.round(control.height)}`),
    )
    expect(small).toEqual([])
  })
}

test('Fullscreen puts the preview panel in fullscreen and takes it out again', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'headless WebKit does not grant element fullscreen')
  await running(page, { width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.className ?? ''))
    .toContain('preview-panel')
  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
})

test('Fullscreen says so when the browser refuses', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('refused'))
  })
  await running(page, { width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect(page.locator('.preview-panel')).toContainText('Fullscreen is unavailable in this browser.')
})

test('fifty edits in a row never hold more than two frames and settle at one, with no console errors', async ({
  page,
}) => {
  // Fifty edits at the quiet period's pace take about 12 s before the last run settles.
  test.setTimeout(90_000)
  const watch = watchPage(page, ORIGIN)
  await running(page, { width: 1280, height: 800 })
  await page.evaluate(() => {
    const record = window as unknown as { maxFrames: number }
    record.maxFrames = 0
    const count = () => {
      record.maxFrames = Math.max(record.maxFrames, document.querySelectorAll('.playground iframe').length)
    }
    new MutationObserver(count).observe(document.querySelector('.playground')!, {
      childList: true,
      subtree: true,
    })
  })
  const first = page.locator('[data-testid="static-code"] .line').first()
  const target = (await first.boundingBox())!
  await page.mouse.click(target.x + target.width - 2, target.y + target.height / 2)
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await page.keyboard.press('End')
  // Each keystroke lands after the quiet period, so each one is an edit that compiles and runs.
  for (let edit = 0; edit < 50; edit++) {
    await page.keyboard.type('x')
    await page.waitForTimeout(edit % 2 ? 350 : 120)
  }
  const settled = page.locator('.playground iframe')
  await expect
    .poll(
      async () =>
        `${await settled.count()} frames, run ${await root(page).getAttribute('data-run-id')}, ${await root(page).getAttribute('data-preview')}: ${await page.locator('.playground-status').textContent()}`,
      { timeout: 15_000 },
    )
    .toMatch(/^1 frames/)
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  expect(
    await page.evaluate(() => (window as unknown as { maxFrames: number }).maxFrames),
  ).toBeLessThanOrEqual(2)
  expect(Number(await root(page).getAttribute('data-run-id'))).toBeGreaterThan(10)
  expect(watch.problems).toEqual([])
})

for (const width of [375, 1280]) {
  test(`axe finds nothing with the editor open at ${width} px`, async ({ page }) => {
    await running(page, { width, height: width < 700 ? 667 : 800 })
    const first = page.locator('[data-testid="static-code"] .line').first()
    await first.scrollIntoViewIfNeeded()
    const target = (await first.boundingBox())!
    await page.mouse.click(target.x + 10, target.y + target.height / 2)
    await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
    expect(await axeViolations(page)).toEqual([])
  })
}
