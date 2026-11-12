// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { checksPill } from '#src/features/suite/core/pills-model.ts'
import SuiteHeader from '#src/features/suite/shell/SuiteHeader.svelte'
import type { ShellMode } from '#src/shared/kit/shell/shell-mode.ts'

// The header: a breadcrumb, the editor's views, the problem count, Saved, Play and the one lime Publish. In compact
// the title opens a sheet that holds what there is no room for, so nothing is lost on a phone.
const finding = { severity: 'error' as const, path: 'levels/start.toml', message: 'no way out' }
const NONE = checksPill({ running: false, checks: [{ check: 'levels', status: 'pass', findings: [] }] })
const BAD = checksPill({ running: false, checks: [{ check: 'levels', status: 'fail', findings: [finding] }] })
const HISTORY = { canUndo: true, canRedo: false, undoLabel: 'Move the door', redoLabel: '' }

const props = (more: Record<string, unknown> = {}) => ({
  mode: 'wide' as ShellMode,
  short: false,
  game: 'Rooftops',
  editor: { label: 'Levels', icon: 'levels' as const },
  header: undefined,
  checks: NONE,
  onlocate: () => {},
  save: 'saved' as const,
  history: HISTORY,
  onundo: () => {},
  onredo: () => {},
  playUrl: 'http://localhost:5199/',
  playOff: undefined,
  onplayoff: () => {},
  onpublish: () => {},
  onhome: () => {},
  atHome: false,
  tools: undefined,
  ...more,
})

const doc = (onselect = vi.fn()) => ({
  doc: {
    name: 'Start',
    items: [
      { id: 'new', label: 'New level' },
      { id: 'rename', label: 'Rename' },
    ],
    onselect,
  },
})
const views = (onchange = vi.fn()) => ({
  views: {
    label: 'View',
    options: [
      { id: 'level', label: 'Level' },
      { id: 'tiles', label: 'Tiles' },
    ],
    value: 'level',
    onchange,
  },
})

