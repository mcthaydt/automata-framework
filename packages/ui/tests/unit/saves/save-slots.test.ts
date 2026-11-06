import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SaveSlots from '#src/saves/SaveSlots.svelte'
import {
  defaultSlot,
  type SaveSlotsCopy,
  type SaveSlotsView,
  type SaveSlotView,
} from '#src/saves/save-slots.ts'

// SaveSlots (M5 spec §6, §7): the slot list and the few things a player does with a slot. Rows are chosen, the
// actions stay in a bar under the list, and a delete waits behind a dialog whose safe button has focus. Nothing here
// reads storage: the runtime's slot states arrive as a view and the player's choices leave as callbacks.

const copy: SaveSlotsCopy = {
  title: 'Saves',
  loading: 'Loading your saves…',
  slot: (slot) => `Slot ${slot}`,
  empty: 'Empty',
  unreadable: "This save can't be opened",
  newer: 'Saved by a newer version of the game',
  otherContent: 'Saved by another version of the game; your progress will load, the rest will not',
  writing: 'Saving…',
  failed: "Couldn't save this slot",
  load: 'Continue',
  newGame: 'New game',
  delete: 'Delete…',
  deleteTitle: 'Delete this save?',
  deleteBody: (name) => `${name} will be gone for good.`,
  deleteNewerBody: 'A newer version of the game made this save. Deleting it here cannot be undone.',
  deleteConfirm: 'Delete',
  cancel: 'Keep it',
  more: (count) => `+${count} more`,
}

const formatTime = (savedAt: number): string => `t${savedAt}`

const ready = (slot: number, savedAt: number, label?: string): SaveSlotView => ({
  kind: 'ready',
  slot,
  savedAt,
  ...(label === undefined ? {} : { label }),
})

const SLOTS: readonly SaveSlotView[] = [
  { kind: 'empty', slot: 1 },
  ready(2, 100, 'Ash, level 3'),
  ready(3, 300),
  { kind: 'other-content', slot: 4, savedAt: 200 },
  { kind: 'unreadable', slot: 5 },
  { kind: 'newer', slot: 6 },
]

function show(view: SaveSlotsView = { state: 'slots', slots: SLOTS }) {
  const handlers = { onload: vi.fn(), onnew: vi.fn(), ondelete: vi.fn() }
  const rendered = render(SaveSlots, { view, copy, formatTime, ...handlers })
  return { ...rendered, ...handlers }
}

