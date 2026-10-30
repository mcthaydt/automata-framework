import { createToasts, type Toast, type WriteResult } from '@mcthaydt/automata-editor-kit/core'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PanelOutcome } from '../../app/document/open-flow-model'
import { afSectorProfile } from '../../profile/af-sector-profile'
import type { LevelProfile } from '../../profile/level-profile'
import ErrorPanel from './ErrorPanel.svelte'

// The error panel (plan ED3D.5c, decision 5; ED3D spec §11): a file that does not open, over Home, with a row per
// problem and its JSON path, Copy details and Open another.

const INSTALLED = ['af-sector', 'last-light-blockout']
const invalid: PanelOutcome = {
  status: 'invalid',
  path: 'levels/depot.json',
  profile: afSectorProfile as LevelProfile<unknown>,
  issues: [
    { path: ['sectors', 0, 'floor'], message: 'Expected number, received string' },
    { path: ['format'], message: 'af-sector/2 is not a version this editor reads (af-sector/1)' },
  ],
  installed: INSTALLED,
  text: '{}',
}

function mount(outcome: PanelOutcome | undefined, copied: WriteResult = { ok: true, mtime: 0 }) {
  const toasts = createToasts({ clock: { now: () => 0, setTimer: () => 0, clearTimer: () => {} } })
  const said: Toast[] = []
  toasts.subscribe((list) => said.splice(0, said.length, ...list))
  const copyText = vi.fn(async () => copied)
  const onclose = vi.fn()
  render(ErrorPanel, { outcome, copyText, toasts, onclose })
  return { copyText, onclose, said }
}

describe('ErrorPanel', () => {
  it('shows nothing with no outcome', () => {
    mount(undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists each problem with its JSON path, says which profile read it and that nothing was written', () => {
    mount(invalid)
    const dialog = screen.getByRole('dialog', { name: 'depot.json does not open' })
    const rows = within(dialog).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'sectors.0.floor Expected number, received string',
      'format af-sector/2 is not a version this editor reads (af-sector/1)',
    ])
    expect(dialog).toHaveTextContent(
      'Read as af-sector. This editor opens af-sector and last-light-blockout.',
    )
    expect(dialog).toHaveTextContent('Nothing was written')
  })

  it('names the installed profiles for a file none of them reads', () => {
    mount({
      status: 'unrecognised',
      path: 'notes.json',
      reason: 'not a level this editor opens',
      installed: INSTALLED,
      message: 'x',
      text: '{}',
    })
    const dialog = screen.getByRole('dialog', { name: 'notes.json is not a level this editor opens' })
    expect(dialog).toHaveTextContent('This editor opens af-sector and last-light-blockout.')
  })

  it('has no rows for a file that is not text', () => {
    mount({ status: 'notText', path: 'img.json' })
    expect(
      within(screen.getByRole('dialog', { name: 'img.json is not a text file' })).queryAllByRole('listitem'),
    ).toEqual([])
  })

  it('Copy details copies every row and the profiles, and says so', async () => {
    const { copyText, said } = mount(invalid)
    await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
    expect(copyText).toHaveBeenCalledWith(
      [
        'levels/depot.json does not open',
        'Profile: af-sector',
        'sectors.0.floor: Expected number, received string',
        'format: af-sector/2 is not a version this editor reads (af-sector/1)',
        'Installed profiles: af-sector, last-light-blockout',
      ].join('\n'),
    )
    expect(said.map((toast) => [toast.kind, toast.message])).toEqual([
      ['ok', 'Copied the details of depot.json.'],
    ])
  })

  it('copies once for a double press while the first copy runs', async () => {
    const { copyText, said } = mount(invalid)
    let finish: (result: WriteResult) => void = () => {}
    copyText.mockImplementation(() => new Promise<WriteResult>((resolve) => (finish = resolve)))
    const button = screen.getByRole('button', { name: 'Copy details' })
    await userEvent.dblClick(button)
    finish({ ok: true, mtime: 0 })
    await screen.findByText('Copied the details of depot.json.', { exact: false }).catch(() => undefined)
    await new Promise((resolve) => setTimeout(resolve))
    expect(copyText).toHaveBeenCalledOnce()
    expect(said).toHaveLength(1)
  })

  it('says when the details could not be copied', async () => {
    const { said } = mount(invalid, { ok: false, reason: 'denied', message: 'The clipboard is closed.' })
    await userEvent.click(screen.getByRole('button', { name: 'Copy details' }))
    expect(said.map((toast) => [toast.kind, toast.message])).toEqual([
      ['error', 'Could not copy the details: The clipboard is closed.'],
    ])
  })

  it('Open another, which has the focus, closes it; so does Escape', async () => {
    const { onclose } = mount(invalid)
    const another = screen.getByRole('button', { name: 'Open another' })
    expect(another).toHaveFocus()
    expect(another).toHaveAttribute('data-kind', 'primary')
    await userEvent.click(another)
    expect(onclose).toHaveBeenCalledOnce()
  })
})
