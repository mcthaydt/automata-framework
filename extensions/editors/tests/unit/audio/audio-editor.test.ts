// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AudioCanvas from '#src/features/audio/AudioCanvas.svelte'
import AudioPanel from '#src/features/audio/AudioPanel.svelte'
import { AUDIO_PATH, createAudio } from '#src/features/audio/audio-suite-editor.ts'

const FILE = `# The game's sounds.
[[cue]]
id = "coin"
about = "A bright blip"
bus = "sfx"
voices = [{ tone = "square", from = 880, to = 1320, length = 0.08, volume = 0.4 }]

[[bed]]
id = "cave"
bus = "music"
volume = 0.3
drones = [{ wave = "sine", freq = 55 }]

[[event]]
on = "coin.picked"
cue = "coin"
`

async function open(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'audio', gates: [], checks: [], modes: ['edit'], writable: true }),
    changeSet: false,
  })
  const play = vi.fn(async () => {})
  const session = await createAudio({ play }).open(await ports.workspace.files('audio'), ports)
  render(AudioPanel, { props: { session } })
  render(AudioCanvas, { props: { session } })
  return { ports, play, session }
}

const text = async (ports: Awaited<ReturnType<typeof open>>['ports']) =>
  (await ports.workspace.read(AUDIO_PATH))?.text

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Audio', () => {
  it('lists the sounds, the music and what plays when, in words', async () => {
    await open({ [AUDIO_PATH]: FILE })
    const list = screen.getByRole('navigation', { name: 'Sounds and music' })
    expect(within(list).getByRole('button', { name: 'coin' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'cave' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'When things happen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'coin' })).toBeInTheDocument()
    expect(screen.getByLabelText('Plays on')).toHaveDisplayValue('Effects')
  })

  it('plays a sound only when asked', async () => {
    const { play } = await open({ [AUDIO_PATH]: FILE })
    expect(play).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(play).toHaveBeenCalledWith(expect.objectContaining({ cue: expect.any(Array) }), {
      kind: 'sound',
      id: 'coin',
    })
  })

  it('changes a tone and keeps the file comment', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    const tone = screen.getByRole('article', { name: 'Tone' })
    const end = within(tone).getByLabelText('Ends at')
    await userEvent.clear(end)
    await userEvent.type(end, '990{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('to = 990'))
    expect(await text(ports)).toMatch(/^# The game's sounds\./)
  })

  it('adds a sound that can be played at once', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Add a sound' }))
    expect(await screen.findByRole('heading', { name: 'sound-1' })).toBeInTheDocument()
    expect(await text(ports)).toContain('id = "sound-1"')
  })

  it('says which sound plays when, and changes it', async () => {
    const { ports } = await open({
      [AUDIO_PATH]: FILE.replace('[[event]]', '[[cue]]\nid = "thud"\nbus = "sfx"\nvoices = []\n\n[[event]]'),
    })
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    const row = screen.getByRole('group', { name: 'When coin picked' })
    await userEvent.selectOptions(within(row).getByLabelText('Play'), 'thud')
    await vi.waitFor(async () => expect(await text(ports)).toContain('cue = "thud"'))
  })

  it('names a sound that does not exist', async () => {
    await open({ [AUDIO_PATH]: FILE.replace('cue = "coin"', 'cue = "boom"') })
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    expect(screen.getByText('There is no sound called boom.')).toBeInTheDocument()
  })

  it('offers to start an audio file when the game has none', async () => {
    const { ports } = await open({})
    await userEvent.click(screen.getByRole('button', { name: 'Start an audio file' }))
    await vi.waitFor(async () => expect(await text(ports)).toMatch(/^# The game's sounds/))
  })

  it('shows no key names', async () => {
    await open({ [AUDIO_PATH]: FILE })
    const words = document.body.textContent ?? ''
    for (const word of ['sfx', 'cue', 'voices', 'bus', 'toml']) expect(words).not.toContain(word)
  })
})
