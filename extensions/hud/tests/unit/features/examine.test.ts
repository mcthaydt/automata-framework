// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automataframework/framework/testing'
import { createSim, definePlugin, type Sim } from '@automataframework/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idle, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

// The examine box: a line said about something, in narrative's one box. Any press dismisses it, and it is the one piece
// that stays while a cutscene holds input.

let sim: Sim | undefined
let play: PlayMount | undefined
afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
  vi.unstubAllGlobals()
})

async function open(): Promise<ToyHud> {
  const toy = toyHud()
  toy.model = { ...idle(), examine: { title: 'examine.title', line: 'examine.line' } }
  sim = await createSim({ seed: 1, plugins: [definePlugin({ name: 'flat' })] })
  play = mountInPlay(toy.slot, sim)
  frame()
  return toy
}
const frame = (): void => {
  sim?.step([])
  play?.session.refresh()
  flushSync()
}
const q = (testId: string): HTMLElement | null =>
  play?.host.querySelector<HTMLElement>(`[data-testid=${testId}]`) ?? null

describe('the examine box', () => {
  it('shows the title and the line, in the dialogue box', async () => {
    await open()
    expect(q('dialogue-box')).not.toBeNull()
    expect(q('dialogue-speaker')?.textContent).toBe('Cupboard')
    expect(q('dialogue-line')?.textContent).toBe('Empty, but for a smell of lavender.')
  })

  it('shows only the line when there is no title', async () => {
    const toy = await open()
    toy.model = { ...idle(), examine: { title: undefined, line: 'examine.line' } }
    frame()
    expect(q('dialogue-speaker')).toBeNull()
  })

  it('is absent when there is nothing to examine', async () => {
    const toy = await open()
    toy.model = idle()
    frame()
    expect(q('dialogue-box')).toBeNull()
  })

  it('dismisses on a press anywhere on the box', async () => {
    const toy = await open()
    q('dialogue-line')?.click()
    expect(toy.calls).toEqual(['dismiss'])
  })

  it('dismisses on Enter, Space or Escape', async () => {
    const toy = await open()
    for (const key of ['Enter', ' ', 'Escape']) window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    expect(toy.calls).toEqual(['dismiss', 'dismiss', 'dismiss'])
  })

  it('dismisses once for a press of the button, not twice', async () => {
    const toy = await open()
    q('hud-examine-close')?.click()
    expect(toy.calls).toEqual(['dismiss'])
  })

  it('dismisses on a pad confirm', async () => {
    let pressed = false
    vi.stubGlobal('navigator', { getGamepads: () => [{ buttons: [{ pressed }] }] })
    // The play host's own frame loop asks for frames too, so every callback is kept and each is run.
    let steps: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      steps.push(callback)
      return steps.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const toy = await open()
    pressed = true
    const run = steps
    steps = []
    for (const step of run) step(0)
    expect(toy.calls).toEqual(['dismiss'])
  })

  it('stays while a cutscene holds input, when every other piece goes', async () => {
    const toy = await open()
    toy.model = { ...toy.model, locked: true, objective: 'objective.look' }
    frame()
    expect(q('dialogue-box')).not.toBeNull()
    expect(q('hud-objective')).toBeNull()
  })
})
