import { expect, type Page, test } from '@playwright/test'
import { ROUTE } from '#src/testing/route.ts'
import { begin, playRoute, waitFor } from './driver.ts'

// The Last Light in a real browser: from the title's Play, through the opening cutscene (played out, not skipped), the whole
// route of the old solver sent through the page's own controls, to the end of the night, where the credits come up. Every
// journey fails on any console error. The page runs the game as `pnpm dev` serves it, unbundled, in a software renderer.

/** Collects console errors and page errors. */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

async function night(page: Page) {
  await begin(page)
  // The opening plays out: it is part of the game, and a skipped opening would leave the sound and the caption unproved.
  await waitFor(page, { events: 'cutscene.ended:opening:played', atLeast: 1 }, 240_000)
  return playRoute(page, ROUTE)
}

test('the prologue plays to its end through the page, and the credits come up', async ({ page }) => {
  const errors = collectErrors(page)
  const first = await night(page)
  expect(first.stuck).toBeUndefined()
  expect(first.facts.rested).toBe(true)
  expect(first.ended).toContain('rest:played')
  await expect(page.getByTestId('credits-panel')).toBeVisible()
  expect(errors).toEqual([])
})

test('a second night, from a fresh page, ends in the same state', async ({ page }) => {
  const errors = collectErrors(page)
  const first = await night(page)
  const second = await (async () => {
    // A fresh page is a fresh sim: the same seed, content and route give the same facts and items at the end (the tick the night
    // ends on is the clock's, not the game's, since a frame can fall behind in a software renderer).
    await page.reload()
    return night(page)
  })()
  expect(second.facts).toEqual(first.facts)
  expect(second.items).toEqual(first.items)
  expect(errors).toEqual([])
})
