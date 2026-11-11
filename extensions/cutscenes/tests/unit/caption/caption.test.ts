// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import type { Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captionSlot } from '#src/features/caption/caption-slot.ts'
import type { CutsceneScript } from '#src/shared/sim/cutscene.schema.ts'
import { createCutGame, load, type Order, play } from '#src/testing/cut-game.ts'

// The caption on the play screen: the words of the caption the playing cutscene has at this moment, above the dialogue
// box's place. It reads the sim and nothing else, takes no focus, and never shows a locale key.

const SCRIPT: CutsceneScript = {
  id: 'wake',
  duration: 3,
  camera: [{ t: 0, pos: [0, 5, 0], look: [0, 0, 0] }],
  caption: [{ t: 0, until: 2, line: 'line.stuck' }],
}
const LINES: Record<string, { text: string }> = { 'line.stuck': { text: 'toy.stuck' } }
const lines = (id: string) => LINES[id]
const TEXT: Record<string, string> = { 'toy.stuck': 'The gate sticks in the rain.' }

let sim: Sim
let mounted: PlayMount | undefined
const reported: string[] = []

async function open(
  words: (key: string) => string | undefined = (key) => TEXT[key],
  more: { lines?: typeof lines; typed?: Parameters<typeof captionSlot>[4] } = {},
) {
  ;({ sim } = await createCutGame([SCRIPT]))
  mounted = mountInPlay(captionSlot(words, more.lines ?? lines, { wake: SCRIPT }, 60, more.typed), sim)
}
function stepOnce(...orders: Order[]): void {
  const input = orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order }))
  sim.step(mounted?.session.commands(sim.tick, input) ?? input)
  mounted?.session.refresh()
  flushSync()
}
const caption = () => mounted?.host.querySelector<HTMLElement>('[data-testid=cutscene-caption]') ?? null

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  sim?.dispose()
  reported.length = 0
  vi.unstubAllGlobals()
})

describe('the cutscene caption', () => {
  it('shows nothing while no cutscene is playing', async () => {
    await open()
    stepOnce()
    expect(caption()).toBeNull()
  })

  it('shows the words of the caption that is up, and takes it away when its time is over', async () => {
    await open()
    stepOnce(load())
    stepOnce(play('wake'))
    expect(caption()?.textContent).toBe('The gate sticks in the rain.')
    for (let tick = 0; tick < 150; tick++) stepOnce() // two and a half seconds on: past `until` (2 s)
    expect(caption()).toBeNull()
  })

  it('takes no focus and does not catch a tap meant for the game', async () => {
    await open()
    stepOnce(load())
    stepOnce(play('wake'))
    const element = caption()
    expect(element?.tabIndex).toBe(-1)
    expect(element?.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])')).toBeNull()
    expect(getComputedStyle(element as HTMLElement).pointerEvents).toBe('none')
  })

  it('shows nothing, never the key, and reports a caption with no words once', async () => {
    vi.stubGlobal('reportError', (error: unknown) => reported.push((error as Error).message))
    await open(() => undefined)
    stepOnce(load())
    stepOnce(play('wake'))
    stepOnce()
    stepOnce()
    expect(caption()).toBeNull()
    expect(mounted?.host.textContent).not.toContain('toy.stuck')
    expect(reported).toEqual(['The caption "line.stuck" has no words yet. Write them in Writer.'])
  })

  describe('typed out', () => {
    // A stand-in for narrative's `typed`, at ten characters a second: cutscenes does not import narrative, so the game hands
    // its own in, and the caption only passes it the words, the line's delivery and the seconds since the caption came up.
    const typed = (words: string, _delivery: unknown, seconds: number) => ({
      shown: Math.min(words.length, Math.floor(seconds * 10)),
      done: seconds * 10 >= words.length,
    })
    const slow = (id: string) => ({ text: LINES[id]?.text ?? '', delivery: { pace: 1 } })

    it('types a line with a delivery by the cutscene’s own clock, keeping the room of the rest', async () => {
      await open(undefined, { lines: slow, typed })
      stepOnce(load())
      stepOnce(play('wake'))
      for (let tick = 0; tick < 30; tick++) stepOnce() // half a second on
      expect(caption()?.querySelector('[data-testid=cutscene-caption-typed]')?.textContent).toBe('The g')
      expect(caption()?.textContent).toBe('The gate sticks in the rain.')
    })

    it('shows a line with no delivery all at once, whatever it is given to type with', async () => {
      await open(undefined, { typed })
      stepOnce(load())
      stepOnce(play('wake'))
      expect(caption()?.querySelector('[data-testid=cutscene-caption-typed]')?.textContent).toBe(
        'The gate sticks in the rain.',
      )
    })
  })
})
