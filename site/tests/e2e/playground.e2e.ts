// in a real browser: an example page runs its original
// on arrival with no input, requests nothing under /playground/ before `load`, and under reduced motion requests
// nothing there before Play; /examples runs nothing. Run `pnpm build` first.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { BOOT_TIMEOUT_MS, FIRST_BOOT_TIMEOUT_MS } from '#src/features/playground/orchestrator.ts'
import { LOOP_GUARD_MS } from '#src/features/playground/protocol.ts'
import { playgroundExamples } from '#src/shared/framework/examples.ts'
import { SITE_PORT } from '../../playwright.config'
import { watchPage } from './gates'

// An example autostarts only for a visitor who has not asked for less motion (the suite's default is reduced).
test.use({ reducedMotion: 'no-preference' })

const ORIGIN = `http://127.0.0.1:${SITE_PORT}`

/** Every request under /playground/, each with whether the page's `load` event had fired when it was made. */
function playgroundRequests(page: Page) {
  const seen: { path: string; afterLoad: boolean }[] = []
  let loaded = false
  page.on('load', () => {
    loaded = true
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === ORIGIN && url.pathname.startsWith('/playground/'))
      seen.push({ path: url.pathname, afterLoad: loaded })
  })
  return seen
}

const root = (page: Page) => page.locator('.playground')

test('an example page starts the original after load with no input, and shows its canvas', async ({
  page,
}) => {
  const watch = watchPage(page, ORIGIN)
  const requests = playgroundRequests(page)
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.filter((request) => !request.afterLoad)).toEqual([])
  expect(requests[0]!.path).toBe('/playground/compiled/shapes-rects.js')
  const frame = page.locator('.playground iframe')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('title', 'Preview: Rectangles that move, slide and spin')
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

test('with reduced motion an example page requests nothing under /playground/ before Play', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requests = playgroundRequests(page)
  await page.goto('/examples/shapes-rects', { waitUntil: 'networkidle' })
  await expect(
    page.getByText('Press Play to start the example. Once it runs, edits update it live.'),
  ).toBeVisible()
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
  await page.evaluate(() =>
    window.postMessage({ v: 1, type: 'failed', runId: 1, phase: 'run', message: 'forged' }, '*'),
  )
  await page.waitForTimeout(200)
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  await expect(page.getByText(/forged/)).toHaveCount(0)
})

test('following a link to another example replaces the preview with that example’s', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await page
    .getByRole('navigation', { name: 'Examples' })
    .locator('a[href="/examples/core-basic-window"]')
    .click()
  await expect(page).toHaveURL(/\/examples\/core-basic-window$/)
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  await expect(page.locator('.playground iframe')).toHaveAttribute(
    'src',
    '/playground/examples/core/basic-window/',
  )
})

// the first tap or focus on the code swaps in the editor, in the same box.
const staticCode = (page: Page) => page.getByTestId('static-code')
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!

/** Taps the middle of line `line` (1-based) of the static code and waits for the editor. */
async function tapLine(page: Page, line: number) {
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await staticCode(page)
    .locator('.line')
    .nth(line - 1)
    .scrollIntoViewIfNeeded()
  const target = (await staticCode(page)
    .locator('.line')
    .nth(line - 1)
    .boundingBox())!
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2)
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
}

function expectSameBox(
  actual: { x: number; y: number; width: number; height: number },
  expected: typeof actual,
) {
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(actual[key] - expected[key]), key).toBeLessThan(1)
}

