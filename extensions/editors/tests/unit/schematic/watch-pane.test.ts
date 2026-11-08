// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import CharacterCanvas from '#src/features/schematic/CharacterCanvas.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'

const HALL = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const NAV = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string
const GAME = 'http://localhost:5173/'

async function open(options: { gameUrl?: string; systems?: string } = {}) {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': options.systems ?? HALL,
      'content/nav/hall.toml': NAV,
    },
    classify: (path) => ({
      path,
      editor: 'schematic',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
    changeSet: false,
  })
  const session = await createSchematic({ gameUrl: options.gameUrl }).open(
    await ports.workspace.files('schematic'),
    ports,
  )
  render(CharacterCanvas, { props: { session } })
  return session
}

const watch = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Watch it run' }))
}
/** The game, as the page hears it: a message from the frame's window at the game's origin. */
function fromGame(data: unknown, origin = 'http://localhost:5173'): void {
  const frame = screen.getByTitle('Your game') as HTMLIFrameElement
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: frame.contentWindow as MessageEventSource }),
  )
}
const mode = (agent: string, from: string, to: string, seconds = 12.4) => ({
  type: 'af-sim-event',
  name: 'systems.mode',
  seconds,
  tick: 1,
  payload: { agent, from, to },
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('')),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Watch', () => {
  it('has nothing to show for the sample, and says where a game comes from', async () => {
    await open()
    await watch()
    expect(
      screen.getByText("Your game shows here when you open the editors in your game's folder."),
    ).toBeInTheDocument()
  })

  it('shows the game with the question for the debug extension in its address', async () => {
    await open({ gameUrl: GAME })
    await watch()
    const frame = await screen.findByTitle('Your game')
    const address = new URL(frame.getAttribute('src') ?? '')
    expect(address.searchParams.get('af-watch')).toBe(window.location.origin)
    expect(address.searchParams.get('events')).toBe('systems.mode')
  })

  it('lights the mode the character went into, flashes the arrow, and logs it in words', async () => {
    await open({ gameUrl: GAME })
    await watch()
    await screen.findByTitle('Your game')
    fromGame({ type: 'af-watch-ready' })
    fromGame(mode('guard', 'patrol', 'hunt'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hunt, 2.2 m/s' })).toHaveAttribute('data-live', 'true'),
    )
    expect(screen.getByRole('button', { name: 'Patrol, 1.4 m/s, where it starts' })).toHaveAttribute(
      'data-live',
      'false',
    )
    const arrow = document.querySelector('polyline[data-flash="true"]')
    expect(arrow).not.toBeNull()
    expect(
      within(screen.getByRole('log', { name: 'What happened' })).getByText(
        '12.4 s: guard went from Patrol to Hunt',
      ),
    ).toBeInTheDocument()
  })

  it('does not believe a message from another origin or another window', async () => {
    await open({ gameUrl: GAME })
    await watch()
    await screen.findByTitle('Your game')
    fromGame(mode('guard', 'patrol', 'hunt'), 'http://evil.example')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: mode('guard', 'patrol', 'hunt'),
        origin: 'http://localhost:5173',
        source: window,
      }),
    )
    expect(screen.queryByText(/went from/)).toBeNull()
  })

  it('asks for the debug extension when the game never says it is listening', async () => {
    await open({ gameUrl: GAME })
    vi.useFakeTimers()
    await fireEvent.click(screen.getByRole('button', { name: 'Watch it run' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.queryByText(/Ask whoever writes your game’s code/)).toBeNull()
    // A game on its title screen has not started its debug extension yet, so the first thing said is to press Play.
    expect(screen.getByText(/Press Play in the game/)).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(
      screen.getByText(
        'Pressed Play and still nothing? Then the game cannot say which mode each character is in. Ask whoever writes your game’s code to add the debug extension.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How to add it' })).toHaveAttribute('href')
  })

  it('does not ask once the game has said it is listening', async () => {
    await open({ gameUrl: GAME })
    vi.useFakeTimers()
    await fireEvent.click(screen.getByRole('button', { name: 'Watch it run' }))
    await vi.advanceTimersByTimeAsync(0)
    fromGame({ type: 'af-watch-ready' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(screen.queryByText(/Ask whoever writes your game’s code/)).toBeNull()
    expect(screen.queryByText(/Press Play in the game/)).toBeNull()
  })

  it('says the game is still playing the last version that worked while the file has problems', async () => {
    const broken = HALL.replace('to = "hunt"', 'to = "chse"')
    expect(broken).not.toBe(HALL)
    await open({ gameUrl: GAME, systems: broken })
    await watch()
    expect(
      screen.getAllByText(/Your game is still playing the last version that worked/).length,
    ).toBeGreaterThan(0)
  })

  it('closes again', async () => {
    await open({ gameUrl: GAME })
    await watch()
    await screen.findByTitle('Your game')
    await userEvent.click(screen.getByRole('button', { name: 'Watch it run' }))
    expect(screen.queryByTitle('Your game')).toBeNull()
  })
})
