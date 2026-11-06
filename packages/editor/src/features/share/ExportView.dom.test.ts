import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createEditorApp } from '../../app/editor-2d/editor-app'
import { createAppProfiles } from '../../app/editor-2d/profiles'
import type { History } from '../../shared/kit/history/history.ts'
import { createDownloadStore, type DownloadFile } from '../../shared/kit/storage/download-store.ts'
import { createMemoryStore } from '../../shared/kit/storage/memory-store.ts'
import type { LifecycleDocument, LifecycleWindow } from '../../shared/kit/storage/page-lifecycle.ts'
import type { ProjectStore } from '../../shared/kit/storage/project-store.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import { createToasts } from '../../shared/kit/widgets/toasts.ts'
import { packTile } from '../../shared/level-2d/model/cells-codec'
import { counterIds } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import { stubGeometry } from '../../testing/kit/stub-geometry.svelte.ts'
import FakeLevelCanvas from '../../testing/level-2d/FakeLevelCanvas.svelte'
import { textOf } from '../../testing/level-2d/memory-workspace'
import { withLayer } from '../../testing/level-2d/project-edit'
import { createTestClock } from '../../testing/level-2d/test-clock'
import DocumentScreen from '../document/DocumentScreen.svelte'
import { createDocumentController } from '../document/document-controller'

// The Export view in jsdom (plan ED2D.7b step 5), mounted the way the app mounts it and reached from the rail.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

interface Options {
  readonly folder?: boolean
  readonly persistent?: boolean
  readonly seed?: (project: Project) => Project
}

async function mount(options: Options = {}) {
  const clock = createTestClock()
  const downloaded: DownloadFile[] = []
  const shared: DownloadFile[] = []
  const copied: string[] = []
  const memory = createMemoryStore({ now: clock.now })
  const store: ProjectStore = options.folder === true ? { ...memory, kind: 'folder' } : memory
  const workspace: Workspace = {
    store,
    journal: createMemoryStore({ now: clock.now }),
    exports: createDownloadStore({
      now: clock.now,
      download: (file) => downloaded.push(file),
      share: async (file) => {
        shared.push(file)
      },
      copyText: async (text) => {
        copied.push(text)
      },
    }),
    persistent: options.persistent ?? true,
    reason: undefined,
  }
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const history = opened.document.history as History<Project>
  if (options.seed !== undefined)
    history.apply('Seed', (project) => (options.seed as (p: Project) => Project)(project))
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(1194, 834),
    controller,
    toasts,
    clock,
    read: (path: string) => store.read(path),
    workspace,
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  await userEvent.click(
    within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name: 'Export' }),
  )
  await screen.findByRole('heading', { name: 'Export' })
  return { history, store, clock, downloaded, shared, copied, path: opened.document.path }
}

const target = (name: RegExp): HTMLInputElement => screen.getByRole('checkbox', { name })
const button = (name: string): HTMLElement => screen.getByRole('button', { name })
const files = (): string[] =>
  within(screen.getByRole('list', { name: 'Files' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[data-path]')?.textContent ?? '')

/** A tile beyond the decor tileset: one error. */
const stray = (project: Project): Project =>
  withLayer(project, 'level-1', 'decor', (layer) =>
    layer.kind === 'tiles' ? { ...layer, cells: layer.cells.set(4, 7, packTile(99, false, false)) } : layer,
  )

describe('Export view', () => {
  it('lists both targets checked, every file with its size, and the total', async () => {
    const { path } = await mount()
    expect(target(/Project file/)).toBeChecked()
    expect(target(/Game files/)).toBeChecked()
    expect(files()).toEqual(expect.arrayContaining([path, 'project.toml', 'world.toml']))
    expect(files().some((file) => /^levels\/.+\.toml$/.test(file))).toBe(true)
    expect(screen.getByText(/^\d+ files · \d+(\.\d)? KB$/)).toBeInTheDocument()
    expect(button('Download')).toBeEnabled()
    expect(button('Download')).toHaveAttribute('data-kind', 'primary')
    expect(button('Share')).toBeDisabled()
    expect(button('Copy')).toBeDisabled()
    expect(screen.getByText('Share and Copy take one file; Download takes them all.')).toBeInTheDocument()
  })

  it('downloads every chosen file and says how many', async () => {
    const { downloaded } = await mount()
    const count = files().length
    await userEvent.click(button('Download'))
    expect(downloaded).toHaveLength(count)
    expect(await screen.findByText(`Downloaded ${count} files.`)).toBeInTheDocument()
  })

  it('shares or copies the one file left when Game files is unchecked', async () => {
    const { shared, copied, path } = await mount()
    await userEvent.click(target(/Game files/))
    expect(files()).toEqual([path])
    await userEvent.click(button('Copy'))
    expect(copied).toEqual([expect.stringContaining('"format": "af2d"')])
    await userEvent.click(button('Share'))
    expect(shared.map((file) => file.name)).toEqual([path])
  })

  it('names the errors and keeps Write to folder for when they are fixed, while Download still works (ED2D-D12)', async () => {
    await mount({ folder: true, seed: stray })
    expect(screen.getByText('1 error')).toBeInTheDocument()
    expect(button('Write to folder')).toBeDisabled()
    expect(screen.getByText('Fix the 1 error in Checks first.')).toBeInTheDocument()
    expect(button('Download')).toBeEnabled()
  })

  it('without a game folder says how to get one', async () => {
    await mount()
    expect(button('Write to folder')).toBeDisabled()
    expect(screen.getByText('Open a game folder to write into it.')).toBeInTheDocument()
  })

  it('recomputes the files after an edit made while it is open (spec §13)', async () => {
    const { history } = await mount()
    const before = files()
    history.apply('Rename', (project) => ({ ...project, name: 'Moss steps' }))
    await vi.waitFor(() => expect(files()).not.toEqual(before))
    expect(files()).toContain('moss-steps.af2d.json')
  })

  it('writes into the folder, and a file changed meanwhile opens the conflict with nothing written (G-m)', async () => {
    const { store, clock } = await mount({ folder: true })
    await vi.waitFor(() => expect(button('Write to folder')).toBeEnabled())
    clock.advance(10)
    await store.write('project.toml', 'theirs\n')
    await userEvent.click(button('Write to folder'))
    const dialog = await screen.findByRole('dialog', { name: 'project.toml changed since the list was made' })
    expect(textOf(await store.read('project.toml'))).toBe('theirs\n')
    expect(await store.read('world.toml')).toBeUndefined()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep mine' }))
    await vi.waitFor(async () => expect(textOf(await store.read('project.toml'))).toMatch(/^# Generated/))
    expect(await store.read('world.toml')).toBeDefined()
    expect(await screen.findByText(/^Wrote \d+ files\.$/)).toBeInTheDocument()
  })

  it('marks the document clean after exporting the working file where Export is the save', async () => {
    const { history } = await mount({ persistent: false })
    history.apply('Rename', (project) => ({ ...project, name: 'Moss steps' }))
    expect(history.cleanRevision).not.toBe(history.revision)
    await userEvent.click(button('Download'))
    await vi.waitFor(() => expect(history.cleanRevision).toBe(history.revision))
  })

  it('leaves the document dirty after a download where the device keeps it', async () => {
    const { history } = await mount()
    history.apply('Rename', (project) => ({ ...project, name: 'Moss steps' }))
    await userEvent.click(button('Download'))
    await screen.findByText(/^Downloaded \d+ files?\.$/)
    expect(history.cleanRevision).not.toBe(history.revision)
  })
})