test('the code box keeps its size when the editor replaces the static code', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await staticCode(page).locator('.line').nth(9).scrollIntoViewIfNeeded()
  const panelBefore = await box(page, '.code-panel')
  const codeBefore = await box(page, '[data-testid="static-code"]')
  await tapLine(page, 10)
  await expect(staticCode(page)).toBeHidden()
  // Equal to the pixel, and the page has not scrolled (the boxes are in viewport coordinates). Safari on macOS lays the
  // static text out at fractional heights that the editor rounds, so a difference under a pixel is not a shift.
  expectSameBox(await box(page, '.code-panel'), panelBefore)
  expectSameBox(await box(page, '.code-panel .cm-editor'), codeBefore)
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

test('the editor is named and described, has 16 px text, wraps, shows the focus ring, and Tab leaves it', async ({
  page,
}) => {
  await page.goto('/examples/shapes-rects')
  await tapLine(page, 3)
  const content = page.getByRole('textbox', {
    name: 'Code for Rectangles that move, slide and spin. Changes update the preview.',
  })
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

/**
 * The built chunks that hold CodeMirror: the editor chunk, and any chunk Vite splits from it. Found by content,
 * because CI's browser job gets the static build without SvelteKit's Vite manifest (check:site reads that instead).
 */
function editorFiles(): string[] {
  const folder = 'build/_app/immutable/chunks'
  return readdirSync(folder)
    .filter(
      (file) => file.endsWith('.js') && readFileSync(join(folder, file), 'utf8').includes('cm-gutterElement'),
    )
    .map((file) => folder.slice('build/'.length) + '/' + file)
}

test('the editor chunk loads on the first focus on the code, not before', async ({ page }) => {
  const files = editorFiles()
  expect(files.length).toBeGreaterThan(0)
  const loaded: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname.slice(1)
    if (files.includes(path)) loaded.push(path)
  })
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.cm-editor')).toHaveCount(0)
  expect(loaded).toEqual([])
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  expect(loaded).toContain(files[0])
  await expect(page.locator('.cm-content')).toBeFocused()
})

test('when the editor chunk fails to load, the static code stays and the status line says so', async ({
  page,
}) => {
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  const files = editorFiles()
  await page.route(
    (url) => files.includes(url.pathname.slice(1)),
    (route) => route.abort(),
  )
  await staticCode(page).locator('.line').nth(2).click()
  await expect(root(page)).toHaveAttribute('data-code', 'failed', { timeout: 10_000 })
  await expect(page.locator('.playground-status')).toHaveText(
    'The editor couldn’t load. The code is shown read-only, and Play still runs the original.',
  )
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

// edits compile in a worker after a quiet period and replace the
// preview through a candidate frame, with no button; a broken edit marks its line and keeps the last good preview.

/** The editor's line `line` (1-based). */
const editorLine = (page: Page, line: number) => page.locator('.cm-line').nth(line - 1)

/** The 1-based line of the shapes-rects source that holds `text`. */
async function lineOf(page: Page, text: string): Promise<number> {
  const lines = await staticCode(page).locator('.line').allTextContents()
  const index = lines.findIndex((line) => line.includes(text))
  if (index < 0) throw new Error(`no line holds ${text}`)
  return index + 1
}

/** Selects the word `word` in the editor by double-clicking it, then types `replacement` over it. Just after the
 * swap the page can still be settling its scroll, so a double-click on a box measured a moment earlier selects
 * another word (in a comment, the typed replacement even compiles): measure and double-click until `word` is the
 * selection. */
async function replaceWord(page: Page, word: string, replacement: string) {
  await expect
    .poll(
      async () => {
        await dblclickWord(page, word)
        return page.evaluate(() => window.getSelection()?.toString())
      },
      { timeout: 5_000 },
    )
    .toBe(word)
  await page.keyboard.type(replacement)
}

async function dblclickWord(page: Page, word: string) {
  const range = await page.locator('.cm-content').evaluate((content, wanted) => {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent!.indexOf(wanted)
      if (index < 0) continue
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + wanted.length)
      const rect = range.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    throw new Error('no such word')
  }, word)
  await page.mouse.dblclick(range.x, range.y)
}

/** How many pixels of the preview frame's screenshot are close to pure red. */
async function redPixels(page: Page): Promise<number> {
  const png = (await page.locator('.playground iframe.shown').screenshot()).toString('base64')
  // Decoded in a blank page of the same context: the site's CSP rightly refuses a `data:` fetch.
  const blank = await page.context().newPage()
  const red = await blank.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob())
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    let red = 0
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i]! > 200 && pixels[i + 1]! < 60 && pixels[i + 2]! < 60) red++
    return red
  }, png)
  await blank.close()
  return red
}

