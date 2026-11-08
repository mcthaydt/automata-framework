// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AskState } from '#src/features/suite/core/ask-session.ts'
import { lineDiff } from '#src/features/suite/core/text-diff.ts'
import AskDialog from '#src/features/suite/shell/AskDialog.svelte'

// The `ask-diff` frame: prompt, scope chip, diff, checks, token meter, Accept, Reject and
// Rewrite, in each of its states.
const BEFORE = '# speeds\nMAX_MOVE_SPEED = 7\nJUMP = 3\n'
const AFTER = BEFORE.replace('= 7', '= 12')
const proposal = { summary: 'Raise the speed', text: AFTER, tokens: 120 }
const shown = (extra: Partial<Extract<AskState, { kind: 'shown' }>> = {}): AskState => ({
  kind: 'shown',
  prompt: 'faster',
  proposal,
  hunks: lineDiff(BEFORE, AFTER),
  results: [{ check: 'speed', status: 'pass', findings: [], output: '' }],
  findings: [],
  tokens: 120,
  ...extra,
})

function setup(state: AskState) {
  const handlers = {
    onask: vi.fn(),
    onaccept: vi.fn(),
    onreject: vi.fn(),
    onrewrite: vi.fn(),
    onclose: vi.fn(),
  }
  render(AskDialog, {
    open: true,
    view: state,
    scope: ['MAX_MOVE_SPEED'],
    tokens: { used: 400, cap: 1000 },
    ...handlers,
  })
  const dialog = screen.getByRole('dialog', { name: 'Ask' })
  return { dialog, ...handlers }
}

describe('AskDialog', () => {
  it('idle: a prompt and the scope chip; Ask sends the prompt', async () => {
    const { dialog, onask } = setup({ kind: 'idle' })
    expect(within(dialog).getByText('MAX_MOVE_SPEED')).toBeInTheDocument()
    expect(within(dialog).getByRole('meter', { name: 'Tokens used' })).toHaveAttribute('aria-valuenow', '400')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Ask for a change' }), 'a bit faster')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ask' }))
    expect(onask).toHaveBeenCalledWith('a bit faster')
  })

  it('asking: says so, with nothing to accept', () => {
    const { dialog } = setup({ kind: 'asking', prompt: 'faster' })
    expect(within(dialog).getByRole('status')).toHaveTextContent('Asking')
    expect(within(dialog).queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  it('passing: the diff with its changed lines, the checks, and Accept and Reject', async () => {
    const { dialog, onaccept, onreject } = setup(shown())
    const diff = within(dialog).getByRole('region', { name: 'Proposed change' })
    expect(within(diff).getByText('MAX_MOVE_SPEED = 7').closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'removed',
    )
    expect(within(diff).getByText('MAX_MOVE_SPEED = 12').closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'added',
    )
    expect(dialog).toHaveTextContent('Raise the speed')
    expect(dialog).toHaveTextContent('speed: pass')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept' }))
    expect(onaccept).toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(onreject).toHaveBeenCalled()
  })

  it('failing: the finding at its line, Accept disabled with the reason, Rewrite offered (EDS-e)', async () => {
    const finding = { path: 'content/tuning.toml', line: 2, severity: 'error' as const, message: 'too fast' }
    const { dialog, onrewrite } = setup(
      shown({
        refusal: { kind: 'checks' },
        findings: [finding],
        results: [{ check: 'speed', status: 'fail', findings: [finding], output: '' }],
      }),
    )
    const added = within(dialog).getByText('MAX_MOVE_SPEED = 12').closest('[data-kind]')
    expect(added?.nextElementSibling).toHaveTextContent('too fast')
    const accept = within(dialog).getByRole('button', { name: 'Accept' })
    expect(accept).toBeDisabled()
    expect(accept).toHaveAccessibleDescription('A check failed: Rewrite asks again with its findings.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rewrite' }))
    expect(onrewrite).toHaveBeenCalled()
  })

  it('a locked value and a never path are named, with Accept disabled (EDS-d, EDS-n)', () => {
    const { dialog } = setup(shown({ refusal: { kind: 'locked', key: 'MAX_MOVE_SPEED' } }))
    expect(within(dialog).getByRole('button', { name: 'Accept' })).toHaveAccessibleDescription(
      'It changes MAX_MOVE_SPEED, which is locked.',
    )
  })

  it('over budget: refused with the tokens spent, and only the owner raises the cap', () => {
    const { dialog } = setup({ kind: 'over-budget', tokens: 1500, budget: 600 })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('1500 tokens')
    expect(dialog).toHaveTextContent('only the owner raises the cap')
  })

  it('failed: the provider’s reason, and Ask can be tried again', () => {
    const { dialog } = setup({ kind: 'failed', reason: 'the assistant is unreachable' })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('the assistant is unreachable')
    expect(within(dialog).getByRole('button', { name: 'Ask' })).toBeInTheDocument()
  })
})
