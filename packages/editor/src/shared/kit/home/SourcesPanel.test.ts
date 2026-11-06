import { render, screen, within } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../storage/memory-store'
import type { Workspace } from '../storage/workspace'
import SourcesPanel from './SourcesPanel.svelte'

// The left of Home (plan ED2D.4c2a; moved from editor-2d in ED3D.5c). The editor's import controls are a snippet.

const stored = (): Workspace => ({
  store: createMemoryStore(),
  journal: createMemoryStore(),
  exports: { kind: 'download' } as Workspace['exports'],
  persistent: true,
  reason: undefined,
})
const unstored = (): Workspace => ({
  ...stored(),
  persistent: false,
  reason: 'Private file storage is unavailable: Quota exceeded.',
})

const importers = createRawSnippet(() => ({ render: () => '<button type="button">Import here</button>' }))

function mount(props: { workspace?: Workspace; count?: number } = {}) {
  render(SourcesPanel, { workspace: stored(), count: 4, importers, ...props })
}

describe('SourcesPanel', () => {
  it('names the workspace and says how many projects it holds and where it lives', () => {
    mount()
    const source = screen.getByRole('heading', { name: 'Open from' }).parentElement as HTMLElement
    expect(within(source).getByText('This workspace')).toBeInTheDocument()
    expect(within(source).getByText('4 projects · browser storage')).toBeInTheDocument()
  })

  it('says "this session only" when nothing is kept on the device', () => {
    mount({ workspace: unstored(), count: 0 })
    expect(screen.getByText('No projects · this session only')).toBeInTheDocument()
  })

  it('lists the storage notes: autosave and persistence when stored', () => {
    mount()
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Autosave on')).toBeInTheDocument()
    expect(within(storage).getByText('Kept in this browser’s private storage')).toBeInTheDocument()
  })

  it('warns, with the kit’s reason, when the browser keeps nothing', () => {
    mount({ workspace: unstored() })
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Not saved on this device')).toHaveAttribute('data-tone', 'warn')
    expect(
      within(storage).getByText('Private file storage is unavailable: Quota exceeded.'),
    ).toBeInTheDocument()
    expect(within(storage).getByText(/Export keeps your work/)).toBeInTheDocument()
  })

  it('has no folder source: that arrives with the folder store', () => {
    mount()
    expect(screen.queryByText(/folder/i)).toBeNull()
  })

  it('draws a dot before a state of the storage, not before the explanation of it', () => {
    mount()
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Autosave on').querySelector('.dot')).not.toBeNull()
    expect(
      within(storage)
        .getByText(/Edits are autosaved/)
        .querySelector('.dot'),
    ).toBeNull()
  })

  it('draws the editor’s import controls under the workspace row', () => {
    mount()
    const source = screen.getByRole('heading', { name: 'Open from' }).parentElement as HTMLElement
    expect(within(source).getByRole('button', { name: 'Import here' })).toBeInTheDocument()
  })
})
