import { createToasts } from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { counterIds } from '../model/ids'
import { memoryWorkspace } from '../testing/memory-workspace'
import { createTestClock } from '../testing/test-clock'
import App from './App.svelte'
import { createEditorApp, type EditorApp } from './editor-app'
import { createAppProfiles } from './profiles'

// The root (plan ED2D.4c2a step 7): Home or a document, and what happens to a document when the person leaves it.

function mount() {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const registry = createAppProfiles()
  const real = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  const disposed = vi.fn()
  const app: EditorApp = {
    ...real,
    async create(...args) {
      const outcome = await real.create(...args)
      if (outcome.status !== 'opened') return outcome
      return { ...outcome, document: { ...outcome.document, dispose: disposed } }
    },
  }
  const view = render(App, {
    geometry: stubGeometry(1194, 834),
    app,
    workspace,
    registry,
    toasts: createToasts({ clock }),
    clock,
  })
  return { ...view, disposed }
}

async function newProject(): Promise<void> {
  const templates = await screen.findByRole('region', { name: 'Start a new project' })
  await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
  await screen.findByRole('button', { name: 'Back' })
}

describe('App', () => {
  it('starts on Home', async () => {
    mount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('a project that opens takes the page; Back leaves it and lets the document go', async () => {
    const { disposed } = mount()
    await newProject()
    expect(screen.queryByRole('heading', { name: 'Projects' })).toBeNull()
    expect(disposed).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(disposed).toHaveBeenCalledOnce()
  })

  it('closing the editor with a document open lets the document go', async () => {
    const { disposed, unmount } = mount()
    await newProject()
    unmount()
    expect(disposed).toHaveBeenCalledOnce()
  })

  it('closing the editor on Home has no document to let go', async () => {
    const { disposed, unmount } = mount()
    await screen.findByRole('heading', { level: 1, name: 'Projects' })
    unmount()
    expect(disposed).not.toHaveBeenCalled()
  })
})
