// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProfileChoice from '#src/features/document/ProfileChoice.svelte'
import type { Profile } from '#src/shared/level-2d/profiles/profile.ts'
import type { ChoiceOutcome } from '#src/shared/level-2d/session/open-flow-model.ts'
import { plantedProfile } from '#src/testing/level-2d/planted-profile.ts'

// The profile choice (plan ED2D.4c2b, decision 4): a file two profiles claim opens with the one the person picks.

const choice: ChoiceOutcome = {
  status: 'choose',
  path: 'notes/harbour.note',
  candidates: [
    plantedProfile() as Profile<unknown>,
    plantedProfile({ id: 'rival', label: 'Rival note' }) as Profile<unknown>,
  ],
  text: 'NOTE\n',
}

function mount(outcome: ChoiceOutcome | undefined) {
  const onchoose = vi.fn()
  const oncancel = vi.fn()
  render(ProfileChoice, { outcome, onchoose, oncancel })
  return { onchoose, oncancel }
}

describe('ProfileChoice', () => {
  it('shows nothing without a choice to make', () => {
    mount(undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the file and offers each profile that claims it', () => {
    mount(choice)
    const dialog = screen.getByRole('dialog', { name: 'Open harbour.note as' })
    expect(within(dialog).getByRole('button', { name: 'Planted note' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Rival note' })).toBeInTheDocument()
  })

  it('choosing one closes the dialog and opens the file with it', async () => {
    const { onchoose, oncancel } = mount(choice)
    await userEvent.click(screen.getByRole('button', { name: 'Rival note' }))
    expect(onchoose).toHaveBeenCalledExactlyOnceWith('rival')
    expect(oncancel).not.toHaveBeenCalled()
  })

  it('Cancel and Escape open nothing', async () => {
    const { onchoose, oncancel } = mount(choice)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(oncancel).toHaveBeenCalledOnce()
    expect(onchoose).not.toHaveBeenCalled()
  })

  it('Escape cancels', async () => {
    const { oncancel } = mount(choice)
    await userEvent.keyboard('{Escape}')
    expect(oncancel).toHaveBeenCalledOnce()
  })
})
