// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AddTilesDialog from '#src/features/tiles/AddTilesDialog.svelte'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import type { TilesetDef } from '#src/shared/level-2d/model/project-types.ts'

// Add tiles (plan 12.3b): choose a picture, say how big one tile is, see the grid, and Add tiles writes the picture
// into the game and adds the tileset. The picture's size comes from `measure` (a browser decodes it; jsdom cannot).

function mount(
  options: {
    size?: { w: number; h: number }
    onadd?: (def: TilesetDef) => { ok: true } | { ok: false; message: string }
  } = {},
) {
  const store = createMemoryStore({ now: () => 1 })
  const onadd = vi.fn(options.onadd ?? (() => ({ ok: true }) as const))
  render(AddTilesDialog, {
    open: true,
    taken: ['terrain'],
    files: store,
    measure: async () => options.size ?? { w: 128, h: 64 },
    onadd,
  })
  return { store, onadd }
}

const picture = (name = 'Forest Tiles.png') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })
const choose = async (file = picture()) => userEvent.upload(screen.getByLabelText('Choose a picture'), file)
const addButton = () => screen.getByRole('button', { name: 'Add tiles' })

describe('Add tiles', () => {
  it('asks for a picture and a tile size, and waits for the picture before Add tiles', async () => {
    mount()
    expect(screen.getByRole('dialog', { name: 'Add tiles' })).toBeInTheDocument()
    expect(screen.getByText('How big is one tile?')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Tile size' })).toHaveAttribute('aria-valuenow', '16')
    expect(addButton()).toBeDisabled()
  })

  it('shows the picture with its grid and the count in words, then Add tiles is ready', async () => {
    mount()
    await choose()
    expect(await screen.findByText('This makes 32 tiles.')).toBeInTheDocument()
    expect(screen.getByTestId('add-tiles-preview')).toHaveAttribute('data-grid', '8x4')
    expect(addButton()).toBeEnabled()
  })

  it('a size that does not fit says so in plain words and keeps Add tiles waiting', async () => {
    mount({ size: { w: 40, h: 40 } })
    await choose()
    expect(
      await screen.findByText('The picture is 40 px wide; 16 px tiles leave 8 px over. Try 10 or 20.'),
    ).toBeInTheDocument()
    expect(addButton()).toBeDisabled()
    await userEvent.click(screen.getByRole('spinbutton', { name: 'Tile size' }))
    const size = await screen.findByLabelText('Tile size', { selector: 'input' })
    await userEvent.clear(size)
    await userEvent.type(size, '8{Enter}')
    expect(await screen.findByText('This makes 25 tiles.')).toBeInTheDocument()
    expect(addButton()).toBeEnabled()
  })

  it('writes the picture into the game, adds the tileset and closes', async () => {
    const { store, onadd } = mount()
    await choose()
    await screen.findByText('This makes 32 tiles.')
    await userEvent.click(addButton())
    await vi.waitFor(() => expect(onadd).toHaveBeenCalledOnce())
    expect(await store.read('assets/forest-tiles.png')).toEqual(new Uint8Array([1, 2, 3]))
    expect(onadd.mock.calls[0]?.[0]).toMatchObject({
      id: 'forest-tiles',
      label: 'Forest tiles',
      image: 'assets/forest-tiles.png',
      imageSize: { w: 128, h: 64 },
      tile: { w: 16, h: 16 },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a write that fails says so, adds nothing and stays open', async () => {
    const { store, onadd } = mount()
    store.write = async () => ({ ok: false, reason: 'quota', message: 'The disk is full.' })
    await choose()
    await screen.findByText('This makes 32 tiles.')
    await userEvent.click(addButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t add the picture. The disk is full.')
    expect(onadd).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // Build audit G1: a game that does not allow pictures says what is true, never a path or the word "policy".
  it('a game that does not allow pictures says so in plain words', async () => {
    const { store, onadd } = mount()
    store.write = async () => ({
      ok: false,
      reason: 'policy',
      message: 'assets/my-tiles.png is not one the editor may write',
    })
    await choose()
    await screen.findByText('This makes 32 tiles.')
    await userEvent.click(addButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This game doesn’t let the editor save pictures yet.')
    expect(alert).not.toHaveTextContent('assets/')
    expect(onadd).not.toHaveBeenCalled()
  })

  it('asks for one tile size, not two controls for the same number', async () => {
    mount()
    await choose()
    await screen.findByText('This makes 32 tiles.')
    expect(screen.getAllByRole('spinbutton').length + screen.queryAllByRole('radio').length).toBe(1)
  })

  it('a picture that cannot be read says so', async () => {
    const store = createMemoryStore({ now: () => 1 })
    render(AddTilesDialog, {
      open: true,
      taken: [],
      files: store,
      measure: async () => undefined,
      onadd: () => ({ ok: true }),
    })
    await choose()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file isn’t a picture we can read. Try a PNG, WebP or JPEG.',
    )
    expect(addButton()).toBeDisabled()
  })

  it('shows no format word, path or "tileset" on screen', async () => {
    mount()
    await choose()
    await screen.findByText('This makes 32 tiles.')
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).not.toMatch(/tileset|assets\/|\.png|IntGrid/i)
  })
})
