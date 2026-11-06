// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createTunerController, type TunerController } from '#src/features/suite/tuner/tuner-controller.ts'
import TunerInspector from '#src/features/suite/tuner/ui/TunerInspector.svelte'
import TunerPanel from '#src/features/suite/tuner/ui/TunerPanel.svelte'
import TunerRows from '#src/features/suite/tuner/ui/TunerRows.svelte'
import { TUNING_FIXTURE, tunerFixtureFiles, tunerFixturePorts } from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner's components in jsdom (EDS.4a; editor suite spec §6.1): the list, the rows (slider and number box, toggle,
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
    await user.click(within(row).getByRole('button', { name: /Lock MAX_RUN/ }))
    expect(controller.session.locked()).toEqual(['MAX_RUN'])
    expect(within(row).getByRole('button', { name: /Unlock MAX_RUN/ })).toBeTruthy()
    expect(
      within(row)
        .getByRole('slider', { name: /MAX_RUN/ })
        .getAttribute('aria-disabled'),
    ).toBe('true')
    await user.click(within(row).getByRole('button', { name: /Unlock MAX_RUN/ }))
    expect(controller.session.locked()).toEqual([])
  })

  it('offers to create tuning.toml when the game has none', async () => {
    const user = userEvent.setup()
    const controller = await open({})
    render(TunerRows, { controller })
    await user.click(screen.getByRole('button', { name: /Create tuning.toml/ }))
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
    expect(screen.getByText(/Run checks to read bounds/)).toBeTruthy()
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
    await user.type(screen.getByRole('searchbox', { name: /Search tunables/ }), 'grav')
    expect(screen.getAllByRole('button', { name: /^GRAVITY/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^MAX_RUN/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /^GRAVITY/ }))
    render(TunerInspector, { controller })
    expect(within(screen.getByTestId('tuner-inspector')).getByText('GRAVITY')).toBeTruthy()
    expect(within(screen.getByTestId('tuner-inspector')).getByText(/16 to 192/)).toBeTruthy()
  })
})
