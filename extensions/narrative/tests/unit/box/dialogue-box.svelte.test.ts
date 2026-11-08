// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { blockedWith, type Places } from '@automata/places'
import { createPuzzlePlugin } from '@automata/puzzle/sim'
import { type Command, createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dialogueBoxSlot } from '#src/features/box/box-slot.ts'
import { createNarrative } from '#src/shared/sim/narrative.plugin.ts'
import { RECORDS, TALK, TEXT } from '#src/testing/toy-dialogue.ts'

// The dialogue box on the play screen: it reads the conversation from the sim and sends `narrative.advance` and
// `narrative.choose`. The sim here has no rooms (a flat field), because the box does not care where anyone stands.

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

let sim: Sim
let play: PlayMount | undefined
const reported: string[] = []
const lines = (id: string) => RECORDS.find((record) => record.id === id)
const words = (key: string) => TEXT[key]

async function open(options: { words?: (key: string) => string | undefined } = {}) {
  const narrative = createNarrative({ places: flat })
  sim = await createSim({
    seed: 1,
    plugins: [definePlugin({ name: 'flat' }), createPuzzlePlugin(), narrative.plugin],
  })
  narrative.load(sim as never, { graphs: [TALK], storylets: [] })
  play = mountInPlay(dialogueBoxSlot(options.words ?? words, lines), sim)
  return { narrative }
}
/** Steps the sim with `orders` (and the box's own sends), the way the play screen's loop does, then draws. */
function stepOnce(...orders: Pick<Command, 'type' | 'payload'>[]): void {
  const input = orders.map((order, seq): Command => ({ tick: sim.tick, source: 0, seq, ...order }))
  sim.step(play?.session.commands(sim.tick, input) ?? input)
  play?.session.refresh()
  flushSync()
}
const q = (testId: string) => play?.host.querySelector<HTMLElement>(`[data-testid=${testId}]`) ?? null

afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
  reported.length = 0
  vi.unstubAllGlobals()
})

describe('the dialogue box', () => {
  it('shows nothing while there is no conversation', async () => {
    await open()
    expect(q('dialogue-box')).toBeNull()
  })

  it('shows the speaker and the words of a line, with Next', async () => {
    await open()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    expect(q('dialogue-box')).not.toBeNull()
    expect(q('dialogue-speaker')?.textContent).toBe('Porter')
    expect(q('dialogue-line')?.textContent).toBe('Cold tonight. The river is high.')
    expect(q('dialogue-next')).not.toBeNull()
    expect(play?.host.querySelectorAll('[data-testid^=dialogue-choice]')).toHaveLength(0)
  })

  it('gives Next the focus, so Enter and Space press it, and pressing it moves to the next line', async () => {
    await open()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    await vi.waitFor(() => expect(document.activeElement).toBe(q('dialogue-next')))
    q('dialogue-next')?.click()
    stepOnce()
    expect(q('dialogue-line')?.textContent).toBe('Who are you, then?')
  })

  it('shows the choices on the last line, with no Next, and keys 1 to 9 choose', async () => {
    await open()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    q('dialogue-next')?.click()
    stepOnce()
    expect(q('dialogue-next')).toBeNull()
    const choices = [...(play?.host.querySelectorAll('[data-testid^=dialogue-choice]') ?? [])]
    expect(choices.map((choice) => choice.textContent?.replaceAll(/\s+/g, ' ').trim())).toEqual([
      '1 Staff. I’m on nights.',
      '2 I don’t know yet.',
      '3 I think I’m for you.',
    ])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    stepOnce()
    // Choice 2 joins and goes past "warm", which only a lighter player hears, to the porter's last word.
    expect(q('dialogue-line')?.textContent).toBe('First light at 06:02, then.')
    expect(q('dialogue-next')).not.toBeNull()
    q('dialogue-next')?.click()
    stepOnce()
    expect(q('dialogue-box')).toBeNull()
  })

  it('moves the focus to the first choice when they appear, and back to the game when the talk ends', async () => {
    await open()
    const before = document.body.appendChild(document.createElement('button'))
    before.focus()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    await vi.waitFor(() => expect(document.activeElement).toBe(q('dialogue-next')))
    q('dialogue-next')?.click()
    stepOnce()
    await vi.waitFor(() => expect(document.activeElement).toBe(q('dialogue-choice-1')))
    q('dialogue-choice-1')?.click()
    stepOnce()
    await vi.waitFor(() => expect(document.activeElement).toBe(q('dialogue-next')))
    q('dialogue-next')?.click()
    stepOnce()
    expect(q('dialogue-box')).toBeNull()
    await vi.waitFor(() => expect(document.activeElement).toBe(before))
    before.remove()
  })

  it('sends one choice for two taps in the same tick', async () => {
    await open()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    q('dialogue-next')?.click()
    stepOnce()
    q('dialogue-choice-3')?.click()
    q('dialogue-choice-3')?.click()
    const sent = play?.session.commands(sim.tick, []) ?? []
    expect(sent.map((command) => command.type)).toEqual(['narrative.choose'])
    expect(sent[0]?.payload).toEqual({ index: 2 })
  })

  it('shows the speaker with an empty line, never the key, and reports a line with no words once', async () => {
    vi.stubGlobal('reportError', (error: unknown) => reported.push((error as Error).message))
    await open({ words: (key) => (key === 'toy.hello' ? undefined : TEXT[key]) })
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    expect(q('dialogue-speaker')?.textContent).toBe('Porter')
    expect(q('dialogue-line')?.textContent).toBe('')
    expect(play?.host.textContent).not.toContain('toy.hello')
    stepOnce()
    stepOnce()
    expect(reported).toEqual(['The line "toy.hello" has no words yet. Write them in Writer.'])
  })

  it('is asked to advance by a pad’s A when it is the focused button', async () => {
    await open()
    stepOnce({ type: 'narrative.start', payload: { graph: 'meet' } })
    const { fakeGamepads } = await import('@automata/framework/testing')
    const pads = fakeGamepads()
    Object.defineProperty(navigator, 'getGamepads', { value: pads.getGamepads, configurable: true })
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
    pads.connect(0)
    play?.unmount()
    play = mountInPlay(dialogueBoxSlot(words, lines), sim)
    flushSync()
    await vi.waitFor(() => expect(document.activeElement).toBe(q('dialogue-next')))
    const tick = () => {
      for (const frame of frames.splice(0)) frame()
      flushSync()
    }
    tick()
    pads.press(0)
    tick()
    const sent = play.session.commands(sim.tick, [])
    expect(sent.map((command) => command.type)).toEqual(['narrative.advance'])
  })
})
