import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'
import AudioPanel from '#src/features/panels/AudioPanel.svelte'
import { type AudioBoardPort, type DebugHost, HOST_CONTEXT } from '#src/shared/host.ts'

afterEach(cleanup)
const mount = (host: Partial<DebugHost>) =>
  render(AudioPanel, { context: new Map([[HOST_CONTEXT, { panels: [], ...host }]]) })
const board = (): AudioBoardPort & { play: Mock<AudioBoardPort['play']> } => {
  let on: string[] = []
  return {
    cues: () => [
      { id: 'ping', bus: 'ui', about: 'confirm', draft: false, events: ['ui.confirm'] },
      { id: 'thud', bus: 'sfx', draft: true, events: [] },
      { id: 'step', bus: 'sfx', draft: false, events: ['player.step'] },
    ],
    beds: () => [{ id: 'hum', bus: 'music', draft: false }],
    play: vi.fn<AudioBoardPort['play']>(),
    startBed: (id) => {
      on = [...on, id]
    },
    stopBed: (id) => {
      on = on.filter((b) => b !== id)
    },
    playing: () => on,
  }
}

describe('AudioPanel', () => {
  it('groups the cues by bus, each on a button, a draft marked', () => {
    mount({ audio: board() })
    expect(screen.getByRole('heading', { name: 'Cues · sfx' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cues · ui' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'thud (draft)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ping' })).toHaveAttribute(
      'title',
      'confirm\nEvents: ui.confirm',
    )
  })
  it('plays a cue when its button is pressed', async () => {
    const b = board()
    mount({ audio: b })
    await fireEvent.click(screen.getByRole('button', { name: 'step' }))
    expect(b.play).toHaveBeenCalledWith('step')
  })
  it('toggles a bed and shows whether it is playing', async () => {
    mount({ audio: board() })
    const hum = screen.getByRole('button', { name: 'hum' })
    expect(hum).toHaveAttribute('aria-pressed', 'false')
    await fireEvent.click(hum)
    expect(hum).toHaveAttribute('aria-pressed', 'true')
    await fireEvent.click(hum)
    expect(hum).toHaveAttribute('aria-pressed', 'false')
  })
  it('says so when there is no audio board', () => {
    mount({})
    expect(screen.getByText('This game has not turned on the audio board.')).toBeInTheDocument()
  })
})
