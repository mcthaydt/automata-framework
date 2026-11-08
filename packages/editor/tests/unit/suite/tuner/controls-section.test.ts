// @vitest-environment jsdom
import { PROMPT_COPY, padLabel } from '@automata/framework'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { readControls } from '#src/features/suite/tuner/controls-section.ts'
import { createTunerController, type TunerController } from '#src/features/suite/tuner/tuner-controller.ts'
import TunerRows from '#src/features/suite/tuner/ui/TunerRows.svelte'
import {
  CONTROLS_FIXTURE,
  controlsFixtureFiles,
  tunerFixtureFiles,
  tunerFixturePorts,
} from '#src/testing/suite/tuner-fixtures.ts'

// The Tuner's Controls section: a game's default controls (content/controls.toml) as rows, each edit one literal and one
// undo step. The model reads the rows in a player's words; the section adds a key by listening for one.

const PATH = 'content/controls.toml'
const open = async (files = controlsFixtureFiles()): Promise<TunerController> =>
  createTunerController(await tunerFixturePorts(files))
const written = async (controller: TunerController): Promise<string> =>
  controller.session.history.state.controls ?? ''

afterEach(() => document.body.replaceChildren())

describe('readControls', () => {
  it('lists one row per action, with the key and pad names a player sees', () => {
    const read = readControls(CONTROLS_FIXTURE)
    if ('problem' in read) throw new Error(read.problem)
    expect(read.rows.map((row) => row.label)).toEqual(['Left', 'right'])
    expect(read.rows[0]?.keys).toEqual([
      { code: 'ArrowLeft', label: '←' },
      { code: 'KeyA', label: 'A' },
    ])
    expect(read.rows[0]?.pads.map((pad) => pad.label)).toEqual([
      padLabel(14, 'generic', PROMPT_COPY),
      padLabel(0, 'generic', PROMPT_COPY),
    ])
    expect(read.rows[1]?.touch).toBe(false)
  })

  it('says what is wrong with a file the game could not read', () => {
    expect(readControls('command = "move"\n')).toEqual({
      problem: 'content/controls.toml: A controls file needs at least one action.',
    })
    expect(readControls('command = ')).toMatchObject({
      problem: expect.stringContaining('content/controls.toml'),
    })
  })
})

describe('the session', () => {
  it('has controls only when the game has the file', async () => {
    expect((await open()).session.hasControls()).toBe(true)
    expect((await open(tunerFixtureFiles())).session.hasControls()).toBe(false)
  })

  it('renames an action by rewriting its one literal, and Undo takes it back', async () => {
    const controller = await open()
    expect(await controller.session.setControlLabel('left', 'Go left')).toEqual({ ok: true })
    expect(await written(controller)).toBe(CONTROLS_FIXTURE.replace('label = "Left"', 'label = "Go left"'))
    await controller.session.undo()
    expect(await written(controller)).toBe(CONTROLS_FIXTURE)
  })

  it('names an action that had no name, writing the label in', async () => {
    const controller = await open()
    await controller.session.setControlLabel('right', 'Right')
    expect(await written(controller)).toContain('label = "Right"')
    expect(readControls(await written(controller))).toMatchObject({ rows: [{}, { label: 'Right' }] })
  })

  it('adds a key and removes one, each one undo step, and never a key kept for the menus', async () => {
    const controller = await open()
    expect(await controller.session.addControlKey('left', 'KeyJ')).toEqual({ ok: true })
    expect(await written(controller)).toContain('keys = ["ArrowLeft", "KeyA", "KeyJ"]')
    expect(await controller.session.removeControlKey('left', 'KeyA')).toEqual({ ok: true })
    expect(await written(controller)).toContain('keys = ["ArrowLeft", "KeyJ"]')
    expect(await controller.session.addControlKey('left', 'Escape')).toEqual({
      ok: false,
      message: 'That key is kept for the menus.',
    })
    expect(await controller.session.addControlKey('left', 'Tab')).toMatchObject({ ok: false })
    expect(await controller.session.addControlKey('left', 'KeyJ')).toMatchObject({ ok: false })
  })

  it('turns the touch button of an action on and off', async () => {
    const controller = await open()
    await controller.session.setControlTouch('right', true)
    expect(await written(controller)).toContain('keys = ["ArrowRight"]\ntouch = true')
  })

  it('writes controls.toml through the workspace, and nothing else', async () => {
    const ports = await tunerFixturePorts(controlsFixtureFiles())
    const controller = await createTunerController(ports)
    await controller.session.addControlKey('left', 'KeyJ')
    expect((await ports.workspace.read(PATH))?.text).toContain('"KeyJ"')
    expect((await ports.workspace.read('content/tuning.toml'))?.text).toBe(
      tunerFixtureFiles()['content/tuning.toml'],
    )
  })
})

