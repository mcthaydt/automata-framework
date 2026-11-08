// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HomeCard } from '#src/shared/kit/home/project-browse.ts'
import { createProjectBrowser } from '#src/shared/kit/home/project-browser.ts'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import { StorageError } from '#src/shared/kit/storage/project-store.ts'
import type { Workspace } from '#src/shared/kit/storage/workspace.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import HomeScreenFixture from '#src/testing/kit/HomeScreenFixture.svelte'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'

// Home's shell, shared by both editors (moved from editor-2d's `Home.svelte` in ED3D.5c): wired to the kit's project
// browser over a hand-written list, with snippets standing in for an editor's import controls and inspector. Each
// editor's own Home tests cover what it puts in them.

interface Entry {
  readonly path: string
  readonly title: string
}

const NOW = 1_700_000_000_000
const workspace: Workspace = {
  store: createMemoryStore(),
  journal: createMemoryStore(),
  exports: { kind: 'download' } as Workspace['exports'],
  persistent: true,
  reason: undefined,
}
const card = (entry: Entry): HomeCard => ({
  path: entry.path,
  title: entry.title,
  badge: { tone: 'ok', text: 'Valid' },
  kind: 'Level',
  accent: undefined,
  size: 10,
  mtime: NOW,
})

function mount(options: { list?: () => Promise<readonly Entry[]>; width?: number; height?: number } = {}) {
  const list = vi.fn(
    options.list ??
      (async () => [
        { path: 'depot.json', title: 'Depot' },
        { path: 'yard.json', title: 'Yard' },
      ]),
  )
  const source = createProjectBrowser<Entry>({
    list,
    words: (entry) => [entry.path, entry.title],
    onError: () => {},
  })
  const onopen = vi.fn()
  render(HomeScreenFixture, {
    geometry: stubGeometry(options.width ?? 1194, options.height ?? 834),
    source,
    card,
    workspace,
    toasts: createToasts({ clock: { now: () => NOW, setTimer: () => 0, clearTimer: () => {} } }),
    clock: { now: () => NOW },
    onopen,
  })
  return { source, list, onopen }
}

describe('HomeScreen', () => {
  it('reads the workspace when it appears and lists the cards, with the first selected and inspected', async () => {
    const { list } = mount()
    expect(await screen.findByRole('option', { name: /Depot/ })).toHaveAttribute('aria-selected', 'true')
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByText('2 in this workspace')).toBeInTheDocument()
    expect(screen.getByTestId('inspected')).toHaveTextContent('Depot')
  })

  it('draws the editor’s import controls, what goes below the list, and the hint for an empty workspace', async () => {
    mount({ list: async () => [] })
    expect(screen.getByRole('button', { name: 'Import here' })).toBeInTheDocument()
    expect(screen.getByText('Below the list')).toBeInTheDocument()
    expect(await screen.findByText('Import a folder to start.')).toBeInTheDocument()
  })

  it('has the Editor colours control at the foot of the list', async () => {
    mount()
    await screen.findByRole('option', { name: /Depot/ })
    expect(screen.getByRole('radiogroup', { name: 'Editor colours' })).toBeInTheDocument()
  })

  it('searches as the person types, and Escape clears the search', async () => {
    mount()
    await screen.findByRole('option', { name: /Depot/ })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'yard')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByText('1 of 2 shown')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('opens a card on a double click', async () => {
    const { onopen } = mount()
    await userEvent.dblClick(await screen.findByRole('option', { name: /Yard/ }))
    expect(onopen).toHaveBeenCalledWith('yard.json')
  })

  it('says why the list is unavailable and reads it again on Retry', async () => {
    let fail = true
    mount({
      list: async () => {
        if (fail) throw new StorageError('io', 'The disk is gone.')
        return [{ path: 'depot.json', title: 'Depot' }]
      },
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The disk is gone.')
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('option', { name: /Depot/ })).toBeInTheDocument()
  })

  it('has Sources and Details below wide, and choosing a card there opens its details', async () => {
    mount({ width: 834, height: 1194 })
    const details = screen.getByRole('button', { name: 'Details' })
    expect(screen.getByRole('button', { name: 'Sources' })).toHaveAttribute('aria-expanded', 'false')
    expect(details).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(await screen.findByRole('option', { name: /Yard/ }))
    await waitFor(() => expect(details).toHaveAttribute('aria-expanded', 'true'))
    expect(screen.getByTestId('inspected')).toHaveTextContent('Yard')
  })

  it('has no Sources or Details button at wide, where both are on screen', async () => {
    mount()
    await screen.findByRole('option', { name: /Depot/ })
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull()
  })
})
