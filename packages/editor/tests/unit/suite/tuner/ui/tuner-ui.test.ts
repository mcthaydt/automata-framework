// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createTunerController, type TunerController } from '#src/features/suite/tuner/tuner-controller.ts'
import TunerInspector from '#src/features/suite/tuner/ui/TunerInspector.svelte'
import TunerPanel from '#src/features/suite/tuner/ui/TunerPanel.svelte'
import TunerRows from '#src/features/suite/tuner/ui/TunerRows.svelte'
import { TUNING_FIXTURE, tunerFixtureFiles, tunerFixturePorts } from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner's components in jsdom: the list, the rows (slider and number box, toggle,
// text, Ask only), the refusal of a value past a bound (EDS-c), the lock (EDS-d) and the search. What reaches the file is
// checked through the controller's session.

const PATH = 'content/tuning.toml'
const open = async (files = tunerFixtureFiles()): Promise<TunerController> =>
  createTunerController(await tunerFixturePorts(files))
const text = (controller: TunerController): string => controller.session.history.state.text ?? ''

afterEach(() => document.body.replaceChildren())

describe('TunerRows', () => {
  it('draws each kind: a slider where there are bounds, a toggle, a text field, and "Ask only" for a table', async () => {
    const controller = await open()
    render(TunerRows, { controller })
    const maxRun = screen.getByTestId('tuner-row-MAX_RUN')
    expect(within(maxRun).getByRole('slider', { name: /MAX_RUN/ })).toBeTruthy()
    // The note says what the number is; the unit comes only from a bare unit comment (GRAVITY's).
    expect(within(maxRun).getByText('Celeste: 90 px/s.')).toBeTruthy()
    expect(within(maxRun).queryByText(/384 px\/s/)).toBeNull()
    expect(within(screen.getByTestId('tuner-row-GRAVITY')).getAllByText(/px\/s²/).length).toBeGreaterThan(0)
    // A bare number with the compiler's bounds has a slider too.
    expect(
      within(screen.getByTestId('tuner-row-GRAVITY')).getByRole('slider', { name: /GRAVITY/ }),
    ).toBeTruthy()
    // A number with no bounds is a number box only.
    expect(within(screen.getByTestId('tuner-row-SCALE')).queryByRole('slider')).toBeNull()
    expect(within(screen.getByTestId('tuner-row-DEBUG')).getByRole('radio', { name: 'On' })).toBeTruthy()
    expect(
      within(screen.getByTestId('tuner-row-GREETING')).getByRole('textbox', { name: /GREETING/ }),
    ).toBeTruthy()
    expect(within(screen.getByTestId('tuner-row-CURVE')).getByText(/Ask only/)).toBeTruthy()
  })

  it('names the slider and the number box for assistive technology', async () => {
    const controller = await open()
    render(TunerRows, { controller })
    const row = screen.getByTestId('tuner-row-MAX_RUN')
    expect(within(row).getByRole('slider', { name: /MAX_RUN/ })).toBeTruthy()
    expect(within(row).getByRole('spinbutton', { name: /MAX_RUN/ })).toBeTruthy()
  })

  it('writes a toggle and a text value through the session', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    await user.click(within(screen.getByTestId('tuner-row-DEBUG')).getByRole('radio', { name: 'On' }))
    expect(text(controller)).toContain('DEBUG = true')
    const field = within(screen.getByTestId('tuner-row-GREETING')).getByRole('textbox', { name: /GREETING/ })
    await user.clear(field)
    await user.type(field, 'hi{Enter}')
    expect(text(controller)).toContain('GREETING = "hi"')
  })

  it('refuses a typed value past the bound, says so, and writes nothing (EDS-c)', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const row = screen.getByTestId('tuner-row-MAX_RUN')
    await user.click(within(row).getByRole('spinbutton', { name: /MAX_RUN/ }))
    await user.keyboard('{Control>}a{/Control}9000{Enter}')
    expect(text(controller)).toBe(TUNING_FIXTURE)
    expect(row.textContent).toMatch(/768/)
  })

  it('locks a tunable: its controls refuse and say why (EDS-d)', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const row = screen.getByTestId('tuner-row-MAX_RUN')
    await user.click(within(row).getByRole('button', { name: /^Keep MAX_RUN/ }))
    expect(controller.session.locked()).toEqual(['MAX_RUN'])
    expect(within(row).getByRole('button', { name: /^Keep MAX_RUN/ })).toBeTruthy()
    expect(
      within(row)
        .getByRole('slider', { name: /MAX_RUN/ })
        .getAttribute('aria-disabled'),
    ).toBe('true')
    await user.click(within(row).getByRole('button', { name: /^Keep MAX_RUN/ }))
    expect(controller.session.locked()).toEqual([])
  })

  it('offers to create tuning.toml when the game has none', async () => {
    const user = userEvent.setup()
    const controller = await open({})
    render(TunerRows, { controller })
    await user.click(screen.getByRole('button', { name: 'Make one' }))
    expect(controller.session.hasFile()).toBe(true)
  })

  it('says why a file that does not parse cannot be shown, with its line', async () => {
    const controller = await open({ [PATH]: 'A = 1\nB = \n' })
    render(TunerRows, { controller })
    expect(screen.getByRole('alert').textContent).toMatch(/line 2/)
  })

  it('says the bounds are unavailable when the compiler has not run and a bare number has none', async () => {
    const files = tunerFixtureFiles()
    delete files['content/generated/tuning-meta.json']
    const controller = await open(files)
    render(TunerRows, { controller })
    expect(screen.getByText(/Run the game.s checks once/)).toBeTruthy()
  })
})