describe('the Controls section', () => {
  const rowOf = (name: string) => screen.getByTestId(`controls-row-${name}`)

  it('shows no section for a game without controls', async () => {
    render(TunerRows, { controller: await open(tunerFixtureFiles()) })
    expect(screen.queryByRole('region', { name: 'Controls' })).toBeNull()
  })

  it('shows one row per action with its name, its keys and its pad buttons', async () => {
    render(TunerRows, { controller: await open() })
    const left = rowOf('left')
    expect(within(left).getByRole('textbox', { name: 'Name' })).toHaveProperty('value', 'Left')
    // ArrowLeft, and the pad's D-pad left (button 14), are both drawn as an arrow.
    expect(within(left).getAllByText('←')).toHaveLength(2)
    expect(within(left).getByText('A')).toBeTruthy()
    expect(within(left).getByText(padLabel(0, 'generic', PROMPT_COPY))).toBeTruthy()
  })

  it('renames an action in place', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const field = within(rowOf('left')).getByRole('textbox', { name: 'Name' })
    await user.clear(field)
    await user.type(field, 'Go left{Enter}')
    expect(await written(controller)).toContain('label = "Go left"')
  })

  it('adds a key by listening for one: it says so, offers Cancel, and takes the next key', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    await user.click(within(rowOf('left')).getByRole('button', { name: 'Add key' }))
    expect(screen.getByText('Press a key on your keyboard.')).toBeTruthy()
    await user.keyboard('j')
    expect(await written(controller)).toContain('"KeyJ"')
    expect(screen.queryByText('Press a key on your keyboard.')).toBeNull()
    expect(within(rowOf('left')).getByText('J')).toBeTruthy()
  })

  it('ends with no edit on Cancel, on Escape, and never takes Tab (a phone has no Escape)', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const add = () => within(rowOf('left')).getByRole('button', { name: 'Add key' })
    await user.click(add())
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Press a key on your keyboard.')).toBeNull()
    await user.click(add())
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Press a key on your keyboard.')).toBeNull()
    await user.click(add())
    await user.keyboard('{Tab}')
    expect(await written(controller)).toBe(CONTROLS_FIXTURE)
    expect(controller.session.history.canUndo).toBe(false)
  })

  it('removes a key from its row', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    await user.click(within(rowOf('left')).getByRole('button', { name: 'Remove A from Left' }))
    expect(await written(controller)).toContain('keys = ["ArrowLeft"]')
  })

  it('has a switch for the button on touch screens', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    const touch = within(rowOf('right')).getByRole('switch', { name: 'Show a button on touch screens' })
    expect(touch.getAttribute('aria-checked')).toBe('false')
    await user.click(touch)
    expect(await written(controller)).toContain('touch = true')
  })

  it('undoes an edit through the same history as the settings', async () => {
    const user = userEvent.setup()
    const controller = await open()
    render(TunerRows, { controller })
    await user.click(within(rowOf('right')).getByRole('switch', { name: 'Show a button on touch screens' }))
    await controller.undo()
    expect(await written(controller)).toBe(CONTROLS_FIXTURE)
  })
})
