import { mountInPlay, settleLayout } from '@automata/framework/testing'
import { createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { idle, LONG_LINE, toyHud } from '#src/testing/toy-hud.ts'

// The HUD in the real play screen at a phone held both ways, with production CSS: the objective wraps a long line inside
// its piece (Review focus 4: a translation longer than the room), the prompt is a whole 48 px target, and nothing runs
// outside the play field, over Pause, or over the other piece.

let sim: Sim | undefined
let mounted: ReturnType<typeof mountInPlay> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  sim?.dispose()
})

async function open(objective: string): Promise<HTMLElement> {
  const toy = toyHud()
  toy.model = { ...idle(), objective, prompt: { at: 'jar', name: 'name.jar' } }
  sim = await createSim({ seed: 1, plugins: [definePlugin({ name: 'flat' })] })
  mounted = mountInPlay(toy.slot, sim)
  sim.step([])
  mounted.session.refresh()
  flushSync()
  await settleLayout()
  return mounted.host
}

const SIZES = [
  { name: 'phone, portrait', width: 390, height: 844 },
  { name: 'phone, landscape', width: 844, height: 390 },
] as const

const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

describe('the HUD layout', () => {
  test.each(SIZES)('a 140-character objective and the prompt at $name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    expect(LONG_LINE.length).toBeGreaterThanOrEqual(140)
    const host = await open('objective.long')
    const field = host.querySelector<HTMLElement>('.af-game-play__field')
    const line = host.querySelector<HTMLElement>('[data-testid=hud-objective]')
    const prompt = host.querySelector<HTMLElement>('[data-testid=hud-prompt]')
    const pause = host.querySelector<HTMLElement>('[data-testid=pause]')
    if (field === null || line === null || prompt === null || pause === null)
      throw new Error('the field, the objective, the prompt or Pause is not drawn')
    const area = field.getBoundingClientRect()
    const lineRect = line.getBoundingClientRect()
    const promptRect = prompt.getBoundingClientRect()

    // The long line wraps inside its piece, so it is taller than one line, and nothing runs off its side.
    expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth + 1)
    expect(lineRect.height).toBeGreaterThan(40)
    for (const rect of [lineRect, promptRect]) {
      expect(rect.left).toBeGreaterThanOrEqual(area.left)
      expect(rect.right).toBeLessThanOrEqual(area.right)
      expect(rect.top).toBeGreaterThanOrEqual(area.top)
      expect(rect.bottom).toBeLessThanOrEqual(area.bottom)
    }

    // The prompt is a whole primary target and the pieces keep out of Pause and of each other.
    expect(promptRect.height).toBeGreaterThanOrEqual(48)
    expect(promptRect.width).toBeGreaterThanOrEqual(48)
    expect(overlaps(lineRect, promptRect), 'the objective covers the prompt').toBe(false)
    expect(overlaps(promptRect, pause.getBoundingClientRect()), 'the prompt covers Pause').toBe(false)
    expect(overlaps(lineRect, pause.getBoundingClientRect()), 'the objective covers Pause').toBe(false)
  })
})
