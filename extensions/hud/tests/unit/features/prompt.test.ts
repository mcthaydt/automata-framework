// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automataframework/framework/testing'
import { createSim, definePlugin, type Sim } from '@automataframework/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idle, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

// The prompt: a button naming the hotspot in reach. Pressing it, Enter or a pad's confirm uses the hotspot.

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
  sim = await createSim({ seed: 1, plugins: [definePlugin({ name: 'flat' })] })
  play = mountInPlay(toy.slot, sim)
  return toy
}
const frame = (): void => {
  sim?.step([])
  play?.session.refresh()
  flushSync()
}
const prompt = (): HTMLButtonElement | null =>
  play?.host.querySelector<HTMLButtonElement>('[data-testid=hud-prompt]') ?? null
const near = (toy: ToyHud): void => {
  toy.model = { ...idle(), prompt: { at: 'jar', name: 'name.jar' } }
  frame()
}

describe('the prompt', () => {
  it('is absent with no hotspot in reach', async () => {
    await open()
    expect(prompt()).toBeNull()
  })

  it('names the hotspot in reach and uses it when pressed', async () => {
    const toy = await open()
    near(toy)
    expect(prompt()?.textContent).toContain('Jar')
    prompt()?.click()
    expect(toy.calls).toEqual(['use:jar'])
  })

  it('goes when the hotspot is out of reach, and while a cutscene holds input', async () => {
    const toy = await open()
    near(toy)
    toy.model = { ...idle(), prompt: { at: 'jar', name: 'name.jar' }, locked: true }
    frame()
    expect(prompt()).toBeNull()
    toy.model = idle()
    frame()
    expect(prompt()).toBeNull()
  })

  it('uses the hotspot on Enter, once for a press', async () => {
    const toy = await open()
    near(toy)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }))
    expect(toy.calls).toEqual(['use:jar'])
  })

  it('leaves Enter alone when it is for another control', async () => {
    const toy = await open()
    near(toy)
    const other = document.body.appendChild(document.createElement('button'))
    other.focus()
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    other.remove()
    expect(toy.calls).toEqual([])
  })

  it('uses the hotspot on a pad confirm, once for a press', async () => {
    let pressed = false
    vi.stubGlobal('navigator', { getGamepads: () => [{ buttons: [{ pressed }] }] })
    let step: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      step = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const toy = await open()
    near(toy)
    step?.(0)
    expect(toy.calls).toEqual([])
    pressed = true
    step?.(16)
    step?.(32)
    expect(toy.calls).toEqual(['use:jar'])
    pressed = false
    step?.(48)
    pressed = true
    step?.(64)
    expect(toy.calls).toEqual(['use:jar', 'use:jar'])
  })

  it('is a whole target', async () => {
    const toy = await open()
    near(toy)
    expect(prompt()?.getAttribute('data-kind')).toBe('primary')
    expect(prompt()?.className).toContain('af-control--primary')
  })
})
