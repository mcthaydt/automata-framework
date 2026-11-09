// Each browser gate must catch its planted fixture and pass a clean page. Without this, a gate
// that silently checks nothing would look exactly like a site with no problems.
import { expect, test } from '@playwright/test'
import { FIXTURE_PORT } from '../../playwright.config'
import {
  axeViolations,
  cookieNames,
  deadButtons,
  horizontalOverflow,
  keyboardProblems,
  storageKeys,
  watchPage,
} from './gates'

const ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`
const PHONE = { width: 375, height: 667 }

test.describe('browser gates catch their fixtures', () => {
  test('a clean page passes every gate', async ({ page, context }) => {
    await page.setViewportSize(PHONE)
    const watch = watchPage(page, ORIGIN)
    await page.goto(ORIGIN + '/good.html')
    expect(await horizontalOverflow(page)).toEqual([])
    expect(await keyboardProblems(page)).toEqual([])
    expect(await deadButtons(page)).toEqual([])
    expect(await axeViolations(page)).toEqual([])
    expect(await cookieNames(context)).toEqual([])
    expect(await storageKeys(page)).toEqual([])
    expect(watch.problems).toEqual([])
  })

  test('horizontal overflow at 375 px', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(ORIGIN + '/overflow.html')
    expect((await horizontalOverflow(page)).join('\n')).toContain('div')
  })

  test('a console error', async ({ page }) => {
    const watch = watchPage(page, ORIGIN)
    await page.goto(ORIGIN + '/console-error.html')
    await expect.poll(() => watch.problems.join('\n')).toContain('console error: planted console error')
  })

  test('an uncaught page error', async ({ page }) => {
    const watch = watchPage(page, ORIGIN)
    await page.goto(ORIGIN + '/page-error.html')
    await expect.poll(() => watch.problems.join('\n')).toContain('page error: planted page error')
  })

  test('a third-party request', async ({ page }) => {
    const watch = watchPage(page, ORIGIN)
    await page.goto(ORIGIN + '/third-party.html')
    await expect
      .poll(() => watch.problems.join('\n'))
      .toContain('third-party request: http://third-party.invalid/pixel.png')
  })

  test('a cookie', async ({ page, context }) => {
    await page.goto(ORIGIN + '/cookie.html')
    expect(await cookieNames(context)).toEqual(['planted'])
  })

  test('browser storage', async ({ page }) => {
    await page.goto(ORIGIN + '/storage.html')
    expect(await storageKeys(page)).toEqual(['localStorage:planted'])
  })

  test('a focused element without a focus ring', async ({ page }) => {
    await page.goto(ORIGIN + '/focus-ring.html')
    expect((await keyboardProblems(page)).join('\n')).toContain('no focus ring: a#top')
  })

  test('an element the keyboard cannot reach', async ({ page }) => {
    await page.goto(ORIGIN + '/keyboard-trap.html')
    expect((await keyboardProblems(page)).join('\n')).toContain('not reachable by keyboard: a#after')
  })

  test('a button that does nothing', async ({ page }) => {
    await page.goto(ORIGIN + '/dead-button.html')
    expect(await deadButtons(page)).toEqual(['button "Does nothing" changed nothing'])
  })

  // WebKit 26 lays out a closed <details>'s content and Playwright then counts its buttons visible, though a reader
  // cannot see or reach them; a click on one waits for a scroll that never brings it into view (the /examples source
  // tree's collapsed folders). The gate presses the buttons a reader can reach.
  test('a button inside a closed <details> is not pressed, and the gate finishes', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(ORIGIN + '/closed-details.html')
    expect(await deadButtons(page)).toEqual([])
    await expect(page.getByRole('button', { name: 'Opened' })).toHaveCount(1)
  })

  // Restart on a demo replaces its frame, and the new same-origin frame's WebGL boot then holds the page's main thread
  // (run 41012189000 on the Mac: the frame was created 4 ms after the click, and the gate's in-page check could not run
  // for 2.9 s). The click did change the page; the gate must not report it dead because the page was busy afterwards.
  test('a button that changes the page and then keeps the main thread busy past the window still counts as doing something', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.goto(ORIGIN + '/busy-frame.html')
    expect(await deadButtons(page)).toEqual([])
  })

  test('an axe violation', async ({ page }) => {
    await page.goto(ORIGIN + '/axe.html')
    expect((await axeViolations(page)).join('\n')).toContain('button-name')
  })
})
