// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Palette from '#src/features/level/Palette.svelte'
import type { PaletteItem } from '#src/shared/level-2d/tiles/palette-model.ts'

// The palette's tile pictures (plan ED2D.4c4a decision 5): a tile is a 44 px CSS sprite of its tileset image once the
// image has a URL, and its number on the placeholder colour until then.

const tile: PaletteItem = {
  kind: 'tile',
  word: 10,
  tile: 9,
  label: 'Tile 9',
  color: '#8a6d5a',
  image: { path: 'assets/terrain.png', size: { w: 128, h: 128 }, frame: { x: 16, y: 16, w: 16, h: 16 } },
}

function mount(url: string | undefined) {
  const onchoose = vi.fn()
  render(Palette, {
    layer: 'Decor',
    items: [tile],
    word: 0,
    entityDef: undefined,
    imageUrl: () => url,
    onchoose,
  })
  return { onchoose, cell: screen.getByRole('radio', { name: 'Tile 9' }) }
}

describe('Palette tiles', () => {
  it('cuts the tile out of the image, scaled to the 44 px cell', () => {
    const { cell } = mount('blob:terrain')
    expect(cell.style.backgroundImage).toBe('url("blob:terrain")')
    // 44 / 16 = 2.75: the 128 px image at 352 px, the tile at (16, 16) moved to the cell's corner.
    expect(cell.style.backgroundSize).toBe('352px 352px')
    expect(cell.style.backgroundPosition).toBe('-44px -44px')
    expect(cell).toHaveTextContent('')
  })

  it('shows the number on the placeholder colour while the image is not read', () => {
    const { cell } = mount(undefined)
    expect(cell).toHaveTextContent('9')
    expect(cell.style.backgroundImage).toBe('')
  })

  it('reports the choice', async () => {
    const { cell, onchoose } = mount(undefined)
    await userEvent.click(cell)
    expect(onchoose).toHaveBeenCalledWith(tile)
  })
})
