// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { blockedWith, type Places } from '@automata/places'
import { createPuzzlePlugin } from '@automata/puzzle/sim'
import { type Command, createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dialogueBoxSlot } from '#src/features/box/box-slot.ts'
import type { DialogueGraph } from '#src/shared/sim/dialogue.schema.ts'
import type { LineRecord } from '#src/shared/sim/lines.schema.ts'
import { createNarrative } from '#src/shared/sim/narrative.plugin.ts'

// A line with a delivery is typed out in the dialogue box at the box's rate, with the clock injected; a press completes
// the line before it dismisses it; under reduced motion all of it shows at once; a line with no delivery is said plainly.

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
const WORDS = 'Cold tonight. The river is high.'
const RECORDS: Record<string, LineRecord> = {
  slow: {
    id: 'slow',
    kind: 'dialogue',
    speaker: 'porter',
    text: 'slow',
    delivery: { beats: [{ after: 1, pause: 1 }] },
  },
  plain: { id: 'plain', kind: 'dialogue', speaker: 'porter', text: 'plain' },
  last: { id: 'last', kind: 'dialogue', speaker: 'porter', text: 'last' },
  ask: { id: 'ask', kind: 'dialogue', speaker: 'porter', text: 'ask' },
}
const TEXT: Record<string, string> = { slow: WORDS, plain: 'Plain words.', last: 'Goodnight.', ask: 'Well?' }
const GRAPH: DialogueGraph = {
  id: 'talk',
  speaker: 'porter',
  start: 'open',
  nodes: {
    open: { say: ['slow', 'last'] },
    quick: { say: ['plain'] },
    ask: { say: ['ask'], choices: [{ line: 'plain', next: 'quick' }] },
  },
}

let sim: Sim
let play: PlayMount | undefined
let seconds = 0
let frames: FrameRequestCallback[] = []
afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
  vi.unstubAllGlobals()
})

/** Opens the box over a conversation; the clock is `seconds` and frames wait for the test to run them. */
async function open(start: string, reduced = false) {
  seconds = 0
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  const narrative = createNarrative({ places: flat })
  sim = await createSim({
    seed: 1,
    plugins: [definePlugin({ name: 'flat' }), createPuzzlePlugin(), narrative.plugin],
  })
  narrative.load(sim as never, { graphs: [{ ...GRAPH, start }], storylets: [] })
  play = mountInPlay(
    dialogueBoxSlot(
      (key) => TEXT[key],
      (id) => RECORDS[id],
      { clock: () => seconds, rate: 10 },
    ),
    sim,
  )
  stepOnce({ type: 'narrative.start', payload: { graph: 'talk' } })
}
function stepOnce(...orders: Pick<Command, 'type' | 'payload'>[]): void {
  const input = orders.map((order, seq): Command => ({ tick: sim.tick, source: 0, seq, ...order }))
  sim.step(play?.session.commands(sim.tick, input) ?? input)
  play?.session.refresh()
  flushSync()
}
/** Moves the clock to `to` seconds and runs the frames the page asked for. */
function at(to: number): void {
  seconds = to
  const run = frames
  frames = []
  for (const frame of run) frame(0)
  flushSync()
}
const q = (testId: string): HTMLElement | null =>
  play?.host.querySelector<HTMLElement>(`[data-testid=${testId}]`) ?? null
const typed = (): string => q('dialogue-typed')?.textContent ?? ''
const press = (): void => {
  q('dialogue-next')?.click()
  stepOnce()
}

describe('a line typed out in the dialogue box', () => {
  it('shows nothing at first, then more as the clock runs, holding for a beat at a sentence end', async () => {
    await open('open')
    expect(typed()).toBe('')
    at(0.5)
    expect(typed()).toBe('Cold ')
    at(1.3)
    expect(typed()).toBe('Cold tonight.')
    // The beat after the first sentence holds it there for 0.35 s.
    at(1.6)
    expect(typed()).toBe('Cold tonight.')
    at(2.0)
    expect(typed()).toBe('Cold tonight. Th')
    at(5)
    expect(typed()).toBe(WORDS)
  })

  it('keeps the room of the words still to come, so the box does not grow', async () => {
    await open('open')
    expect(q('dialogue-line')?.textContent).toBe(WORDS)
    expect(q('dialogue-line')?.querySelector('.unseen')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('a press completes the line, and the next press goes on', async () => {
    await open('open')
    at(0.5)
    press()
    expect(typed()).toBe(WORDS)
    expect(q('dialogue-line')?.textContent).toBe(WORDS)
    press()
    // The second press moved on to the conversation's next line.
    expect(q('dialogue-line')?.textContent).toBe('Goodnight.')
  })

  it('starts the next line from the beginning', async () => {
    await open('open')
    at(5)
    press()
    expect(typed()).toBe('Goodnight.')
  })

  it('shows all of it at once under reduced motion', async () => {
    await open('open', true)
    expect(typed()).toBe(WORDS)
    expect(q('dialogue-next')).not.toBeNull()
  })

  it('says a line with no delivery plainly, all at once', async () => {
    await open('quick')
    expect(typed()).toBe('Plain words.')
  })

  it('shows the choices only once the line is all there', async () => {
    RECORDS.ask = { ...(RECORDS.ask as LineRecord), delivery: { pace: 1 } }
    try {
      await open('ask')
      expect(play?.host.querySelectorAll('[data-testid^=dialogue-choice]')).toHaveLength(0)
      at(5)
      expect(play?.host.querySelectorAll('[data-testid^=dialogue-choice]')).toHaveLength(1)
    } finally {
      RECORDS.ask = { id: 'ask', kind: 'dialogue', speaker: 'porter', text: 'ask' }
    }
  })
})
