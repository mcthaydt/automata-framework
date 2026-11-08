import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { serveFolder } from './harness/serve-folder.ts'

// The look on a real page load, in Chromium (spec §5.5): the design board is a full editor page that loads `theme-boot.js`
// first, as every editor page does, so what a page paints first is what a person sees first.
const theme = JSON.parse(
  readFileSync(new URL('../../src/shared/kit/tokens/tool-theme.json', import.meta.url), 'utf8'),
) as Record<'light' | 'dark', Record<string, string>>
const rgb = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
const DARK = rgb(theme.dark['tool-bg'] as string)
const LIGHT = rgb(theme.light['tool-bg'] as string)

test('a stored dark on a light device is dark in the very first frame, on the built editor the site serves', async ({
  page,
}) => {
  // The built 2D editor (`pnpm build`), served as the site's "Try the editor" is: its stylesheet is a `<link>` in the head,
  // which holds the first paint, so `color-scheme` is already dark when the first frame is drawn. (A dev server injects
  // the stylesheet from a script, so only the attribute is checked there, below.)
  const dist = fileURLToPath(new URL('../../dist/suite', import.meta.url))
  test.skip(!existsSync(`${dist}/index.html`), 'run `pnpm build` first')
  const served = await serveFolder(dist)
  try {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('automata-editor:theme', 'dark'))
    await page.addInitScript(() => {
      requestAnimationFrame(() => {
        const root = document.documentElement
        ;(window as unknown as { firstFrame: string }).firstFrame =
          `${root.dataset.theme}/${getComputedStyle(root).colorScheme}/${getComputedStyle(document.body).backgroundColor}`
      })
    })
    await page.goto(served.url)
    await expect(page.locator('#app')).toBeAttached()
    const first = await page.evaluate(() => (window as unknown as { firstFrame: string }).firstFrame)
    expect(first.startsWith('dark/dark/')).toBe(true)
    expect(first).toBe(`dark/dark/${DARK}`)
  } finally {
    await served.stop()
  }
})

test('on the dev page too, a stored dark on a light device is dark before anything paints', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('automata-editor:theme', 'dark'))
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      ;(window as unknown as { firstFrame: string | undefined }).firstFrame =
        document.documentElement.dataset.theme
    })
  })
  await page.goto('/design.html')
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { firstFrame: string }).firstFrame)).toBe('dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK)
})

test('a person who has never chosen sees Dark, whatever the device says', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/design.html')
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK)
  expect(await page.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
})

test('a stored light opens light even on a dark device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => localStorage.setItem('automata-editor:theme', 'light'))
  await page.goto('/design.html')
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT)
})

test('Match device follows a light device, is remembered as "device", and survives a reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/design.html')
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  await page.getByRole('radio', { name: 'Match device' }).click()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT)
  expect(await page.evaluate(() => localStorage.getItem('automata-editor:theme'))).toBe('device')
  await page.reload()
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT)
  // And the device can still change its mind while the page is open.
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(DARK)
})

test('a forced choice wins over the device, and is remembered for the next visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/design.html')
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  await page.getByRole('radio', { name: 'Light' }).click()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT)
  await page.reload()
  await expect(page.locator('[data-board-ready]')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT)
})

test('the boot script is a file: the page has no inline script and no CSP-refused script', async ({
  page,
}) => {
  const refused: string[] = []
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) refused.push(message.text())
  })
  await page.goto('/design.html')
  expect(await page.locator('script:not([src])').count()).toBe(0)
  expect(refused).toEqual([])
})
