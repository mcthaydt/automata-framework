// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorPanel from '#src/features/document/ErrorPanel.svelte'
import type { PanelOutcome } from '#src/features/document/open-flow-model.ts'
import type { WriteResult } from '#src/shared/kit/storage/project-store.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import type { Profile } from '#src/shared/level-2d/profiles/profile.ts'
import { plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// The error panel (plan ED2D.4c2b, decisions 1 to 3; spec §13; G-n, G-o, G-p): what did not open and why, the file's
// text read only, that nothing was written, Copy text and Open another.

const profile = plantedProfile() as Profile<unknown>
const invalid: PanelOutcome = {
  status: 'invalid',
  path: 'levels/mossgate.af2d.json',
  profile,
  errors: [
    { code: 'newerVersion', message: 'This project was made by a newer editor (file version 3).', line: 3 },
    { code: 'unknownKeys', message: '"extra" is not a key this editor knows.', path: 'extra' },
  ],
  text: '{\n  "format": "af2d",\n  "version": 3\n}\n',
}

function mount(outcome: PanelOutcome | undefined, copied: WriteResult = { ok: true, mtime: 1 }) {
  const toasts = createToasts({ clock: createTestClock() })
  const copyText = vi.fn(async (_text: string) => copied)
  const onclose = vi.fn()
  const view = render(ErrorPanel, { outcome, copyText, toasts, onclose })
  return { toasts, copyText, onclose, view }
}

const panel = (): HTMLElement => screen.getByRole('dialog')

describe('ErrorPanel', () => {
  it('shows nothing without an outcome', () => {
    mount(undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the file, lists the profile’s errors with where they are, and says nothing was written', () => {
    mount(invalid)
    expect(screen.getByRole('dialog', { name: 'mossgate.af2d.json does not open' })).toBeInTheDocument()
    const problems = within(panel()).getAllByRole('listitem')
    expect(problems.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'This project was made by a newer editor (file version 3). line 3',
      '"extra" is not a key this editor knows. extra',
    ])
    expect(within(panel()).getByText('Nothing was written')).toBeInTheDocument()
    expect(within(panel()).getByText(/The file is unchanged/)).toBeInTheDocument()
  })

  it('shows the text read only with the error lines marked', () => {
    mount(invalid)
    expect(within(panel()).getByTestId('text-view')).toBeInTheDocument()
    expect(panel().querySelector('[data-marked]')).toHaveTextContent(/^3\s*"version": 3/)
  })

  it('is the wide dialog, and Open another has focus and is the primary action', () => {
    mount(invalid)
    expect(panel()).toHaveAttribute('data-width', 'wide')
    const another = screen.getByRole('button', { name: 'Open another' })
    expect(another).toHaveFocus()
    expect(another).toHaveAttribute('data-kind', 'primary')
  })

  it('Open another closes it', async () => {
    const { onclose } = mount(invalid)
    await userEvent.click(screen.getByRole('button', { name: 'Open another' }))
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('Escape closes it', async () => {
    const { onclose } = mount(invalid)
    await userEvent.keyboard('{Escape}')
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('Copy text copies the file’s text and says so', async () => {
    const { copyText, toasts } = mount(invalid)
    await userEvent.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(copyText).toHaveBeenCalledWith('{\n  "format": "af2d",\n  "version": 3\n}\n')
    expect(toasts.items).toEqual([
      expect.objectContaining({ kind: 'ok', message: 'Copied the text of mossgate.af2d.json.' }),
    ])
  })

  it('a refused copy says why', async () => {
    const { toasts } = mount(invalid, {
      ok: false,
      reason: 'denied',
      message: 'The clipboard is not allowed.',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(toasts.items).toEqual([
      expect.objectContaining({
        kind: 'error',
        message: 'Could not copy the text: The clipboard is not allowed.',
      }),
    ])
  })

  it('a file that is not text has no text view and nothing to copy', () => {
    mount({ status: 'notText', path: 'art.png' })
    expect(screen.getByRole('dialog', { name: 'art.png is not a text file' })).toBeInTheDocument()
    expect(screen.queryByTestId('text-view')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy text' })).toBeNull()
  })

  it('a problem with no place has no place drawn', () => {
    mount({ status: 'unrecognised', path: 'todo.txt', text: 'milk' })
    const [item] = within(panel()).getAllByRole('listitem')
    expect(item?.querySelector('.where')).toBeNull()
  })
})
