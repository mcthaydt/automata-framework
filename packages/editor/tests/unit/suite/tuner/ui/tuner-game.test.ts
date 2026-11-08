// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TunerGame from '#src/features/suite/tuner/ui/TunerGame.svelte'

// The Tuner's game pane: the game's dev page in a frame beside the settings, so a change shows in the running game.
// When nothing answers at that address yet, the pane says how to start the game and looks again until it does.

const GAME = 'http://localhost:5173/'

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('TunerGame', () => {
  it('shows the running game in a frame named "Your game"', async () => {
    render(TunerGame, { url: GAME, answers: async () => true })
    const frame = await screen.findByTitle('Your game')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('src')).toBe(GAME)
  })

  it('says how to start the game while nothing answers, and shows it once it does', async () => {
    vi.useFakeTimers()
    let up = false
    const answers = vi.fn(async () => up)
    render(TunerGame, { url: GAME, answers })
    await vi.waitFor(() =>
      expect(screen.getByText('Start your game with pnpm dev to see your changes here.')).toBeTruthy(),
    )
    expect(screen.queryByTitle('Your game')).toBeNull()

    up = true
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await screen.findByTitle('Your game')).toBeTruthy()
    // Once it answers, the pane stops asking.
    const asked = answers.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(answers.mock.calls.length).toBe(asked)
  })

  it('has no game to show for the sample, and says where one comes from', () => {
    render(TunerGame, { url: undefined })
    expect(
      screen.getByText("Your game shows here when you open the editors in your game's folder."),
    ).toBeTruthy()
    expect(screen.queryByTitle('Your game')).toBeNull()
  })

  it('adds the questions an editor asks the game to the address, and hands over the frame it shows', async () => {
    const frames: (HTMLIFrameElement | undefined)[] = []
    render(TunerGame, {
      url: GAME,
      answers: async () => true,
      query: { 'af-watch': 'http://localhost:5174', events: 'systems.mode' },
      onframe: (frame: HTMLIFrameElement | undefined) => frames.push(frame),
    })
    const frame = await screen.findByTitle('Your game')
    expect(frame.getAttribute('src')).toBe(
      'http://localhost:5173/?af-watch=http%3A%2F%2Flocalhost%3A5174&events=systems.mode',
    )
    expect(frames).toContain(frame)
  })

  it('keeps what the game address already asks when it adds its own', async () => {
    render(TunerGame, { url: `${GAME}?debug=1`, answers: async () => true, query: { events: 'a' } })
    expect((await screen.findByTitle('Your game')).getAttribute('src')).toBe(`${GAME}?debug=1&events=a`)
  })
})