test('an edit updates the preview with no button', async ({ page }) => {
  const watch = watchPage(page, ORIGIN)
  await page.goto('/examples/shapes-rects')
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  expect(await redPixels(page)).toBeLessThan(100)
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  await expect(page.locator('.playground-status')).toHaveText('Preview updated.')
  await expect.poll(() => redPixels(page), { timeout: 5_000 }).toBeGreaterThan(100)
  expect(watch.problems).toEqual([])
})

/** The 1-based line of the editor that holds the caret. */
const caretLine = (page: Page) =>
  page.evaluate(() => {
    const node = window.getSelection()?.anchorNode
    const line = (node instanceof Element ? node : node?.parentElement)?.closest('.cm-line')
    return line ? [...document.querySelectorAll('.cm-line')].indexOf(line) + 1 : 0
  })

/** Opens the editor and types `typed` just after `text`, placing the caret by the text's own box: the End key would
 * stop at the end of a wrapped line's first row. */
async function typeAfter(page: Page, text: string, typed: string) {
  const line = await lineOf(page, text)
  await tapLine(page, line)
  await expect(page.locator('.cm-content')).toBeFocused()
  // WebKit can still be settling the page's scroll after the swap, so a click on a box measured a moment earlier lands
  // on another line: measure and click until the caret is on the intended one.
  await expect
    .poll(
      async () => {
        await clickAfter(page, line, text)
        return caretLine(page)
      },
      { timeout: 5_000 },
    )
    .toBe(line)
  await page.keyboard.type(typed)
  return line
}

/** Clicks just after the last character of `text` on the editor's line `line`. */
async function clickAfter(page: Page, line: number, text: string) {
  const point = await editorLine(page, line).evaluate((element, wanted) => {
    // The highlighting splits the line into spans, so the last character is found by its offset in the whole line.
    let last = element.textContent!.indexOf(wanted) + wanted.length - 1
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent!.length
      if (last < length) {
        const range = document.createRange()
        range.setStart(node, last)
        range.setEnd(node, last + 1)
        const rect = range.getBoundingClientRect()
        return { x: rect.right - 1, y: rect.top + rect.height / 2 }
      }
      last -= length
    }
    throw new Error('no such text')
  }, text)
  await page.mouse.click(point.x, point.y)
}

test('a syntax error marks its line, names it, and keeps the running preview', async ({ page }) => {
  const watch = watchPage(page, ORIGIN)
  await page.goto('/examples/shapes-rects')
  const move = await typeAfter(page, "defineSystem('move', (ctx) => {", '\nconst broken = 1 +;')
  const frame = await page.locator('.playground iframe').elementHandle()
  await expect(root(page)).toHaveAttribute('data-compile', 'syntax-error', { timeout: 2_000 })
  await expect(page.locator('.playground-status')).toHaveText(
    `Line ${move + 1}: Unexpected token. The preview is still running your last working version.`,
  )
  await expect(editorLine(page, move + 1).locator('.cm-lintRange-error')).toHaveCount(1)
  await expect(page.locator('.cm-lint-marker-error')).toHaveCount(1)
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  expect(await frame!.evaluate((element) => element.isConnected)).toBe(true)
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  // Fixing it runs the fix.
  for (let i = 0; i < '\nconst broken = 1 +;'.length; i++) await page.keyboard.press('Backspace')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect(page.locator('.cm-lint-marker-error')).toHaveCount(0)
  await expect(page.locator('.playground-status')).toHaveText('Preview updated.')
  expect(watch.problems).toEqual([])
})

test('an import from another package marks its line and requests nothing', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('lodash')) requested.push(request.url())
  })
  await page.goto('/examples/shapes-rects')
  await tapLine(page, 1)
  await page.keyboard.press('ControlOrMeta+Home')
  await page.keyboard.type("import _ from 'lodash'\n")
  await expect(root(page)).toHaveAttribute('data-compile', 'syntax-error', { timeout: 2_000 })
  await expect(page.locator('.playground-status')).toHaveText(
    'Line 1: The playground can import only @automata/framework and zod. The preview is still running your last working version.',
  )
  await expect(editorLine(page, 1).locator('.cm-lintRange-error')).toHaveCount(1)
  await page.waitForTimeout(500)
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  expect(requested).toEqual([])
})

