import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { SKILL_PREFLIGHT } from '#src/features/start/agent-setup'
import Start from '#src/features/start/Start.svelte'

// "Using a coding agent" on Start: the agent setup the old AI and docs pages held.
describe('Start: using a coding agent', () => {
  it('keeps every command copyable and has no checkbox and no counter', async () => {
    const view = render(Start)
    const copies = () => view.getAllByRole('button', { name: 'Copy command' })
    expect(copies()).toHaveLength(4)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(view.container.textContent).not.toMatch(/\d of 3 ticked/)
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(copies()).toHaveLength(4)
  })

  it('lists the three steps in order', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    const steps = [...view.container.querySelectorAll('.agent-setup ol > li')].map(
      (li) => li.querySelector('h3')?.textContent,
    )
    expect(steps).toEqual(['Install Superpowers', 'Install the PixiJS skills', 'Ask your agent to check'])
  })

  it('asks the agent to read the game’s README.md, which create-game writes, and names no AGENTS.md', () => {
    expect(SKILL_PREFLIGHT).toContain('README.md')
    expect(SKILL_PREFLIGHT).not.toContain('AGENTS.md')
  })
})
