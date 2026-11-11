// @vitest-environment jsdom

import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { createSim, definePlugin, type Sim } from '@automata/sim'
import { flushSync, tick } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { ITEMS, idle, type ToyHud, toyHud } from '#src/testing/toy-hud.ts'

// The inventory: a row of item buttons, the held one marked. Pressing an item opens a small sheet with its name, its text
// and three actions (Hold, Combine, Close); a combine takes a second item.

let sim: Sim | undefined
let play: PlayMount | undefined
afterEach(() => {
  play?.unmount()
  play = undefined
  sim?.dispose()
})

async function open(items: HudModelItems = ITEMS, held?: string): Promise<ToyHud> {
  const toy = toyHud()
  toy.model = { ...idle(), items, held }
  sim = await createSim({ seed: 1, plugins: [definePlugin({ name: 'flat' })] })
  play = mountInPlay(toy.slot, sim)
  frame()
  return toy
}
type HudModelItems = typeof ITEMS
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
const sheet = (): HTMLElement | null => q('hud-item-sheet')

describe('the inventory', () => {
  it('says so when nothing is carried', async () => {
    await open([])
    expect(q('hud-inventory-empty')?.textContent).toBe('You carry nothing.')
    expect(q('hud-item-key')).toBeNull()
  })

  it('shows a button for each item, and marks the one in hand', async () => {
    await open(ITEMS, 'lid')
    expect(ITEMS.map((item) => q(`hud-item-${item.id}`)?.textContent?.trim())).toEqual(['Key', 'Lid', 'Jar'])
    expect(q('hud-item-lid')?.getAttribute('aria-pressed')).toBe('true')
    expect(q('hud-item-key')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('opens a sheet with the name, the text and three actions', async () => {
    await open()
    expect(sheet()).toBeNull()
    press('hud-item-key')
    expect(sheet()?.textContent).toContain('Key')
    expect(sheet()?.textContent).toContain('A small brass key.')
    expect(['hold', 'combine', 'close'].map((a) => q(`hud-item-${a}`)?.textContent?.trim())).toEqual([
      'Hold',
      'Combine',
      'Close',
    ])
  })

  it('holds the item and closes the sheet; holding the held item puts it away', async () => {
    const toy = await open()
    press('hud-item-key')
    press('hud-item-hold')
    expect(toy.calls).toEqual(['hold:key'])
    expect(sheet()).toBeNull()
    toy.model = { ...toy.model, held: 'key' }
    frame()
    press('hud-item-key')
    press('hud-item-hold')
    expect(toy.calls).toEqual(['hold:key', 'hold:'])
  })

  it('combines with a second item, picked from the row', async () => {
    const toy = await open()
    press('hud-item-key')
    press('hud-item-combine')
    expect(q('hud-item-combining')?.textContent).toContain('Key')
    press('hud-item-lid')
    expect(toy.calls).toEqual(['combine:key+lid'])
    expect(sheet()).toBeNull()
  })

  it('pressing the same item again while combining cancels the combine', async () => {
    const toy = await open()
    press('hud-item-key')
    press('hud-item-combine')
    press('hud-item-key')
    expect(toy.calls).toEqual([])
    expect(q('hud-item-combining')).toBeNull()
  })

  it('closes with Close and with Escape, and focus goes back to the item', async () => {
    await open()
    press('hud-item-key')
    press('hud-item-close')
    await tick()
    expect(sheet()).toBeNull()
    expect(document.activeElement).toBe(q('hud-item-key'))
    press('hud-item-lid')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    flushSync()
    await tick()
    expect(sheet()).toBeNull()
    expect(document.activeElement).toBe(q('hud-item-lid'))
  })

  it('closes an open sheet when a cutscene takes the input, and stays closed after', async () => {
    const toy = await open()
    press('hud-item-key')
    toy.model = { ...toy.model, locked: true }
    frame()
    expect(q('hud-inventory')).toBeNull()
    toy.model = { ...toy.model, locked: false }
    frame()
    expect(q('hud-inventory')).not.toBeNull()
    expect(sheet()).toBeNull()
  })

  it('drops a sheet whose item is gone', async () => {
    const toy = await open()
    press('hud-item-key')
    toy.model = { ...toy.model, items: ITEMS.filter((item) => item.id !== 'key') }
    frame()
    expect(sheet()).toBeNull()
  })
})
