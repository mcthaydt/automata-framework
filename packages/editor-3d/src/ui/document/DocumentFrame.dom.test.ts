import { createToasts } from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createDocumentController, type DocumentController } from '../../app/document/document-controller'
import { createEditorApp } from '../../app/editor-app'
import type { OpenLevel } from '../../app/open-level'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { createTestClock, memoryWorkspace, textOf } from '../../testing/memory-workspace'
import DocumentFrame from './DocumentFrame.svelte'

// The frame of an open level (plan ED3D.5c step 9): its top bar, the save flows' dialogs (the held Save of ED3-o, the
// conflict of ED3-k, Restore) and the toasts, over the real document controller. The level is edited through its
// history, as the Plan view will do from ED3D.5d.

const PATH = 'depot/depot.json'
const DEPOT = depotText
const page = () => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function setup(options: { width?: number; height?: number; journal?: boolean } = {}) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PATH, DEPOT)
  clock.advance(1000)
  const app = createEditorApp({ workspace, clock })
  const toasts = createToasts({ clock })
  const open = async (): Promise<DocumentController> => {
    const outcome = await app.open(PATH)
    if (outcome.status !== 'opened') throw new Error('expected the depot to open')
    return createDocumentController({ app, opened: outcome, toasts, lifecycle: page() })
  }
  let controller = await open()
  if (options.journal === true) {
    edit(levelOf(controller), 'light', 0.5)
    await controller.close()
    controller = await open()
  }
  const onback = vi.fn()
  render(DocumentFrame, {
    geometry: stubGeometry(options.width ?? 1194, options.height ?? 834),
    controller,
    toasts,
    clock,
    renderer: async () => undefined,
    dollhouse: async () => undefined,
    schedule: (_delay: number, run: () => void) => {
      run()
      return () => undefined
    },
    onback,
  })
  return { clock, workspace, controller, onback, file: async () => textOf(await workspace.store.read(PATH)) }
}

function levelOf(controller: DocumentController): OpenLevel {
  let level: OpenLevel | undefined
  controller.state.subscribe((state) => (level = state.level))()
  if (level === undefined) throw new Error('no level')
  return level
}

function edit(level: OpenLevel, member: 'light' | 'floor', value: number): void {
  level.editor.history.apply(`Set ${member}`, (state) => {
    const next = structuredClone(state.level) as { sectors: Record<string, unknown>[] }
    const hall = next.sectors[0]
    if (hall === undefined) throw new Error('the depot has no hall')
    hall[member] = value
    return { level: next }
  })
}

