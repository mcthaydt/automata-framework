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

async function open(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
    changeSet: false,
  })
  const listed = await ports.workspace.files('feel')
  const session = await createFeel().open(listed, ports)
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
    const shake = screen.getByRole('article', { name: 'Shake the screen' })
    expect(within(shake).getByLabelText('How hard')).toHaveValue(0.2)
  })

  it('writes a changed value into the file and keeps its comments', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    const field = within(screen.getByRole('article', { name: 'Shake the screen' })).getByLabelText('How hard')
    await userEvent.clear(field)
    await userEvent.type(field, '0.4{Enter}')
    await vi.waitFor(async () => expect(await text(ports)).toContain('shake = 0.4 }] # a light knock'))
  })

  it('refuses a value out of range in words and writes nothing', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    const field = within(screen.getByRole('article', { name: 'Shake the screen' })).getByLabelText('How hard')
    await userEvent.clear(field)
    await userEvent.type(field, '3{Enter}')
    expect(await screen.findByText('The most is 1.')).toBeInTheDocument()
    expect(await text(ports)).toBe(FILE)
  })

  it('adds a feel for something that happens, and an effect to it', async () => {
    const { ports } = await open({ [FEEL_PATH]: FILE })
    await userEvent.click(screen.getByRole('button', { name: 'Add a feel' }))
    await userEvent.type(screen.getByLabelText('What happens in the game?'), 'enemy.died')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('heading', { name: 'When enemy died happens' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add an effect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Freeze the action' }))
    const freeze = await screen.findByRole('article', { name: 'Freeze the action' })
    expect(within(freeze).getByLabelText('How long')).toHaveValue(60)
    const written = (await text(ports)) ?? ''
    expect(written).toContain('on = "enemy.died"')
    expect(written).toContain('hit_stop_ms = 60')
    expect(written.startsWith('# What the player feels.\n')).toBe(true)
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
})
