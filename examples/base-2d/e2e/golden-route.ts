import { expect, type Locator, type Page } from '@playwright/test'
import { createBaseSim, moveCommand, readPlayer } from '../src/base-sim.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_ROUTE } from '../src/golden.ts'

/**
 * Plays the golden route with real key presses, tick for tick, on the game whose root is `game` (in the page or
 * in a frame of it), from the start of a round to the ember. Playwright's clock must be installed and paused:
 * frames come every 16 ms and steps every 16.67 ms, so a frame runs at most one step, and the route moves the
 * clock one frame at a time, reads the sim tick the page shows, and changes keys right after the frame that ran
 * a segment's last step. Key presses go to the focused frame.
 *
 * The same route runs in a sim in this Node process: after every segment the page's character must be exactly
 * where the sim says, so a mismatch names the segment where the page and the sim parted. Returns the Node sim's
 * state hash at the goal tick, which the page's `data-hash` must equal.
 */
export async function playGoldenRoute(page: Page, game: Locator): Promise<{ expectedHash: string }> {
  const keyFor = { [-1]: 'ArrowLeft', 0: null, 1: 'ArrowRight' } as const
  let held: string[] = []
  const hold = async (wanted: string[]) => {
    for (const key of held) if (!wanted.includes(key)) await page.keyboard.up(key)
    for (const key of wanted) if (!held.includes(key)) await page.keyboard.down(key)
    held = wanted
  }
  const pageTick = async () => Number((await game.getAttribute('data-tick')) ?? 0)

  const reference = await createBaseSim()
  let ticks = 0
  for (const [index, [x, jump, length]] of GOLDEN_ROUTE.entries()) {
    const direction = keyFor[x]
    await hold([...(direction === null ? [] : [direction]), ...(jump ? ['KeyZ'] : [])])
    ticks = Math.min(ticks + length, GOLDEN_GOAL_TICK)
    while ((await pageTick()) < ticks) await page.clock.runFor(16)
    expect(await pageTick(), `the page ran past segment ${index}`).toBe(ticks)
    while (reference.tick < ticks) reference.step([moveCommand(reference, { x, jump })])
    const expected = readPlayer(reference)
    const actual = {
      x: await game.getAttribute('data-player-x'),
      y: await game.getAttribute('data-player-y'),
    }
    expect(actual, `after segment ${index} (tick ${ticks})`).toEqual({
      x: String(Math.floor(expected.x / 256)),
      y: String(Math.floor(expected.y / 256)),
    })
    if (ticks === GOLDEN_GOAL_TICK) break
  }
  const expectedHash = reference.hash()
  reference.dispose()
  await hold([])
  return { expectedHash }
}
