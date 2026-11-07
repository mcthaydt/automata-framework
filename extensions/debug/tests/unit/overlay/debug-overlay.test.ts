// DB-a: in a dev build the overlay opens with the dev key and shows every component registered as a debug panel.
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DebugOverlay from '#src/features/overlay/DebugOverlay.svelte'
import { installDebug } from '#src/shared/host.ts'
import { PanelOne, PanelTwo, Throwing } from '#src/testing/panels.ts'

const panels = [
  { id: 'one', title: 'One', component: PanelOne },
  { id: 'two', title: 'Two', component: PanelTwo },
]
let dispose: (() => void) | undefined
afterEach(() => {
  cleanup()
  dispose?.()
  dispose = undefined
})
const open = async (): Promise<void> => {
  await fireEvent.keyDown(window, { key: '`' })
}

describe('DebugOverlay', () => {
  it('draws nothing while closed', () => {
    dispose = installDebug({ panels })
    render(DebugOverlay)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('opens on the dev key and lists a tab for every panel, the first shown', async () => {
    dispose = installDebug({ panels })
    render(DebugOverlay)
    await open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['One', 'Two'])
    expect(screen.getByText('panel one body')).toBeInTheDocument()
  })
  it('shows another panel when its tab is chosen', async () => {
    dispose = installDebug({ panels })
    render(DebugOverlay)
    await open()
    await fireEvent.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByText('panel two body')).toBeInTheDocument()
    expect(screen.queryByText('panel one body')).toBeNull()
  })
  it('opens on a three-finger tap and closes on Escape', async () => {
    dispose = installDebug({ panels })
    render(DebugOverlay)
    await fireEvent.touchStart(window, { touches: [{}, {}, {}] })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('sends the pause toggle through the host', async () => {
    const setPaused = vi.fn()
    dispose = installDebug({ panels, setPaused })
    render(DebugOverlay)
    await open()
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Pause the game' }))
    expect(setPaused).toHaveBeenCalledWith(true)
  })
  it('keeps the other panels working when one throws, and says which broke', async () => {
    dispose = installDebug({
      panels: [{ id: 'broken', title: 'Broken', component: Throwing }, ...panels],
    })
    render(DebugOverlay)
    await open()
    expect(await screen.findByRole('alert')).toHaveTextContent('this panel is broken')
    await fireEvent.click(screen.getByRole('tab', { name: 'One' }))
    expect(screen.getByText('panel one body')).toBeInTheDocument()
  })
  it('puts the panels in a labelled scroll region', async () => {
    dispose = installDebug({ panels })
    render(DebugOverlay)
    await open()
    expect(screen.getByRole('region', { name: 'Debug panel' })).toHaveAttribute('tabindex', '0')
  })
  it('draws nothing when no host is installed', async () => {
    render(DebugOverlay)
    await open()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
