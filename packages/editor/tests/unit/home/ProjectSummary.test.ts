// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ProjectSummary from '#src/features/home/ProjectSummary.svelte'
import type { ProjectEntry } from '#src/shared/level-2d/documents/project-list.ts'

// A level's Details (from its card's More menu): what its profile says about it, why it does not open or what could
// open it, and the file's facts. Entries are written by hand; the component knows no profile. Its actions are the
// card's menu now, so it has none.

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

function mount(entry: ProjectEntry) {
  render(ProjectSummary, { entry, now: NOW })
}

const facts = (): (string | null)[] => screen.getAllByRole('term').map((term) => term.textContent)
const values = (): (string | null)[] => screen.getAllByRole('definition').map((value) => value.textContent)

describe('ProjectSummary', () => {
  describe('a level that opens', () => {
    it('shows its kind, the badge and the profile’s facts in order, then the file', () => {
      mount(withSummary)
      expect(screen.getByText('Dungeon crawl')).toBeInTheDocument()
      expect(screen.getByText('1 problem')).toBeInTheDocument()
      expect(facts()).toEqual(['Floors', 'Monsters', 'File', 'Size', 'Changed'])
      expect(values()).toEqual(['5', 'None', 'delve/keep.dgn', '5.3 KB', '2 hours ago'])
    })

    it('counts errors and warnings when the profile gives no summary', () => {
      mount(withoutSummary)
      expect(screen.getByText('3 problems')).toBeInTheDocument()
      expect(facts().slice(0, 2)).toEqual(['Errors', 'Warnings'])
      expect(values().slice(0, 2)).toEqual(['2', '1'])
    })

    it('has no buttons: Open, Duplicate and Delete are on the card', () => {
      mount(withSummary)
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  describe('a level that does not open', () => {
    it('gives the reason and the file', () => {
      mount(broken)
      expect(screen.getByText('Can’t open')).toBeInTheDocument()
      expect(screen.getByText('Not JSON: line 3, column 5.')).toBeInTheDocument()
      expect(facts()).toEqual(['File', 'Size', 'Changed'])
    })
  })

  describe('a file two profiles claim', () => {
    it('lists the candidates, names each once and has no kind pill', () => {
      mount(either)
      expect(screen.getByText('Choose a profile')).toBeInTheDocument()
      const candidates = screen.getByRole('list', { name: 'Could be' })
      expect(
        within(candidates)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Dungeon crawl', 'Maze'])
      expect(screen.getAllByText('Dungeon crawl')).toHaveLength(1)
      expect(facts()).toEqual(['File', 'Size', 'Changed'])
    })
  })
})
