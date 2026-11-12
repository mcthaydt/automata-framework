import { expect, test } from '@playwright/test'
import { begin, stateOf, waitFor } from './driver.ts'

// The old game's play HUD is a line of text at the top left with a marker before it, over the picture and no box, and nothing at
// all where nothing is carried. Ours is the framework's pieces: the game says so in its stylesheet (`style.css`), the only thing a
// game can change of a piece without new framework work. This reads what the player sees, the computed styles, with the opening
// skipped, and waits on the game's own state, never on a sleep. A touch target stays 44 px: nothing here shrinks a control.

test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1, viewport: { width: 1024, height: 768 } })
test.setTimeout(10 * 60_000)

test('the objective is a plain line with a marker, and an empty inventory draws nothing', async ({
  page,
}) => {
  await begin(page)
  await page.evaluate(() => globalThis.__lastLight?.skip())
  await waitFor(page, { cutscene: null }, 600_000)
  await waitFor(page, { tickAtLeast: (await stateOf(page)).tick + 30 })

  const objective = page.getByTestId('hud-objective')
  await expect(objective).toBeVisible()
  const look = await objective.evaluate((element) => {
    const style = getComputedStyle(element)
    const marker = getComputedStyle(element, '::before')
    return {
      background: style.backgroundColor,
      border: style.borderTopWidth,
      marker: marker.content,
    }
  })
  expect(look.background).toBe('rgba(0, 0, 0, 0)')
  expect(look.border).toBe('0px')
  expect(look.marker).toContain('✦')

  // Nothing carried: the box is not drawn (an empty bordered box over the picture says nothing).
  await expect(page.getByTestId('hud-inventory-empty')).toBeHidden()
  await expect(page.getByTestId('hud-inventory')).toBeHidden()
})