describe('DocumentFrame', () => {
  it('heads the level and puts the plan, its layers, the views and the checks around it (ED3D.5d)', async () => {
    await setup()
    expect(screen.getByRole('heading', { level: 1, name: 'depot.json' })).toHaveFocus()
    expect(screen.getByRole('application', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('checks-pill')).toHaveTextContent(/No problems|warning|problem/)
    expect(screen.getByText(/Nothing selected/)).toBeInTheDocument()
  })

  it('shows the plan and the 3D view side by side in Split, and the 3D view alone in 3D (ED3D.5e)', async () => {
    await setup()
    await userEvent.click(screen.getByRole('radio', { name: 'Split' }))
    expect(screen.getByRole('application', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: '3D view' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '3D' }))
    expect(screen.queryByRole('application', { name: 'Plan' })).toBeNull()
    expect(screen.getByRole('application', { name: '3D view' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Plan' }))
    expect(screen.queryByRole('application', { name: '3D view' })).toBeNull()
  })

  it('shows the 3D view alone, not Split, below wide (ED3D spec §10: the 3D modes replace Plan)', async () => {
    const { controller } = await setup({ width: 834, height: 1194 })
    levelOf(controller).editor.view.set({ mode: 'split' })
    await waitFor(() => expect(screen.getByRole('application', { name: '3D view' })).toBeInTheDocument())
    expect(screen.queryByRole('application', { name: 'Plan' })).toBeNull()
  })

  it('hides and locks a layer through the panel, and names what is selected in the status line (ED3D.5d)', async () => {
    const { controller } = await setup()
    const level = levelOf(controller)
    await userEvent.click(screen.getByRole('button', { name: 'Hide Walls' }))
    expect(level.editor.view.state.hidden).toEqual(['walls'])
    expect(screen.getByRole('button', { name: 'Show Walls' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Lock Sectors' }))
    expect(level.editor.view.state.locked).toEqual(['sectors'])
    await userEvent.click(screen.getByRole('button', { name: 'Walls' }))
    expect(level.editor.view.state.layer).toBe('walls')
    level.editor.selection.set(['sector:hall'])
    expect(await screen.findByText(/Room hall selected/)).toBeInTheDocument()
  })

  it('Undo names the step after an edit, and Save writes the patched text', async () => {
    const { controller, file } = await setup()
    edit(levelOf(controller), 'light', 0.5)
    await userEvent.click(await screen.findByRole('button', { name: 'Undo Set light' }))
    expect(screen.getByRole('button', { name: 'Redo Set light' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Redo Set light' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect(await file()).toBe(DEPOT.replace('"light": 1,', '"light": 0.5,')))
  })

  it('Back goes to its owner', async () => {
    const { onback } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onback).toHaveBeenCalledOnce()
  })

  it('ED3-o: a change the patch cannot write holds Save with the path and reason; nothing is written; Export a copy downloads it', async () => {
    const { controller, file, workspace } = await setup()
    edit(levelOf(controller), 'floor', 1e21)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const held = await screen.findByRole('dialog', { name: 'depot.json can’t be saved as it is written' })
    expect(held).toHaveTextContent('sectors.0.floor')
    expect(await file()).toBe(DEPOT)
    await userEvent.click(within(held).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const again = await screen.findByRole('dialog', { name: 'depot.json can’t be saved as it is written' })
    expect(await file()).toBe(DEPOT)
    await userEvent.click(within(again).getByRole('button', { name: 'Export a copy' }))
    await waitFor(() => expect(workspace.downloads.map((download) => download.name)).toEqual(['depot.json']))
    expect(await screen.findByText('Exported a copy as depot.json.')).toBeInTheDocument()
  })

  it('ED3-o: Save reformatted writes the whole file', async () => {
    const { controller, file } = await setup()
    edit(levelOf(controller), 'floor', 1e21)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const held = await screen.findByRole('dialog', { name: 'depot.json can’t be saved as it is written' })
    await userEvent.click(within(held).getByRole('button', { name: 'Save reformatted' }))
    await waitFor(async () => expect(await file()).toContain('"floor": 1e+21'))
    expect(await screen.findByText('Saved depot.json reformatted.')).toBeInTheDocument()
  })

  it('ED3-k: a file changed behind the editor opens the conflict dialog and writes nothing until Keep mine', async () => {
    const { controller, file, workspace, clock } = await setup()
    edit(levelOf(controller), 'light', 0.5)
    clock.advance(1000)
    await workspace.store.write(PATH, DEPOT.replace('"light": 1,', '"light": 0.25,'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const conflict = await screen.findByRole('dialog', { name: 'depot.json changed since you opened it' })
    expect(await file()).toContain('"light": 0.25,')
    await userEvent.click(within(conflict).getByRole('button', { name: 'Keep mine' }))
    await waitFor(async () => expect(await file()).toContain('"light": 0.5,'))
  })

  it('offers an autosave newer than the file first, and Restore edits applies it as one step', async () => {
    await setup({ journal: true })
    const restore = await screen.findByRole('dialog', { name: 'Restore your unsaved work?' })
    expect(restore).toHaveTextContent('depot.json')
    await userEvent.click(within(restore).getByRole('button', { name: 'Restore edits' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo Restore autosave' })).toBeEnabled())
  })

  it('leaves the profile out of the bar on a phone', async () => {
    await setup({ width: 390, height: 844 })
    expect(within(screen.getByTestId('document-bar')).queryByText('af-sector')).toBeNull()
  })

  it('puts the checks words in the status line on a phone, where the bar has no room for the pill (ED3D.5d)', async () => {
    await setup({ width: 390, height: 844 })
    expect(screen.queryByTestId('checks-pill')).toBeNull()
    expect(screen.getByText(/(No problems|warning|problem).* · Nothing selected/)).toBeInTheDocument()
  })
})
