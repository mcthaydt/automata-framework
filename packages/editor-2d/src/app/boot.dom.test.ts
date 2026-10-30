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
  thumbnails?: EditorEnv['thumbnails']
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
    ...(options.thumbnails === undefined ? {} : { thumbnails: options.thumbnails }),
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

    const heading = await screen.findByRole('heading', { level: 1 })
    const path = heading.textContent ?? ''
    expect(path).not.toBe('Projects')
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
    expect(await screen.findByRole('heading', { level: 1, name: 'hollowmere.af2d.json' })).toBeInTheDocument()
  })

  it('Home keeps its search and its selection across a visit to a document', async () => {
    await boot()
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search projects' }), 'moss')
    await userEvent.dblClick(screen.getByRole('option', { name: /Mossgate/ }))
    await screen.findByRole('heading', { level: 1, name: 'mossgate.af2d.json' })
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

  it('dispose takes the editor off the page and lets go of the window', async () => {
    const { target, win, handle } = await boot()
    await screen.findByRole('listbox', { name: 'Projects' })
    expect(win.count()).toBeGreaterThan(0)
    await handle.dispose()
    expect(target.childElementCount).toBe(0)
    expect(win.count()).toBe(0)
  })

  it('makes the thumbnails over its workspace, hands them to Home’s cards, and disposes them with the editor', async () => {
    const thumbnail = vi.fn(async () => 'data:image/png;base64,AAAA')
    const dispose = vi.fn()
    const make = vi.fn(() => ({ thumbnail, dispose }))
    const { workspace, handle } = await boot({ thumbnails: make })
    expect(make).toHaveBeenCalledWith(workspace)
    const card = await screen.findByRole('option', { name: /Mossgate/ })
    await waitFor(() =>
      expect(card.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA'),
    )
    await handle.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
