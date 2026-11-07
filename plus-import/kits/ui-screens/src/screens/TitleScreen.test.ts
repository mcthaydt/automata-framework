import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TitleScreen from './TitleScreen.svelte'

// PRODUCT.6: the title is the game's name, one primary Play, and any further actions the game adds (Settings, Credits).

afterEach(cleanup)
const props = (over: Record<string, unknown> = {}) => ({
  title: 'Moss Garden',
  copy: { play: 'Play' },
  onPlay: () => {},
  ...over,
})

describe('TitleScreen', () => {
  it('shows the title and a primary Play, focused', () => {
    render(TitleScreen, props())
    expect(screen.getByRole('heading', { name: 'Moss Garden' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('data-kind', 'primary')
  })

  it('plays', async () => {
    const onPlay = vi.fn()
    render(TitleScreen, props({ onPlay }))
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledOnce()
  })

  it('adds the game’s own actions after Play, and reports the one chosen', async () => {
    const onAction = vi.fn()
    render(
      TitleScreen,
      props({
        extra: [
          { id: 'settings', label: 'Settings' },
          { id: 'credits', label: 'Credits' },
        ],
        onAction,
      }),
    )
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
      'Play',
      'Settings',
      'Credits',
    ])
    await fireEvent.click(screen.getByRole('button', { name: 'Credits' }))
    expect(onAction).toHaveBeenCalledExactlyOnceWith('credits')
  })
})
