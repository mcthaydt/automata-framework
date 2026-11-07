import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Start from '../../../src/features/start/Start.svelte'

// "Using a coding agent" on Start: the agent setup the old AI and docs pages held.
describe('Start: using a coding agent', () => {
  it('keeps every command copyable while offering an optional readiness checklist', async () => {
    const view = render(Start)
    const copies = () => view.getAllByRole('button', { name: 'Copy command' })
    expect(copies()).toHaveLength(4)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    for (const label of [
      'Superpowers is installed for this agent',
      'The PixiJS v8 skill collection is installed',
      'My agent reported and loaded the required skills',
    ])
      await fireEvent.click(view.getByLabelText(label))
    expect(view.getByText(/3 of 3 confirmed by you/)).toBeTruthy()
    expect(view.getByRole('group', { name: 'Skill readiness' })).toBeTruthy()
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(copies()).toHaveLength(4)
  })
})