test('pressing the diagnostic puts the caret on its line', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  const move = await typeAfter(page, "defineSystem('move', (ctx) => {", '\nconst broken = 1 +;')
  await expect(root(page)).toHaveAttribute('data-compile', 'syntax-error', { timeout: 2_000 })
  await page.keyboard.press('ControlOrMeta+End')
  const button = page.locator('.playground-status button')
  await expect(button).toHaveText(new RegExp(`^Line ${move + 1}: Unexpected token`))
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await button.click()
  await expect(page.locator('.cm-content')).toBeFocused()
  expect(await caretLine(page)).toBe(move + 1)
})

test('an edit before the first run replaces it, and the original is not run after it', async ({ page }) => {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/playground/compiled/shapes-rects.js', async (route) => {
    await held
    await route.continue()
  })
  await page.goto('/examples/shapes-rects')
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await expect(root(page)).toHaveAttribute('data-preview', 'poster')
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect.poll(() => redPixels(page), { timeout: 5_000 }).toBeGreaterThan(100)
  release()
  await page.waitForResponse('**/playground/compiled/shapes-rects.js')
  await page.waitForTimeout(1_000)
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  expect(await redPixels(page)).toBeGreaterThan(100)
})

test('with reduced motion an edit runs nothing until Play, then edits update the preview live', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requests = playgroundRequests(page)
  await page.goto('/examples/shapes-rects')
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-compile', 'ok', { timeout: 2_000 })
  await page.waitForTimeout(500)
  expect(requests).toEqual([])
  await expect(root(page)).toHaveAttribute('data-preview', 'poster')
  await expect(page.locator('[data-testid="preview-poster"]')).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  // Play ran the edited code, not the precompiled original.
  expect(requests.map((request) => request.path)).not.toContain('/playground/compiled/shapes-rects.js')
  await expect.poll(() => redPixels(page), { timeout: 5_000 }).toBeGreaterThan(100)
  await replaceWord(page, '0xff0000', '0x52d2ff')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect.poll(() => redPixels(page), { timeout: 5_000 }).toBeLessThan(100)
})

test('the compile worker starts with the editor, not before', async ({ page }) => {
  const workers: string[] = []
  page.on('request', (request) => {
    if (/\/workers\/compile\.worker-[^/]+\.js$/.test(new URL(request.url()).pathname))
      workers.push(request.url())
  })
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await page.waitForTimeout(500)
  expect(workers).toEqual([])
  await staticCode(page).focus()
  await expect(root(page)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await expect.poll(() => workers.length).toBe(1)
})

test('a diagnostic that stands for a second is announced once, politely', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  const move = await typeAfter(page, "defineSystem('move', (ctx) => {", '\nconst broken = 1 +;')
  // Not CodeMirror's own `.cm-announced` region, which is polite too.
  const region = page.locator('.playground-announce[aria-live="polite"]')
  await expect(root(page)).toHaveAttribute('data-compile', 'syntax-error', { timeout: 2_000 })
  await expect(region).toHaveText('')
  await expect(region).toHaveText(
    `Line ${move + 1}: Unexpected token. The preview is still running your last working version.`,
    { timeout: 2_000 },
  )
})

test('an IME composition compiles once, when it ends', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'composition is driven through the Chrome DevTools Protocol')
  await page.goto('/examples/shapes-rects')
  await typeAfter(page, '// Blocks fall and wrap', '')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 })
  await cdp.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 })
  await page.waitForTimeout(800)
  await expect(root(page)).toHaveAttribute('data-compile', 'original')
  await cdp.send('Input.insertText', { text: '日本' })
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect(editorLine(page, await lineOf(page, '// Blocks fall and wrap'))).toContainText(
    '// Blocks fall and wrap日本',
  )
  await page.waitForTimeout(800)
  await expect(root(page)).toHaveAttribute('data-run-id', '2')
})

// each failure shows its text, keeps the last good preview where the spec says
// so, and the next good edit, Restart or Retry recovers.

