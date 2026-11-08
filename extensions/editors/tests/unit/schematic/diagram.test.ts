// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import type { AgentDef } from '@automata/systems/sim'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import CharacterCanvas from '#src/features/schematic/CharacterCanvas.svelte'
import { DECIDE_LINES, modeNotes, switchNote } from '#src/features/schematic/decide-words.ts'
import { namesOf } from '#src/features/schematic/names.ts'
import { NO_NAMES } from '#src/features/schematic/pieces/piece.ts'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import { arrowLabel, groupOf, switchWords, wrapLabel } from '#src/features/schematic/switch-words.ts'

const HALL = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const NAV = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string

const drawn = () => within(screen.getByRole('region', { name: 'Diagram' }))

async function open(systems = HALL) {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': systems,
      'content/nav/hall.toml': NAV,
    },
    classify: (path) => ({
      path,
      editor: 'schematic',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
    changeSet: false,
  })
  const session = await createSchematic().open(await ports.workspace.files('schematic'), ports)
  render(CharacterCanvas, { props: { session } })
  return session
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the diagram', () => {
  it('draws each mode as a button with its speed, and selects it', async () => {
    const session = await open()
    const patrol = screen.getByRole('button', { name: 'Patrol, 1.4 m/s, where it starts' })
    expect(screen.getByRole('button', { name: 'Hunt, 2.2 m/s' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hunt, 2.2 m/s' }))
    expect(session.selected).toEqual({ kind: 'mode', mode: 'hunt' })
    expect(screen.getByRole('button', { name: 'Hunt, 2.2 m/s' })).toHaveAttribute('aria-pressed', 'true')
    expect(patrol).toHaveAttribute('aria-pressed', 'false')
  })

  it('labels an arrow with its first condition, then how many more', async () => {
    await open()
    const arrow = drawn().getByRole('button', {
      name: /Search to Patrol: has got where it was going and has stood still more than 5 s/,
    })
    expect(within(arrow).getByText('has got where it was')).toBeInTheDocument()
    expect(within(arrow).getByText('going and 1 more')).toBeInTheDocument()
    expect(
      within(drawn().getByRole('button', { name: /Patrol to Hunt: sees the player/ })).getByText(
        'sees the player',
      ),
    ).toBeInTheDocument()
    expect(wrapLabel('a b')).toEqual(['a b'])
    expect(wrapLabel('one two three four five six seven eight nine ten eleven twelve')).toEqual([
      'one two three four',
      'five six seven eight…',
    ])
  })

  it('selects a switch by its arrow', async () => {
    const session = await open()
    await userEvent.click(drawn().getByRole('button', { name: /Patrol to Hunt: sees the player/ }))
    expect(session.selected).toEqual({ kind: 'switch', index: 0 })
  })

  it('draws a switch it asks when it stops dashed, with its mark', async () => {
    await open()
    const arrow = drawn().getByRole('button', { name: /Search to Patrol/ })
    expect(arrow).toHaveAttribute('data-timing', 'stops')
    expect(within(arrow).getByText('when it stops')).toBeInTheDocument()
    expect(drawn().getByRole('button', { name: /Patrol to Hunt: sees/ })).toHaveAttribute(
      'data-timing',
      'always',
    )
  })

  it('marks the patrol mode', async () => {
    await open()
    expect(
      within(screen.getByRole('button', { name: /^Patrol,/ })).getByText('Walks its patrol here'),
    ).toBeInTheDocument()
  })

  it('names the box for any mode, and a mode that stands still', async () => {
    const still = HALL.replace('search = 1.4', 'search = 0').concat(`
[[agents.transitions]]
from = "*"
to = "hunt"
priority = 90
when = [{ touching = true }]
`)
    await open(
      still.replace(
        '[[agents.senses]]\n[agents.senses.touch]\nradius = 0.6',
        '[[agents.senses]]\n[agents.senses.touch]\nradius = 0.6',
      ),
    )
    expect(screen.getByRole('button', { name: 'Any mode it moves in, while it moves' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search, stands still' })).toHaveAttribute('data-still', 'true')
  })
})

describe('the list', () => {
  it('has the three groups the game asks switches in', async () => {
    await open()
    const groups = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(groups).toEqual([
      'All the time',
      'When it hears something',
      'When it stops or is stuck',
      'How it decides',
    ])
    const always = screen.getByRole('region', { name: 'All the time' })
    expect(
      within(always)
        .getAllByRole('button')
        .map((b) => b.textContent?.trim()),
    ).toEqual([
      'Patrol to Hunt: sees the player',
      'Search to Hunt: sees the player',
      'Hunt to Hunt: sees the player',
      'Hunt to Search: does not see the player',
    ])
    expect(
      within(screen.getByRole('region', { name: 'When it stops or is stuck' })).getAllByRole('button'),
    ).toHaveLength(1)
    expect(
      within(screen.getByRole('region', { name: 'When it hears something' })).getByText('None.'),
    ).toBeInTheDocument()
  })

  it('says the rules the game decides by', async () => {
    await open()
    const rules = screen.getByRole('region', { name: 'How it decides' })
    for (const line of DECIDE_LINES) expect(within(rules).getByText(line)).toBeInTheDocument()
  })

  it('selects a switch from the list', async () => {
    const session = await open()
    await userEvent.click(
      within(screen.getByRole('region', { name: 'When it stops or is stuck' })).getByRole('button'),
    )
    expect(session.selected).toEqual({ kind: 'switch', index: 4 })
  })
})

describe('what the editor says about a mode and a switch', () => {
  const agent = (over: Partial<AgentDef>): AgentDef => ({
    id: 'sentry',
    modes: ['patrol', 'alarm'],
    initial: 'patrol',
    speed: { patrol: 1, alarm: 0 },
    senses: [],
    transitions: [],
    ...over,
  })

  it('warns of a switch that cannot happen: it waits in a mode where it stands still', () => {
    const def = agent({ transitions: [{ from: 'alarm', to: 'patrol', when: [{ timer: 8 }], priority: 1 }] })
    expect(switchNote(def, 0)).toBe('This never happens: it stands still in Alarm.')
    expect(modeNotes(def, 'alarm')).toEqual(['stands still'])
  })

  it('says a switch with no condition happens every time it is checked', () => {
    const def = agent({ transitions: [{ from: 'patrol', to: 'alarm', when: [], priority: 1 }] })
    expect(switchNote(def, 0)).toBe(
      'With no condition this switches every time it is checked. Add one to make it wait.',
    )
  })

  it('reads a switch from any mode as "From any mode it moves in to …"', () => {
    const def = agent({ transitions: [{ from: '*', to: 'alarm', when: [], priority: 1 }] })
    expect(switchWords(def.transitions[0] as never, NO_NAMES)).toBe(
      'From any mode it moves in to Alarm: always',
    )
  })

  it('warns of a mode that may switch at once: it waits, and nothing resets the wait on the way in', () => {
    const def = agent({
      modes: ['patrol', 'search'],
      speed: { patrol: 1, search: 1 },
      transitions: [
        { from: 'patrol', to: 'search', when: [{ sees: true }], priority: 1 },
        { from: 'search', to: 'patrol', when: [{ timer: 5 }], priority: 1 },
      ],
    })
    expect(modeNotes(def, 'search')).toEqual([
      'This may switch at once: nothing resets its wait on the way in.',
    ])
    const reset: AgentDef = {
      ...def,
      transitions: [
        {
          from: 'patrol',
          to: 'search',
          when: [{ sees: true }],
          priority: 1,
          do: [{ set: 'self.timer', to: 0 }],
        },
        ...def.transitions.slice(1),
      ],
    }
    expect(modeNotes(reset, 'search')).toEqual([])
  })

  it('orders a group by its order number, ties in the order written', () => {
    const def = agent({
      speed: { patrol: 1, alarm: 1 },
      transitions: [
        { from: 'patrol', to: 'alarm', when: [], priority: 1 },
        { from: 'patrol', to: 'alarm', when: [], priority: 9 },
        { from: 'alarm', to: 'patrol', when: [], priority: 1 },
        { from: 'alarm', to: 'patrol', when: [{ heard: '*' }], priority: 5 },
      ],
    })
    expect(groupOf(def, 'always')).toEqual([1, 0, 2])
    expect(groupOf(def, 'hears')).toEqual([3])
    const names = namesOf(
      {
        scene: 's',
        objects: [],
        matrix: [],
        tunables: {},
        rules: [],
        agents: [def],
        scenarios: [],
        fairness: {
          cautiousWin: 1,
          firstThreatAfter: 1,
          telegraph: 1,
          maxDeathsPerRun: 1,
          safeWindowMargin: 1,
        },
      },
      0,
    )
    expect(arrowLabel(def, [0, 1], names)).toBe('always and 1 more')
  })
})
