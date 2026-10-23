import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Examples from '../src/routes/examples/+page.svelte'
import Home from '../src/routes/+page.svelte'
import { examplesData, homeData } from './helpers/page-data'

describe('Project source explorers', () => {
  it('switches actual files and copies the selected content', async () => {
    const view = render(Examples, { props: { data: examplesData('renderer-2d') } })
    expect(view.getByRole('navigation', { name: 'Project files' })).toBeTruthy()
    await fireEvent.click(view.getByRole('button', { name: 'Open examples/render-pixi/renderer-2d/package.json' }))
    const region = view.getByRole('region', { name: 'examples/render-pixi/renderer-2d/package.json' })
    expect(region.textContent).toContain('"dev": "vite"')
    const copy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
    await fireEvent.click(view.getByRole('button', { name: 'Copy code' }))
    expect(copy.mock.calls[0][0]).toContain('"dev": "vite"')
    await view.rerender({ data: examplesData('ui-primitives') })
    expect(view.getByRole('region', { name: 'examples/ui/primitives/main.ts' })).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Open examples/render-pixi/renderer-2d/package.json' })).toBeNull()
  })

  it('supports the phone file picker and exposes shared starter files', async () => {
    const view = render(Examples, { props: { data: examplesData('bodies-2d') } })
    await fireEvent.change(view.getByLabelText('Choose a file'), { target: { value: 'games/emberwick/src/play-room.ts' } })
    expect(view.getByRole('region', { name: 'games/emberwick/src/play-room.ts' }).textContent).toContain('createPlay')
    expect(view.getByText('pnpm --filter @af-examples/physics-bodies-2d dev')).toBeTruthy()
  })

  it('connects the homepage explanations to actual simulation, rendering and wiring files', async () => {
    const view = render(Home, { props: { data: homeData } })
    await fireEvent.click(view.getByRole('button', { name: 'Simulation' }))
    expect(view.getByRole('region', { name: 'games/emberwick/src/sim/player-move.system.ts' }).textContent).toContain('defineSystem')
    await fireEvent.click(view.getByRole('button', { name: 'Presentation' }))
    expect(view.getByRole('region', { name: 'games/emberwick/src/render/renderer.ts' }).textContent).toContain('createRenderer')
    await fireEvent.click(view.getByRole('button', { name: 'Wiring' }))
    const region = view.getByRole('region', { name: 'games/emberwick/src/play-room.ts' })
    expect(region.textContent).toContain('createLoop')
    // Once the code is highlighted, `createLoop` is in two tokens (the import and the call), so ask for all of them.
    expect(within(region).getAllByText(/createLoop/).length).toBeGreaterThan(0)
  })
})
