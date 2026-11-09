import { describe, expect, it } from 'vitest'
import { JOURNEY_TIMEOUT_MS, PLAY_STEP_MS } from '../../e2e/budget.ts'

// The journeys draw WebGL2 in software on the CI runners, a frame every few hundred milliseconds when the machine is
// loaded, so a journey is many slow page round trips. The portrait journey (G3-x) took 31 to 33 s there and was cut
// off at Playwright's default 30 s while its last step (play coming back) was about to pass.
describe('the journeys’ time budget', () => {
  it('lets a whole journey run longer than any one of its steps, several steps over', () => {
    expect(JOURNEY_TIMEOUT_MS).toBeGreaterThanOrEqual(3 * PLAY_STEP_MS)
  })
})
