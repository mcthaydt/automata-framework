import { cleanup, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import depotText from '../testing/fixtures/depot.af-sector.json?raw'
import { createTestClock, memoryWorkspace, textOf } from '../testing/memory-workspace'
import { type EditorEnv, type EditorHandle, startEditor } from './boot'
import type { PlanRendererFactory } from './plan/plan-renderer'

// The 3D editor's boot and its journeys (plan ED3D.5c step 9): a function of its environment, so a test hands it a
// window, a document, a clock and a workspace and gets the real app. Home, the error panel, a level in the frame, the
// lifecycle while a level is open, and an import. The flows that need an edit are the frame's tests: until ED3D.5d no
// view edits a level.

type Listener = () => void

function fakeWindow(width: number, height: number) {
  const listeners = new Map<string, Set<Listener>>()
  const view = {
    innerWidth: width,
    innerHeight: height,
    addEventListener(type: string, listener: Listener): void {
      const set = listeners.get(type) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: Listener): void {
      listeners.get(type)?.delete(listener)
    },
  }
  return { view, count: (type: string): number => listeners.get(type)?.size ?? 0 }
}

const DEPOT = 'depot/depot.json'
// Imported as text, not read through `node:fs`: the component tests run under Vite's module URLs.
const DEPOT_TEXT = depotText

let started: EditorHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  cleanup()
  document.body.replaceChildren()
  delete document.documentElement.dataset.formFactor
})

async function boot(
  files: Record<string, string> = { [DEPOT]: DEPOT_TEXT },
  renderer: PlanRendererFactory = async () => undefined,
) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  for (const [path, text] of Object.entries(files)) {
    clock.advance(1000)
    await workspace.store.write(path, text)
  }
  const target = document.createElement('div')
  document.body.append(target)
  const win = fakeWindow(1194, 834)
  const env: EditorEnv = { window: win.view, document, clock, workspace, renderer }
  started = await startEditor(target, env)
  return { workspace, clock, win, file: async (path = DEPOT) => textOf(await workspace.store.read(path)) }
}

async function openDepot(): Promise<void> {
  await userEvent.dblClick(await screen.findByRole('option', { name: /depot\.json/ }))
  await screen.findByTestId('document-bar')
}

describe('startEditor', () => {
  it('shows Home with the workspace’s levels and the two imports', async () => {
    await boot({ [DEPOT]: DEPOT_TEXT, 'art/pier/pier.json': DEPOT_TEXT })
    expect(await screen.findByRole('option', { name: /depot\.json/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /pier\.json/ })).toHaveTextContent('af-sector')
    expect(screen.getByLabelText('Import folder…')).toHaveAttribute('webkitdirectory')
    expect(screen.getByLabelText('Import zip…')).toHaveAttribute('accept', '.zip,application/zip')
  })

  it('journey: a file that does not open shows the error panel with its JSON paths; Open another returns to Home', async () => {
    const { workspace, file } = await boot({
      'newer.json': DEPOT_TEXT.replace('"af-sector/1"', '"af-sector/2"'),
    })
    const before = (await workspace.store.list())[0]?.mtime
    await userEvent.dblClick(await screen.findByRole('option', { name: /newer\.json/ }))
    const panel = await screen.findByRole('dialog', { name: 'newer.json does not open' })
    expect(within(panel).getByRole('listitem')).toHaveTextContent(
      'format af-sector/2 is not a version this editor reads (af-sector/1)',
    )
    await userEvent.click(within(panel).getByRole('button', { name: 'Open another' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('listbox', { name: 'Projects' })).toBeInTheDocument()
    expect((await workspace.store.list())[0]?.mtime).toBe(before)
    expect(await file('newer.json')).toBe(DEPOT_TEXT.replace('"af-sector/1"', '"af-sector/2"'))
  })

  it('journey: open a level, the frame heads it, Back returns to Home with its selection', async () => {
    await boot()
    await openDepot()
    expect(screen.getByRole('heading', { level: 1, name: 'depot.json' })).toBeInTheDocument()
    expect(screen.getByText('af-sector')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('option', { name: /depot\.json/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('journey: an opened level’s plan asks the page’s renderer for its canvas once it has a size (ED3D.5d)', async () => {
    // Every observer in the page (the shell measures its foot too) hears the size, as a real one would.
    const observed: (() => void)[] = []
    const measure = (): void => {
      for (const run of observed) run()
    }
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly run: ResizeObserverCallback) {}
        observe(): void {
          observed.push(() =>
            this.run([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this as never),
          )
        }
        disconnect(): void {}
      },
    )
    const renderer = vi.fn<PlanRendererFactory>(async () => undefined)
    await boot(undefined, renderer)
    await openDepot()
    expect(screen.getByRole('application', { name: 'Plan' })).toBeInTheDocument()
    measure()
    await vi.waitFor(() => expect(renderer).toHaveBeenCalledOnce())
    expect(await screen.findByText(/needs WebGL2/)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('journey: the page lifecycle is listened to while a level is open, and let go after Back', async () => {
    const { win } = await boot()
    await openDepot()
    expect(win.count('pagehide')).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('listbox', { name: 'Projects' })
    expect(win.count('pagehide')).toBe(0)
  })

  it('journey: importing a zip lists what it brought and selects it', async () => {
    await boot({})
    expect(await screen.findByText('Import a folder or a zip to start.')).toBeInTheDocument()
    const zip = zipSync({ 'pier/pier.json': strToU8(DEPOT_TEXT) })
    await userEvent.upload(screen.getByLabelText('Import zip…'), new File([zip], 'pier.zip'))
    expect(await screen.findByText('Imported 1 file into pier.')).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: /pier\.json/ })).toHaveAttribute('aria-selected', 'true')
  })
})
