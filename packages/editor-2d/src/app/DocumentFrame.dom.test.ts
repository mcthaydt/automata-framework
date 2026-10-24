import { createToasts } from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { counterIds } from '../model/ids'
import { memoryWorkspace } from '../testing/memory-workspace'
import { createTestClock } from '../testing/test-clock'
import DocumentFrame from './DocumentFrame.svelte'
import { createEditorApp, type OpenOutcome } from './editor-app'
import { createAppProfiles } from './profiles'

// The place an opened document goes until the Level view replaces it (plan ED2D.4c2a, decision 10): it says what is
// open, offers Back and shows how the document stands on saving. It edits nothing.

type Opened = Extract<OpenOutcome, { status: 'opened' }>

/** The first template of the first profile: what a test starts a project from. */
function firstTemplate(registry: ReturnType<typeof createAppProfiles>): readonly [string, string] {
  const [template] = registry
    .list()
    .flatMap((profile) => profile.templates.map((t) => [profile.id, t.id] as const))
  if (template === undefined) throw new Error('the registry holds a template')
  return template
}

async function openIn(options: { persistent?: boolean } = {}) {
  const clock = createTestClock()
  const workspace = { ...memoryWorkspace(clock), persistent: options.persistent ?? true }
  const registry = createAppProfiles()
  const app = createEditorApp({ workspace, registry, ids: counterIds(), clock })
  const outcome = await app.create(...firstTemplate(registry))
  if (outcome.status !== 'opened') throw new Error(`could not open: ${outcome.status}`)
  const opened: Opened = outcome
  return { opened, app, clock, registry }
}

async function mount(options: { persistent?: boolean } = {}) {
  const { opened, clock, app, registry } = await openIn(options)
  const onback = vi.fn()
  const toasts = createToasts({ clock })
  const view = render(DocumentFrame, { geometry: stubGeometry(1194, 834), opened, toasts, onback })
  return { opened, onback, toasts, app, registry, view }
}

describe('DocumentFrame', () => {
  it('names the open file as the page heading and the profile that opens it', async () => {
    const { opened } = await mount()
    expect(screen.getByRole('heading', { level: 1, name: opened.document.path })).toBeInTheDocument()
    expect(screen.getByText(opened.document.profile.label)).toBeInTheDocument()
  })

  it('moves focus to the heading, so a keyboard or a screen reader starts on the new page', async () => {
    const { opened } = await mount()
    expect(screen.getByRole('heading', { level: 1, name: opened.document.path })).toHaveFocus()
  })

  it('says the editing views are not here yet', async () => {
    await mount()
    expect(screen.getByText(/arrive with ED2D\.4c4/)).toBeInTheDocument()
  })

  it('Back returns to Home', async () => {
    const { onback } = await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onback).toHaveBeenCalledOnce()
  })

  it('shows the document’s save state in the status line and follows it', async () => {
    const { opened } = await mount()
    const status = (): HTMLElement => document.querySelector('[data-widget="status-line"]') as HTMLElement
    expect(status()).toHaveTextContent('Saved')
    opened.document.history.apply('edit', (value) => ({ ...(value as object) }))
    flushSync()
    expect(status()).toHaveTextContent('Unsaved changes')
  })

  it('shows the toasts, so a problem with saving can be told while a document is open', async () => {
    const { toasts } = await mount()
    toasts.push({ kind: 'error', message: 'Could not save.' })
    expect(await screen.findByText('Could not save.')).toBeInTheDocument()
  })

  it('follows the save state of another document when it is given one', async () => {
    const { view, app, registry } = await mount()
    const second = await app.create(...firstTemplate(registry))
    if (second.status !== 'opened') throw new Error('could not open')
    second.document.history.apply('edit', (value) => ({ ...(value as object) }))
    await view.rerender({ opened: second })
    expect(document.querySelector('[data-widget="status-line"]')).toHaveTextContent('Unsaved changes')
  })

  it('says so when this device keeps nothing', async () => {
    await mount({ persistent: false })
    expect(document.querySelector('[data-widget="status-line"]')).toHaveTextContent(
      'Not saved on this device',
    )
  })
})
