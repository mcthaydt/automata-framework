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

[[slot]]
id = "calm"
mode = "loop"
volume = 0.6
sound = "calm-theme"

[[slot]]
id = "chase"
mode = "loop"
volume = 0.9

[[music_rule]]
when = { danger = { atLeast = 2 } }
slot = "chase"

[[music_rule]]
when = {}
slot = "calm"

[[event]]
on = "coin.picked"
cue = "coin"
`

async function open(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'audio', gates: [], checks: [], modes: ['edit'], writable: true }),
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

describe('Audio removals keep the file valid', () => {
  it('removes a track and sets the rules that played it to play nothing, as the ask says', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'calm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove calm' }))
    expect(
      screen.getByText('Remove calm? The rules that play it will play nothing instead.'),
    ).toBeInTheDocument()
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Remove calm?' })).getByRole('button', { name: 'Remove' }),
    )
    await vi.waitFor(async () => expect(await text(ports)).not.toContain('id = "calm"'))
    expect(await text(ports)).toContain('slot = "silence"')
    expect(await text(ports)).not.toContain('slot = "calm"')
    expect(document.body.textContent).not.toMatch(/problem/)
  })

  it('removes a sound and the rows that played it, and says so first', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Remove coin' }))
    expect(screen.getByText('Remove coin? The 1 row that plays it is removed too.')).toBeInTheDocument()
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Remove coin?' })).getByRole('button', { name: 'Remove' }),
    )
    await vi.waitFor(async () => expect(await text(ports)).not.toContain('id = "coin"'))
    expect(await text(ports)).not.toContain('coin.picked')
    expect(document.body.textContent).not.toMatch(/problem/)
  })
})

describe('Audio: when things happen', () => {
  it('offers the game’s events in words, and the new row plays the sound last looked at', async () => {
    const { ports } = await open({
      [AUDIO_PATH]: FILE.replace('[[event]]', '[[cue]]\nid = "thud"\nbus = "sfx"\nvoices = []\n\n[[event]]'),
      'content/cutscenes/opening.toml': 'id = "opening"\nduration = 5\n',
    })
    await userEvent.click(screen.getByRole('button', { name: 'thud' }))
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add what happens' }))
    await userEvent.click(screen.getByRole('button', { name: 'a cutscene starts' }))
    await vi.waitFor(async () => expect(await text(ports)).toContain('on = "cutscene.started"\ncue = "thud"'))
  })
})

describe('Audio', () => {
  it('lists the sounds, the music and what plays when, in words', async () => {
    await open({ [AUDIO_PATH]: FILE })
    const list = screen.getByRole('navigation', { name: 'Sounds and music' })
    expect(within(list).getByRole('button', { name: 'coin' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'calm' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'What music plays when' })).toBeInTheDocument()
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
    for (const word of ['sfx', 'cue', 'voices', 'bus', 'toml', 'slot', 'music_rule'])
      expect(words).not.toContain(word)
  })

  it('shows a track as how the game switches to it, and writes a change', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE, 'assets/music/calm-theme.ogg': '' })
    await userEvent.click(screen.getByRole('button', { name: 'chase' }))
    expect(screen.getByRole('heading', { name: 'chase' })).toBeInTheDocument()
    const fade = screen.getByLabelText('Fades in over')
    await userEvent.clear(fade)
    await userEvent.type(fade, '1.5{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('fade = 1.5'))
    // Nothing on the page composes music: no tones, voices or drones for a track.
    expect(screen.queryByRole('button', { name: 'Add a tone' })).toBeNull()
  })

  it('names a track whose file the game folder does not have', async () => {
    await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'calm' }))
    expect(screen.getByText('The game has no music file called calm-theme yet.')).toBeInTheDocument()
  })

  it('offers a track file the game folder has, to use as a track', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE, 'assets/music/boss.ogg': '' })
    await userEvent.click(screen.getByRole('button', { name: 'What music plays when' }))
    await userEvent.click(screen.getByRole('button', { name: 'Use this track' }))
    await vi.waitFor(async () => expect(await text(ports)).toContain('sound = "boss"'))
    expect(await screen.findByRole('heading', { name: 'boss' })).toBeInTheDocument()
  })

  it('reads the music rules as sentences and moves one up in one step', async () => {
    const { ports, session } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'What music plays when' }))
    expect(screen.getByRole('article', { name: 'When danger is at least 2: play chase' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Otherwise: play calm' })).toBeInTheDocument()
    const otherwise = screen.getByRole('article', { name: 'Otherwise: play calm' })
    await userEvent.click(within(otherwise).getByRole('button', { name: 'Move up' }))
    await vi.waitFor(async () => expect(await text(ports)).toMatch(/slot = "calm"[\s\S]*slot = "chase"/))
    expect(session.toml.history.undoLabel).toBe('Move a music rule up')
  })

  it('does not save a number it was not given', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'What music plays when' }))
    const otherwise = screen.getByRole('article', { name: 'Otherwise: play calm' })
    await userEvent.click(within(otherwise).getByRole('button', { name: 'Wait for something' }))
    await userEvent.type(within(otherwise).getByLabelText('What does the game keep track of?'), 'danger')
    await userEvent.selectOptions(within(otherwise).getByLabelText('Is'), 'is at least')
    await userEvent.type(within(otherwise).getByLabelText('Value'), 'lots')
    await userEvent.click(within(otherwise).getByRole('button', { name: 'Add' }))
    expect(within(otherwise).getByRole('alert')).toHaveTextContent('“is at least” needs a number, like 2.')
    expect(await text(ports)).toBe(FILE)
  })

  it('waits for something: adds a condition to a rule', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'What music plays when' }))
    const otherwise = screen.getByRole('article', { name: 'Otherwise: play calm' })
    await userEvent.click(within(otherwise).getByRole('button', { name: 'Wait for something' }))
    await userEvent.type(within(otherwise).getByLabelText('What does the game keep track of?'), 'indoors')
    await userEvent.type(within(otherwise).getByLabelText('Value'), 'yes')
    await userEvent.click(within(otherwise).getByRole('button', { name: 'Add' }))
    await vi.waitFor(async () => expect(await text(ports)).toContain('indoors = true'))
  })
})
