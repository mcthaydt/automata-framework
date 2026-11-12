// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EditorCard, HomeState } from '#src/features/suite/shell/home-model.ts'
import SuiteHome from '#src/features/suite/shell/SuiteHome.svelte'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

// Home asks what to change, and each card says in a plain line what the editor is for and what is in it.

const file = (path: string, editor: string): WorkspaceFile => ({
  path,
  editor,
  gates: [],
  checks: ['content'],
  modes: ['edit'],
  writable: true,
})

const card = (
  editor: string,
  label: string,
  files: readonly WorkspaceFile[] = [],
  installed = true,
): EditorCard => ({
  editor,
  label,
  entry: installed ? editor : undefined,
  installed,
  files,
  rows: files,
  viewOnly: false,
})

const LINES: readonly (readonly [string, string, string])[] = [
  ['tuner', 'Tuner', 'Speeds, jumps and the keys that play it, tried while you play.'],
  ['levels-2d', 'Levels', 'Draw the places your game happens in.'],
  ['studio', 'Characters', 'What each person and thing looks like.'],
  ['feel', 'Feel', 'Shakes, freezes and flashes when something happens.'],
  ['audio', 'Audio', 'Sounds and music, and when each one plays.'],
  ['writer', 'Writer', 'What people say to each other.'],
  ['sequence', 'Sequence', 'Cutscenes: who moves, what shows and when.'],
  ['schematic', 'Schematic', 'How characters behave: where they walk, what they notice.'],
]

function mount(cards: readonly EditorCard[], sample = false) {
  const onopen = vi.fn()
  const onread = vi.fn()
  const home: HomeState = { kind: 'cards', cards }
  render(SuiteHome, { home, sample, onopen, onread })
  return { onopen, onread }
}

const cardOf = (name: string): HTMLElement => screen.getByRole('region', { name })

describe('Home', () => {
  it('lists the characters on the card that is a view of the levels, and offers no Start button on it', () => {
    mount([{ ...card('levels-2d', 'Characters', []), viewOnly: true, names: ['Hero', 'Slime'] }])
    expect(cardOf('Characters')).toHaveTextContent('Hero · Slime')
    expect(within(cardOf('Characters')).queryByRole('button', { name: /start|new/i })).toBeNull()
  })

  it('asks what you want to change, and says where changes are kept', () => {
    mount([card('tuner', 'Tuner')])
    expect(screen.getByRole('heading', { level: 1, name: 'What do you want to change?' })).toBeInTheDocument()
    expect(
      screen.getByText("Pick a part of your game. Everything you change is saved in your game's folder."),
    ).toBeInTheDocument()
  })

  it('on the sample it does not promise a folder, because nothing is saved', () => {
    mount([card('tuner', 'Tuner')], true)
    expect(screen.queryByText(/saved in your game's folder/)).toBeNull()
    expect(screen.getByText('Pick a part of the sample to try.')).toBeInTheDocument()
  })

  it.each(LINES)('the %s card is named once and says what it is for', (editor, label, line) => {
    mount([card(editor, label)])
    const section = cardOf(label)
    expect(within(section).getAllByText(label)).toHaveLength(1)
    expect(within(section).getByText(line)).toBeInTheDocument()
  })

  it('names what is in a card from the game, never a path', () => {
    mount([
      card('levels-2d', 'Levels', [
        file('content/rooms/start.af2d.json', 'levels-2d'),
        file('content/rooms/shop.af2d.json', 'levels-2d'),
      ]),
    ])
    const section = cardOf('Levels')
    expect(section).toHaveTextContent('Start · Shop')
    expect(section.textContent).not.toMatch(/content\/|\.json/)
  })

  it('says an editor with no file has nothing yet and how to start', () => {
    mount([card('feel', 'Feel')])
    expect(cardOf('Feel')).toHaveTextContent('Nothing made yet. Open it to start.')
  })

  it('opens the editor from its card', async () => {
    const { onopen } = mount([card('feel', 'Feel', [file('content/feel.toml', 'feel')])])
    await userEvent.click(within(cardOf('Feel')).getByRole('button', { name: 'Feel' }))
    expect(onopen).toHaveBeenCalledWith(expect.objectContaining({ editor: 'feel' }))
  })

  it('an editor this build lacks opens its files read only, by name', async () => {
    const { onread, onopen } = mount([card('writer', 'Writer', [file('content/talk.toml', 'writer')], false)])
    await userEvent.click(within(cardOf('Writer')).getByRole('button', { name: 'Talk' }))
    expect(onread).toHaveBeenCalledOnce()
    expect(onopen).not.toHaveBeenCalled()
  })

  it('has the colours control at the foot, Dark first', () => {
    mount([card('tuner', 'Tuner')])
    const group = screen.getByRole('radiogroup', { name: 'Editor colours' })
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label') ?? radio.textContent),
    ).toEqual(['Dark', 'Light', 'Match device'])
  })
})
