import { mountInPlay, settleLayout } from '@automata/framework/testing'
import { blockedWith, type Places } from '@automata/places'
import { createPuzzlePlugin } from '@automata/puzzle/sim'
import { createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { dialogueBoxSlot } from '#src/features/box/box-slot.ts'
import { BOX_HEIGHT_VAR } from '#src/features/box/dialogue-box.ts'
import type { DialogueGraph } from '#src/shared/sim/dialogue.schema.ts'
import type { LineRecord } from '#src/shared/sim/lines.schema.ts'
import { createNarrative } from '#src/shared/sim/narrative.plugin.ts'

// The dialogue box in the real play screen at a phone held both ways and at a tablet, with production CSS: it stays inside
// the field (so never over Pause), its buttons are whole 48 px targets, the choices stack on a phone, and a long line wraps inside
// the box instead of running off the screen.

const LONG =
  'It was a very long night at the river, and the porter had a great deal to say about the water, the weather and the clocks.'
const lines: Record<string, LineRecord> = Object.fromEntries(
  ['say', 'a', 'b', 'c'].map((id) => [
    id,
    { id, kind: 'dialogue', speaker: 'porter', text: id } as LineRecord,
  ]),
)
const TEXT: Record<string, string> = {
  say: LONG,
  a: 'Staff, and I am on nights tonight, as I have been all week.',
  b: 'I do not know yet.',
  c: 'I think I am for you.',
  'speaker.porter': 'Porter',
}
const GRAPH: DialogueGraph = {
  id: 'meet',
  speaker: 'porter',
  start: 'open',
  nodes: {
    open: {
      say: ['say'],
      choices: [
        { line: 'a', next: 'end' },
        { line: 'b', next: 'end' },
        { line: 'c', next: 'end' },
      ],
    },
    end: { say: [] },
  },
}
const flat: Places = {
  provider: 'flat',
  at: () => undefined,
  move: () => {},
  spawnAt: () => [],
  rooms: () => [],
  roomAt: () => 0,
  roomOf: () => 0,
  walk: (_, doors) => blockedWith(() => false, doors),
  sight: (_, doors) => blockedWith(() => false, doors),
  crossing: () => null,
}

let sim: Sim | undefined
let mounted: ReturnType<typeof mountInPlay> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  sim?.dispose()
})

async function open(): Promise<HTMLElement> {
  const narrative = createNarrative({ places: flat })
  sim = await createSim({
    seed: 1,
    plugins: [definePlugin({ name: 'flat' }), createPuzzlePlugin(), narrative.plugin],
  })
  narrative.load(sim as never, { graphs: [GRAPH], storylets: [] })
  mounted = mountInPlay(
    dialogueBoxSlot(
      (key) => TEXT[key],
      (id) => lines[id],
    ),
    sim,
  )
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'narrative.start', payload: { graph: 'meet' } }])
  mounted.session.refresh()
  flushSync()
  await settleLayout()
  return mounted.host
}

const SIZES = [
  { name: 'phone, portrait', width: 390, height: 844 },
  { name: 'phone, landscape', width: 844, height: 390 },
  { name: 'tablet', width: 1024, height: 768 },
] as const

describe('the dialogue box layout', () => {
  test.each(SIZES)('$name ($width x $height)', async (size) => {
    await page.viewport(size.width, size.height)
    const host = await open()
    const box = host.querySelector<HTMLElement>('[data-testid=dialogue-box]')
    const pause = host.querySelector<HTMLElement>('[data-testid=pause]')
    if (box === null || pause === null) throw new Error('the box or Pause is not drawn')
    const boxRect = box.getBoundingClientRect()
    const pauseRect = pause.getBoundingClientRect()

    // It never covers Pause, and it is inside the screen.
    const overlaps =
      boxRect.left < pauseRect.right &&
      boxRect.right > pauseRect.left &&
      boxRect.top < pauseRect.bottom &&
      boxRect.bottom > pauseRect.top
    expect(overlaps, 'the box covers Pause').toBe(false)
    expect(boxRect.left).toBeGreaterThanOrEqual(0)
    expect(boxRect.right).toBeLessThanOrEqual(size.width)
    expect(boxRect.bottom).toBeLessThanOrEqual(size.height)

    // Every button is a whole target.
    const buttons = [...box.querySelectorAll<HTMLElement>('button')]
    expect(buttons.length).toBe(3)
    for (const button of buttons) expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48)

    // A long line wraps inside the box; nothing runs off its side.
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1)
    const line = host.querySelector<HTMLElement>('[data-testid=dialogue-line]')?.getBoundingClientRect()
    expect(line?.right ?? 0).toBeLessThanOrEqual(boxRect.right + 1)

    // On a phone the choices stack, one under another; wider, they may sit side by side.
    if (size.width < 600) {
      const tops = buttons.map((button) => button.getBoundingClientRect().top)
      expect([...tops].sort((a, b) => a - b)).toEqual(tops)
      expect(new Set(tops).size).toBe(3)
    }

    // The field knows how tall the box is, so a caption can sit above it.
    const field = host.querySelector<HTMLElement>('.af-game-play__field')
    expect(Number.parseFloat(field?.style.getPropertyValue(BOX_HEIGHT_VAR) ?? '0')).toBeGreaterThan(40)
  })
})
