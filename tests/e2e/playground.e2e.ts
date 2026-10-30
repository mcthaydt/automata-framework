// WEB.PLAY.5 in a real browser (playground spec §6 F1, §7.4, A-2, A-11, A-12, A-13): an example page runs its original
// on arrival with no input, requests nothing under /playground/ before `load`, and under reduced motion requests
// nothing there before Play; /examples runs nothing. Run `pnpm build` first.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`

/** Every request under /playground/, each with whether the page's `load` event had fired when it was made. */
function playgroundRequests(page: Page) {
  const seen: { path: string; afterLoad: boolean }[] = []
  let loaded = false
  page.on('load', () => { loaded = true })
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin === ORIGIN && url.pathname.startsWith('/playground/')) seen.push({ path: url.pathname, afterLoad: loaded })
  })
  return seen
}

const root = (page: Page) => page.locator('.playground')

test('an example page starts the original after load with no input, and shows its canvas', async ({ page }) => {
  const watch = watchPage(page, ORIGIN)
  const requests = playgroundRequests(page)
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.filter(request => !request.afterLoad)).toEqual([])
  expect(requests[0]!.path).toBe('/playground/compiled/shapes-rects.js')
  const frame = page.locator('.playground iframe')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('title', 'Preview: rectangles that move, slide and spin')
  await expect(frame).not.toHaveAttribute('inert', /.*/)
  await expect(page.getByText('Running. Edit the code and the preview updates as you type.')).toBeVisible()
  // The game's canvas is in the revealed frame (its pixels are a cross-origin frame's, which the page cannot read).
  const game = page.frameLocator('.playground iframe').locator('canvas')
  await expect(game).toBeVisible()
  await expect(page.locator('[data-testid="preview-poster"]')).toHaveCount(0)
  expect(watch.problems).toEqual([])
})

test('an example that loads a sound runs at this server’s origin', async ({ page }) => {
  const watch = watchPage(page, ORIGIN)
  await page.goto('/examples/audio-sound')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  expect(watch.problems).toEqual([])
})

test('with reduced motion an example page requests nothing under /playground/ before Play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requests = playgroundRequests(page)
  await page.goto('/examples/shapes-rects', { waitUntil: 'networkidle' })
  await expect(page.getByText('Press Play to start the example. Once it runs, edits update it live.')).toBeVisible()
  expect(requests).toEqual([])
  await expect(root(page)).toHaveAttribute('data-preview', 'poster')
  const play = page.getByRole('button', { name: 'Play', exact: true })
  expect((await play.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await play.click()
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
})

test('/examples runs nothing and requests nothing under /playground/', async ({ page }) => {
  const requests = playgroundRequests(page)
  await page.goto('/examples', { waitUntil: 'networkidle' })
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(requests).toEqual([])
  await page.getByRole('link', { name: /core-basic-window/ }).click()
  await expect(page).toHaveURL(/\/examples\/core-basic-window$/)
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
})

test('the parent drops a message from a window that is not its frame', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  // The page posts to itself: the right shape, a failure for the running run, but the wrong source and origin.
  await page.evaluate(() => window.postMessage({ v: 1, type: 'failed', runId: 1, phase: 'run', message: 'forged' }, '*'))
  await page.waitForTimeout(200)
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  await expect(page.getByText(/forged/)).toHaveCount(0)
})

test('following a link to another example replaces the preview with that example’s', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await page.getByRole('navigation', { name: 'Examples' }).locator('a[href="/examples/core-basic-window"]').click()
  await expect(page).toHaveURL(/\/examples\/core-basic-window$/)
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  await expect(page.locator('.playground iframe')).toHaveAttribute('src', '/playground/examples/core/basic-window/')
})

// WEB.PLAY.6 (spec F2, §9.2, §9.3): the first tap or focus on the code swaps in the editor, in the same box.
const staticCode = (page: Page) => page.getByTestId('static-code')
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!

/** Taps the middle of line `line` (1-based) of the static code and waits for the editor. */
async function tapLine(page: Page, line: number) {
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await staticCode(page).locator('.line').nth(line - 1).scrollIntoViewIfNeeded()
  const target = (await staticCode(page).locator('.line').nth(line - 1).boundingBox())!
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2)
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
}

