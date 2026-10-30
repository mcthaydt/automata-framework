import type { FieldDef, FieldValue } from '@mcthaydt/automata-editor-kit/fields'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FieldEditor from './FieldEditor.svelte'
import type { FieldCommit } from './field-commit'
import { fieldRow } from './inspector-model'

// One inspector row per widget kind (plan ED2D.4c4b step 5, decision 1): a stepper, toggle, segmented control or picker
// commits on change, text on blur or Enter; a refused value shows the message and the field shows the stored value.

function mount(def: FieldDef, value: FieldValue | undefined, result: FieldCommit = { ok: true }) {
  const oncommit = vi.fn((_value: FieldValue) => result)
  render(FieldEditor, { row: fieldRow(def, value), palette: ['#7c3aed', '#ef4444'], oncommit })
  return { oncommit, user: userEvent.setup() }
}

describe('FieldEditor', () => {
  it('steps an int and commits each step', async () => {
    const { oncommit, user } = mount({ id: 'hp', type: 'int', label: 'Hit points', min: 1, max: 9 }, 3)
    await user.click(screen.getByRole('button', { name: 'Increase Hit points' }))
    expect(oncommit).toHaveBeenCalledWith(4)
  })

  it('shows a refusal under the field and puts the stored value back', async () => {
    const refused = { ok: false, message: 'hp is taken by the boss' } as const
    const { oncommit, user } = mount(
      { id: 'hp', type: 'int', label: 'Hit points', min: 1, max: 9 },
      3,
      refused,
    )
    await user.click(screen.getByRole('button', { name: 'Increase Hit points' }))
    expect(oncommit).toHaveBeenCalledWith(4)
    expect(screen.getByRole('alert')).toHaveTextContent('hp is taken by the boss')
    expect(screen.getByRole('spinbutton', { name: 'Hit points' })).toHaveAttribute('aria-valuenow', '3')
  })

  it('refuses a typed int past its max in the stepper, committing nothing', async () => {
    const { oncommit, user } = mount({ id: 'hp', type: 'int', label: 'Hit points', min: 1, max: 9 }, 3)
    await user.click(screen.getByRole('spinbutton', { name: 'Hit points' }))
    await user.keyboard('12{Enter}')
    expect(oncommit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/9/)
  })

  it('toggles a bool and picks an enum option', async () => {
    const bool = mount({ id: 'awake', type: 'bool', label: 'Awake' }, false)
    await bool.user.click(screen.getByRole('radio', { name: 'On' }))
    expect(bool.oncommit).toHaveBeenCalledWith(true)
  })

  it('picks a segmented enum option', async () => {
    const { oncommit, user } = mount(
      { id: 'mood', type: 'enum', label: 'Mood', options: ['calm', 'angry'] },
      'calm',
    )
    await user.click(screen.getByRole('radio', { name: 'angry' }))
    expect(oncommit).toHaveBeenCalledWith('angry')
  })

  it('commits text on Enter and on blur, not on each key', async () => {
    const { oncommit, user } = mount({ id: 'music', type: 'text', label: 'Music' }, '')
    const box = screen.getByRole('textbox', { name: 'Music' })
    await user.type(box, 'cave')
    expect(oncommit).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(oncommit).toHaveBeenLastCalledWith('cave')
    await user.type(box, 's')
    await user.tab()
    expect(oncommit).toHaveBeenLastCalledWith('caves')
  })

  it('puts refused text back to the stored value', async () => {
    const refused = { ok: false, message: 'music must be text' } as const
    const { user } = mount({ id: 'music', type: 'text', label: 'Music' }, 'cave', refused)
    const box = screen.getByRole('textbox', { name: 'Music' })
    await user.type(box, 's{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('music must be text')
    expect(screen.getByRole('textbox', { name: 'Music' })).toHaveValue('cave')
  })

  it('edits a point list: steps a coordinate, adds and removes points', async () => {
    const { oncommit, user } = mount({ id: 'patrol', type: 'point', label: 'Patrol path', list: true }, [
      { x: 1, y: 2 },
    ])
    await user.click(screen.getByRole('button', { name: 'Increase Patrol path 1 x' }))
    expect(oncommit).toHaveBeenLastCalledWith([{ x: 2, y: 2 }])
    await user.click(screen.getByRole('button', { name: 'Add point to Patrol path' }))
    expect(oncommit).toHaveBeenLastCalledWith([
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ])
    await user.click(screen.getByRole('button', { name: 'Remove Patrol path 1' }))
    expect(oncommit).toHaveBeenLastCalledWith([])
  })

  it('shows a ref and says the target picker is still to come', async () => {
    const { oncommit, user } = mount({ id: 'target', type: 'ref', label: 'Leads to' }, undefined)
    expect(screen.getByText('Not set')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose target' }))
    expect(screen.getByRole('status')).toHaveTextContent(/coming/i)
    expect(oncommit).not.toHaveBeenCalled()
  })

  it('opens a colour field on the stored colour', () => {
    mount({ id: 'tint', type: 'color', label: 'Tint' }, '#7c3aed')
    expect(screen.getByRole('button', { name: 'Tint: #7c3aed' })).toBeInTheDocument()
  })
})
