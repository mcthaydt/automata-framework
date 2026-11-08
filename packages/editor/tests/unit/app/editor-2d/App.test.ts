// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '#src/app/editor-2d/App.svelte'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import type { EditorApp } from '#src/shared/level-2d/session/editor-app-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// The root (plan ED2D.4c2a step 7): Home or a document, and what happens to a document when the person leaves it.

const quietPage = () => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(
  options: { rival?: boolean; files?: Readonly<Record<string, string>>; holdFlush?: boolean } = {},
) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createAppProfiles()
  if (options.rival) {
    registry.register(plantedProfile())
    registry.register(plantedProfile({ id: 'rival', label: 'Rival note' }))
  }
  const real = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  for (const [path, text] of Object.entries(options.files ?? {})) await workspace.store.write(path, text)
  const disposed = vi.fn()
  // A journal write that waits until the test lets it finish, so a test can act while a document is still closing.
  let releaseFlush: () => void = () => {}
  const flushGate = new Promise<void>((resolve) => {
    releaseFlush = resolve
  })
  const opens = vi.fn()
  const app: EditorApp = {
    ...real,
    async create(...args) {
      const outcome = await real.create(...args)
      if (outcome.status !== 'opened') return outcome
      const { session } = outcome.document
      const flush = options.holdFlush ? () => flushGate.then(() => session.flush()) : session.flush
      return {
        ...outcome,
        document: { ...outcome.document, session: { ...session, flush }, dispose: disposed },
      }
    },
    open(...args) {
      opens(...args)
      return real.open(...args)
    },
  }
  const view = render(App, {
    geometry: stubGeometry(1194, 834),
    app,
    workspace,
    registry,
    toasts: createToasts({ clock }),
    clock,
    lifecycle: quietPage(),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
  })
  return { ...view, disposed, workspace, opens, releaseFlush }
}

async function newProject(): Promise<void> {
  const templates = await screen.findByRole('region', { name: 'Start a new project' })
  await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
  await screen.findByRole('button', { name: 'Back' })
}

describe('App', () => {
  it('starts on Home', async () => {
    await mount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('a project that opens takes the page; Back leaves it and lets the document go', async () => {
    const { disposed } = await mount()
    await newProject()
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull()
    expect(disposed).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    await waitFor(() => expect(disposed).toHaveBeenCalledOnce())
  })

  it('closing the editor with a document open lets the document go', async () => {
    const { disposed, unmount } = await mount()
    await newProject()
    unmount()
    await waitFor(() => expect(disposed).toHaveBeenCalledOnce())
  })

  it('closing the editor on Home has no document to let go', async () => {
    const { disposed, unmount } = await mount()
    await screen.findByRole('heading', { level: 1, name: 'Projects' })
    unmount()
    expect(disposed).not.toHaveBeenCalled()
  })

  it('a file that does not open shows the error panel over Home, and Open another goes back to the list (G-n)', async () => {
    const { workspace } = await mount({ files: { 'broken.af2d.json': '{ "format": "af2d",' } })
    const before = (await workspace.store.list()).map((entry) => entry.path)
    await userEvent.dblClick(await screen.findByRole('option', { name: /broken\.af2d\.json/ }))
    const panel = await screen.findByRole('dialog', { name: 'broken.af2d.json does not open' })
    expect(within(panel).getByTestId('text-view')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open another' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('listbox', { name: 'Projects' })).toBeInTheDocument()
    expect((await workspace.store.list()).map((entry) => entry.path)).toEqual(before)
  })

  it('a file two profiles claim asks which, and opens with the one chosen', async () => {
    await mount({ rival: true, files: { 'harbour.note': noteText('harbour') } })
    await userEvent.dblClick(await screen.findByRole('option', { name: /harbour\.note/ }))
    await screen.findByRole('dialog', { name: 'Open harbour.note as' })
    await userEvent.click(screen.getByRole('button', { name: 'Rival note' }))
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByText('Rival note')).toBeInTheDocument()
  })

  it('opening a file waits until the document left on Back has written its journal', async () => {
    const { opens, releaseFlush, disposed } = await mount({ holdFlush: true })
    await newProject()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    const [card] = await screen.findAllByRole('option')
    await userEvent.dblClick(card as HTMLElement)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(opens).not.toHaveBeenCalled()
    expect(disposed).not.toHaveBeenCalled()
    releaseFlush()
    await waitFor(() => expect(opens).toHaveBeenCalledOnce())
    expect(disposed).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