describe('TunerPanel', () => {
  it('lists the tunables, filters them by the search, and chooses one for the inspector', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerPanel, { controller })
    expect(
      screen.getAllByRole('button', { name: /^(MAX_RUN|GRAVITY|SCALE|DEBUG|GREETING|CURVE)/ }),
    ).toHaveLength(6)
    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'grav')
    expect(screen.getAllByRole('button', { name: /^GRAVITY/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^MAX_RUN/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /^GRAVITY/ }))
    render(TunerInspector, { controller })
    expect(within(screen.getByTestId('tuner-inspector')).getByText('GRAVITY')).toBeTruthy()
    expect(within(screen.getByTestId('tuner-inspector')).getByText(/16 to 192/)).toBeTruthy()
  })
})

// The grandma audit, section 6.2: a setting is shown by its label and what a player feels, never by its constant name
// or the other game's numbers in the comment; Lock is Keep.
describe('the Tuner in plain words', () => {
  const LABELLED = [
    '# Celeste: 90 px/s.',
    'MAX_RUN = { value = 384, min = 128, max = 768, step = 1, label = "Running speed", feel = "How fast Wick runs." }',
    '',
  ].join('\n')

  it('shows a labelled setting by its label and its feel, never its name in code or the comment', async () => {
    const controller = await open({ [PATH]: LABELLED })
    render(TunerRows, { controller })
    const row = screen.getByTestId('tuner-row-MAX_RUN')
    expect(row).toHaveTextContent('Running speed')
    expect(row).toHaveTextContent('How fast Wick runs.')
    expect(row).not.toHaveTextContent(/MAX_RUN|Celeste/)
    expect(within(row).getByRole('slider', { name: 'Running speed' })).toBeTruthy()
  })

  it('keeps a setting (was Lock), and says what keeping does', async () => {
    const user = userEvent.setup()
    const controller = await open({ [PATH]: LABELLED })
    render(TunerRows, { controller })
    const keep = within(screen.getByTestId('tuner-row-MAX_RUN')).getByRole('button', {
      name: 'Keep Running speed',
    })
    expect(keep).toHaveAttribute('title', 'Keep this value: nothing changes it until you let it go.')
    await user.click(keep)
    expect(controller.session.locked()).toEqual(['MAX_RUN'])
    expect(keep).toHaveTextContent('Kept')
  })

  it('lists the labels, searches settings, and asks for a tap when nothing is chosen', async () => {
    const controller = await open({ [PATH]: LABELLED })
    render(TunerPanel, { controller })
    render(TunerInspector, { controller })
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toBeTruthy()
    expect(
      within(screen.getByTestId('tuner-panel')).getByRole('button', { name: 'Running speed' }),
    ).toBeTruthy()
    expect(screen.getByTestId('tuner-inspector')).toHaveTextContent('Tap a setting to see more.')
  })

  it('offers to make the settings file without naming it', async () => {
    const controller = await open({})
    render(TunerRows, { controller })
    expect(screen.getByTestId('tuner-rows')).toHaveTextContent('This game has no settings file yet.')
    expect(screen.getByRole('button', { name: 'Make one' })).toBeTruthy()
  })
})
