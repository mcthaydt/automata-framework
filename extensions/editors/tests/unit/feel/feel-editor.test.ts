// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FeelCanvas from '#src/features/feel/FeelCanvas.svelte'
import FeelPanel from '#src/features/feel/FeelPanel.svelte'
import type { FeelSession } from '#src/features/feel/feel-session.svelte.ts'
import { createFeel, FEEL_PATH } from '#src/features/feel/feel-suite-editor.ts'

const FILE = `# What the player feels.
[[entry]]
on = "player.hit"
camera = [{ shake = 0.2 }] # a light knock

[[entry]]
on = "door.*"
`

async function open(files: Record<string, string>, options: Parameters<typeof createFeel>[0] = {}) {
  const { ports } = await createMemoryPorts({
    files,
    generated: (path) => path.startsWith('content/generated/'),
    classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const listed = (await ports.workspace.files('feel')).filter((file) => file.path.startsWith('content/feel/'))
  const session = await createFeel(options).open(listed, ports)
  render(FeelPanel, { props: { session } })
  render(FeelCanvas, { props: { session } })
  return { ports, session }
}

const text = async (ports: Awaited<ReturnType<typeof open>>['ports']) =>
  (await ports.workspace.read(FEEL_PATH))?.text

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Feel', () => {
  it('lists what happens in words and shows the chosen feel as sentences', async () => {
    await open({ [FEEL_PATH]: FILE })
    const list = screen.getByRole('navigation', { name: 'Feels' })
    expect(within(list).getByRole('button', { name: 'When player hit' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'When any door event' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'When player hit happens' })).toBeInTheDocument()
    const shake = screen.getByRole('region', { name: 'Shake the screen' })
    expect(within(shake).getByLabelText('How hard')).toHaveValue(0.2)
  })

  it('writes a changed value into the file and keeps its comments', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    const field = within(screen.getByRole('region', { name: 'Shake the screen' })).getByLabelText('How hard')
    await userEvent.clear(field)
    await userEvent.type(field, '0.4{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('shake = 0.4 }] # a light knock'))
  })

  it('refuses a value out of range in words and writes nothing', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    const field = within(screen.getByRole('region', { name: 'Shake the screen' })).getByLabelText('How hard')
    await userEvent.clear(field)
    await userEvent.type(field, '3{Enter}')
    expect(await screen.findByText('The most is 1.')).toBeInTheDocument()
    expect(await text(ports)).toBe(FILE)
  })

  it('adds a feel for something that happens, and an effect to it', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Add a feel' }))
    await userEvent.type(screen.getByLabelText('Something else'), 'enemy.died')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('heading', { name: 'When enemy died happens' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add an effect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Freeze the action' }))
    const freeze = await screen.findByRole('region', { name: 'Freeze the action' })
    expect(within(freeze).getByLabelText('How long')).toHaveValue(60)
    const written = (await text(ports)) ?? ''
    expect(written).toContain('on = "enemy.died"')
    expect(written).toContain('hit_stop_ms = 60')
    expect(written.startsWith('# What the player feels.\n')).toBe(true)
  })

  it('writes what a word says and files it under its event, without showing the filing name', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Add an effect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Show a word' }))
    const word = await screen.findByRole('region', { name: 'Show a word' })
    const says = within(word).getByLabelText('What it says')
    expect(says).toHaveValue('Pow!')
    expect(screen.queryByLabelText('Which word')).toBeNull()
    await userEvent.clear(says)
    await userEvent.type(says, 'Ouch!{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('words = "Ouch!"'))
    expect(await text(ports)).toContain('key = "player.hit.word"')
  })

  it('tunes how squash moves, writing the whole spring the first time', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Never more than' }))
    expect(screen.getByRole('heading', { name: 'How squash moves' })).toBeInTheDocument()
    const wobble = screen.getByLabelText('Wobble')
    expect(wobble).toHaveValue(0.35)
    await userEvent.clear(wobble)
    await userEvent.type(wobble, '0.5{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('zeta = 0.5'))
    const written = (await text(ports)) ?? ''
    expect(written).toContain('f = 4')
    expect(written).toContain('r = 0')
  })

  it('asks before removing a feel', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Remove this feel' }))
    expect(await text(ports)).toBe(FILE)
    const confirm = screen.getByRole('group', { name: 'Remove this feel?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await vi.waitFor(async () => expect(await text(ports)).not.toContain('player.hit'))
  })

  it('says when two feels answer one thing, on the second', async () => {
    await open({ [FEEL_PATH]: `[[entry]]\non = "player.hit"\n\n[[entry]]\non = "player.hit"\n` })
    await userEvent.click(screen.getAllByRole('button', { name: 'When player hit' })[1] as HTMLElement)
    expect(await screen.findByText('Another feel already answers player hit.')).toBeInTheDocument()
  })

  it('offers to start a feel file when the game has none', async () => {
    const { ports } = await open({})
    expect(screen.getByRole('heading', { name: 'This game has no feel file yet.' })).toBeInTheDocument()
    // The start page is an empty state: one heading, one line and one way forward.
    const start = document.querySelector<HTMLElement>('[data-widget="empty-state"]')
    expect(start).not.toBeNull()
    expect(within(start as HTMLElement).getAllByRole('heading')).toHaveLength(1)
    expect(within(start as HTMLElement).getAllByRole('button')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Start a feel file' }))
    expect(await screen.findByRole('heading', { name: 'Nothing has a feel yet.' })).toBeInTheDocument()
    expect(await text(ports)).toMatch(/^# What the player feels/)
  })

  it('opens a file with a mistake read only, naming the line', async () => {
    await open({ [FEEL_PATH]: '[[entry]\n' })
    expect(
      screen.getByRole('heading', { name: 'The feel file has a mistake on line 1.' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a feel' })).toBeNull()
  })

  it('shows no key names or schema words', async () => {
    await open({ [FEEL_PATH]: FILE })
    const words = document.body.textContent ?? ''
    for (const word of ['hit_stop_ms', 'entry', 'camera', 'trauma', 'cue', 'toml'])
      expect(words).not.toContain(word)
  })

  it('keeps the chosen feel across a reopen of the view', async () => {
    const { session } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'When any door event' }))
    document.body.innerHTML = ''
    render(FeelCanvas, { props: { session: session as FeelSession } })
    expect(screen.getByRole('heading', { name: 'When any door event happens' })).toBeInTheDocument()
  })

  it('writes “Over what was hit” as a key and removes it again for “Middle of the screen”', async () => {
    const { ports } = await open({
      [FEEL_PATH]: '[[entry]]\non = "player.hit"\nword = [{ key = "ouch", words = "Ouch" }]\n',
    })
    await userEvent.selectOptions(screen.getByLabelText('Where'), 'Over what was hit')
    await vi.waitFor(async () => expect(await text(ports)).toContain('at = "subject"'))
    await userEvent.selectOptions(screen.getByLabelText('Where'), 'Middle of the screen')
    await vi.waitFor(async () => expect(await text(ports)).not.toContain('at ='))
  })

  it('keeps "Add an effect" off until a new feel is written, so the effect lands on the new feel', async () => {
    const { ports } = await createMemoryPorts({
      files: { [FEEL_PATH]: FILE },
      generated: (path) => path.startsWith('content/generated/'),
      classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
    })
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const write = ports.workspace.write.bind(ports.workspace)
    ports.workspace.write = async (...args) => {
      await gate
      return write(...args)
    }
    const session = await createFeel().open(await ports.workspace.files('feel'), ports)
    render(FeelPanel, { props: { session } })
    render(FeelCanvas, { props: { session } })
    await userEvent.click(screen.getByRole('button', { name: 'Add a feel' }))
    await userEvent.type(screen.getByLabelText('Something else'), 'enemy.died')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: 'Add an effect' })).toBeDisabled()
    release()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Add an effect' })).toBeEnabled())
    expect(screen.getByRole('heading', { name: 'When enemy died happens' })).toBeInTheDocument()
  })

  it('changes what a feel answers, keeping its effects, and refuses an event another feel answers', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    await userEvent.type(screen.getByLabelText('Something else'), 'enemy.died')
    await userEvent.click(screen.getByRole('button', { name: 'Use this' }))
    await vi.waitFor(async () =>
      expect(await text(ports)).toContain('on = "enemy.died"\ncamera = [{ shake = 0.2 }]'),
    )
    expect(screen.getByRole('heading', { name: 'When enemy died happens' })).toBeInTheDocument()
  })

  it('starts the preview with Reduce motion as the device is set', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    try {
      const { session } = await open({ [FEEL_PATH]: FILE })
      expect(session.preview.reduced).toBe(true)
      expect(screen.getByLabelText('Reduce motion')).toBeChecked()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('says a freeze on an event about nobody holds nothing, and that a freeze holds what was hit', async () => {
    await open({
      [FEEL_PATH]: '[[entry]]\non = "cutscene.started"\npose = [{ hit_stop_ms = 60 }]\n',
      'content/cutscenes/opening.toml': 'id = "opening"\nduration = 5\n',
    })
    expect(screen.getByText('Freezes what was hit')).toBeInTheDocument()
    expect(screen.getByText('Nothing is hit by this, so nothing freezes.')).toBeInTheDocument()
  })

  it('says beside a freeze above the limit what the player gets', async () => {
    await open({ [FEEL_PATH]: '[[entry]]\non = "player.hit"\npose = [{ hit_stop_ms = 200 }]\n' })
    expect(screen.getByText('Above the longest freeze. Players feel 120 ms.')).toBeInTheDocument()
  })

  it('offers what happens in the game by name, and adds a feel for one with a tap', async () => {
    const { ports } = await open({
      [FEEL_PATH]: FILE,
      'content/generated/events.json': JSON.stringify([{ id: 'player.hit' }, { id: 'player.jumped' }]),
    })
    await userEvent.click(screen.getByRole('button', { name: 'Add a feel' }))
    // player hit is already answered, so only the new one is offered; and “any player event” covers the kind.
    expect(screen.queryByRole('button', { name: 'player hit' })).toBeNull()
    expect(screen.getByRole('button', { name: 'any player event' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'player jumped' }))
    await vi.waitFor(async () => expect(await text(ports)).toContain('on = "player.jumped"'))
    expect(await screen.findByRole('heading', { name: 'When player jumped happens' })).toBeInTheDocument()
  })

  it('plays the chosen feel again after a change, and on Play again', async () => {
    const { session } = await open({ [FEEL_PATH]: FILE })
    const before = session.replay
    const field = within(screen.getByRole('region', { name: 'Shake the screen' })).getByLabelText('How hard')
    await userEvent.clear(field)
    await userEvent.type(field, '0.5{Enter}')
    await vi.waitFor(() => expect(session.replay).toBe(before + 1))
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(session.replay).toBe(before + 2)
  })

  it('tries the player’s settings on the stage without touching the file', async () => {
    const { ports, session } = await open({ [FEEL_PATH]: FILE })
    expect(screen.getByText('Only changes this preview.')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Less flashing'))
    await userEvent.click(screen.getByLabelText('Rumble'))
    await userEvent.click(screen.getByLabelText('Reduce motion'))
    await userEvent.selectOptions(screen.getByLabelText('Strength'), 'Half')
    expect(session.preview).toEqual({ reduceFlashing: true, haptics: false, intensity: 0.5, reduced: true })
    expect(await text(ports)).toBe(FILE)
  })

  it('says which other feel also plays, and goes to it on a tap', async () => {
    const { session } = await open({
      [FEEL_PATH]: '[[entry]]\non = "player.hit"\n\n[[entry]]\non = "player.*"\n',
    })
    expect(screen.getByText(/Also plays:/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'any player event' }))
    expect(session.chosen).toBe(1)
  })

  it('says what a rumble or a missing sound would do, in words, on the stage', async () => {
    await open({
      [FEEL_PATH]:
        '[[entry]]\non = "player.hit"\nhaptic = [{ strong = 0.5, weak = 0.3, ms = 100 }]\naudio = [{ cue = "hit" }]\n',
    })
    await vi.waitFor(() => {
      const said = screen.getByLabelText('The feel playing').nextElementSibling?.textContent ?? ''
      expect(said).toContain('Rumble: strong 0.5, light 0.3 for 100 ms')
      expect(said).toContain('Plays the sound hit')
    })
  })

  it('plays a sound the game has through the audio the game would use, and says nothing about it', async () => {
    const audio = vi.fn(() => Promise.resolve())
    await open(
      {
        [FEEL_PATH]: '[[entry]]\non = "player.hit"\naudio = [{ cue = "hit" }]\n',
        'content/audio/audio.toml': '[[cue]]\nid = "hit"\nbus = "sfx"\nvoices = []\n',
      },
      { audio },
    )
    await vi.waitFor(() =>
      expect(audio).toHaveBeenCalledWith(
        expect.objectContaining({ cue: [expect.objectContaining({ id: 'hit' })] }),
        {
          kind: 'sound',
          id: 'hit',
        },
      ),
    )
    expect(screen.getByLabelText('The feel playing').nextElementSibling?.textContent).toBe('')
  })

  it('says it would play the sound when this page has no way to make sound', async () => {
    await open({
      [FEEL_PATH]: '[[entry]]\non = "player.hit"\naudio = [{ cue = "hit" }]\n',
      'content/audio/audio.toml': '[[cue]]\nid = "hit"\nbus = "sfx"\nvoices = []\n',
    })
    await vi.waitFor(() => {
      const said = screen.getByLabelText('The feel playing').nextElementSibling?.textContent ?? ''
      expect(said).toContain('Plays the sound hit')
    })
  })

  it('shows no stage for a file with a mistake, and says why', async () => {
    await open({ [FEEL_PATH]: '[[entry]\n' })
    expect(screen.getByText('Fix the file to play it.')).toBeInTheDocument()
    expect(screen.queryByLabelText('The feel playing')).toBeNull()
  })

  it('keeps a sound the game lacks and names it in words', async () => {
    await open({ [FEEL_PATH]: '[[entry]]\non = "player.hit"\naudio = [{ cue = "hit" }]\n' })
    expect(screen.getByText('The game has no sound “hit” yet.')).toBeInTheDocument()
  })

  it('does not name a sound the game has', async () => {
    await open({
      [FEEL_PATH]: '[[entry]]\non = "player.hit"\naudio = [{ cue = "hit" }]\n',
      'content/audio/audio.toml': '[[cue]]\nid = "hit"\n',
    })
    expect(screen.queryByText(/The game has no sound/)).toBeNull()
  })
})