test('the code box keeps its size when the editor replaces the static code', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await staticCode(page).locator('.line').nth(9).scrollIntoViewIfNeeded()
  const panelBefore = await box(page, '.code-panel')
  const codeBefore = await box(page, '[data-testid="static-code"]')
  await tapLine(page, 10)
  await expect(staticCode(page)).toBeHidden()
  expect(await box(page, '.code-panel')).toEqual(panelBefore)
  expect(await box(page, '.code-panel .cm-editor')).toEqual(codeBefore)
})

test('a tap starts editing with the caret at the tap', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  // Typing waits for the preview: a key pressed while the arrival run's frame holds focus is lost (see the next test).
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  const line = staticCode(page).locator('.line').nth(9)
  await line.scrollIntoViewIfNeeded()
  const text = (await line.textContent())!.replace(/\n$/, '')
  const at = Math.floor(text.length / 2)
  // The left edge of the character at `at`, worked out from the static text, so the caret lands just before it.
  const point = await line.evaluate((element, index) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent!.length
      if (index < length) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + 1)
        const rect = range.getClientRects()[0]
        return { x: rect.left + 1, y: rect.top + rect.height / 2 }
      }
      index -= length
    }
    throw new Error('no such character')
  }, at)
  await page.mouse.click(point.x, point.y)
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await expect(page.locator('.cm-content')).toBeFocused()
  await page.keyboard.type('Z')
  await expect(page.locator('.cm-line').nth(9)).toHaveText(text.slice(0, at) + 'Z' + text.slice(at))
})

test('the editor is named and described, has 16 px text, wraps, shows the focus ring, and Tab leaves it', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await tapLine(page, 3)
  const content = page.getByRole('textbox', { name: 'Code for rectangles that move, slide and spin. Changes update the preview.' })
  await expect(content).toBeFocused()
  const statusId = await page.locator('.playground-status').getAttribute('id')
  await expect(content).toHaveAttribute('aria-describedby', statusId!)
  await expect(content).toHaveAttribute('autocorrect', 'off')
  await expect(content).toHaveAttribute('autocapitalize', 'off')
  await expect(content).toHaveAttribute('spellcheck', 'false')
  await expect(content).toHaveCSS('font-size', '16px')
  await expect(content).toHaveClass(/cm-lineWrapping/)
  await expect(page.locator('.cm-editor')).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(content).not.toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(content).toBeFocused()
})

/** The editor chunk and the chunks it imports, from the build's Vite manifest. */
function editorFiles(): string[] {
  const manifest = JSON.parse(readFileSync('.svelte-kit/output/client/.vite/manifest.json', 'utf8')) as Record<string, { file: string; imports?: string[] }>
  const files = new Set<string>()
  const visit = (key: string) => { const chunk = manifest[key]; if (chunk && !files.has(chunk.file)) { files.add(chunk.file); chunk.imports?.forEach(visit) } }
  visit('src/lib/playground/editor.ts')
  return [...files]
}

test('the editor chunk loads on the first focus on the code, not before', async ({ page }) => {
  const files = editorFiles()
  expect(files.length).toBeGreaterThan(0)
  const loaded: string[] = []
  page.on('request', request => { const path = new URL(request.url()).pathname.slice(1); if (files.includes(path)) loaded.push(path) })
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.cm-editor')).toHaveCount(0)
  expect(loaded).toEqual([])
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  expect(loaded).toContain(files[0])
  await expect(page.locator('.cm-content')).toBeFocused()
})

test('when the editor chunk fails to load, the static code stays and the status line says so', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  const files = editorFiles()
  await page.route(url => files.includes(url.pathname.slice(1)), route => route.abort())
  await staticCode(page).locator('.line').nth(2).click()
  await expect(root(page)).toHaveAttribute('data-code', 'failed', { timeout: 10_000 })
  await expect(page.locator('.playground-status')).toHaveText('The editor couldn’t load. The code is shown read-only, and Play still runs the original.')
  await expect(staticCode(page)).toBeVisible()
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
})

// The arrival run's frame focuses its own first control in Chromium even while it is `inert`; the page gives focus
// back to the code (Playground.svelte). A key pressed in that moment still reaches the frame: the framework follow-up
// in the WEB.PLAY.6 plan.
test('a preview that starts while the reader is in the code leaves focus in the code', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.cm-content')).toBeFocused()
})
