// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte'
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
    expect(screen.getByText('On this device and GitHub: mcthaydt/old')).toBeInTheDocument()
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

/** What signing in adds: the games GitHub has that this device does not, and the three things a page can do about GitHub. */
function github(extra: Record<string, unknown> = {}) {
  const calls = {
    check: vi.fn(async (_id: string) => true),
    get: vi.fn(async (_repo: string) => undefined),
    open: vi.fn(),
  }
  const options = {
    remote: [{ repo: 'mcthaydt/night-shift', title: 'night-shift' }],
    installUrl: 'https://github.com/apps/automata/installations/new',
    ...calls,
    ...extra,
  }
  return { calls, options }
}
const row = (name: string): HTMLElement => {
  const found = screen.getByText(name).closest('li')
  if (found === null) throw new Error(`no row for ${name}`)
  return found
}

describe('Your games on GitHub', () => {
  it('offers nothing about GitHub to a person who is not signed in', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Keep this game on GitHub' })).toBeNull()
    expect(screen.queryByText('Your games on GitHub')).toBeNull()
  })

  it('lists a GitHub game this device does not have, and gets it on Get it', async () => {
    const { calls, options } = github()
    mount({ github: options })
    expect(screen.getByRole('heading', { name: 'Your games on GitHub' })).toBeInTheDocument()
    expect(screen.getByText('night-shift')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Get night-shift' }))
    expect(calls.get).toHaveBeenCalledWith('mcthaydt/night-shift')
  })

  it('shows why a game could not be got, in words', async () => {
    const { options } = github({
      get: vi.fn(async () => {
        throw new Error('This game is too big to get on the web. Use the Automata app.')
      }),
    })
    mount({ github: options })
    await userEvent.click(screen.getByRole('button', { name: 'Get night-shift' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('too big to get on the web')
  })

  it('offers Keep this game on GitHub only to a game that is not on GitHub', () => {
    mount({ github: github().options })
    expect(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    ).toBeInTheDocument()
    expect(within(row('Old Game')).queryByRole('button', { name: 'Keep this game on GitHub' })).toBeNull()
  })

  it('opens GitHub’s new-repository page for the game in a new tab, and says what to do there', async () => {
    const { calls, options } = github()
    mount({ github: options })
    await userEvent.click(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    )
    expect(calls.open).toHaveBeenCalledWith('https://github.com/new?name=lantern-run&visibility=private')
    expect(
      screen.getByText('Make an empty place for your game on GitHub, then come back.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I made it' })).toBeInTheDocument()
  })

  it('checks the place on I made it and, when it is there, is done', async () => {
    const { calls, options } = github()
    const done = vi.fn()
    mount({ github: options, onlinked: done })
    await userEvent.click(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'I made it' }))
    expect(calls.check).toHaveBeenCalledWith('lantern-run')
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(screen.queryByText('Make an empty place for your game on GitHub, then come back.')).toBeNull()
  })

  it('says Automata cannot reach it yet, and sends the person to let it see the game', async () => {
    const { calls, options } = github({ check: vi.fn(async () => false) })
    mount({ github: options })
    await userEvent.click(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'I made it' }))
    expect(await screen.findByText('Automata can’t reach this game on GitHub yet.')).toBeInTheDocument()
    calls.open.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Let Automata see this game' }))
    expect(calls.open).toHaveBeenCalledWith('https://github.com/apps/automata/installations/new')
    expect(screen.getByText('Choose your games on GitHub, then come back here.')).toBeInTheDocument()
  })

  it('checks again on Check again, and again when the person comes back to the page', async () => {
    let reachable = false
    const done = vi.fn()
    const check = vi.fn(async () => reachable)
    mount({ github: github({ check }).options, onlinked: done })
    await userEvent.click(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'I made it' }))
    await screen.findByText('Automata can’t reach this game on GitHub yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await waitFor(() => expect(check).toHaveBeenCalledTimes(2))
    expect(done).not.toHaveBeenCalled()
    reachable = true
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(done).toHaveBeenCalled())
  })

  it('lets the person back out', async () => {
    mount({ github: github().options })
    await userEvent.click(
      within(row('Lantern Run')).getByRole('button', { name: 'Keep this game on GitHub' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Never mind' }))
    expect(screen.queryByText('Make an empty place for your game on GitHub, then come back.')).toBeNull()
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
