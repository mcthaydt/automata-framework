// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import dialogue from '#src/app/suite/sample/dialogue.toml?raw'
import lines from '#src/app/suite/sample/lines.toml?raw'
import WriterCanvas from '#src/features/writer/WriterCanvas.svelte'
import WriterPanel from '#src/features/writer/WriterPanel.svelte'
import WriterStatus from '#src/features/writer/WriterStatus.svelte'
import { createWriter } from '#src/features/writer/writer-suite-editor.ts'

const LINES = 'content/lines/shop.toml'
const DIALOGUE = 'content/dialogue/shop.toml'

async function open(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({ path, editor: 'writer', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const listed = await ports.workspace.files('writer')
  const session = await createWriter().open(listed, ports)
  render(WriterPanel, { props: { session } })
  render(WriterCanvas, { props: { session } })
  render(WriterStatus, { props: { session } })
  return { ports, session }
}

type Opened = Awaited<ReturnType<typeof open>>
const text = async (ports: Opened['ports'], path: string) => (await ports.workspace.read(path))?.text

afterEach(() => {
  document.body.innerHTML = ''
})

const SHOP = { [LINES]: lines, [DIALOGUE]: dialogue }

describe('Writer lines', () => {
  it('starts a game with no words by asking what the place is called', async () => {
    const { ports } = await open({})
    expect(screen.getByRole('heading', { name: 'This game has no words yet.' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start writing' }))
    expect(await screen.findByText('This scene has no lines yet.')).toBeInTheDocument()
    expect(await ports.workspace.read(LINES.replace('shop', 'story'))).toBeUndefined()
  })

  it('writes the first line of a scene without a key being typed', async () => {
    const { ports } = await open({ [DIALOGUE]: dialogue })
    expect(screen.getByText('This scene has no lines yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Write the first line' }))
    await userEvent.type(screen.getByLabelText('What do they say?'), 'Welcome in. Mind the step.')
    await userEvent.click(screen.getByRole('button', { name: 'Add this line' }))
    await vi.waitFor(async () =>
      expect(await text(ports, LINES)).toContain('words = "Welcome in. Mind the step."'),
    )
    const written = (await text(ports, LINES)) ?? ''
    expect(written).toContain('id = "shop.welcome_in_mind_the"')
    expect(written).toContain('text = "shop.welcome_in_mind_the"')
  })

  it('shows each line as who says it, its words and what it is for', async () => {
    await open(SHOP)
    const first = screen.getByRole('article', { name: 'Line 1' })
    expect(within(first).getByRole('heading', { name: 'Shopkeeper' })).toBeInTheDocument()
    expect(within(first).getByText('Said in a conversation')).toBeInTheDocument()
    expect(within(first).getByLabelText('What it says')).toHaveValue('Welcome in. Mind the step.')
  })

  it('writes changed words into the line and keeps the rest of the file', async () => {
    const { ports } = await open(SHOP)
    const field = within(screen.getByRole('article', { name: 'Line 1' })).getByLabelText('What it says')
    await userEvent.clear(field)
    await userEvent.type(field, 'Come in.')
    await userEvent.tab()
    await vi.waitFor(async () => expect(await text(ports, LINES)).toContain('words = "Come in."'))
    expect(await text(ports, LINES)).toContain('# What the shop says')
  })

  it('removes the words when they are cleared and says there are none', async () => {
    const { ports } = await open(SHOP)
    const field = within(screen.getByRole('article', { name: 'Line 1' })).getByLabelText('What it says')
    await userEvent.clear(field)
    await userEvent.tab()
    expect(await screen.findByText('No words yet')).toBeInTheDocument()
    const written = (await text(ports, LINES)) ?? ''
    expect(written.split('[[lines]]')[1]).not.toContain('words')
  })

  it('asks before removing a line a conversation still says, and names it', async () => {
    const { ports } = await open(SHOP)
    await userEvent.click(
      within(screen.getByRole('article', { name: 'Line 1' })).getByRole('button', { name: /Remove/ }),
    )
    expect(await screen.findByText('The conversation Shopkeeper still says this line.')).toBeInTheDocument()
    expect(await text(ports, LINES)).toContain('shop.welcome_in')
    await userEvent.click(screen.getByRole('button', { name: 'Remove anyway' }))
    await vi.waitFor(async () => expect(await text(ports, LINES)).not.toContain('"shop.welcome_in"'))
  })

  it('removes a line nothing says without asking', async () => {
    const { ports } = await open({
      [LINES]: `${lines}\n[[lines]]\nid = "shop.extra"\nkind = "bark"\ntext = "shop.extra"\nwords = "Hm."\n`,
      [DIALOGUE]: dialogue,
    })
    const cards = screen.getAllByRole('article')
    await userEvent.click(
      within(cards[cards.length - 1] as HTMLElement).getByRole('button', { name: /Remove/ }),
    )
    await vi.waitFor(async () => expect(await text(ports, LINES)).not.toContain('shop.extra'))
  })

  it('says translations are out of date after a change of words, and leaves them alone', async () => {
    const fr = '{"content_lines_shop_lines_0_words":"Bienvenue."}\n'
    const { ports } = await open({ ...SHOP, 'content/messages/fr.json': fr })
    const field = within(screen.getByRole('article', { name: 'Line 1' })).getByLabelText('What it says')
    await userEvent.clear(field)
    await userEvent.type(field, 'Come in.')
    await userEvent.tab()
    expect(await screen.findByText('Translations of this line are now out of date.')).toBeInTheDocument()
    expect(await text(ports, 'content/messages/fr.json')).toBe(fr)
  })

  it('names each language that needs a change before the game builds, after a line is added', async () => {
    await open({ ...SHOP, 'content/messages/fr.json': '{}\n' })
    await userEvent.click(screen.getByRole('button', { name: 'Add a line' }))
    await userEvent.type(screen.getByLabelText('What do they say?'), 'Closing soon.')
    await userEvent.click(screen.getByRole('button', { name: 'Add this line' }))
    expect(await screen.findByText('French needs this change before the game builds.')).toBeInTheDocument()
  })

  it('shows no key anywhere on the page', async () => {
    await open(SHOP)
    await userEvent.click(screen.getByRole('button', { name: "Shopkeeper's talk" }))
    const shown = document.body.textContent ?? ''
    expect(shown).not.toMatch(/shop\.|[a-z]+_[a-z]+|\bnext\b|\bchoices\b|\bstance\b|\bwhen\b|\bkind\b/)
  })
})

describe('Writer conversations', () => {
  async function talk() {
    const opened = await open(SHOP)
    await userEvent.click(screen.getByRole('button', { name: "Shopkeeper's talk" }))
    return opened
  }

  it('reads the parts from the start, each with its lines and choices', async () => {
    await talk()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings.slice(0, 4)).toEqual(['Hello', 'Browsing', 'Key', 'Goodbye'])
    const hello = screen.getByRole('article', { name: 'Hello' })
    expect(within(hello).getByLabelText('Shopkeeper says')).toHaveValue('Welcome in. Mind the step.')
    expect(within(hello).getAllByLabelText('You say')[0]).toHaveValue("I'm just looking.")
    expect(within(hello).getAllByLabelText('Goes to')[0]).toHaveValue('browsing')
    expect(within(hello).getByText('Remembers: asked key = yes')).toBeInTheDocument()
  })

  it('sets how a choice moves the standing, within the canon’s range', async () => {
    const { ports } = await talk()
    const choice = within(screen.getByRole('article', { name: 'Hello' })).getByRole('region', {
      name: 'Choice 2',
    })
    await userEvent.selectOptions(within(choice).getByLabelText('Standing'), 'Colder −1')
    await vi.waitFor(async () => expect(await text(ports, DIALOGUE)).toContain('stance = -1'))
  })

  it('adds a choice that leads to a new part, as two undo steps, one per file', async () => {
    const { ports, session } = await talk()
    const goodbye = screen.getByRole('article', { name: 'Goodbye' })
    await userEvent.click(within(goodbye).getByRole('button', { name: 'Add a choice' }))
    await userEvent.type(within(goodbye).getByLabelText('What does the player say?'), 'Wait, one more thing.')
    await userEvent.selectOptions(within(goodbye).getByLabelText('Where does it go?'), 'A new part…')
    await userEvent.type(within(goodbye).getByLabelText('What is the new part called?'), 'One more thing')
    await userEvent.click(within(goodbye).getByRole('button', { name: 'Add this choice' }))
    await vi.waitFor(async () => expect(await text(ports, DIALOGUE)).toContain('one_more_thing'))
    expect(await text(ports, LINES)).toContain('words = "Wait, one more thing."')
    // The new part goes on to the way out, so it does not end the conversation by itself (and Writer blames no one).
    expect(await text(ports, DIALOGUE)).toMatch(/one_more_thing[\s\S]*?next\s*=\s*"goodbye"/)
    expect(document.body.textContent).not.toMatch(/ends the conversation by itself|second way out/)
    const undo = session.trail.hook()
    expect(undo.undoLabel()).toBe('Add a choice')
    undo.undo()
    await vi.waitFor(() => expect(undo.undoLabel()).toBe('Add a part'))
    undo.undo()
    await vi.waitFor(() => expect(undo.undoLabel()).toBe("Write the player's line"))
    expect(session.files?.lines.toml.history.state.text).toContain('Wait, one more thing.')
    undo.undo()
    await vi.waitFor(() =>
      expect(session.files?.lines.toml.history.state.text).not.toContain('Wait, one more thing.'),
    )
  })

  it('says a part only if a fact holds, and writes it', async () => {
    const { ports } = await talk()
    const key = screen.getByRole('article', { name: 'Key' })
    await userEvent.click(within(key).getByRole('button', { name: 'Only if…' }))
    await userEvent.type(within(key).getByLabelText('Which fact?'), 'asked_key')
    await userEvent.click(within(key).getByRole('button', { name: 'Add this condition' }))
    await vi.waitFor(async () => expect(await text(ports, DIALOGUE)).toContain('fact = "asked_key"'))
    expect(await within(key).findByText('Only if asked key is yes')).toBeInTheDocument()
  })

  it('renames a part that many choices lead to, and every place follows', async () => {
    const { ports } = await talk()
    const browsing = screen.getByRole('article', { name: 'Browsing' })
    await userEvent.click(within(browsing).getByRole('button', { name: 'Rename this part' }))
    const field = within(browsing).getByLabelText('What is this part called?')
    await userEvent.clear(field)
    await userEvent.type(field, 'Looking around')
    await userEvent.click(within(browsing).getByRole('button', { name: 'Rename' }))
    await vi.waitFor(async () => expect(await text(ports, DIALOGUE)).toContain('looking_around'))
    const written = (await text(ports, DIALOGUE)) ?? ''
    expect(written).not.toMatch(/\bbrowsing\b/)
    expect(written.match(/looking_around/g)?.length).toBeGreaterThanOrEqual(2)
    expect(await screen.findByRole('article', { name: 'Looking around' })).toBeInTheDocument()
  })

  it('refuses a name another part has, in words', async () => {
    await talk()
    const browsing = screen.getByRole('article', { name: 'Browsing' })
    await userEvent.click(within(browsing).getByRole('button', { name: 'Rename this part' }))
    const field = within(browsing).getByLabelText('What is this part called?')
    await userEvent.clear(field)
    await userEvent.type(field, 'Goodbye')
    await userEvent.click(within(browsing).getByRole('button', { name: 'Rename' }))
    expect(await screen.findByText('There is already a part called Goodbye.')).toBeInTheDocument()
  })

  it('says what is wrong beside the part, in words', async () => {
    await open({
      [LINES]: lines,
      [DIALOGUE]: `${dialogue}\n[graphs.nodes.lonely]\nsay = []\nnext = "goodbye"\n`,
    })
    await userEvent.click(screen.getByRole('button', { name: "Shopkeeper's talk" }))
    const lonely = screen.getByRole('article', { name: 'Lonely' })
    expect(within(lonely).getByText('Nothing leads to Lonely, so no one can reach it.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 problem in the conversations.')
  })

  it('plays the conversation through: lines, a choice, Next, the end', async () => {
    await talk()
    await userEvent.click(screen.getByRole('button', { name: 'Play it' }))
    const play = screen.getByRole('region', { name: 'Playing the conversation' })
    expect(within(play).getByText(/Welcome in\. Mind the step\./)).toBeInTheDocument()
    await userEvent.click(within(play).getByRole('button', { name: "I'm just looking." }))
    await userEvent.click(await within(play).findByRole('button', { name: 'Next' }))
    expect(await within(play).findByText(/Mind the step on the way out\./)).toBeInTheDocument()
    expect(within(play).getByText('The end.')).toBeInTheDocument()
  })
})
