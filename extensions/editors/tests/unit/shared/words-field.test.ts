// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FieldRow from '#src/shared/ui/FieldRow.svelte'
import WordsField from '#src/shared/ui/WordsField.svelte'

// P14: words typed into a field were written only when the field was left, so a reload or a closed tab lost them while
// the bar said "Saved". A field now writes half a second after the last key, with the focus still in it.

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }))
afterEach(() => vi.useRealTimers())

describe('WordsField', () => {
  it('writes the words half a second after the last key, with the focus still in the field', async () => {
    const onchange = vi.fn()
    render(WordsField, { label: 'What it says', value: '', onchange })
    const field = screen.getByLabelText('What it says')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.type(field, 'Hello grandma')
    expect(onchange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(onchange).toHaveBeenCalledExactlyOnceWith('Hello grandma')
    expect(document.activeElement).toBe(field)
  })

  it('does not write the same words again when the field is left', async () => {
    const onchange = vi.fn()
    render(WordsField, { label: 'What it says', value: '', onchange })
    const field = screen.getByLabelText('What it says')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.type(field, 'Hi')
    vi.advanceTimersByTime(500)
    await user.tab()
    expect(onchange).toHaveBeenCalledOnce()
  })

  it('keeps what the person has typed when the old words come back from a write', async () => {
    const { rerender } = render(WordsField, { label: 'Line', value: 'Hello', onchange: vi.fn() })
    const field = screen.getByLabelText('Line') as HTMLTextAreaElement
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.type(field, ' gra')
    await rerender({ label: 'Line', value: 'Hello', onchange: vi.fn() })
    expect(field.value).toBe('Hello gra')
  })

  it('shows new words from outside when nobody is typing', async () => {
    const { rerender } = render(WordsField, { label: 'Line', value: 'Hello', onchange: vi.fn() })
    await rerender({ label: 'Line', value: 'Changed by Undo', onchange: vi.fn() })
    expect((screen.getByLabelText('Line') as HTMLTextAreaElement).value).toBe('Changed by Undo')
  })

  it('writes the words as the field goes away', async () => {
    const onchange = vi.fn()
    const { unmount } = render(WordsField, { label: 'Line', value: '', onchange })
    const field = screen.getByLabelText('Line')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.type(field, 'Quick')
    unmount()
    expect(onchange).toHaveBeenCalledExactlyOnceWith('Quick')
  })
})

describe('FieldRow', () => {
  it('writes a number half a second after the last key', async () => {
    const onchange = vi.fn()
    render(FieldRow, { label: 'How hard', kind: 'number', value: 1, onchange })
    const field = screen.getByLabelText('How hard')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.clear(field)
    await user.type(field, '4')
    vi.advanceTimersByTime(500)
    expect(onchange).toHaveBeenLastCalledWith(4)
  })

  it('leaves a number on its way to a valid one alone: no refusal, no reset, nothing written', async () => {
    const onchange = vi.fn()
    render(FieldRow, { label: 'Pause', kind: 'number', value: 1, min: 0.1, onchange })
    const field = screen.getByLabelText('Pause') as HTMLInputElement
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.clear(field)
    await user.type(field, '0')
    vi.advanceTimersByTime(2000)
    expect(onchange).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(field.value).toBe('0')
    await fireEvent.input(field, { target: { value: '0.5' } })
    vi.advanceTimersByTime(500)
    expect(onchange).toHaveBeenLastCalledWith(0.5)
  })

  it('says why a number is refused only when the field is left, and puts the old one back then', async () => {
    const onchange = vi.fn()
    render(FieldRow, { label: 'Pause', kind: 'number', value: 1, min: 0.1, onchange })
    const field = screen.getByLabelText('Pause') as HTMLInputElement
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.clear(field)
    await user.type(field, '0')
    vi.advanceTimersByTime(2000)
    expect(screen.queryByRole('alert')).toBeNull()
    await user.tab()
    expect(screen.getByRole('alert').textContent).toBe('The least is 0.1.')
    expect(field.value).toBe('1')
    expect(onchange).not.toHaveBeenCalled()
  })

  it('does not write an empty name while it is being retyped', async () => {
    const onchange = vi.fn()
    render(FieldRow, { label: 'Name', kind: 'text', value: 'Guard', onchange })
    const field = screen.getByLabelText('Name') as HTMLInputElement
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.clear(field)
    vi.advanceTimersByTime(2000)
    expect(onchange).not.toHaveBeenCalled()
    expect(field.value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('writes a field that names something only when it is left', async () => {
    const onchange = vi.fn()
    render(FieldRow, { label: 'Name', kind: 'text', value: 'Guard', commit: 'leave', onchange })
    const field = screen.getByLabelText('Name')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(field)
    await user.type(field, '2')
    vi.advanceTimersByTime(5000)
    expect(onchange).not.toHaveBeenCalled()
    await fireEvent.blur(field)
    expect(onchange).toHaveBeenCalledExactlyOnceWith('Guard2')
  })
})
