import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SectorOptions from './SectorOptions.svelte'

// The sector toolbar and the drawing's actions (plan ED3D.6g-a step 6; ED3D spec §5.3 flow 2, §9 `Draw a sector`):
// Polygon, Rectangle, Split and Merge; Undo point and Close sector while there are corners; the portal offers.

function mount(props: Partial<Record<string, unknown>> = {}) {
  const handlers = {
    onshape: vi.fn(),
    onundopoint: vi.fn(),
    onclose: vi.fn(),
    onaccept: vi.fn(),
    ondecline: vi.fn(),
    onacceptall: vi.fn(),
  }
  render(SectorOptions, { tool: 'polygon', corners: 0, offers: [], ...handlers, ...props })
  return handlers
}

describe('SectorOptions', () => {
  it('chooses the shape', async () => {
    const { onshape } = mount()
    expect(screen.getByRole('radio', { name: 'Polygon' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Merge' }))
    expect(onshape).toHaveBeenCalledWith('merge')
  })

  it('shows Undo point and Close sector only while there are corners, and Close is pressable with two (ED3-m)', async () => {
    const first = mount()
    expect(screen.queryByRole('button', { name: 'Close sector' })).toBeNull()
    first.onclose.mockClear()
    document.body.innerHTML = ''
    const { onclose, onundopoint } = mount({ corners: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Close sector' }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo point' }))
    expect(onclose).toHaveBeenCalledOnce()
    expect(onundopoint).toHaveBeenCalledOnce()
  })

  it('asks about each shared wall, and offers Accept all for more than one', async () => {
    const { onaccept, ondecline, onacceptall } = mount({
      offers: [
        { sector: 'sector-1', corner: 1, to: 'hall', toCorner: 3, length: 6 },
        { sector: 'sector-1', corner: 2, to: 'dock', toCorner: 0, length: 2.5 },
      ],
    })
    expect(screen.getByText('Shares a 6.00 m wall with hall. Make it a portal?')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Make portal' })[1] as HTMLElement)
    await userEvent.click(screen.getAllByRole('button', { name: 'Keep solid' })[0] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Portal on every shared wall' }))
    expect(onaccept).toHaveBeenCalledWith(1)
    expect(ondecline).toHaveBeenCalledWith(0)
    expect(onacceptall).toHaveBeenCalledOnce()
  })

  it('has no Accept all for one offer, and no shape choice while offers are open', () => {
    mount({ offers: [{ sector: 'sector-1', corner: 1, to: 'hall', toCorner: 3, length: 6 }] })
    expect(screen.queryByRole('button', { name: 'Portal on every shared wall' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute('aria-disabled', 'true')
  })
})
