import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectEntry } from '../../app/project-list'
import LevelSummary from './LevelSummary.svelte'

// The inspector of the 3D Home (plan ED3D.5c, decision 4): the selected level's facts and Open.

const listed = { size: 4300, mtime: 1_700_000_000_000 - 5 * 60_000 }
const NOW = 1_700_000_000_000
const level: ProjectEntry = {
  ...listed,
  path: 'depot/depot.json',
  status: 'ok',
  profile: 'af-sector',
  errors: 1,
  warnings: 2,
}

function mount(entry: ProjectEntry | undefined, busy = false) {
  const onopen = vi.fn()
  render(LevelSummary, { entry, busy, now: NOW, installed: ['af-sector', 'last-light-blockout'], onopen })
  return { onopen }
}

describe('LevelSummary', () => {
  it('asks for a selection when there is none', () => {
    mount(undefined)
    expect(screen.getByText('Select a level')).toBeInTheDocument()
  })

  it('shows a level’s file, badge, check counts, size and age, and opens it', async () => {
    const { onopen } = mount(level)
    expect(screen.getByRole('heading', { name: 'depot.json' })).toBeInTheDocument()
    expect(screen.getByText('1 error · 2 warnings')).toBeInTheDocument()
    expect(screen.getByText('Errors').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Warnings').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('depot/depot.json')).toBeInTheDocument()
    expect(screen.getByText('4.2 KB · 5 min ago')).toBeInTheDocument()
    const open = screen.getByRole('button', { name: 'Open' })
    expect(open).toHaveAttribute('data-kind', 'primary')
    await userEvent.click(open)
    expect(onopen).toHaveBeenCalledOnce()
  })

  it('gives a broken level its first problem and still opens it, into the error panel', () => {
    mount({
      ...listed,
      path: 'b.json',
      status: 'broken',
      profile: 'af-sector',
      message: 'sectors: Required',
    })
    expect(screen.getByText('sectors: Required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled()
  })

  it('disables Open while another action runs', () => {
    mount(level, true)
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  })
})
