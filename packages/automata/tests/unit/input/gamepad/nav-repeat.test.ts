import { describe, expect, it } from 'vitest'
import { NavRepeat, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from '#src/features/input/gamepad/nav-repeat.ts'

// The held-direction repeat (M4 spec §4.3), from FloorFifty `gamepad-source.ts` at `ac72660` (lines 35–36 and
// `fireNav`) and its "repeats a held direction after a delay, not every frame" test.
const down = new Set(['down'] as const)
const none = new Set<'down'>()

/** Polls every 1 ms from 0 to `until` holding `held`, and lists when each direction fired. */
function timeline(repeat: NavRepeat, until: number): number[] {
  const fired: number[] = []
  for (let now = 0; now <= until; now++) if (repeat.update(down, now).length > 0) fired.push(now)
  return fired
}

describe('NavRepeat', () => {
  it('fires a held direction at once, after 400 ms, then every 120 ms (I-d)', () => {
    expect([REPEAT_DELAY_MS, REPEAT_EVERY_MS]).toEqual([400, 120])
    expect(timeline(new NavRepeat(), 700)).toEqual([0, 400, 520, 640])
  })

  it('fires again at once after a release', () => {
    const repeat = new NavRepeat()
    expect(repeat.update(down, 0)).toEqual(['down'])
    expect(repeat.update(down, 100)).toEqual([])
    expect(repeat.update(none, 150)).toEqual([])
    expect(repeat.update(down, 160)).toEqual(['down'])
  })

  it('forgets everything on clear', () => {
    const repeat = new NavRepeat()
    repeat.update(down, 0)
    repeat.clear()
    expect(repeat.update(down, 10)).toEqual(['down'])
  })
})
