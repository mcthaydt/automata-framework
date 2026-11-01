import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ChecksPanel, ChecksPanelView } from '../../app/checks-panel-controller'
import { checkResult } from '../../checks/check'
import ChecksList from './ChecksList.svelte'

// The checks list (the Owner, testing base-3d: "17 problems" showed no list): every failing check with its problems in
// the model's own sentences, a button on each that has a place (44 px, so a finger can take it), a refusal in words, and
// a plain "No problems" when the level is clean.

const view = (results: ChecksPanelView['results']): ChecksPanelView => ({
  results,
  errors: results.filter((r) => !r.ok && r.severity === 'error').reduce((n, r) => n + r.problems.length, 0),
  warnings: results
    .filter((r) => !r.ok && r.severity === 'warning')
    .reduce((n, r) => n + r.problems.length, 0),
  pending: false,
})

function panel(results: ChecksPanelView['results'], locate: ChecksPanel['locate']): ChecksPanel {
  return { view: view(results), subscribe: () => () => {}, run: () => {}, locate, dispose: () => {} }
}

const FAILING = [
  checkResult('ids', []),
  checkResult('heights', [
    {
      message: 'a and b: their portal leaves no opening',
      locator: { selection: 'wall:a/2', at: { x: 5, z: 8 } },
    },
  ]),
  checkResult('entities', [{ message: 'entity definition ember: shape is missing' }], {
    severity: 'warning',
  }),
]

describe('ChecksList', () => {
  it('lists each failing check with its problems and says nothing of the passing ones', () => {
    render(ChecksList, { props: { checks: panel(FAILING, () => ({ ok: true })) } })
    const heights = screen.getByRole('group', { name: /heights/i })
    expect(within(heights).getByText(/leaves no opening/)).toBeInTheDocument()
    expect(screen.getByText(/shape is missing/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /ids/i })).toBeNull()
  })

  it('takes a finger to the place of a problem that has one, and a problem without one has no button', async () => {
    const locate = vi.fn(() => ({ ok: true as const }))
    render(ChecksList, { props: { checks: panel(FAILING, locate) } })
    const buttons = screen.getAllByRole('button', { name: /Show/ })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0] as HTMLElement)
    expect(locate).toHaveBeenCalledWith({ selection: 'wall:a/2', at: { x: 5, z: 8 } })
  })

  it('says why a place cannot be shown', async () => {
    const locate = vi.fn(() => ({ ok: false as const, reason: 'wall a/2 is not in the level any more' }))
    render(ChecksList, { props: { checks: panel(FAILING, locate) } })
    await userEvent.click(screen.getByRole('button', { name: /Show/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('wall a/2 is not in the level any more')
  })

  it('says "No problems" for a clean level', () => {
    render(ChecksList, { props: { checks: panel([checkResult('ids', [])], () => ({ ok: true })) } })
    expect(screen.getByText('No problems')).toBeInTheDocument()
  })
})