const row = (slot: number): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-save-slot="${slot}"]`)
  if (found === null) throw new Error(`no row for slot ${slot}`)
  return found
}

const checked = (): string | undefined =>
  document.querySelector<HTMLElement>('[data-save-slot][aria-checked="true"]')?.dataset.saveSlot

describe('defaultSlot', () => {
  it('is the newest slot that can be continued, whichever its number', () => {
    expect(defaultSlot(SLOTS)).toBe(3)
  })

  it('counts a slot saved by other content as one that can be continued', () => {
    expect(
      defaultSlot([
        { kind: 'empty', slot: 1 },
        { kind: 'other-content', slot: 2, savedAt: 5 },
      ]),
    ).toBe(2)
  })

  it('is the first slot when none can be continued, and nothing when there are none', () => {
    expect(
      defaultSlot([
        { kind: 'unreadable', slot: 4 },
        { kind: 'empty', slot: 5 },
      ]),
    ).toBe(4)
    expect(defaultSlot([])).toBeUndefined()
  })
})

describe('SaveSlots: the list', () => {
  it('says it is loading, in a polite live region, with no rows and no actions', () => {
    show({ state: 'loading' })
    const message = document.querySelector('[data-save-slots-message]')
    expect(message?.textContent?.trim()).toBe('Loading your saves…')
    expect(message?.getAttribute('role')).toBe('status')
    expect(document.querySelectorAll('[data-save-slot]')).toHaveLength(0)
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('[data-save-slots]')?.getAttribute('data-state')).toBe('loading')
  })

  it('draws one row per slot, in the order given, as radios in one group', () => {
    show()
    const group = screen.getByRole('radiogroup', { name: 'Saves' })
    const rows = within(group).getAllByRole('radio')
    expect(rows.map((r) => r.getAttribute('data-save-slot'))).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual([
      'empty',
      'ready',
      'ready',
      'other-content',
      'unreadable',
      'newer',
    ])
  })

  it('says what each slot holds, in words: the label or the slot, the time, and why it cannot be opened', () => {
    show()
    expect(row(1).textContent).toContain('Slot 1')
    expect(row(1).textContent).toContain('Empty')
    expect(row(2).textContent).toContain('Ash, level 3')
    expect(row(2).textContent).toContain('t100')
    expect(row(3).textContent).toContain('Slot 3')
    expect(row(3).textContent).toContain('t300')
    expect(row(4).textContent).toContain('t200')
    expect(row(4).textContent).toContain('Saved by another version of the game')
    expect(row(5).textContent).toContain("This save can't be opened")
    expect(row(6).textContent).toContain('Saved by a newer version of the game')
  })

  it('keeps a long label whole in the row, so its accessible name is the full text however it is clamped', () => {
    const label = 'A very long name for a save, '.repeat(8).trim()
    show({ state: 'slots', slots: [ready(1, 10, label)] })
    expect(row(1).textContent).toContain(label)
  })

  it('shows a slot that is being written, and one whose write failed, in words', () => {
    show({
      state: 'slots',
      slots: [
        { ...ready(1, 10), activity: 'writing' },
        { ...ready(2, 20), activity: 'failed' },
      ],
    })
    expect(row(1).textContent).toContain('Saving…')
    expect(row(1).dataset.activity).toBe('writing')
    expect(row(2).textContent).toContain("Couldn't save this slot")
    expect(row(2).dataset.activity).toBe('failed')
  })

  it('keeps its rows in a declared scroll region and its actions outside it', () => {
    show()
    const region = document.querySelector('[data-scroll-region]')
    expect(region?.querySelector('[data-save-slot="1"]')).not.toBeNull()
    expect(region?.contains(screen.getByRole('button', { name: 'Continue' }))).toBe(false)
  })
})

describe('SaveSlots: choosing a slot', () => {
  it('starts on the newest slot that can be continued', () => {
    show()
    expect(checked()).toBe('3')
  })

  it('moves the choice to a row that is pressed, and only one row is chosen', async () => {
    show()
    await userEvent.click(row(2))
    expect(checked()).toBe('2')
    expect(document.querySelectorAll('[data-save-slot][aria-checked="true"]')).toHaveLength(1)
  })

  it('keeps every row in the focus order, so a pad or a keyboard can reach each one', () => {
    show()
    for (const r of document.querySelectorAll<HTMLElement>('[data-save-slot]')) {
      expect(r.tagName).toBe('BUTTON')
      expect(r.tabIndex).toBeGreaterThanOrEqual(0)
    }
  })

  it('falls back to the default when the chosen slot is gone', async () => {
    const { rerender } = show()
    await userEvent.click(row(2))
    await rerender({ view: { state: 'slots', slots: SLOTS.filter((s) => s.slot !== 2) } })
    expect(checked()).toBe('3')
  })

  it('keeps the choice when the list changes under it', async () => {
    const { rerender } = show()
    await userEvent.click(row(2))
    await rerender({ view: { state: 'slots', slots: [...SLOTS, ready(7, 900)] } })
    expect(checked()).toBe('2')
  })
})

describe('SaveSlots: the actions', () => {
  // The rows are radios, so the buttons are the actions alone.
  const names = (): string[] => screen.queryAllByRole('button').map((b) => b.textContent?.trim() ?? '')

  it.each([
    [2, ['Continue', 'Delete…']],
    [4, ['Continue', 'Delete…']],
    [1, ['New game']],
    [5, ['Delete…']],
    [6, ['Delete…']],
  ] as const)('slot %i offers %j', async (slot, expected) => {
    show()
    await userEvent.click(row(slot))
    expect(names()).toEqual(expected)
  })

  it('offers Continue and calls onload with the chosen slot', async () => {
    const { onload } = show()
    await userEvent.click(row(2))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onload).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('offers New game for an empty slot and calls onnew with it', async () => {
    const { onnew, onload } = show()
    await userEvent.click(row(1))
    await userEvent.click(screen.getByRole('button', { name: 'New game' }))
    expect(onnew).toHaveBeenCalledExactlyOnceWith(1)
    expect(onload).not.toHaveBeenCalled()
  })

  it('offers no way to continue, or to write over, a save that cannot be opened or is from a newer build', async () => {
    show()
    for (const slot of [5, 6]) {
      await userEvent.click(row(slot))
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'New game' })).toBeNull()
    }
  })

  it('leaves the actions off a slot that is being written, and on one whose write failed', async () => {
    const { rerender } = show({ state: 'slots', slots: [{ ...ready(1, 10), activity: 'writing' }] })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete…' })).toBeDisabled()
    await rerender({ view: { state: 'slots', slots: [{ ...ready(1, 10), activity: 'failed' }] } })
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('offers nothing when there are no slots', () => {
    show({ state: 'slots', slots: [] })
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('SaveSlots: deleting', () => {
  it('asks first, with the safe button focused, and deletes nothing until the player says so', async () => {
    const { ondelete } = show()
    await userEvent.click(row(2))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this save?' })
    expect(dialog).toHaveAccessibleDescription('Ash, level 3 will be gone for good.')
    expect(within(dialog).getByRole('button', { name: 'Keep it' })).toHaveFocus()
    expect(ondelete).not.toHaveBeenCalled()
  })

  it('names the slot by its number when it has no label', async () => {
    show()
    await userEvent.click(row(3))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    expect(await screen.findByRole('dialog')).toHaveAccessibleDescription('Slot 3 will be gone for good.')
  })

  it('deletes the chosen slot when confirmed, closes, and puts focus back on its row', async () => {
    const { ondelete } = show()
    await userEvent.click(row(2))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(ondelete).toHaveBeenCalledExactlyOnceWith(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(row(2)).toHaveFocus()
  })

  it('does not delete on Escape or on the safe button, and gives focus back to Delete', async () => {
    const { ondelete } = show()
    await userEvent.click(row(2))
    const opener = screen.getByRole('button', { name: 'Delete…' })
    await userEvent.click(opener)
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(opener).toHaveFocus()
    await userEvent.click(opener)
    await userEvent.click(await screen.findByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ondelete).not.toHaveBeenCalled()
  })

  it('names the newer build when a slot from one is deleted, and still asks first', async () => {
    const { ondelete } = show()
    await userEvent.click(row(6))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleDescription(
      'A newer version of the game made this save. Deleting it here cannot be undone.',
    )
    expect(ondelete).not.toHaveBeenCalled()
  })

  it('closes the question if the slot it was about disappears', async () => {
    const { rerender } = show()
    await userEvent.click(row(2))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    await screen.findByRole('dialog')
    await rerender({ view: { state: 'slots', slots: SLOTS.filter((s) => s.slot !== 2) } })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
