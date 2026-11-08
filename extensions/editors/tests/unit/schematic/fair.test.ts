// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { CheckResult } from '@automata/editor/kit/ports'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import type { SystemsDef } from '@automata/systems/sim'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { stringify } from 'smol-toml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import FairCanvas from '#src/features/schematic/FairCanvas.svelte'
import { fairVerdict, scenarioWords } from '#src/features/schematic/fair-words.ts'
import { namesOf } from '#src/features/schematic/names.ts'
import SchematicStatus from '#src/features/schematic/SchematicStatus.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import { newAgent, newSystemsFile } from '#src/features/schematic/starter.ts'

const scene: SystemsDef = {
  ...newSystemsFile('hall', { ...newAgent('porter'), modes: ['patrol'], speed: { patrol: 1 } }),
  scenarios: [
    {
      id: 'hide-and-pass',
      claims: 'A careful player who hides gets past the porter',
      setup: { place: { player: { x: 0, z: 0 } } },
      policy: 'careful',
      expect: { condition: [{ at: 'lobby' }], within: 90, probability: 0.8 },
      seeds: 20,
    },
  ],
}
const text = `# How this scene's characters behave.\n${stringify(scene as unknown as Record<string, unknown>)}`

const pass = (value: number): Omit<CheckResult, 'check'> => ({
  status: value >= 0.7 ? 'pass' : 'fail',
  findings: [],
  measure: [
    { id: 'cautiousWin', label: 'A careful player wins', value, threshold: 0.7, ok: value >= 0.7 },
    { id: 'telegraph', label: 'Warning before a threat, in seconds', value: 1.5, threshold: 1, ok: true },
  ],
  output: '',
})

async function open(check?: (wins: number) => Omit<CheckResult, 'check'>, wins = { value: 0.9 }) {
  const respond = vi.fn(async () => (check ?? pass)(wins.value))
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': text,
      'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string,
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
    checks: [
      {
        id: 'fair-play',
        when: 'after',
        run: ['node', 'fair.ts', '{scene}'],
        joins: [],
        measure: true,
        respond,
      },
    ],
  })
  const session = await createSchematic().open(await ports.workspace.files('schematic'), ports)
  session.chosen = { kind: 'fair' }
  render(FairCanvas, { props: { session } })
  return { session, respond }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('what the scenarios say', () => {
  it('reads a scenario as a sentence', () => {
    expect(scenarioWords(scene.scenarios[0] as SystemsDef['scenarios'][number], namesOf(scene, 0))).toBe(
      'A careful player who hides gets past the porter: a careful player is at lobby within 90 s, in at least 80 % of 20 tries.',
    )
  })

  it('says a scenario with no claim by its name', () => {
    const bare = { ...(scene.scenarios[0] as SystemsDef['scenarios'][number]), claims: undefined }
    expect(scenarioWords(bare, namesOf(scene, 0))).toMatch(/^Hide and pass: /)
  })
})

describe('the verdict', () => {
  it('counts the checks that pass', () => {
    expect(fairVerdict({ check: 'fair-play', ...pass(0.9) })).toBe('Fair: 2 of 2 checks pass.')
  })

  it('names the first check that does not, with its number and its target', () => {
    expect(fairVerdict({ check: 'fair-play', ...pass(0.4) })).toBe(
      'Not fair yet: a careful player wins is 0.4, the target is 0.7. 1 of 2 checks pass.',
    )
  })

  it('says why a check could not run', () => {
    expect(
      fairVerdict({ check: 'fair-play', status: 'error', findings: [], output: 'Error: no scene module' }),
    ).toBe('The check could not run: Error: no scene module')
  })

  it('shows the failing finding when the check measures nothing', () => {
    expect(
      fairVerdict({
        check: 'fair-play',
        status: 'fail',
        findings: [{ severity: 'error', message: 'scenario hide-and-pass: 3/20 within 90 s (expected 0.8)' }],
        output: '',
      }),
    ).toBe('Not fair yet: scenario hide-and-pass: 3/20 within 90 s (expected 0.8)')
  })
})

describe('the Fair play page', () => {
  it('lists the scenarios as sentences and the thresholds as numbers with words', async () => {
    await open()
    expect(await screen.findByText(/A careful player who hides gets past the porter: /)).toBeInTheDocument()
    expect(screen.getByLabelText('A careful player wins at least')).toHaveValue(90)
    expect(screen.getByLabelText('The first threat comes after at least')).toHaveValue(20)
  })

  it('changes a threshold without running any fair-play check', async () => {
    const { session, respond } = await open()
    const field = await screen.findByLabelText('A careful player wins at least')
    await userEvent.clear(field)
    await userEvent.type(field, '70{Enter}')
    expect(session.def?.fairness.cautiousWin).toBeCloseTo(0.7)
    expect(respond).not.toHaveBeenCalled()
  })

  it('runs the check when Check now is pressed, by its id, on the file as it is now', async () => {
    const { respond } = await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Check now' }))
    expect(await screen.findByText('Fair: 2 of 2 checks pass.')).toBeInTheDocument()
    expect(respond).toHaveBeenCalledTimes(1)
    const input = respond.mock.calls[0] as unknown as [{ candidates: { path: string; text: string }[] }]
    expect(input[0].candidates[0]?.path).toBe('content/systems/hall.toml')
    expect(input[0].candidates[0]?.text).toContain('cautiousWin')
  })

  it('shows what the check measured, each with its target', async () => {
    await open((wins) => pass(wins), { value: 0.4 })
    await userEvent.click(await screen.findByRole('button', { name: 'Check now' }))
    expect(
      await screen.findByText(/Not fair yet: a careful player wins is 0.4, the target is 0.7/),
    ).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'What the check measured' })).getAllByRole(
      'listitem',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('A careful player wins: 0.4 (target 0.7)')
  })

  it('greys the result once the file changes, and says so', async () => {
    await open()
    await userEvent.click(await screen.findByRole('button', { name: 'Check now' }))
    await screen.findByText('Fair: 2 of 2 checks pass.')
    expect(screen.queryByText('This is from before your last change. Check again.')).toBeNull()
    const field = screen.getByLabelText('A careful player wins at least')
    await userEvent.clear(field)
    await userEvent.type(field, '80{Enter}')
    await waitFor(() =>
      expect(screen.getByText('This is from before your last change. Check again.')).toBeInTheDocument(),
    )
  })

  it('says on the status line when fair play was last checked, in changes', async () => {
    const { session } = await open()
    const statusText = () =>
      screen
        .getAllByRole('status')
        .map((s) => s.textContent)
        .join(' ')
    render(SchematicStatus, { props: { session } })
    expect(statusText()).toContain('Fair play: not checked yet.')
    await userEvent.click(await screen.findByRole('button', { name: 'Check now' }))
    await waitFor(() => expect(statusText()).toContain('Fair play: checked on this version.'))
    const field = screen.getByLabelText('A careful player wins at least')
    await userEvent.clear(field)
    await userEvent.type(field, '80{Enter}')
    await waitFor(() => expect(statusText()).toContain('Fair play: last checked 1 change ago.'))
  })

  it('says what is missing when the game has no fair-play check', async () => {
    const { ports } = await createMemoryPorts({
      files: {
        [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
        'content/systems/hall.toml': text,
        'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string,
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
    session.chosen = { kind: 'fair' }
    render(FairCanvas, { props: { session } })
    expect(
      await screen.findByText(
        'Your game cannot check fair play yet. Ask whoever writes your game’s code to add a fair-play check.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull()
    expect(screen.getByRole('link', { name: 'How to add it' })).toHaveAttribute('href')
  })
})
