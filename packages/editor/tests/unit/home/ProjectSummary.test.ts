// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProjectSummary from '#src/features/home/ProjectSummary.svelte'
import type { ProjectEntry } from '#src/shared/level-2d/session/editor-app-types.ts'

// The inspector of Home: the selected project, what its profile says about it, and the three things a
// person does with it. Entries are written by hand; the component knows no profile.

const NOW = 1_700_000_000_000
const kind = { id: 'dungeon', label: 'Dungeon crawl' }
const listed = { path: 'delve/keep.dgn', size: 5400, mtime: NOW - 2 * 3_600_000 }

const withSummary: ProjectEntry = {
  ...listed,
  status: 'ok',
  profile: kind,
  errors: 0,
  warnings: 1,
  summary: {
    title: 'The Keep',
    facts: [
      { label: 'Floors', value: '5' },
      { label: 'Monsters', value: 'None' },
    ],
  },
  preview: undefined,
}
const withoutSummary: ProjectEntry = { ...withSummary, errors: 2, warnings: 1, summary: undefined }
const broken: ProjectEntry = {
  ...listed,
  status: 'broken',
  profile: kind,
  message: 'Not JSON: line 3, column 5.',
}
const either: ProjectEntry = {
  ...listed,
  status: 'ambiguous',
  candidates: [kind, { id: 'maze', label: 'Maze' }],
}

function mount(entry: ProjectEntry | undefined, busy = false) {
  const handlers = { onopen: vi.fn(), onduplicate: vi.fn(), ondelete: vi.fn() }
  render(ProjectSummary, { entry, busy, now: NOW, ...handlers })
  return handlers
}

const button = (name: string): HTMLElement => screen.getByRole('button', { name })

describe('ProjectSummary', () => {
  it('asks for a selection when there is none, and offers no action', () => {
    mount(undefined)
    expect(screen.getByText('Select a project')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  describe('a project that opens', () => {
    it('shows the profile’s title, its kind, the badge and its facts in order', () => {
      mount(withSummary)
      expect(screen.getByRole('heading', { name: 'The Keep' })).toBeInTheDocument()
      expect(screen.getByText('Dungeon crawl')).toBeInTheDocument()
      expect(screen.getByText('1 problem')).toBeInTheDocument()
      const facts = screen.getAllByRole('term').map((term) => term.textContent)
      expect(facts).toEqual(['Floors', 'Monsters'])
      expect(screen.getByText('5', { selector: 'dd' })).toBeInTheDocument()
      expect(screen.getByText('None', { selector: 'dd' })).toBeInTheDocument()
    })

    it('shows where the file is, how big and how long ago it changed', () => {
      mount(withSummary)
      expect(screen.getByText('delve/keep.dgn')).toBeInTheDocument()
      expect(screen.getByText('5.3 KB · 2 h ago')).toBeInTheDocument()
    })

    it('counts errors and warnings when the profile gives no summary, and names the file', () => {
      mount(withoutSummary)
      expect(screen.getByRole('heading', { name: 'keep.dgn' })).toBeInTheDocument()
      expect(screen.getByText('3 problems')).toBeInTheDocument()
      expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Errors', 'Warnings'])
      expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['2', '1'])
    })

    it('has Open (the primary action), Duplicate and Delete, each calling its handler', async () => {
      const { onopen, onduplicate, ondelete } = mount(withSummary)
      expect(button('Open')).toHaveAttribute('data-kind', 'primary')
      expect(button('Delete')).toHaveAttribute('data-kind', 'danger')
      await userEvent.click(button('Open'))
      await userEvent.click(button('Duplicate'))
      await userEvent.click(button('Delete'))
      expect(onopen).toHaveBeenCalledOnce()
      expect(onduplicate).toHaveBeenCalledOnce()
      expect(ondelete).toHaveBeenCalledOnce()
    })
  })

  describe('a project that does not open', () => {
    it('gives the reason, and still offers Open, which will show the error panel', () => {
      mount(broken)
      expect(screen.getByRole('heading', { name: 'keep.dgn' })).toBeInTheDocument()
      expect(screen.getByText('Can’t open')).toBeInTheDocument()
      expect(screen.getByText('Not JSON: line 3, column 5.')).toBeInTheDocument()
      expect(button('Open')).toBeEnabled()
      expect(button('Duplicate')).toBeEnabled()
      expect(button('Delete')).toBeEnabled()
    })
  })

  describe('a file two profiles claim', () => {
    it('lists the candidates and offers Open', () => {
      mount(either)
      expect(screen.getByText('Choose a profile')).toBeInTheDocument()
      const candidates = screen.getByRole('list', { name: 'Could be' })
      expect(
        within(candidates)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Dungeon crawl', 'Maze'])
      expect(button('Open')).toBeEnabled()
      // The profiles are named once, as candidates: the file has no kind yet, so no kind pill repeats one of them.
      expect(screen.getAllByText('Dungeon crawl')).toHaveLength(1)
      expect(document.querySelectorAll('header [data-pill]')).toHaveLength(1)
      expect(screen.queryByRole('definition')).toBeNull()
    })
  })

  it('while another action runs every action is disabled but stays in place', () => {
    mount(withSummary, true)
    for (const name of ['Open', 'Duplicate', 'Delete']) expect(button(name)).toBeDisabled()
  })
})