describe('SuiteHeader in the wide layout', () => {
  it('draws "Levels / Start" and opens the document menu from the chevron', async () => {
    const onselect = vi.fn()
    render(SuiteHeader, props({ header: doc(onselect) }))
    const crumbs = screen.getByRole('navigation', { name: 'Where you are' })
    expect(crumbs).toHaveTextContent('Levels')
    expect(crumbs).toHaveTextContent('/')
    await userEvent.click(within(crumbs).getByRole('button', { name: 'Start' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    expect(onselect).toHaveBeenCalledWith('rename')
  })

  it('the document menu is a popover under the chevron, not a sheet', async () => {
    render(SuiteHeader, props({ header: doc() }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await screen.findByRole('menu', { name: 'Start' })
    expect(screen.queryByRole('group', { name: 'Start' })).toBeNull()
  })

  it('on Home it says Home', () => {
    render(SuiteHeader, props({ editor: undefined }))
    expect(screen.getByRole('navigation', { name: 'Where you are' })).toHaveTextContent('Home')
  })

  it('draws the views as a radio group that changes the view', async () => {
    const onchange = vi.fn()
    render(SuiteHeader, props({ header: views(onchange) }))
    await userEvent.click(screen.getByRole('radio', { name: 'Tiles' }))
    expect(onchange).toHaveBeenCalledWith('tiles')
  })

  it('names Undo with the step; Redo is off with nothing to redo', () => {
    render(SuiteHeader, props())
    expect(screen.getByRole('button', { name: 'Undo Move the door' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('has exactly one lime button, Publish, and Play as a link that opens the game in a new tab', () => {
    render(SuiteHeader, props())
    const play = screen.getByRole('link', { name: 'Play' })
    expect(play).toHaveAttribute('target', '_blank')
    expect(document.querySelectorAll('[data-kind="primary"]')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveAttribute('data-kind', 'primary')
  })

  it('hides what has nothing to say: no history, no Play, no Publish, no Saved', () => {
    render(
      SuiteHeader,
      props({ history: undefined, playUrl: undefined, onpublish: undefined, save: undefined }),
    )
    for (const name of ['Undo', 'Redo', 'Publish']) expect(screen.queryByRole('button', { name })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Play' })).toBeNull()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('says Saved, Saving… and why it could not save', () => {
    const { rerender } = render(SuiteHeader, props())
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    rerender(props({ save: 'saving' }))
    return vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saving…'))
  })

  it('says the problems in words, lists them, and Locate selects one', async () => {
    const onlocate = vi.fn()
    render(SuiteHeader, props({ checks: BAD, onlocate }))
    await userEvent.click(screen.getByRole('button', { name: '1 problem' }))
    const list = await screen.findByRole('region', { name: '1 problem' })
    expect(list).toHaveTextContent('no way out')
    await userEvent.click(within(list).getByRole('button', { name: 'Locate levels' }))
    expect(onlocate).toHaveBeenCalledWith(finding)
  })

  it('under 900 px the count keeps its number and drops its word', () => {
    render(SuiteHeader, props({ checks: BAD, short: true }))
    const count = screen.getByRole('button', { name: '1 problem' })
    expect(count).toHaveTextContent('1')
    expect(count).not.toHaveTextContent('problem')
  })

  it('under 900 px with nothing to count it shows nothing, not a tick that sits beside Saved', () => {
    for (const pill of [
      NONE,
      checksPill({ running: true, checks: [] }),
      checksPill({ running: false, checks: [] }),
    ]) {
      const { unmount } = render(SuiteHeader, props({ checks: pill, short: true }))
      expect(screen.queryByRole('button', { name: /problem|Check|check/ })).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('Saved')
      unmount()
    }
  })

  it('under 900 px a check that could not run still shows, as a warning', () => {
    const failed = checksPill({ running: false, checks: [{ check: 'a', status: 'error', findings: [] }] })
    render(SuiteHeader, props({ checks: failed, short: true }))
    expect(screen.getByRole('button', { name: "Couldn't check" })).toBeInTheDocument()
  })

  it('shows the checks in the words of every state', () => {
    const words = (pill: ReturnType<typeof checksPill>) => {
      const { unmount } = render(SuiteHeader, props({ checks: pill }))
      const text = screen.getByRole('button', { name: /problem|Check|check/ }).getAttribute('aria-label')
      unmount()
      return text
    }
    expect(words(checksPill({ running: true, checks: [] }))).toBe('Checking…')
    expect(words(checksPill({ running: false, checks: [] }))).toBe('Not checked yet')
    expect(words(NONE)).toBe('No problems')
    expect(
      words(checksPill({ running: false, checks: [{ check: 'a', status: 'error', findings: [] }] })),
    ).toBe("Couldn't check")
  })
})

describe('SuiteHeader in the medium layout', () => {
  it('drops the editor name and the first slash when there is a document', () => {
    render(SuiteHeader, props({ mode: 'medium', header: doc() }))
    const crumbs = screen.getByRole('navigation', { name: 'Where you are' })
    expect(crumbs).not.toHaveTextContent('Levels')
    expect(crumbs).not.toHaveTextContent('/')
    expect(within(crumbs).getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })
})

describe('SuiteHeader in the medium layout', () => {
  it('the document menu rises from the foot as a sheet', async () => {
    render(SuiteHeader, props({ mode: 'medium', header: doc() }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    const sheet = await screen.findByRole('group', { name: 'Start' })
    expect(within(sheet).getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
  })
})

describe('SuiteHeader in compact', () => {
  it('has Home, a title, Undo, Redo, Play and Publish, and Home answers', async () => {
    const onhome = vi.fn()
    render(SuiteHeader, props({ mode: 'compact', header: doc(), onhome }))
    for (const name of ['Undo Move the door', 'Redo', 'Publish', 'Start'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Play' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onhome).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'No problems' })).toBeNull()
  })

  it('the title menu holds the views, the document actions, the problems and Saved', async () => {
    const onchange = vi.fn()
    const onselect = vi.fn()
    render(
      SuiteHeader,
      props({ mode: 'compact', checks: BAD, header: { ...doc(onselect), ...views(onchange) } }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    const sheet = await screen.findByRole('dialog', { name: 'Start' })
    expect(within(sheet).getByText('1 problem')).toBeInTheDocument()
    expect(within(sheet).getByText('no way out')).toBeInTheDocument()
    expect(within(sheet).getByRole('status')).toHaveTextContent('Saved')
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Tiles' }))
    expect(onchange).toHaveBeenCalledWith('tiles')
    await userEvent.click(within(sheet).getByRole('button', { name: 'New level' }))
    expect(onselect).toHaveBeenCalledWith('new')
  })
})
