// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type EditorEnv, type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'

/** Opens Home's New level sheet and answers its list of templates. */
async function openNewLevel(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByTestId('new-level'))
  return screen.getByRole('list', { name: 'Templates' })
}

// The editor's boot: a function of its environment, so a test hands it a window, a document, a
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
  /** More files in the workspace before the editor starts. */
  files?: Readonly<Record<string, string>>
}

/** A mouse press or release as the browser sends it; jsdom has no `PointerEvent` constructor. */
function press(target: HTMLElement, type: 'pointerdown' | 'pointerup', x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', pressure: type === 'pointerdown' ? 0.5 : 0 })
  target.dispatchEvent(event)
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
    ...(options.thumbnails === undefined ? {} : { thumbnails: options.thumbnails }),
    // jsdom has no WebGL: the Level view draws into a stand-in.
    canvas: FakeLevelCanvas,
  }
  started = await startEditor(target, env)
  return { target, win, workspace, handle: started, clock }
}

describe('startEditor', () => {
  it('shows Home over the workspace it is given', async () => {
    await boot()
    expect(await screen.findByRole('button', { name: /^(Mossgate)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^(Hollowmere)/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Your levels' })).toBeInTheDocument()
  })

  it('journey: New makes a project and opens it in the Level view; Back returns to a list that holds it', async () => {
    const { workspace } = await boot()
    await screen.findByRole('list', { name: 'Levels' })
    const templates = await openNewLevel()
    await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)

    const bar = await screen.findByTestId('document-bar')
    const path = bar.getAttribute('data-path') ?? ''
    expect(path).toMatch(/\.af2d\.json$/)
    expect(await workspace.store.read(path)).toBeDefined()
    expect(screen.queryByRole('list', { name: 'Levels' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('list', { name: 'Levels' })).toBeInTheDocument()
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Levels' })).getAllByRole('listitem')).toHaveLength(3),
    )
  })

  it('journey: New opens the Level view, a tap paints a cell as one undo step, and Back leaves', async () => {
    await boot()
    const templates = await openNewLevel()
    const platformer = within(templates).getByRole('button', { name: /Platformer/ })
    await userEvent.click(platformer)
    expect(await screen.findByTestId('level-view')).toBeInTheDocument()
    expect(
      within(screen.getByRole('radiogroup', { name: 'Views' })).getByRole('radio', { name: 'Level' }),
    ).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(within(screen.getByRole('listbox', { name: 'Layers' })).getByText('Collision'))
    const surface = screen.getByTestId('level-surface')
    // jsdom lays nothing out, so the canvas is unmeasured and a canvas point is a level pixel: cell (2, 10).
    press(surface, 'pointerdown', 40, 168)
    press(surface, 'pointerup', 40, 168)
    expect(await screen.findByRole('button', { name: 'Undo Paint' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Undo Paint' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    // An undo is a change of its own to the history, so Back asks; Don't save leaves.
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Don’t save' }))
    expect(await screen.findByRole('list', { name: 'Levels' })).toBeInTheDocument()
  })

  it('journey: Enter on the selected card opens that level', async () => {
    await boot()
    const list = await screen.findByRole('list', { name: 'Levels' })
    ;(list.querySelector('[tabindex="0"]') as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Hollowmere' })).toBeInTheDocument()
  })

  it('Home keeps its search and its selection across a visit to a document', async () => {
    await boot()
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search levels' }), 'moss')
    await userEvent.click(screen.getByRole('button', { name: /^(Mossgate)/ }))
    await screen.findByRole('heading', { level: 1, name: 'Mossgate' })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('searchbox', { name: 'Search levels' })).toHaveValue('moss')
    expect(screen.getByRole('button', { name: /^(Mossgate)/ })).toHaveAttribute('tabindex', '0')
  })

  it('opens the browser’s storage itself, and says so when it keeps nothing', async () => {
    await boot({ seed: false, own: true })
    expect(await screen.findByText('No levels yet')).toBeInTheDocument()
    expect(screen.getByTestId('home-storage')).toHaveTextContent(
      'Not saved on this device. Download your level to keep it.',
    )
  })

  it('lays the shell out from the window it was given, and again when that resizes', async () => {
    const { win } = await boot()
    await screen.findByRole('list', { name: 'Levels' })
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
    // The browser's own reason is for whoever asks (the line's tooltip), not the line itself.
    expect(await screen.findByTestId('home-storage')).toHaveAttribute(
      'title',
      'Private file storage is unavailable: boom',
    )
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
    const templates = await openNewLevel()
    expect(fillRandom).not.toHaveBeenCalled()
    await userEvent.click(within(templates).getAllByRole('button')[0] as HTMLElement)
    await screen.findByRole('button', { name: 'Back' })
    expect(fillRandom).toHaveBeenCalled()
  })

  it('times its toasts by the clock it is given', async () => {
    const { clock } = await boot()
    await userEvent.click(await screen.findByRole('button', { name: 'More for Mossgate' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    expect(await screen.findByText(/^Copied to /)).toBeInTheDocument()
    clock.advance(60_000)
    await waitFor(() => expect(screen.queryByText(/^Copied to /)).toBeNull())
  })

  it('dispose twice is the same as once', async () => {
    const { handle, target } = await boot()
    await screen.findByRole('list', { name: 'Levels' })
    await handle.dispose()
    await expect(handle.dispose()).resolves.toBeUndefined()
    expect(target.childElementCount).toBe(0)
  })

  it('listens for the page hiding while a document is open, and stops after Back', async () => {
    const { win } = await boot()
    await screen.findByRole('list', { name: 'Levels' })
    const onHome = win.count()
    await userEvent.click(screen.getByRole('button', { name: /^(Mossgate)/ }))
    await screen.findByRole('heading', { level: 1, name: 'Mossgate' })
    expect(win.count()).toBe(onHome + 1)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('list', { name: 'Levels' })
    expect(win.count()).toBe(onHome)
  })

  it('a project from a newer editor shows the profile’s message and is never rewritten (G-o)', async () => {
    const text = `${JSON.stringify({ ...JSON.parse(printProject(mossgate())), version: 9 }, null, 2)}\n`
    const { workspace } = await boot({ seed: false, files: { 'newer.af2d.json': text } })
    await userEvent.click(await screen.findByRole('button', { name: /^(newer\.af2d\.json)/ }))
    const panel = await screen.findByRole('dialog', { name: 'newer.af2d.json does not open' })
    expect(panel).toHaveTextContent(/made by a newer editor/)
    expect(within(panel).getByTestId('text-view')).toBeInTheDocument()
    expect(new TextDecoder().decode(await workspace.store.read('newer.af2d.json'))).toBe(text)
  })

  it('a project with keys this editor does not know lists their paths (G-p)', async () => {
    const text = JSON.stringify({ ...JSON.parse(printProject(mossgate())), extra: 1, more: 2 })
    await boot({ seed: false, files: { 'keys.af2d.json': text } })
    await userEvent.click(await screen.findByRole('button', { name: /^(keys\.af2d\.json)/ }))
    const panel = await screen.findByRole('dialog', { name: 'keys.af2d.json does not open' })
    const places = [...panel.querySelectorAll('.where')].map((where) => where.textContent)
    expect(places).toEqual(['extra', 'more'])
  })

  it('dispose waits until an open document has written its journal', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    await workspace.store.write('mossgate.af2d.json', printProject(mossgate()))
    clock.advance(1000)
    // An autosave newer than the file, so Restore leaves an edit the journal has to keep.
    const earlier = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
    const first = await earlier.open('mossgate.af2d.json')
    if (first.status !== 'opened') throw new Error(first.status)
    first.document.history.apply('Rename', (value) => ({ ...(value as Project), name: 'Renamed' }))
    clock.advance(1000)
    await first.document.session.flush()
    first.document.dispose()

    let hold = false
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const write = workspace.journal.write.bind(workspace.journal)
    const journal = {
      ...workspace.journal,
      write: async (...args: Parameters<typeof write>) => {
        if (hold) await gate
        return write(...args)
      },
    }
    const target = document.body.appendChild(document.createElement('div'))
    const handle = await startEditor(target, {
      window: fakeWindow(1194, 834).view,
      document,
      clock,
      fillRandom: (bytes) => {
        crypto.getRandomValues(bytes)
      },
      workspace: { ...workspace, journal },
    })
    await userEvent.click(await screen.findByRole('button', { name: /^(Renamed|Mossgate)/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Restore edits' }))
    hold = true
    let done = false
    const disposing = handle.dispose().then(() => {
      done = true
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(done).toBe(false)
    release()
    await disposing
    expect(done).toBe(true)
  })

  it('dispose takes the editor off the page and lets go of the window', async () => {
    const { target, win, handle } = await boot()
    await screen.findByRole('list', { name: 'Levels' })
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
    const card = await screen.findByRole('button', { name: /^(Mossgate)/ })
    await waitFor(() =>
      expect(card.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA'),
    )
    await handle.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
