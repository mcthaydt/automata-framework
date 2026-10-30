import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ShellFixture from '../testing/ShellFixture.svelte'
import { stubGeometry } from '../testing/stub-geometry.svelte'
import type { SnippetRegion } from './region-error'

// Kit spec §6: a widget that throws replaces only its own region with the error panel; the others stay usable.
const REGIONS: readonly SnippetRegion[] = ['topbar', 'rail', 'panel', 'canvas', 'inspector', 'dock', 'status']

/** One control the fixture puts in each region, so a test can tell the region's content is still there. */
const CONTENT: Record<SnippetRegion, string> = {
  topbar: 'toggle-panel',
  rail: 'rail-Stage',
  panel: 'panel-field',
  canvas: 'canvas-field',
  inspector: 'field-depth',
  dock: 'scene-floor 1',
  status: 'open-state',
}

const region = (name: SnippetRegion): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}

const mount = (width: number, height: number, broken: SnippetRegion, breaks: 'mount' | 'click' = 'mount') =>
  render(ShellFixture, { geometry: stubGeometry(width, height), broken, breaks })

/** The other regions still hold their content, and their controls still take input. */
async function expectOthersUsable(broken: SnippetRegion): Promise<void> {
  for (const other of REGIONS.filter((name) => name !== broken)) {
    expect(within(region(other)).getByTestId(CONTENT[other])).toBeInTheDocument()
    expect(region(other).querySelector('[data-region-error]')).toBeNull()
  }
  if (broken !== 'canvas') {
    await userEvent.type(screen.getByTestId('canvas-field'), 'Roof')
    expect(screen.getByTestId('canvas-field')).toHaveValue('Roof')
  }
  if (broken !== 'topbar' && broken !== 'status') {
    await userEvent.click(screen.getByTestId('toggle-inspector'))
    expect(screen.getByTestId('open-state')).toHaveTextContent('inspector:true')
  }
}

describe('EditorShell region boundaries', () => {
  it.each(REGIONS)('a widget that throws as the %s renders replaces only that region', async (broken) => {
    mount(1194, 834, broken)
    const panel = region(broken).querySelector<HTMLElement>('[data-region-error]') as HTMLElement
    expect(panel).toHaveAttribute('data-region-error', broken)
    expect(within(panel).getByRole('alert')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Copy details' })).toBeInTheDocument()
    expect(within(region(broken)).queryByTestId(CONTENT[broken])).toBeNull()
    expect(document.querySelectorAll('[data-region-error]')).toHaveLength(1)
    await expectOthersUsable(broken)
  })

  it.each(REGIONS)(
    'a widget in the %s that throws after a click replaces only that region',
    async (broken) => {
      mount(1194, 834, broken, 'click')
      expect(within(region(broken)).getByTestId(CONTENT[broken])).toBeInTheDocument()
      await userEvent.click(screen.getByTestId('break-it'))
      expect(within(region(broken)).getByRole('alert')).toBeInTheDocument()
      expect(region(broken).querySelector('[data-region-error]')).toHaveAttribute('data-region-error', broken)
      expect(within(region(broken)).queryByTestId(CONTENT[broken])).toBeNull()
      await expectOthersUsable(broken)
    },
  )

  it.each([
    ['topbar', 1194, 834, 'bar'],
    ['status', 1194, 834, 'bar'],
    ['rail', 1194, 834, 'block'],
    ['rail', 834, 1194, 'bar'],
    ['panel', 834, 1194, 'block'],
    ['canvas', 390, 844, 'block'],
  ] as const)('the %s at %d x %d shows the panel as a %s', (broken, width, height, layout) => {
    mount(width, height, broken)
    // A closed drawer is hidden from the accessibility tree, so this reads the panel by its attribute.
    expect(region(broken).querySelector('[data-region-error]')).toHaveAttribute('data-layout', layout)
  })

  it('keeps a broken sheet resizable: its handle sits outside the boundary', async () => {
    mount(390, 844, 'panel')
    await userEvent.click(screen.getByTestId('toggle-panel'))
    const panel = region('panel')
    expect(within(panel).getByRole('alert')).toBeInTheDocument()
    const handle = within(panel).getByRole('button', { name: 'Resize panel' })
    await userEvent.click(handle)
    expect(panel).toHaveAttribute('data-detent', 'full')
  })
})
