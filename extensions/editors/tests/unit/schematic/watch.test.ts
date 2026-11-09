import { describe, expect, it, vi } from 'vitest'
import { watchBridge } from '#src/features/schematic/watch-bridge.ts'
import { EMPTY_WATCH, hearWatch, watchLine } from '#src/features/schematic/watch-log.ts'

const GAME = 'http://localhost:5173'

function frameOf() {
  const win = {} as Window
  return { frame: { contentWindow: win } as unknown as HTMLIFrameElement, win }
}
const send = (data: unknown, source: unknown, origin: string): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source: source as MessageEventSource, origin }))
}
const mode = { type: 'af-sim-event', name: 'systems.mode', tick: 744, seconds: 12.4 }

describe('the bridge from the game', () => {
  it('hears a mode change from the frame, at the game’s own origin', () => {
    const { frame, win } = frameOf()
    const heard = vi.fn()
    const stop = watchBridge(frame, GAME, heard)
    send({ ...mode, payload: { agent: 'guard', from: 'patrol', to: 'hunt' } }, win, GAME)
    expect(heard).toHaveBeenCalledWith({
      kind: 'mode',
      seconds: 12.4,
      agent: 'guard',
      from: 'patrol',
      to: 'hunt',
    })
    stop()
  })

  it('ignores a message from another window, even at the right origin', () => {
    const { frame } = frameOf()
    const heard = vi.fn()
    const stop = watchBridge(frame, GAME, heard)
    send({ ...mode, payload: { agent: 'guard', from: 'a', to: 'b' } }, {}, GAME)
    expect(heard).not.toHaveBeenCalled()
    stop()
  })

  it('ignores a message from the right window at another origin', () => {
    const { frame, win } = frameOf()
    const heard = vi.fn()
    const stop = watchBridge(frame, GAME, heard)
    send({ ...mode, payload: { agent: 'guard', from: 'a', to: 'b' } }, win, 'http://evil.example')
    expect(heard).not.toHaveBeenCalled()
    stop()
  })

  it('ignores a message that is not shaped like a mode change', () => {
    const { frame, win } = frameOf()
    const heard = vi.fn()
    const stop = watchBridge(frame, GAME, heard)
    for (const data of [
      null,
      'hello',
      { type: 'other' },
      { ...mode, payload: { agent: 'guard' } },
      { ...mode, name: 'systems.noise', payload: {} },
      { ...mode, seconds: 'soon', payload: { agent: 'guard', from: 'a', to: 'b' } },
    ])
      send(data, win, GAME)
    expect(heard).not.toHaveBeenCalled()
    stop()
  })

  it('says when the game says it is listening, and stops listening when told to', () => {
    const { frame, win } = frameOf()
    const heard = vi.fn()
    const stop = watchBridge(frame, GAME, heard)
    send({ type: 'af-watch-ready' }, win, GAME)
    expect(heard).toHaveBeenCalledWith({ kind: 'ready' })
    stop()
    send({ type: 'af-watch-ready' }, win, GAME)
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('the log', () => {
  it('writes a mode change in words', () => {
    expect(watchLine({ kind: 'mode', seconds: 12.4, agent: 'guard', from: 'patrol', to: 'hunt' })).toBe(
      '12.4 s: guard went from Patrol to Hunt',
    )
    expect(
      watchLine({ kind: 'mode', seconds: 3, agent: 'night-nurse', from: 'search-room', to: 'patrol' }),
    ).toBe('3.0 s: night nurse went from Search room to Patrol')
  })

  it('keeps each character’s mode, the arrow that just fired, and the last lines', () => {
    let state = EMPTY_WATCH
    state = hearWatch(state, { kind: 'mode', seconds: 1, agent: 'guard', from: 'patrol', to: 'hunt' })
    expect(state.modes).toEqual({ guard: 'hunt' })
    expect(state.flash).toEqual({ agent: 'guard', from: 'patrol', to: 'hunt' })
    expect(state.lines).toEqual(['1.0 s: guard went from Patrol to Hunt'])
    state = hearWatch(state, { kind: 'mode', seconds: 2, agent: 'porter', from: 'a', to: 'b' })
    expect(state.modes).toEqual({ guard: 'hunt', porter: 'b' })
    expect(state.flash?.agent).toBe('porter')
  })

  it('keeps only the last 50 lines, newest last', () => {
    let state = EMPTY_WATCH
    for (let i = 0; i < 60; i += 1)
      state = hearWatch(state, { kind: 'mode', seconds: i, agent: 'g', from: 'a', to: 'b' })
    expect(state.lines).toHaveLength(50)
    expect(state.lines[49]).toBe('59.0 s: g went from A to B')
  })

  it('knows the game is listening once it says so', () => {
    expect(EMPTY_WATCH.listening).toBe(false)
    expect(hearWatch(EMPTY_WATCH, { kind: 'ready' }).listening).toBe(true)
  })

  it('starts the log again when the game starts again', () => {
    let state = hearWatch(EMPTY_WATCH, { kind: 'mode', seconds: 1, agent: 'g', from: 'a', to: 'b' })
    state = hearWatch(state, { kind: 'ready' })
    expect(state.lines).toEqual([])
    expect(state.modes).toEqual({})
    expect(state.listening).toBe(true)
  })
})
