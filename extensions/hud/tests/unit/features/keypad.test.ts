// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automataframework/framework/testing'
import { createSim, definePlugin, type Sim } from '@automataframework/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { idle, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

// The keypad: ten digits, Delete, Enter and Close, for a code of `digits` digits. Keyboard, pad and touch all work.

let sim: Sim | undefined
let play: PlayMount | undefined
afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
})

async function open(digits = 4): Promise<ToyHud> {
  const toy = toyHud()
  toy.model = { ...idle(), keypad: { open: true, digits } }
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
const press = (testId: string): void => {
  q(testId)?.click()
  flushSync()
}
const type = (key: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  flushSync()
}
const shown = (): string => q('hud-keypad-code')?.textContent?.replaceAll(/\s/g, '') ?? ''

describe('the keypad', () => {
  it('is absent until the model opens it', async () => {
    const toy = await open()
    toy.model = idle()
    frame()
    expect(q('hud-keypad')).toBeNull()
  })

  it('has ten digits, Delete, Enter and Close', async () => {
    await open()
    for (const digit of '0123456789') expect(q(`hud-key-${digit}`)?.textContent?.trim()).toBe(digit)
    expect(['delete', 'enter', 'close'].map((a) => q(`hud-key-${a}`)?.textContent?.trim())).toEqual([
      'Delete',
      'Enter',
      'Close',
    ])
  })

  it('shows the digits typed and the places left', async () => {
    await open()
    expect(shown()).toBe('____')
    press('hud-key-4')
    press('hud-key-2')
    expect(shown()).toBe('42__')
  })

  it('takes no more digits than the code has', async () => {
    await open(3)
    for (const digit of '12345') press(`hud-key-${digit}`)
    expect(shown()).toBe('123')
  })

  it('Delete takes the last digit away', async () => {
    await open()
    press('hud-key-4')
    press('hud-key-2')
    press('hud-key-delete')
    expect(shown()).toBe('4___')
  })

  it('Enter sends the code once it is whole, and not before', async () => {
    const toy = await open(3)
    press('hud-key-4')
    press('hud-key-enter')
    expect(toy.calls).toEqual([])
    press('hud-key-2')
    press('hud-key-0')
    press('hud-key-enter')
    expect(toy.calls).toEqual(['code:420'])
  })

  it('types on a keyboard: digits, Backspace, Enter', async () => {
    const toy = await open(3)
    for (const key of ['4', '2', '9', 'Backspace', '0', 'Enter']) type(key)
    expect(toy.calls).toEqual(['code:420'])
  })

  it('closes with Close and with Escape', async () => {
    const toy = await open()
    press('hud-key-close')
    type('Escape')
    expect(toy.calls).toEqual(['dismiss', 'dismiss'])
  })

  it('closes when a cutscene takes the input, and opens empty after', async () => {
    const toy = await open()
    press('hud-key-4')
    toy.model = { ...toy.model, locked: true }
    frame()
    expect(q('hud-keypad')).toBeNull()
    toy.model = { ...toy.model, locked: false }
    frame()
    expect(shown()).toBe('____')
  })

  it('has every button as a target of its own, not an image of one', async () => {
    await open()
    const buttons = [...(q('hud-keypad')?.querySelectorAll('button') ?? [])]
    expect(buttons).toHaveLength(13)
    expect(buttons.every((b) => b.type === 'button')).toBe(true)
  })
})