test('a loop that never ends is stopped and named, and the next good edit runs', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  // The edit starts from the original running, so the first boot (its own 20 s budget) is not part of what follows.
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: FIRST_BOOT_TIMEOUT_MS })
  const move = await typeAfter(page, "defineSystem('move', (ctx) => {", '\nwhile (true) {}')
  // The loop runs in a fresh frame, so the stop comes after three steps: the edit compiles (data-compile is `ok` once
  // it has and its run is sent), the frame boots, and the guard waits a second. A boot may take up to the
  // orchestrator's BOOT_TIMEOUT_MS before it is a failure of its own, so the stop is awaited for that plus the guard.
  await expect(root(page)).toHaveAttribute('data-compile', 'ok', { timeout: 10_000 })
  await expect(page.locator('.playground-status')).toHaveText(
    // By phase: a stop while running is "Stopped: line N", a candidate that never got going "Line N".
    new RegExp(
      `^(Stopped: line|Line) ${move + 1}: this loop ran for over a second without a break, so the preview stopped it\\.`,
    ),
    { timeout: BOOT_TIMEOUT_MS + LOOP_GUARD_MS },
  )
  // The editor takes typing again: the loop is deleted, and the fix runs.
  for (let i = 0; i < '\nwhile (true) {}'.length; i++) await page.keyboard.press('Backspace')
  await expect(page.locator('.playground-status')).toHaveText('Preview updated.', { timeout: 10_000 })
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
})

test('a throw in setup marks its line and keeps the running preview', async ({ page }) => {
  await page.goto('/examples/shapes-rects')
  const setup = await typeAfter(page, 'setup: (sim) => {', "\nthrow new Error('x')")
  await expect(page.locator('.playground-status')).toHaveText(
    `Line ${setup + 1}: x. The preview is still running your last working version.`,
    { timeout: 10_000 },
  )
  await expect(page.locator('.cm-lint-marker-error')).toHaveCount(1)
  await expect(editorLine(page, setup + 1).locator('.cm-lintRange-error')).toHaveCount(1)
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
})

test('a throw on tick 60 stops the preview, marks its line, and the next good edit runs', async ({
  page,
}) => {
  await page.goto('/examples/shapes-rects')
  const move = await typeAfter(
    page,
    "defineSystem('move', (ctx) => {",
    "\nif (ctx.tick === 60) throw new Error('x')",
  )
  await expect(page.locator('.playground-status')).toHaveText(`Stopped: line ${move + 1}: x.`, {
    timeout: 10_000,
  })
  await expect(page.locator('.cm-lint-marker-error')).toHaveCount(1)
  await expect(editorLine(page, move + 1).locator('.cm-lintRange-error')).toHaveCount(1)
  for (let i = 0; i < "\nif (ctx.tick === 60) throw new Error('x')".length; i++)
    await page.keyboard.press('Backspace')
  await expect(page.locator('.playground-status')).toHaveText('Preview updated.', { timeout: 10_000 })
  await expect(page.locator('.cm-lint-marker-error')).toHaveCount(0)
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
})

test('a default export that is not defineGame(...) is named, and the preview keeps running', async ({
  page,
}) => {
  await page.goto('/examples/shapes-rects')
  // `export default 1;` takes the place of the defineGame call, which is left as an unused expression.
  await typeAfter(page, 'export default', ' 1;\nconst game =')
  await expect(page.locator('.playground-status')).toContainText(
    "This code doesn't make a game any more. Press Reset to start again",
    { timeout: 10_000 },
  )
  await expect(page.locator('.playground-status')).toContainText(
    'The preview is still running your last working version.',
  )
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
  await expect(page.locator('.playground iframe')).toHaveCount(1)
})

test('a later frame that never starts is removed after 10 s, and the running preview stays', async ({
  page,
}) => {
  let frames = 0
  await page.route(`${ORIGIN}/playground/examples/shapes/rects/**`, (route) => {
    if (route.request().resourceType() !== 'document' || ++frames === 1) return route.fallback()
    // The second frame's page never posts `booted`.
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stuck</title>' })
  })
  await page.goto('/examples/shapes-rects')
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 10_000 })
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(page.locator('.playground iframe')).toHaveCount(2, { timeout: 5_000 })
  expect(frames).toBe(2)
  await expect(page.locator('.playground-status')).toHaveText(
    'The preview did not start within 10 seconds.',
    { timeout: 12_000 },
  )
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
})

