import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PauseScreen from './PauseScreen.svelte'

// PRODUCT.6: pause is a dialog over the dimmed game: Resume (primary, focused), Mute, Settings and Quit, which asks first because the
// run is lost. Escape steps back one level: from the confirm to the menu, from the menu to resuming. The words are core's `paused` copy.

afterEach(cleanup)
const COPY = {
  title: 'Paused',
  resume: 'Resume',
  back: 'Back',
  mute: 'Mute',
  unmute: 'Unmute',
  settings: 'Settings',
  quit: 'Quit to title',
  quitPrompt: 'Quit to the title? This run is lost.',
  quitConfirm: 'Quit',
  cancel: 'Cancel',
  reconnect: 'Reconnect your controller',
}
const props = (over: Record<string, unknown> = {}) => ({
  copy: COPY,
  muted: false,
  onResume: () => {},
  onQuit: () => {},
  onSettings: () => {},
  onMute: () => {},
  ...over,
})

describe('PauseScreen', () => {
  it('shows the menu with Resume focused as the primary', () => {
    render(PauseScreen, props())
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument()
    expect(screen.getByTestId('resume')).toHaveFocus()
    for (const name of ['Mute', 'Settings', 'Quit to title'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('resumes, and opens Settings', async () => {
    const onResume = vi.fn()
    const onSettings = vi.fn()
    render(PauseScreen, props({ onResume, onSettings }))
    await fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await fireEvent.click(screen.getByTestId('resume'))
    expect(onSettings).toHaveBeenCalledOnce()
    expect(onResume).toHaveBeenCalledOnce()
  })

  it('toggles Mute and says which way it went', async () => {
    const onMute = vi.fn()
    render(PauseScreen, props({ onMute }))
    await fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(onMute).toHaveBeenCalledExactlyOnceWith(true)
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts muted when the game is muted', () => {
    render(PauseScreen, props({ muted: true }))
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument()
  })

  it('asks before quitting, and cancel returns to the menu with Quit focused', async () => {
    const onQuit = vi.fn()
    render(PauseScreen, props({ onQuit }))
    await fireEvent.click(screen.getByRole('button', { name: 'Quit to title' }))
    expect(screen.getByText('Quit to the title? This run is lost.')).toBeInTheDocument()
    expect(onQuit).not.toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Quit to title' })).toHaveFocus())
    await fireEvent.click(screen.getByRole('button', { name: 'Quit to title' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(onQuit).toHaveBeenCalledOnce()
  })

  it('steps back one level on Escape: confirm to menu, menu to resume', async () => {
    const onResume = vi.fn()
    render(PauseScreen, props({ onResume }))
    await fireEvent.click(screen.getByRole('button', { name: 'Quit to title' }))
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('resume')).toBeInTheDocument()
    expect(onResume).not.toHaveBeenCalled()
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onResume).toHaveBeenCalledOnce()
  })

  it('says to reconnect the controller when play paused because it was unplugged', () => {
    render(PauseScreen, props({ reconnect: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Reconnect your controller')
  })
})
