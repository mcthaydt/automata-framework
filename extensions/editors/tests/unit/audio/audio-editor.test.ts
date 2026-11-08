// @vitest-environment jsdom
import type { AudioContent } from '@automata/audio-synth'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AudioCanvas from '#src/features/audio/AudioCanvas.svelte'
import AudioPanel from '#src/features/audio/AudioPanel.svelte'
import type { SoundFinding } from '#src/features/audio/audio-findings.ts'
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

async function open(
  files: Record<string, string>,
  options: { check?: (content: AudioContent) => Promise<SoundFinding[]> } = {},
) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'audio', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const play = vi.fn(async () => {})
  const session = await createAudio({ play, check: options.check ?? (async () => []) }).open(
    await ports.workspace.files('audio'),
    ports,
  )
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

describe('Audio: a sound as a picture and its switches', () => {
  it('draws the sound as a picture that follows each change', async () => {
    await open({ [AUDIO_PATH]: FILE })
    const bars = (): number =>
      screen.getByRole('img', { name: /Shape of coin/ }).querySelectorAll('[data-bar]').length
    expect(bars()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'Add a hiss' }))
    await vi.waitFor(() => expect(bars()).toBe(2))
  })

  it('writes a switch when it is turned on, and takes it out when it is turned off', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    const draft = screen.getByRole('checkbox', { name: 'Not final yet' })
    expect(draft).not.toBeChecked()
    await userEvent.click(draft)
    await vi.waitFor(async () => expect(await text(ports)).toContain('draft = true'))
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: 'Not final yet' })).toBeChecked())
    await userEvent.click(screen.getByRole('checkbox', { name: 'Not final yet' }))
    await vi.waitFor(async () => expect(await text(ports)).not.toContain('draft'))
  })

  it('keeps a hiss that picks its pitch from a range a range when one end changes', async () => {
    const { ports } = await open({
      [AUDIO_PATH]: FILE.replace(
        'voices = [{ tone = "square", from = 880, to = 1320, length = 0.08, volume = 0.4 }]',
        'voices = [{ hiss = [400, 1200], q = 1, length = 0.5, volume = 0.2 }]',
      ),
    })
    const hiss = screen.getByRole('region', { name: 'Hiss' })
    const high = within(hiss).getByLabelText('Highest pitch')
    await userEvent.clear(high)
    await userEvent.type(high, '1500{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('hiss = [400, 1500]'))
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

describe('Audio: the mix', () => {
  const MIXED = `master_gain = 0.8

[[cue]]
id = "coin"
bus = "sfx"
voices = []

[[duck]]
bus = "voice"
duck = ["music"]
db = -6
attack = 0.1
release = 0.5
`

  it('changes the overall volume and says the ducks as sentences', async () => {
    const { ports } = await open({ [AUDIO_PATH]: MIXED })
    await userEvent.click(screen.getByRole('button', { name: 'Mix' }))
    expect(
      screen.getByText('While a voice plays, music drops 6 dB (in 0.1 s, back in 0.5 s)'),
    ).toBeInTheDocument()
    const volume = screen.getByLabelText('Overall volume')
    expect(volume).toHaveValue(0.8)
    await userEvent.clear(volume)
    await userEvent.type(volume, '0.5{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('master_gain = 0.5'))
  })

  it('changes how far a duck drops, and which sounds drop', async () => {
    const { ports } = await open({ [AUDIO_PATH]: MIXED })
    await userEvent.click(screen.getByRole('button', { name: 'Mix' }))
    const duck = screen.getByRole('group', { name: /While a voice plays/ })
    const by = within(duck).getByLabelText('It drops by')
    await userEvent.clear(by)
    await userEvent.type(by, '9{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('db = -9'))
    await userEvent.click(
      within(screen.getByRole('group', { name: /While a voice plays/ })).getByRole('checkbox', {
        name: 'Effects',
      }),
    )
    await vi.waitFor(async () => expect(await text(ports)).toContain('duck = ["music", "sfx"]'))
  })

  it('adds a duck as a section like the others, and removes it', async () => {
    const { ports } = await open({ [AUDIO_PATH]: MIXED })
    await userEvent.click(screen.getByRole('button', { name: 'Mix' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quiet something while a sound plays' }))
    await vi.waitFor(async () => expect((await text(ports))?.match(/\[\[duck\]\]/g)).toHaveLength(2))
    expect(await text(ports)).not.toMatch(/duck = \[\{/)
    const ducks = screen.getAllByRole('group', { name: /While a voice plays/ })
    await userEvent.click(within(ducks[1] as HTMLElement).getByRole('button', { name: 'Remove' }))
    await vi.waitFor(async () => expect((await text(ports))?.match(/\[\[duck\]\]/g)).toHaveLength(1))
  })
})

describe('Audio: Tap to hear, and Check the sounds', () => {
  it('says Tap to hear until the page has made its first sound', async () => {
    await open({ [AUDIO_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Tap to hear' }))
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('checks the sounds on request and shows each finding in words beside its sound', async () => {
    const check = vi.fn(async (): Promise<SoundFinding[]> => [{ sound: 'coin', kind: 'peak', value: -0.4 }])
    await open({ [AUDIO_PATH]: FILE }, { check })
    expect(check).not.toHaveBeenCalled()
    expect(screen.queryByText(/Too loud/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Check the sounds' }))
    expect(await screen.findByText('Too loud at its peak: −0.4 dB. Keep it under −1 dB.')).toBeInTheDocument()
    expect(check).toHaveBeenCalledWith(expect.objectContaining({ cue: expect.any(Array) }))
    // The list says which sounds need a look.
    expect(
      within(screen.getByRole('navigation', { name: 'Sounds and music' })).getByText('Needs a look'),
    ).toBeInTheDocument()
  })

  it('says a clean check in words, and marks it out of date when the sound changes', async () => {
    await open({ [AUDIO_PATH]: FILE }, { check: async () => [] })
    await userEvent.click(screen.getByRole('button', { name: 'Check the sounds' }))
    expect(await screen.findByText('Checked: nothing to fix.')).toBeInTheDocument()
    const tone = screen.getByRole('region', { name: 'Tone' })
    const end = within(tone).getByLabelText('Ends at')
    await userEvent.clear(end)
    await userEvent.type(end, '990{Enter}')
    expect(
      await screen.findByText('Changed since it was checked. Check the sounds again.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Checked: nothing to fix.')).toBeNull()
  })

  it('says when the check could not run', async () => {
    await open(
      { [AUDIO_PATH]: FILE },
      { check: () => Promise.reject(new Error('this page cannot check sounds')) },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Check the sounds' }))
    expect(
      await screen.findByText('The sounds could not be checked: this page cannot check sounds'),
    ).toBeInTheDocument()
  })
})

describe('Audio: rows that never play, and events nothing answers', () => {
  const SHADOWED = `[[cue]]
id = "coin"
bus = "sfx"
voices = []

[[event]]
on = "player.*"
cue = "coin"

[[event]]
on = "player.hit"
cue = "coin"
`

  it('says a row an earlier row answers first never plays, and moves it up in one step', async () => {
    const { ports, session } = await open({ [AUDIO_PATH]: SHADOWED })
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    const row = screen.getByRole('group', { name: 'When player hit' })
    expect(within(row).getByText('Never plays: any player event above answers first.')).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'When any player event' })).queryByText(/Never plays/),
    ).toBeNull()
    await userEvent.click(within(row).getByRole('button', { name: 'Move up' }))
    await vi.waitFor(async () =>
      expect(await text(ports)).toMatch(/on = "player\.hit"[\s\S]*on = "player\.\*"/),
    )
    expect(screen.queryByText(/Never plays/)).toBeNull()
    // One undo step puts it back.
    await session.toml.undo()
    await vi.waitFor(async () =>
      expect(await text(ports)).toMatch(/on = "player\.\*"[\s\S]*on = "player\.hit"/),
    )
  })

  it('lists the events nothing plays for, to pick a sound for or keep quiet', async () => {
    const { ports } = await open({
      [AUDIO_PATH]: SHADOWED,
      'content/cutscenes/opening.toml': 'id = "opening"\nduration = 5\n',
    })
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    const list = screen.getByRole('region', { name: 'Nothing plays yet' })
    const started = within(list).getByRole('group', { name: 'a cutscene starts' })
    await userEvent.selectOptions(within(started).getByLabelText('Pick a sound'), 'coin')
    await vi.waitFor(async () => expect(await text(ports)).toContain('on = "cutscene.started"\ncue = "coin"'))
    const ended = within(screen.getByRole('region', { name: 'Nothing plays yet' })).getByRole('group', {
      name: 'a cutscene ends',
    })
    await userEvent.click(within(ended).getByRole('button', { name: 'Keep it quiet' }))
    await vi.waitFor(async () => expect(await text(ports)).toContain('silent = "Quiet on purpose."'))
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Nothing plays yet' })).toBeNull())
  })

  it('lets the reason a row is quiet be changed', async () => {
    const { ports } = await open({
      [AUDIO_PATH]: '[[event]]\non = "door.opens"\nsilent = "Quiet on purpose."\n',
    })
    await userEvent.click(screen.getByRole('button', { name: 'When things happen' }))
    const reason = screen.getByLabelText('Quiet because')
    await userEvent.clear(reason)
    await userEvent.type(reason, 'the door is silent in the dark{Enter}')
    await vi.waitFor(async () =>
      expect(await text(ports)).toContain('silent = "the door is silent in the dark"'),
    )
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
    await userEvent.click(screen.getByRole('button', { name: 'Tap to hear' }))
    expect(play).toHaveBeenCalledWith(expect.objectContaining({ cue: expect.any(Array) }), {
      kind: 'sound',
      id: 'coin',
    })
  })

  it('changes a tone and keeps the file comment', async () => {
    const { ports } = await open({ [AUDIO_PATH]: FILE })
    const tone = screen.getByRole('region', { name: 'Tone' })
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
    // The start page is an empty state: one heading, one line and one way forward.
    const start = document.querySelector<HTMLElement>('[data-widget="empty-state"]')
    expect(start).not.toBeNull()
    expect(within(start as HTMLElement).getAllByRole('heading')).toHaveLength(1)
    expect(within(start as HTMLElement).getAllByRole('button')).toHaveLength(1)
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
