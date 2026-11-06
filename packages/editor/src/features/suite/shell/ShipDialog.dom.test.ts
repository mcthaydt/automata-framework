import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReviewChangeSet } from '../core/review-model'
import ShipDialog from './ShipDialog.svelte'
import type { ShipOutcome } from './suite-session'

// The `ship-dialog` frame (editor suite spec §9, §11): ready, a check failing, pushing, pushed with a PR, pushed with
// the compare link only, and a push that failed.
const REVIEW: ReviewChangeSet = {
  title: 'Faster',
  branch: 'edit/faster',
  base: 'main',
  files: [{ path: 'content/tuning.toml', created: false, before: 'a = 1\n', after: 'a = 2\n', hunks: [] }],
  checks: [{ check: 'content', status: 'pass', findings: [] }],
  gates: { reopened: [{ id: 'g-feel', name: 'Feel review', decision: 'approved' }] },
  tokens: { used: 0, cap: 1000 },
}
const DRAFT = { title: 'Faster', body: '## Changes\n' }
const PUSHED = {
  branch: 'edit/faster',
  pushed: true,
  compareUrl: 'https://github.com/o/g/compare/main...edit/faster',
}

function setup(ship: (draft: { title: string; body: string }) => Promise<ShipOutcome>, review = REVIEW) {
  const onship = vi.fn(ship)
  render(ShipDialog, { open: true, review, draft: DRAFT, onship, onclose: vi.fn() })
  return { onship, dialog: screen.getByRole('dialog', { name: 'Ship this change' }) }
}

describe('ShipDialog', () => {
  it('ready: the drafted title and description are editable, with the files and gates; Ship sends the edits', async () => {
    const { onship } = setup(async () => PUSHED)
    expect(screen.getByText('content/tuning.toml')).toBeInTheDocument()
    expect(screen.getByText('Feel review: approved')).toBeInTheDocument()
    const body = screen.getByLabelText('Description')
    await userEvent.type(body, 'Feels better.')
    await userEvent.click(screen.getByRole('button', { name: 'Ship' }))
    expect(onship).toHaveBeenCalledWith({ title: 'Faster', body: '## Changes\nFeels better.' })
  })

  it('a failing check warns and still allows Ship', () => {
    setup(async () => PUSHED, { ...REVIEW, checks: [{ check: 'fair', status: 'fail', findings: [] }] })
    expect(screen.getByRole('note')).toHaveTextContent('fair is failing. Ship still opens a draft.')
    expect(screen.getByRole('button', { name: 'Ship' })).toBeEnabled()
  })

  it('pushing: Ship and the fields are disabled until the push answers', async () => {
    let answer: (outcome: ShipOutcome) => void = () => {}
    setup(() => new Promise((resolve) => (answer = resolve)))
    await userEvent.click(screen.getByRole('button', { name: 'Ship' }))
    expect(screen.getByRole('button', { name: 'Pushing…' })).toBeDisabled()
    expect(screen.getByLabelText('Title')).toBeDisabled()
    answer(PUSHED)
    expect(await screen.findByRole('status')).toHaveTextContent('Pushed edit/faster.')
  })

  it('EDS-j: pushed with a PR links the draft PR; without gh, the compare link', async () => {
    setup(async () => ({ ...PUSHED, pr: 'https://github.com/o/g/pull/7' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ship' }))
    expect(await screen.findByRole('link', { name: 'Open the draft pull request' })).toHaveAttribute(
      'href',
      'https://github.com/o/g/pull/7',
    )
    document.body.innerHTML = ''
    setup(async () => PUSHED)
    await userEvent.click(screen.getByRole('button', { name: 'Ship' }))
    expect(await screen.findByRole('link', { name: 'Open the pull request on GitHub' })).toHaveAttribute(
      'href',
      PUSHED.compareUrl,
    )
    expect(screen.getByText(/no pull request was opened/)).toBeInTheDocument()
  })

  it('a failed push shows the reason and says the commits stay', async () => {
    setup(async () => ({ error: 'remote rejected' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ship' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The push failed: remote rejected')
    expect(screen.getByText(/Your commits stay/)).toBeInTheDocument()
  })

  it('with no change set open there is nothing to ship', () => {
    render(ShipDialog, { open: true, review: undefined, draft: undefined, onship: vi.fn(), onclose: vi.fn() })
    expect(screen.getByText(/nothing to ship/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ship' })).toBeNull()
  })
})