test('when the compile worker fails, the status line says so and Play still runs the original', async ({
  page,
}) => {
  await page.route(/\/workers\/compile\.worker-[^/]+\.js$/, (route) =>
    route.fulfill({ status: 500, body: '' }),
  )
  await page.goto('/examples/shapes-rects')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 10_000 })
  await typeAfter(page, "defineSystem('move', (ctx) => {", '\nconst edited = 1')
  await expect(page.locator('.playground-status')).toHaveText(
    'This browser can’t update the game as you type. Press Play to see the original.',
    { timeout: 5_000 },
  )
  await expect(root(page)).toHaveAttribute('data-run-id', '1')
  await expect(root(page)).toHaveAttribute('data-preview', 'running')
})

test('offline, the first frame times out and Retry starts a fresh one', async ({ page }) => {
  test.setTimeout(60_000)
  let offline = true
  await page.route(`${ORIGIN}/playground/runtime/**`, (route) =>
    offline ? route.abort('internetdisconnected') : route.fallback(),
  )
  await page.goto('/examples/shapes-rects')
  await expect(page.locator('.playground-status')).toHaveText(
    'The preview couldn’t load. Check the connection and press Retry.',
    { timeout: 25_000 },
  )
  const retry = page.getByRole('button', { name: 'Retry' })
  await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0)
  const box = (await retry.boundingBox())!
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
  offline = false
  await retry.click()
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect(page.locator('.playground iframe')).toHaveCount(1)
  await expect(retry).toHaveCount(0)
})

// Reset, the share link, and opening one.

