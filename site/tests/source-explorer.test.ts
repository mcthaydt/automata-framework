import { fireEvent, render, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import { getExampleProject } from '../src/data/projects'
import SourceExplorer from '../src/lib/components/SourceExplorer.svelte'
import Home from '../src/routes/+page.svelte'
import { homeData } from './helpers/page-data'

describe('Project source explorers', () => {
  it('switches actual files and copies the selected content', async () => {
    const view = render(SourceExplorer, { props: { project: getExampleProject('hot-reload')! } })
    expect(view.getByRole('navigation', { name: 'Project files' })).toBeTruthy()
    await fireEvent.click(
      view.getByRole('button', { name: 'Open examples/2d/content/hot-reload/package.json' }),
    )
    const region = view.getByRole('region', { name: 'examples/2d/content/hot-reload/package.json' })
    expect(region.textContent).toContain('"dev": "vite')
    const copy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
    await fireEvent.click(view.getByRole('button', { name: 'Copy code' }))
    expect(copy.mock.calls[0][0]).toContain('"dev": "vite')
    await view.rerender({ project: getExampleProject('primitives')! })
    expect(view.getByRole('region', { name: 'examples/2d/ui/primitives/main.ts' })).toBeTruthy()
    expect(
      view.queryByRole('button', { name: 'Open examples/2d/content/hot-reload/package.json' }),
    ).toBeNull()
  })

  it('supports the phone file picker and exposes shared starter files', async () => {
    const view = render(SourceExplorer, { props: { project: getExampleProject('hot-reload')! } })
    await fireEvent.change(view.getByLabelText('Choose a file'), {
      target: { value: 'examples/2d/content/hot-reload/room.schema.ts' },
    })
    expect(
      view.getByRole('region', { name: 'examples/2d/content/hot-reload/room.schema.ts' }).textContent,
    ).toContain('export')
    expect(view.getByText('pnpm --filter @af-examples/content-hot-reload dev')).toBeTruthy()
  })

  it('connects the homepage explanations to actual simulation, rendering and wiring files', async () => {
    const view = render(Home, { props: { data: homeData } })
    await fireEvent.click(view.getByRole('button', { name: 'Simulation' }))
    expect(
      view.getByRole('region', { name: 'games/emberwick/src/features/player/player-move.system.ts' })
        .textContent,
    ).toContain('defineSystem')
    await fireEvent.click(view.getByRole('button', { name: 'Presentation' }))
    expect(
      view.getByRole('region', { name: 'games/emberwick/src/features/scene/scene-renderer.ts' }).textContent,
    ).toContain('export')
    await fireEvent.click(view.getByRole('button', { name: 'Wiring' }))
    const region = view.getByRole('region', { name: 'games/emberwick/src/app/make-game.ts' })
    // Once the code is highlighted, `defineGame` is in two tokens (the import and the call), so ask for all of them.
    expect(within(region).getAllByText(/defineGame/).length).toBeGreaterThan(0)
  })
})
