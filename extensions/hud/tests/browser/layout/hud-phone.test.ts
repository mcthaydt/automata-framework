import { mountInPlay, settleLayout } from '@automata/framework/testing'
import { createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { idle, LONG_LINE, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

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
  return show({ ...idle(), objective, prompt: { at: 'jar', name: 'name.jar' } })
}

/** Mounts the toy HUD over a sim with `model` and gives the host once it has laid out. */
async function show(
  model: ToyHud['model'],
  more: Readonly<Record<string, string>> = {},
): Promise<HTMLElement> {
  const toy = toyHud(undefined, more)
  toy.model = model
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

const q = (host: HTMLElement, testId: string): HTMLElement => {
  const found = host.querySelector<HTMLElement>(`[data-testid=${testId}]`)
  if (found === null) throw new Error(`${testId} is not drawn`)
  return found
}
const within = (inner: DOMRect, outer: DOMRect): boolean =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5

const MANY = Array.from({ length: 20 }, (_, n) => ({
  id: `item${n}`,
  name: `item.n${n}`,
  text: `text.n${n}`,
}))
const MANY_WORDS = Object.fromEntries(
  MANY.flatMap((item, n) => [
    [item.name, `Item ${n + 1}`],
    [item.text, `Item number ${n + 1}, a thing you picked up on the way.`],
  ]),
)

describe('the inventory layout', () => {
  test.each(SIZES)('twenty items scroll in the row and nowhere else, at $name', async (size) => {
    await page.viewport(size.width, size.height)
    const host = await show({ ...idle(), items: MANY }, MANY_WORDS)
    const field = q(host, 'hud-inventory').closest('.af-game-play__field') as HTMLElement
    const piece = q(host, 'hud-inventory')
    const row = piece.querySelector<HTMLElement>('.row') as HTMLElement
    expect(within(piece.getBoundingClientRect(), field.getBoundingClientRect())).toBe(true)
    // The row holds all twenty and scrolls sideways; the piece itself does not.
    expect(row.scrollWidth).toBeGreaterThan(row.clientWidth)
    expect(piece.scrollWidth).toBeLessThanOrEqual(piece.clientWidth + 1)
    for (const button of row.querySelectorAll('button'))
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(row.querySelectorAll('button')).toHaveLength(20)
  })

  test('a sheet has whole targets, and keeps its place and focus when the phone turns', async () => {
    await page.viewport(390, 844)
    const host = await show({ ...idle(), items: MANY.slice(0, 3) }, MANY_WORDS)
    q(host, 'hud-item-item1').click()
    flushSync()
    await settleLayout()
    const hold = q(host, 'hud-item-hold')
    // Focus moves onto the primary action as the sheet opens.
    await expect.poll(() => document.activeElement === hold).toBe(true)
    expect(hold.getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    for (const id of ['hud-item-combine', 'hud-item-close'])
      expect(q(host, id).getBoundingClientRect().height).toBeGreaterThanOrEqual(44)

    await page.viewport(844, 390)
    await settleLayout()
    const field = q(host, 'hud-inventory').closest('.af-game-play__field') as HTMLElement
    expect(q(host, 'hud-item-sheet')).not.toBeNull()
    expect(document.activeElement).toBe(hold)
    expect(within(q(host, 'hud-inventory').getBoundingClientRect(), field.getBoundingClientRect())).toBe(true)
  })
})

describe('the keypad layout', () => {
  test.each(SIZES)('every key is a whole target inside the field, at $name', async (size) => {
    await page.viewport(size.width, size.height)
    const host = await show({ ...idle(), keypad: { open: true, digits: 4 } })
    const keypad = q(host, 'hud-keypad')
    const field = keypad.closest('.af-game-play__field') as HTMLElement
    expect(within(keypad.getBoundingClientRect(), field.getBoundingClientRect())).toBe(true)
    for (const key of keypad.querySelectorAll('button')) {
      const rect = key.getBoundingClientRect()
      expect(rect.height, `${key.textContent} is too short`).toBeGreaterThanOrEqual(
        key.dataset.kind === 'primary' || /^[0-9]$/.test(key.textContent?.trim() ?? '') ? 48 : 44,
      )
      expect(rect.width, `${key.textContent} is too narrow`).toBeGreaterThanOrEqual(44)
    }
    // Nothing is cut off: on a short screen the keypad scrolls inside itself, and says so by being scrollable.
    expect(keypad.scrollWidth).toBeLessThanOrEqual(keypad.clientWidth + 1)
  })
})

describe('the examine layout', () => {
  test.each(SIZES)(
    'a long line wraps inside the box and the box stays in the field, at $name',
    async (size) => {
      await page.viewport(size.width, size.height)
      const host = await show({ ...idle(), examine: { title: 'examine.title', line: 'objective.long' } })
      const box = q(host, 'dialogue-box')
      const field = box.closest('.af-game-play__field') as HTMLElement
      expect(within(box.getBoundingClientRect(), field.getBoundingClientRect())).toBe(true)
      expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1)
      expect(q(host, 'hud-examine-close').getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    },
  )
})
