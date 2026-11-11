// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idle, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

// The objective line: the words for the model's objective key, in the place the file gives it.

let sim: Sim | undefined
let play: PlayMount | undefined
afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
  vi.restoreAllMocks()
})

async function open(): Promise<ToyHud> {
  const toy = toyHud()
  sim = await createSim({ seed: 1, plugins: [definePlugin({ name: 'flat' })] })
  play = mountInPlay(toy.slot, sim)
  return toy
}
/** Says a frame passed, so the HUD reads its model again. */
const frame = (): void => {
  sim?.step([])
  play?.session.refresh()
  flushSync()
}
const line = (): HTMLElement | null =>
  play?.host.querySelector<HTMLElement>('[data-testid=hud-objective]') ?? null

describe('the objective line', () => {
  it('shows nothing while the model has no objective', async () => {
    await open()
    expect(line()).toBeNull()
  })

  it('shows the words for the objective key', async () => {
    const toy = await open()
    toy.model = { ...idle(), objective: 'objective.look' }
    frame()
    expect(line()?.textContent?.trim()).toBe('Look around the room for something useful.')
  })

  it('changes with the model, and goes when the objective does', async () => {
    const toy = await open()
    toy.model = { ...idle(), objective: 'objective.look' }
    frame()
    toy.model = { ...idle(), objective: 'objective.long' }
    frame()
    expect(line()?.textContent).toContain('Find the key')
    toy.model = idle()
    frame()
    expect(line()).toBeNull()
  })

  it('is hidden while a cutscene holds input', async () => {
    const toy = await open()
    toy.model = { ...idle(), objective: 'objective.look', locked: true }
    frame()
    expect(line()).toBeNull()
  })

  it('never shows a key: a line with no words shows nothing and is told to whoever writes the game, once', async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: Error) => void reported.push(error.message))
    const toy = await open()
    toy.model = { ...idle(), objective: 'objective.missing' }
    frame()
    frame()
    expect(line()).toBeNull()
    expect(reported).toEqual([
      'The objective "objective.missing" has no words yet. Add them to the messages.',
    ])
    vi.unstubAllGlobals()
  })

  it('sits where the file puts it', async () => {
    const toy = await open()
    toy.model = { ...idle(), objective: 'objective.look' }
    frame()
    const style = line()?.getAttribute('style') ?? ''
    expect(style).toContain('left: 50%')
    expect(style).toContain('top: var(--af-gutter, 16px)')
    expect(style).toContain('min(480px')
  })
})
