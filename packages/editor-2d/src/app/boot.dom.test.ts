import { cleanup, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printProject } from '../model/project-codec'
import { memoryWorkspace } from '../testing/memory-workspace'
import { hollowmere, mossgate } from '../testing/samples'
import { createTestClock } from '../testing/test-clock'
import { type EditorEnv, type EditorHandle, startEditor } from './boot'

// The editor's boot (plan ED2D.4c2a decision 9): a function of its environment, so a test hands it a window, a document, a
// clock and a workspace and gets the real app. The journey: list, New, the document frame, Back.

type Listener = () => void

/** A window the geometry owner can read, whose size a test sets and whose listeners it can count and call. */
function fakeWindow(width: number, height: number) {
  const listeners = new Map<string, Set<Listener>>()
  const add = (type: string, listener: Listener): void => {
    const set = listeners.get(type) ?? new Set<Listener>()
    set.add(listener)
    listeners.set(type, set)
  }
  const remove = (type: string, listener: Listener): void => {
    listeners.get(type)?.delete(listener)
  }
  const view = {
    innerWidth: width,
    innerHeight: height,
    addEventListener: add,
    removeEventListener: remove,
  }
  return {
    view,
    resize(w: number, h: number): void {
      view.innerWidth = w
      view.innerHeight = h
      for (const listener of [...(listeners.get('resize') ?? [])]) listener()
    },
    count: (): number => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  }
}

let started: EditorHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  cleanup()
  document.body.replaceChildren()
  delete document.documentElement.dataset.formFactor
})

interface BootOptions {
  seed?: boolean
  /** Hand the editor browser storage to open, not a workspace. */
  own?: boolean
  storage?: EditorEnv['storage']
  size?: [number, number]
  fillRandom?: EditorEnv['fillRandom']
  /** More files in the workspace before the editor starts. */
  files?: Readonly<Record<string, string>>
}

async function boot(options: BootOptions = {}) {
  const { seed = true, own = false, size = [1194, 834] } = options
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  if (seed) {
    await workspace.store.write('mossgate.af2d.json', printProject(mossgate()))
    clock.advance(1000)
    await workspace.store.write('hollowmere.af2d.json', printProject(hollowmere()))
  }
  for (const [path, text] of Object.entries(options.files ?? {})) await workspace.store.write(path, text)
  const target = document.createElement('div')
  document.body.append(target)
  const win = fakeWindow(...size)
  const env: EditorEnv = {
    window: win.view,
    document,
    clock,
    fillRandom:
      options.fillRandom ??
      ((bytes) => {
        crypto.getRandomValues(bytes)
      }),
    ...(own ? { storage: options.storage ?? {} } : { workspace }),
  }
  started = await startEditor(target, env)
  return { target, win, workspace, handle: started, clock }
}

