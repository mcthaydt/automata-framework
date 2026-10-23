import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ShellFixture from '../testing/ShellFixture.svelte'
import { type ResizableGeometry, stubGeometry } from '../testing/stub-geometry.svelte'

const regions = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-region]')]
const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
// Svelte sets `inert` as a property, which a browser reflects to the attribute; jsdom keeps the property alone.
const isInert = (element: HTMLElement): boolean => element.inert
const mount = (width: number, height: number, props: Record<string, unknown> = {}) => {
  const geometry = stubGeometry(width, height)
  render(ShellFixture, { geometry, ...props })
  return geometry
}

describe('EditorShell structure', () => {
  it('is one root that names its mode and where the dock sits', () => {
    mount(1194, 834)
    const roots = document.querySelectorAll('[data-editor-shell]')
    expect(roots).toHaveLength(1)
    expect(roots[0]).toHaveAttribute('data-mode', 'wide')
    expect(roots[0]).toHaveAttribute('data-dock', 'inline')
    expect(roots[0]).toHaveAttribute('data-testid', 'shell')
  })

  it.each([
    [1194, 834],
    [834, 1194],
    [390, 844],
  ])('keeps every region in the DOM in the same order at %d x %d', (width, height) => {
    mount(width, height)
    expect(regions().map((r) => r.dataset.region)).toEqual([
      'topbar',
      'rail',
      'panel',
      'canvas',
      'inspector',
      'dock',
      'status',
    ])
  })

  it('declares the panel, inspector and dock bodies scroll regions and the canvas none', () => {
    mount(1194, 834)
    for (const name of ['panel', 'inspector', 'dock']) {
      expect(region(name).querySelector('[data-scroll-region]')).not.toBeNull()
    }
    expect(region('canvas').querySelector('[data-scroll-region]')).toBeNull()
  })

  it('tells the rail which way to draw: vertical in wide, horizontal below it', async () => {
    const geometry = mount(1194, 834)
    expect(screen.getByTestId('rail')).toHaveAttribute('data-orientation', 'vertical')
    geometry.resize(834, 1194)
    expect(await screen.findByTestId('rail')).toHaveAttribute('data-orientation', 'horizontal')
    geometry.resize(390, 844)
    expect(await screen.findByTestId('rail')).toHaveAttribute('data-orientation', 'horizontal')
  })
})

describe('EditorShell presentation per mode', () => {
  it('wide: panel, inspector and an inline dock are all in view', () => {
    mount(1194, 834)
    for (const name of ['panel', 'inspector', 'dock']) {
      expect(region(name)).toHaveAttribute('data-presentation', 'inline')
      expect(region(name)).toHaveAttribute('data-open', 'true')
      expect(isInert(region(name))).toBe(false)
    }
  })

  it('wide but short (900 x 600): the dock is a closed sheet, panel and inspector stay inline', () => {
    mount(900, 600)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-dock', 'sheet')
    expect(region('dock')).toHaveAttribute('data-presentation', 'sheet')
    expect(region('dock')).toHaveAttribute('data-open', 'false')
    expect(region('panel')).toHaveAttribute('data-presentation', 'inline')
  })

  it('medium: panel and inspector are closed drawers, the dock a sheet at peek', () => {
    mount(834, 1194)
    expect(region('panel')).toHaveAttribute('data-presentation', 'drawer')
    expect(region('inspector')).toHaveAttribute('data-presentation', 'drawer')
    expect(region('dock')).toHaveAttribute('data-presentation', 'sheet')
    expect(region('dock')).toHaveAttribute('data-open', 'true')
    expect(region('dock')).toHaveAttribute('data-detent', 'peek')
  })

  it('compact: all three are sheets and all start closed', () => {
    mount(390, 844)
    for (const name of ['panel', 'inspector', 'dock']) {
      expect(region(name)).toHaveAttribute('data-presentation', 'sheet')
      expect(region(name)).toHaveAttribute('data-open', 'false')
    }
  })

  it('a rail below wide is a tab bar', () => {
    mount(834, 1194)
    expect(region('rail')).toHaveAttribute('data-presentation', 'tabbar')
  })
})

