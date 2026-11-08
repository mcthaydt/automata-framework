// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { checksPill } from '#src/features/suite/core/pills-model.ts'
import SuitePills from '#src/features/suite/shell/SuitePills.svelte'

// The top bar's pills: the checks, a button that opens its list; in the `short` tier it is an icon with its count,
// never hidden.
const finding = { path: 'content/tuning.toml', line: 2, severity: 'error' as const, message: 'too fast' }
const PILLS = [
  checksPill({ running: false, checks: [{ check: 'lint', status: 'fail', findings: [finding] }] }),
]

describe('SuitePills', () => {
  it('shows the pill with its label and tone', () => {
    render(SuitePills, { pills: PILLS, compact: false, onlocate: () => {} })
    const buttons = within(screen.getByRole('group', { name: 'Checks' })).getAllByRole('button')
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['lint failed'])
    expect(buttons[0]).toHaveAttribute('data-tone', 'fail')
  })

  it('in the short tier shows an icon with its count, and keeps the label for assistive tech', () => {
    render(SuitePills, { pills: PILLS, compact: true, onlocate: () => {} })
    const checks = screen.getByRole('button', { name: 'lint failed (1)' })
    expect(checks).toHaveTextContent('1')
    expect(checks).not.toHaveTextContent('lint failed')
    expect(screen.getAllByRole('button')).toHaveLength(1)
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

  it('Escape closes an open list', async () => {
    render(SuitePills, { pills: PILLS, compact: false, onlocate: () => {} })
    await userEvent.click(screen.getByRole('button', { name: 'lint failed' }))
    expect(screen.getByRole('region', { name: 'lint failed' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'lint failed' })).toBeNull()
  })
})