describe('startEditor', () => {
  it('shows Home over the workspace it is given', async () => {
    await boot()
    expect(await screen.findByRole('option', { name: /Mossgate/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Hollowmere/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
  })

  it('journey: New makes a project and opens it in the frame; Back returns to a list that holds it', async () => {
    const { workspace } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    const templates = screen.getByRole('region', { name: 'Start a new project' })
    await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)

    const bar = await screen.findByTestId('document-bar')
    const path = bar.querySelector('.file')?.textContent ?? ''
    expect(path).toMatch(/\.af2d\.json$/)
    expect(await workspace.store.read(path)).toBeDefined()
    expect(screen.queryByRole('listbox')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('listbox', { name: 'Projects' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
  })

  it('journey: Enter on the list opens the selected project in the frame', async () => {
    await boot()
    const list = await screen.findByRole('listbox', { name: 'Projects' })
    list.focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hollowmere' })).toBeInTheDocument()
  })

  it('Home keeps its search and its selection across a visit to a document', async () => {
    await boot()
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search projects' }), 'moss')
    await userEvent.dblClick(screen.getByRole('option', { name: /Mossgate/ }))
    await screen.findByRole('heading', { level: 1, name: 'Mossgate' })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('searchbox', { name: 'Search projects' })).toHaveValue('moss')
    expect(screen.getByRole('option', { name: /Mossgate/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the browser’s storage itself, and says so when it keeps nothing', async () => {
    await boot({ seed: false, own: true })
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(screen.getByText('This browser has no private file storage (OPFS).')).toBeInTheDocument()
    expect(document.querySelector('[data-widget="status-line"]')).toHaveTextContent(
      'Not saved on this device',
    )
  })

  it('lays the shell out from the window it was given, and again when that resizes', async () => {
    const { win } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    const shell = (): Element | null => document.querySelector('[data-editor-shell]')
    expect(shell()).toHaveAttribute('data-mode', 'wide')
    win.resize(834, 1194)
    flushSync()
    expect(shell()).toHaveAttribute('data-mode', 'medium')
  })

  it('hands back the workspace it is using', async () => {
    const { workspace, handle } = await boot()
    expect(handle.workspace).toBe(workspace)
    await started?.dispose()
    started = undefined
    const own = await boot({ seed: false, own: true })
    expect(own.handle.workspace.persistent).toBe(false)
  })

  it('opens the storage it is given, and reports why it could not be used', async () => {
    await boot({
      seed: false,
      own: true,
      storage: {
        getDirectory: async () => {
          throw new Error('boom')
        },
      },
    })
    expect(await screen.findByText('Private file storage is unavailable: boom')).toBeInTheDocument()
  })

  it('publishes the window’s geometry on the document root, and follows the window', async () => {
    const { win } = await boot()
    expect(document.documentElement.dataset.formFactor).toBe('desktop')
    win.resize(834, 1194)
    expect(document.documentElement.dataset.formFactor).toBe('tablet-portrait')
  })

  it('takes instance ids from the random bytes it is given', async () => {
    const fillRandom = vi.fn((bytes: Uint8Array<ArrayBuffer>) => {
      crypto.getRandomValues(bytes)
    })
    await boot({ seed: false, fillRandom })
    const templates = await screen.findByRole('region', { name: 'Start a new project' })
    expect(fillRandom).not.toHaveBeenCalled()
    await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
    await screen.findByRole('button', { name: 'Back' })
    expect(fillRandom).toHaveBeenCalled()
  })

  it('times its toasts by the clock it is given', async () => {
    const { clock } = await boot()
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }))
    expect(await screen.findByText(/^Copied to /)).toBeInTheDocument()
    clock.advance(60_000)
    await waitFor(() => expect(screen.queryByText(/^Copied to /)).toBeNull())
  })

  it('dispose twice is the same as once', async () => {
    const { handle, target } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    await handle.dispose()
    await expect(handle.dispose()).resolves.toBeUndefined()
    expect(target.childElementCount).toBe(0)
  })

  it('listens for the page hiding while a document is open, and stops after Back', async () => {
    const { win } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    const onHome = win.count()
    await userEvent.dblClick(screen.getByRole('option', { name: /Mossgate/ }))
    await screen.findByRole('heading', { level: 1, name: 'Mossgate' })
    expect(win.count()).toBe(onHome + 1)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('listbox', { name: 'Projects' })
    expect(win.count()).toBe(onHome)
  })

  it('a project from a newer editor shows the profile’s message and is never rewritten (G-o)', async () => {
    const text = `${JSON.stringify({ ...JSON.parse(printProject(mossgate())), version: 9 }, null, 2)}\n`
    const { workspace } = await boot({ seed: false, files: { 'newer.af2d.json': text } })
    await userEvent.dblClick(await screen.findByRole('option', { name: /newer\.af2d\.json/ }))
    const panel = await screen.findByRole('dialog', { name: 'newer.af2d.json does not open' })
    expect(panel).toHaveTextContent(/made by a newer editor/)
    expect(within(panel).getByTestId('text-view')).toBeInTheDocument()
    expect(new TextDecoder().decode(await workspace.store.read('newer.af2d.json'))).toBe(text)
  })

  it('a project with keys this editor does not know lists their paths (G-p)', async () => {
    const text = JSON.stringify({ ...JSON.parse(printProject(mossgate())), extra: 1, more: 2 })
    await boot({ seed: false, files: { 'keys.af2d.json': text } })
    await userEvent.dblClick(await screen.findByRole('option', { name: /keys\.af2d\.json/ }))
    const panel = await screen.findByRole('dialog', { name: 'keys.af2d.json does not open' })
    const places = [...panel.querySelectorAll('.where')].map((where) => where.textContent)
    expect(places).toEqual(['extra', 'more'])
  })

  it('dispose takes the editor off the page and lets go of the window', async () => {
    const { target, win, handle } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    expect(win.count()).toBeGreaterThan(0)
    await handle.dispose()
    expect(target.childElementCount).toBe(0)
    expect(win.count()).toBe(0)
  })
})
