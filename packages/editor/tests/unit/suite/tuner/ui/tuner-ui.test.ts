// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createTunerController, type TunerController } from '#src/features/suite/tuner/tuner-controller.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import TunerRows from '#src/features/suite/tuner/ui/TunerRows.svelte'
import { TUNING_FIXTURE, tunerFixtureFiles, tunerFixturePorts } from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner's components in jsdom: the settings (a slider or a number box, never both; a toggle, text, a table that says to change it in the file), the
// bounds a slider cannot leave (EDS-c). What reaches the file is checked through the
// controller's session.

const PATH = 'content/tuning.toml'
const open = async (files = tunerFixtureFiles()): Promise<TunerController> =>
  createTunerController(await tunerFixturePorts(files))
const text = (controller: TunerController): string => controller.session.history.state.text ?? ''

afterEach(() => document.body.replaceChildren())

describe('TunerRows', () => {
  it('draws each kind: a slider where there are bounds, a toggle, a text field, and "change it in the file" for a table', async () => {
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
    expect(within(screen.getByTestId('tuner-row-CURVE')).getByText(/change it in the file/)).toBeTruthy()
  })

  // Build audit C2: one control and one read-out for a value, never a slider and a number box for the same number.
  it('gives a number one control: a slider with bounds, a number box without', async () => {
    const controller = await open()
    render(TunerRows, { controller })
    const bounded = screen.getByTestId('tuner-row-MAX_RUN')
    expect(within(bounded).getByRole('slider', { name: /MAX_RUN/ })).toBeTruthy()
    expect(within(bounded).queryByRole('spinbutton')).toBeNull()
    const free = screen.getByTestId('tuner-row-SCALE')
    expect(within(free).getByRole('spinbutton', { name: /SCALE/ })).toBeTruthy()
    expect(within(free).queryByRole('slider')).toBeNull()
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

  it('a slider stays inside its bounds: End writes the largest, Home the smallest (EDS-c)', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const slider = within(screen.getByTestId('tuner-row-MAX_RUN')).getByRole('slider', { name: /MAX_RUN/ })
    slider.focus()
    await user.keyboard('{End}')
    expect(text(controller)).toContain('MAX_RUN = { value = 768,')
    await user.keyboard('{Home}')
    expect(text(controller)).toContain('MAX_RUN = { value = 128,')
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

describe('the Tuner’s regions', () => {
  // Build audit C2: the settings are the list and each card is where its setting changes, so there is no second list
  // to search and no inspector to repeat the card.
  it('has a canvas only: no panel, no inspector', () => {
    const { regions } = createTuner()
    expect(regions.canvas).toBeDefined()
    expect(regions.panel).toBeUndefined()
    expect(regions.inspector).toBeUndefined()
  })
})

// The grandma audit, section 6.2: a setting is shown by its label and what a player feels, never by its constant name
// or the other game's numbers in the comment.
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

  it('shows a scaled setting in its unit and a step a person can feel, and writes the sim’s number back', async () => {
    const SCALED =
      'MAX_RUN = { value = 384, min = 128, max = 768, step = 1, label = "Running speed", unit = "px/s", scale = 0.234375 }\n'
    const user = userEvent.setup()
    const controller = await open({ [PATH]: SCALED })
    render(TunerRows, { controller })
    const row = screen.getByTestId('tuner-row-MAX_RUN')
    const slider = within(row).getByRole('slider', { name: 'Running speed' })
    expect(slider).toHaveAttribute('aria-valuenow', '90')
    expect(slider).toHaveAttribute('aria-valuemin', '30')
    expect(slider).toHaveAttribute('aria-valuemax', '180')
    expect(row).toHaveTextContent('px/s')
    // One press is one whole pixel a second (91), written as the nearest whole subpixel step (388), never 0.23.
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(text(controller)).toContain('value = 388')
    expect(screen.getByTestId('tuner-row-MAX_RUN')).not.toHaveTextContent(/384|768/)
  })

  it('offers to make the settings file without naming it', async () => {
    const controller = await open({})
    render(TunerRows, { controller })
    expect(screen.getByTestId('tuner-rows')).toHaveTextContent('This game has no settings file yet.')
    expect(screen.getByRole('button', { name: 'Make one' })).toBeTruthy()
  })

  it('puts the controls above the offer to make a settings file, which is not what a new game came for', async () => {
    const controller = await open({
      'content/controls.toml': '[[action]]\nid = "left"\nkeys = ["ArrowLeft"]\n',
    })
    render(TunerRows, { controller })
    const controls = screen.getByTestId('tuner-controls')
    const offer = screen.getByRole('button', { name: 'Make one' })
    expect(controls.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(offer.getAttribute('data-kind')).not.toBe('primary')
  })
})
