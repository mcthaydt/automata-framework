// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RowsFixture from '#src/testing/kit/RowsFixture.svelte'

// The kit's list and inspector parts (spec 7.5): a Section with its count and add button, Rows with their own buttons, a
// label-left Field with a hint and a warning, and a Block that never holds a Block.
describe('Section and Row', () => {
  it('a section is named by its label, with its count and an add button named for it', async () => {
    const onadd = vi.fn()
    render(RowsFixture, { onadd })
    const layers = screen.getByRole('region', { name: 'Layers' })
    expect(within(layers).getByRole('heading', { name: 'Layers' })).toBeInTheDocument()
    expect(layers).toHaveTextContent('4')
    await userEvent.click(within(layers).getByRole('button', { name: 'Add a layer' }))
    expect(onadd).toHaveBeenCalledOnce()
  })

  it('a row is a button by its name, the chosen one marked, and each row has its own buttons beside it', async () => {
    render(RowsFixture)
    const layers = screen.getByRole('region', { name: 'Layers' })
    expect(within(layers).getByRole('button', { name: 'Decor' })).toHaveAttribute('aria-current', 'true')
    expect(within(layers).getByRole('button', { name: 'Ground' })).not.toHaveAttribute('aria-current')
    await userEvent.click(within(layers).getByRole('button', { name: 'Ground' }))
    expect(within(layers).getByRole('button', { name: 'Ground' })).toHaveAttribute('aria-current', 'true')
    // The row's buttons are siblings of the row's name, never inside it (a button cannot hold a button).
    const hide = within(layers).getByRole('button', { name: 'Hide Ground' })
    expect(hide.closest('button.main')).toBeNull()
  })
})

describe('Field', () => {
  it('names its group by its label and describes it by the hint', () => {
    render(RowsFixture)
    const field = screen.getByRole('group', { name: 'Name' })
    expect(field).toHaveAccessibleDescription('What the level is called in the list.')
    expect(within(field).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  })

  it('shows a warning with the alert icon and describes the field by it', () => {
    render(RowsFixture)
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent('Depth is past the ground.')
    expect(warning.querySelector('svg')).not.toBeNull()
  })

  it('a plain field is described by its warning before its hint', () => {
    render(RowsFixture, { warnName: true })
    expect(screen.getByRole('group', { name: 'Name' })).toHaveAccessibleDescription(
      'Name is already taken. What the level is called in the list.',
    )
  })

  it('a control that draws its own name (a stepper) is not named twice', () => {
    render(RowsFixture)
    const stepper = screen.getByRole('group', { name: 'Depth' })
    expect(screen.getAllByText('Depth')).toHaveLength(1)
    expect(stepper.closest('[data-labelled="true"]')).not.toBeNull()
  })
})

describe('Block', () => {
  it('has a head with its name and a Remove that says what it removes, and holds its fields', async () => {
    const onremove = vi.fn()
    render(RowsFixture, { onremove })
    const block = screen.getByRole('region', { name: 'Jump' })
    expect(within(block).getByRole('group', { name: 'Height' })).toBeInTheDocument()
    await userEvent.click(within(block).getByRole('button', { name: 'Remove Jump' }))
    expect(onremove).toHaveBeenCalledOnce()
  })

  it('a block inside a block is a mistake and throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(RowsFixture, { nested: true })).toThrow('A Block never holds a Block.')
    quiet.mockRestore()
  })
})
