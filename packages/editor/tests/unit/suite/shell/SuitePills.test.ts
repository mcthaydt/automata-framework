// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { changeSetPill, checksPill, gatesPill } from '#src/features/suite/core/pills-model.ts'
import SuitePills from '#src/features/suite/shell/SuitePills.svelte'

// The top bar's pills (editor suite spec §9 `suite-home`, §10, §11): change set, checks and gates, each a button that
// opens its list; in the `short` tier each is an icon with its count, never hidden.
const finding = { path: 'content/tuning.toml', line: 2, severity: 'error' as const, message: 'too fast' }
const PILLS = [
  changeSetPill({ port: true, open: { title: 'Faster', files: ['content/tuning.toml'] } }),
  checksPill({ running: false, checks: [{ check: 'lint', status: 'fail', findings: [finding] }] }),
  gatesPill({
    reopened: ['g-feel'],
    states: [{ id: 'g-feel', name: 'Feel', decision: 'approved', url: 'https://example.com/g-feel' }],
  }),
]

describe('SuitePills', () => {
  it('shows each pill with its label and tone', () => {
    render(SuitePills, { pills: PILLS, compact: false, onlocate: () => {} })
    const buttons = within(screen.getByRole('group', { name: 'Change set and checks' })).getAllByRole(
      'button',
    )
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Faster',
      'lint failed',
      '1 gate reopened',
    ])
    expect(buttons[1]).toHaveAttribute('data-tone', 'fail')
  })

  it('in the short tier shows icons with counts, and keeps each label for assistive tech', () => {
    render(SuitePills, { pills: PILLS, compact: true, onlocate: () => {} })
    const checks = screen.getByRole('button', { name: 'lint failed (1)' })
    expect(checks).toHaveTextContent('1')
    expect(checks).not.toHaveTextContent('lint failed')
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('opens the failing check with Locate, one tap away (EDS-h)', async () => {
    const onlocate = vi.fn()
    render(SuitePills, { pills: PILLS, compact: false, onlocate })
    await userEvent.click(screen.getByRole('button', { name: 'lint failed' }))
    const list = screen.getByRole('region', { name: 'lint failed' })
    expect(list).toHaveTextContent('too fast')
    await userEvent.click(within(list).getByRole('button', { name: 'Locate lint' }))
    expect(onlocate).toHaveBeenCalledWith(finding)
  })

  it('lists each reopened gate with its decision and link, and offers nothing that records one', async () => {
    render(SuitePills, { pills: PILLS, compact: false, onlocate: () => {} })
    await userEvent.click(screen.getByRole('button', { name: '1 gate reopened' }))
    const list = screen.getByRole('region', { name: '1 gate reopened' })
    expect(within(list).getByRole('link', { name: 'Feel' })).toHaveAttribute(
      'href',
      'https://example.com/g-feel',
    )
    expect(list).toHaveTextContent('approved')
    expect(within(list).queryAllByRole('button')).toEqual([])
  })

  it('shows measures before and after', async () => {
    const measured = checksPill({
      running: false,
      checks: [
        {
          check: 'fair',
          status: 'pass',
          findings: [],
          before: [{ id: 'gap', label: 'Widest gap', value: 3, ok: true }],
          after: [{ id: 'gap', label: 'Widest gap', value: 4, ok: true }],
        },
      ],
    })
    render(SuitePills, { pills: [measured], compact: false, onlocate: () => {} })
    await userEvent.click(screen.getByRole('button', { name: 'Checks pass' }))
    expect(screen.getByRole('region', { name: 'Checks pass' })).toHaveTextContent('Widest gap 3 → 4')
  })

  it('Escape closes an open list', async () => {
    render(SuitePills, { pills: PILLS, compact: false, onlocate: () => {} })
    await userEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByRole('region', { name: 'Faster' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Faster' })).toBeNull()
  })
})