describe('EditorShell drawers and sheets', () => {
  it('a closed drawer is inert; opening it from the top bar makes it live', async () => {
    mount(834, 1194)
    expect(isInert(region('panel'))).toBe(true)
    expect(region('panel')).toHaveAttribute('data-open', 'false')
    await userEvent.click(screen.getByTestId('toggle-panel'))
    expect(region('panel')).toHaveAttribute('data-open', 'true')
    expect(isInert(region('panel'))).toBe(false)
    expect(screen.getByTestId('open-state')).toHaveTextContent('panel:true')
  })

  it('drawers have no handle: they open beside the canvas, they are not resized', async () => {
    mount(834, 1194, { panelOpen: true })
    expect(region('panel').querySelector('[data-sheet-handle]')).toBeNull()
  })

  it('a sheet has a handle that steps peek, half, full and back, and says whether it is expanded', async () => {
    mount(390, 844, { dockOpen: true })
    const handle = region('dock').querySelector<HTMLButtonElement>('[data-sheet-handle]')
    if (handle === null) throw new Error('no handle')
    expect(handle).toHaveAccessibleName('Resize dock')
    expect(region('dock')).toHaveAttribute('data-detent', 'peek')
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(handle)
    expect(region('dock')).toHaveAttribute('data-detent', 'half')
    expect(handle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(handle)
    expect(region('dock')).toHaveAttribute('data-detent', 'full')
    await userEvent.click(handle)
    expect(region('dock')).toHaveAttribute('data-detent', 'peek')
    expect(handle).toHaveAttribute('aria-expanded', 'false')
  })

  it('the handle works from the keyboard', async () => {
    mount(390, 844, { panelOpen: true })
    const handle = region('panel').querySelector<HTMLButtonElement>('[data-sheet-handle]')
    if (handle === null) throw new Error('no handle')
    expect(handle).toHaveAccessibleName('Resize panel')
    handle.focus()
    await userEvent.keyboard('{Enter}')
    expect(region('panel')).toHaveAttribute('data-detent', 'full')
    await userEvent.keyboard(' ')
    expect(region('panel')).toHaveAttribute('data-detent', 'peek')
  })

  it('in compact one sheet is open at a time: opening the inspector closes the panel', async () => {
    mount(390, 844)
    await userEvent.click(screen.getByTestId('toggle-panel'))
    expect(region('panel')).toHaveAttribute('data-open', 'true')
    await userEvent.click(screen.getByTestId('toggle-inspector'))
    expect(region('inspector')).toHaveAttribute('data-open', 'true')
    expect(region('panel')).toHaveAttribute('data-open', 'false')
    expect(screen.getByTestId('open-state')).toHaveTextContent('panel:false inspector:true')
  })

  it('in medium both drawers can be open together', async () => {
    mount(834, 1194)
    await userEvent.click(screen.getByTestId('toggle-panel'))
    await userEvent.click(screen.getByTestId('toggle-inspector'))
    expect(region('panel')).toHaveAttribute('data-open', 'true')
    expect(region('inspector')).toHaveAttribute('data-open', 'true')
  })

  it('a sheet at full height shows a scrim that closes it', async () => {
    mount(390, 844, { panelOpen: true })
    expect(document.querySelector('[data-scrim]')).toBeNull()
    const handle = region('panel').querySelector<HTMLButtonElement>('[data-sheet-handle]')
    if (handle === null) throw new Error('no handle')
    await userEvent.click(handle)
    expect(region('panel')).toHaveAttribute('data-detent', 'full')
    const scrim = document.querySelector<HTMLElement>('[data-scrim]')
    expect(scrim).not.toBeNull()
    await userEvent.click(scrim as HTMLElement)
    expect(region('panel')).toHaveAttribute('data-open', 'false')
    expect(document.querySelector('[data-scrim]')).toBeNull()
  })

  it('the dock toggled from the top bar opens and closes where it sits', async () => {
    mount(900, 600)
    expect(region('dock')).toHaveAttribute('data-open', 'false')
    await userEvent.click(screen.getByTestId('toggle-dock'))
    expect(region('dock')).toHaveAttribute('data-open', 'true')
    await userEvent.click(screen.getByTestId('toggle-dock'))
    expect(region('dock')).toHaveAttribute('data-open', 'false')
  })
})

describe('EditorShell when the size changes', () => {
  async function turn(geometry: ResizableGeometry, width: number, height: number) {
    geometry.resize(width, height)
    // the mode attribute is the shell's own answer to the new size
    await screen.findByTestId('shell')
  }

  it('keeps the same canvas element, and the focus and text in a field inside it, through every mode', async () => {
    const geometry = mount(1194, 834)
    const canvas = region('canvas')
    const field = screen.getByTestId('canvas-field') as HTMLInputElement
    await userEvent.click(field)
    await userEvent.keyboard('Rooftops')
    expect(field).toHaveFocus()

    await turn(geometry, 834, 1194)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
    expect(region('canvas')).toBe(canvas)
    expect(screen.getByTestId('canvas-field')).toBe(field)
    expect(field).toHaveFocus()

    await turn(geometry, 390, 844)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'compact')
    expect(region('canvas')).toBe(canvas)
    expect(screen.getByTestId('canvas-field')).toBe(field)
    expect(field).toHaveFocus()
    expect(field.value).toBe('Rooftops')
  })

  it('keeps the panel and its field mounted, with what was typed, when it turns from a drawer into an inline panel', async () => {
    const geometry = mount(834, 1194, { panelOpen: true })
    const field = screen.getByTestId('panel-field') as HTMLInputElement
    await userEvent.click(field)
    await userEvent.keyboard('mid')
    await turn(geometry, 1194, 834)
    expect(screen.getByTestId('panel-field')).toBe(field)
    expect(field).toHaveFocus()
    expect(field.value).toBe('mid')
    expect(region('panel')).toHaveAttribute('data-presentation', 'inline')
  })

  it('turning into compact leaves only one of two open drawers open', async () => {
    const geometry = mount(834, 1194, { panelOpen: true, inspectorOpen: true })
    await turn(geometry, 390, 844)
    const open = ['panel', 'inspector', 'dock'].filter((name) => region(name).dataset.open === 'true')
    expect(open).toEqual(['panel'])
  })
})
