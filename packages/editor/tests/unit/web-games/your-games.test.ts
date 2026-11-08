// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NewGame from '#src/features/web-games/NewGame.svelte'
import { since } from '#src/features/web-games/since.ts'
import YourGames from '#src/features/web-games/YourGames.svelte'

const NOW = 10 * 60_000
const games = [
  { id: 'lantern-run', title: 'Lantern Run', changed: NOW - 5 * 60_000 },
  { id: 'old', title: 'Old Game', changed: NOW - 3 * 24 * 60 * 60_000, github: 'mcthaydt/old' },
]

function mount(extra: Record<string, unknown> = {}) {
  const calls = { open: vi.fn(), made: vi.fn(), copy: vi.fn(), imported: vi.fn(), remove: vi.fn() }
  render(YourGames, {
    games,
    now: NOW,
    kept: true,
    onopen: calls.open,
    onnew: calls.made,
    oncopy: calls.copy,
    onimport: calls.imported,
    onremove: calls.remove,
    ...extra,
  })
  return calls
}

describe('since', () => {
  it('says how long ago in words', () => {
    expect(since(NOW, NOW)).toBe('just now')
    expect(since(NOW - 60_000, NOW)).toBe('1 minute ago')
    expect(since(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago')
    expect(since(0, 2 * 3_600_000)).toBe('2 hours ago')
    expect(since(0, 3 * 24 * 3_600_000)).toBe('3 days ago')
  })
})

describe('Your games', () => {
  it('lists each game with its name, when it changed and where it is kept', () => {
    mount()
    expect(screen.getByText('Lantern Run')).toBeInTheDocument()
    expect(screen.getByText('Changed 5 minutes ago')).toBeInTheDocument()
    expect(screen.getByText('On this device')).toBeInTheDocument()
    expect(screen.getByText('On GitHub: mcthaydt/old')).toBeInTheDocument()
  })

  it('says the games are kept in this browser only, and how to keep one safe', () => {
    mount()
    expect(screen.getByText('Saved in this browser only. Save a copy to keep it safe.')).toBeInTheDocument()
  })

  it('names signing in with GitHub only where it is offered', () => {
    mount({ canSignIn: true })
    expect(
      screen.getByText('Saved in this browser only. Save a copy, or sign in with GitHub, to keep it safe.'),
    ).toBeInTheDocument()
  })

  it('says Not saved when the browser keeps nothing', () => {
    mount({ kept: false })
    expect(
      screen.getByText('Not saved: this browser can’t keep files. Save a copy to keep your work.'),
    ).toBeInTheDocument()
  })

  it('opens, copies and starts a new game through what it was given', async () => {
    const calls = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Open Lantern Run' }))
    expect(calls.open).toHaveBeenCalledWith('lantern-run')
    await userEvent.click(screen.getByRole('button', { name: 'Save a copy of Lantern Run' }))
    expect(calls.copy).toHaveBeenCalledWith('lantern-run')
    await userEvent.click(screen.getByRole('button', { name: 'New game' }))
    expect(calls.made).toHaveBeenCalled()
  })

  it('asks before it removes, and says a copy on GitHub stays', async () => {
    const calls = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Old Game' }))
    expect(screen.getByText(/Remove Old Game from this browser\?/)).toBeInTheDocument()
    expect(screen.getByText(/A copy on GitHub stays\./)).toBeInTheDocument()
    expect(calls.remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(calls.remove).toHaveBeenCalledWith('old')
  })

  it('keeps the game when the person says Keep it', async () => {
    const calls = mount()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Lantern Run' }))
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(calls.remove).not.toHaveBeenCalled()
  })

  it('hands a chosen .zip to Open a copy, and shows what went wrong in words', async () => {
    const calls = mount({ trouble: 'This isn’t an Automata game. Pick a .zip you saved from Automata.' })
    const file = new File(['x'], 'copy.zip', { type: 'application/zip' })
    await userEvent.upload(screen.getByLabelText('Choose a game copy to open'), file)
    expect(calls.imported).toHaveBeenCalledWith(file)
    expect(screen.getByRole('alert')).toHaveTextContent('This isn’t an Automata game.')
  })

  it('invites a first game when there are none', () => {
    mount({ games: [] })
    expect(screen.getByText('You haven’t made a game yet. Press New game to start one.')).toBeInTheDocument()
  })
})

describe('New game', () => {
  function ask(taken: string[] = []) {
    const onmake = vi.fn(() => undefined as string | undefined)
    const oncancel = vi.fn()
    render(NewGame, { taken, onmake, oncancel })
    return { onmake, oncancel }
  }

  it('asks what the game is called and shows the name its files will have', async () => {
    ask()
    await userEvent.type(screen.getByLabelText('What’s your game called?'), 'Lantern Run')
    expect(screen.getByText('lantern-run')).toBeInTheDocument()
  })

  it('numbers a name that is taken', async () => {
    ask(['lantern-run'])
    await userEvent.type(screen.getByLabelText('What’s your game called?'), 'Lantern Run')
    expect(screen.getByText('lantern-run-2')).toBeInTheDocument()
  })

  it('makes the game with the name as typed, and My game when none was', async () => {
    const { onmake } = ask()
    await userEvent.click(screen.getByRole('button', { name: 'Make my game' }))
    await waitFor(() => expect(onmake).toHaveBeenCalledWith('My game'))
  })

  it('shows why a game could not be made', async () => {
    const onmake = vi.fn(() => 'The browser is full.')
    render(NewGame, { taken: [], onmake, oncancel: () => undefined })
    await userEvent.click(screen.getByRole('button', { name: 'Make my game' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The browser is full.')
  })
})