test('a share link opens the edited code in a new context and runs it', async ({ page, browser }) => {
  await page.goto('/examples/shapes-rects')
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#code=1\.[\w-]+$/)
  const context = await browser.newContext()
  const friend = await context.newPage()
  const watch = watchPage(friend, ORIGIN)
  await friend.goto(page.url())
  await expect(root(friend)).toHaveAttribute('data-code', 'ready', { timeout: 10_000 })
  await expect(friend.locator('.cm-content')).toContainText('0xff0000')
  await expect(friend.locator('.cm-content')).not.toContainText('0x52d2ff')
  await expect(root(friend)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await expect.poll(() => redPixels(friend), { timeout: 5_000 }).toBeGreaterThan(100)
  expect(watch.problems).toEqual([])
  await context.close()
})

for (const [name, fragment] of [
  ['corrupted', async () => 'code=1.not*base64'],
  [
    'oversized',
    async () => {
      const stream = new Blob([new Uint8Array(65_537).fill(0x61)])
        .stream()
        .pipeThrough(new CompressionStream('deflate-raw'))
      return 'code=1.' + Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url')
    },
  ],
] as const) {
  test(`a ${name} share link shows the original and says it could not be read`, async ({ page }) => {
    const watch = watchPage(page, ORIGIN)
    await page.goto('/examples/shapes-rects#' + (await fragment()))
    await expect(page.locator('.playground-status')).toHaveText(
      'This link’s code could not be read, so the original example is shown.',
      { timeout: 10_000 },
    )
    await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
    await expect(root(page)).toHaveAttribute('data-compile', 'original')
    await expect(staticCode(page)).toContainText('0x52d2ff')
    expect(watch.problems).toEqual([])
  })
}

/** The framework file the page shows, read from examples/2d. */
function syncedSource(id: string): string {
  return playgroundExamples().find((example) => example.id === id)!.source
}

/** The editor's whole text, line by line (the example is short enough for every line to be drawn). */
const editorText = (page: Page) =>
  page.locator('.cm-line').evaluateAll((lines) => lines.map((line) => line.textContent).join('\n'))

test('Reset puts the original back byte for byte, removes the fragment and runs it, and Mod-Z brings the edit back', async ({
  page,
}) => {
  await page.goto('/examples/shapes-rects')
  const reset = page.getByRole('button', { name: 'Reset' })
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  await expect(reset).toHaveCount(0)
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#code=1\./)
  const box = (await reset.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  await reset.click()
  await expect(reset).toHaveCount(0)
  expect(await editorText(page)).toBe(syncedSource('shapes-rects'))
  await expect(root(page)).toHaveAttribute('data-run-id', '3', { timeout: 10_000 })
  await expect.poll(() => page.url()).toBe(`${ORIGIN}/examples/shapes-rects`)
  await expect.poll(() => redPixels(page), { timeout: 5_000 }).toBeLessThan(100)
  await page.locator('.cm-content').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.cm-content')).toContainText('0xff0000')
  await expect(reset).toHaveCount(1)
})

test('Copy link copies the address with the edit, and Copy code the edited text', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'reading the clipboard back needs Chromium’s clipboard-read permission',
  )
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN })
  await page.goto('/examples/shapes-rects')
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect.poll(() => new URL(page.url()).hash).toMatch(/^#code=1\./)
  const copyLink = page.getByRole('button', { name: 'Copy link' })
  expect((await copyLink.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await copyLink.click()
  await expect(page.locator('.code-panel [role="status"]').first()).toHaveText('Link copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  await page.getByRole('button', { name: 'Copy code' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await editorText(page))
})

test('a share link with no compile worker runs the original', async ({ page }) => {
  await page.route(/\/workers\/compile\.worker-[^/]+\.js$/, (route) =>
    route.fulfill({ status: 500, body: '' }),
  )
  const stream = new Blob([new TextEncoder().encode('export default 1\n')])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  await page.goto(
    '/examples/shapes-rects#code=1.' +
      Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url'),
  )
  await expect(page.locator('.playground-status')).toHaveText(
    'This browser can’t update the game as you type. Press Play to see the original.',
    { timeout: 10_000 },
  )
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
})

// the determinism row says only what this browser checked.
const row = (page: Page) => page.locator('.determinism-row')

test('the unedited original replays its golden in this browser, and the row names the hash and the framework', async ({
  page,
}) => {
  const watch = watchPage(page, ORIGIN)
  await page.goto('/examples/shapes-rects')
  await expect(row(page)).toHaveText(
    /^Determinism: these 120 ticks replay in this browser to the golden recorded in the framework \(examples\/__goldens__\/shapes-rects\.replay, framework [0-9a-f]{7}\)\. Hash [0-9a-f]{16}\.$/,
    { timeout: 20_000 },
  )
  await expect(row(page)).not.toHaveAttribute('role', 'alert')
  // Computed at runtime: the hash is in none of the site's sources.
  const hash = (await row(page).textContent())!.match(/Hash ([0-9a-f]{16})/)![1]!
  // Files only: a route folder can carry a file-like name (`src/routes/sources/[slug].json/`).
  const holders = readdirSync('src', { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|svelte|json|js)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => readFileSync(file, 'utf8').includes(hash))
  expect(holders).toEqual([])
  expect(watch.problems).toEqual([])
})

test('an edit hashes its own run and claims no golden', async ({ page }) => {
  const watch = watchPage(page, ORIGIN)
  await page.goto('/examples/shapes-rects')
  await tapLine(page, await lineOf(page, '0x52d2ff'))
  await replaceWord(page, '0x52d2ff', '0xff0000')
  await expect(root(page)).toHaveAttribute('data-run-id', '2', { timeout: 10_000 })
  await expect(row(page)).toHaveText(
    /^Your edit: 120 ticks hash to [0-9a-f]{16} in this browser\. The golden belongs to the original code; agreement across engines is checked in the framework's CI\.$/,
    { timeout: 20_000 },
  )
  expect(watch.problems).toEqual([])
})

test('an example with no golden shows no determinism row', async ({ page }) => {
  await page.goto('/examples/core-basic-window')
  await expect(root(page)).toHaveAttribute('data-preview', 'running', { timeout: 20_000 })
  await page.waitForTimeout(1_000)
  await expect(row(page)).toHaveCount(0)
})
