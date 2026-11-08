// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Inspector from '#src/features/levels-3d/inspector/Inspector.svelte'
import type { InspectorCard } from '#src/features/levels-3d/inspector/inspector-cards.ts'

// The inspector's cards (plan ED3D.5f step 4; ED3D spec §9): the card for what is selected, its fields from the card, each
// change handed on with the widget's phase, and a refusal in the model's words.

const hall: InspectorCard = {
  kind: 'sector',
  selected: 1,
  id: 'hall',
  floor: 0,
  ceiling: 4,
  light: 1,
  style: undefined,
  floorTexture: 'tile',
  ceilingTexture: undefined,
  wallTexture: 'brick',
  view: undefined,
  pit: false,
  trim: {},
  views: [],
  walls: 4,
  portals: 1,
}

const doorWall: InspectorCard = {
  kind: 'wall',
  selected: 1,
  sector: 'hall',
  corner: 3,
  length: 6,
  type: 'door',
  to: undefined,
  door: { at: 3, width: 1.2, height: 2.2 },
  window: undefined,
  texture: undefined,
  occlude: undefined,
  handrail: undefined,
  frame: undefined,
  mask: undefined,
  preset: undefined,
}

const crate: InspectorCard = {
  kind: 'thing',
  selected: 1,
  definition: 'crate',
  definitionLabel: 'crate',
  id: 'crate1',
  x: 11,
  z: 2,
  y: undefined,
  fields: [
    {
      id: 'contents',
      label: 'contents',
      type: 'enum',
      value: 'tools',
      widget: 'segmented',
      options: ['supplies', 'tools', 'empty'],
    },
  ],
}

function mount(card: InspectorCard, answer: string | undefined = undefined) {
  const onchange = vi.fn(() => answer)
  render(Inspector, { card, onchange })
  return onchange
}

describe('Inspector', () => {
  it('says how to select when nothing is', () => {
    mount({ kind: 'none', selected: 0 })
    expect(screen.getByText('Tap a room, a wall or a thing to see it here.')).toBeInTheDocument()
  })

  it('Time of day lists the times by name and “As the game has it”, and picking one changes the level', async () => {
    const onchange = mount({
      kind: 'none',
      selected: 0,
      time: {
        value: 'dusk',
        options: [
          { id: 'day', label: 'Day' },
          { id: 'dusk', label: 'Dusk' },
        ],
      },
    })
    const time = screen.getByRole('button', { name: /Time of day/ })
    expect(time).toHaveTextContent('Dusk')
    await userEvent.click(time)
    expect(screen.getAllByRole('option').map((each) => each.textContent?.trim())).toEqual([
      'Day',
      'Dusk',
      'As the game has it',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Day' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'level', time: 'day', label: 'Day' }, 'set')
    await userEvent.click(screen.getByRole('button', { name: /Time of day/ }))
    await userEvent.click(screen.getByRole('option', { name: 'As the game has it' }))
    expect(onchange).toHaveBeenLastCalledWith({ kind: 'level', time: null }, 'set')
  })

  it('shows a sector’s heights, light and materials, and a stepper press changes the floor', async () => {
    const onchange = mount(hall)
    expect(screen.getByRole('heading', { name: 'hall' })).toBeInTheDocument()
    expect(screen.getByText('4 walls · 1 portal')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Floor' })).toHaveValue(0)
    expect(screen.getByRole('spinbutton', { name: 'Ceiling' })).toHaveValue(4)
    expect(screen.getByText('tile')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Floor' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', floor: 0.05 }, 'set')
  })

  it('Skirting, Wainscot and Rail are steppers in metres, and none reads 0', async () => {
    const onchange = mount({ ...hall, trim: { wainscot: 1 } })
    expect(screen.getByRole('spinbutton', { name: 'Skirting' })).toHaveValue(0)
    expect(screen.getByRole('spinbutton', { name: 'Wainscot' })).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: 'Increase Rail' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', trim: { rail: 0.05 } }, 'set')
  })

  it('stepping a piece of trim down to 0 takes it off', async () => {
    const onchange = mount({ ...hall, trim: { skirting: 0.05 } })
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Skirting' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', trim: { skirting: null } }, 'set')
  })

  it('Pit is a checkbox that says "Pit (the player falls in)"', async () => {
    const onchange = mount(hall)
    const box = screen.getByRole('checkbox', { name: 'Pit (the player falls in)' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', pit: true }, 'set')
  })

  it('a pit shows ticked', () => {
    mount({ ...hall, pit: true })
    expect(screen.getByRole('checkbox', { name: 'Pit (the player falls in)' })).toBeChecked()
  })

  it('Camera lists the room’s views by name and None, and picking one changes it', async () => {
    const onchange = mount({ ...hall, view: 'middle', views: ['start', 'middle', 'goal'] })
    const camera = screen.getByRole('button', { name: /Camera/ })
    expect(camera).toHaveTextContent('Middle')
    await userEvent.click(camera)
    expect(screen.getAllByRole('option').map((each) => each.textContent?.trim())).toEqual([
      'Start',
      'Middle',
      'Goal',
      'None',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Goal' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', view: 'goal' }, 'set')
  })

  it('Camera None takes the camera off, and a room whose file has no views has no Camera', async () => {
    const onchange = mount({ ...hall, view: 'middle', views: ['start', 'middle'] })
    await userEvent.click(screen.getByRole('button', { name: /Camera/ }))
    await userEvent.click(screen.getByRole('option', { name: 'None' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'sector', id: 'hall', view: null }, 'set')
  })

  it('has no Camera when the file names no views', () => {
    mount(hall)
    expect(screen.queryByRole('button', { name: /Camera/ })).toBeNull()
  })

  it('shows the model’s sentence when a change is refused', async () => {
    mount(hall, 'the floor must be below the ceiling')
    await userEvent.click(screen.getByRole('button', { name: 'Increase Floor' }))
    expect(screen.getByRole('alert')).toHaveTextContent('the floor must be below the ceiling')
  })

  it('shows a wall’s kind and its door, and changes the kind', async () => {
    const onchange = mount(doorWall)
    expect(screen.getByRole('heading', { name: 'Wall 4 of hall' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Door' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('spinbutton', { name: 'Door width' })).toHaveValue(1.2)
    await userEvent.click(screen.getByRole('radio', { name: 'Window' }))
    expect(onchange).toHaveBeenCalledWith({ kind: 'wall', sector: 'hall', corner: 3, type: 'window' }, 'set')
  })

  it('says a portal is made with the Portal tool', () => {
    mount({ ...doorWall, type: 'solid', door: undefined })
    expect(screen.getByRole('radio', { name: 'Portal' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a thing’s definition and place', () => {
    mount(crate)
    expect(screen.getByRole('heading', { name: 'crate1' })).toBeInTheDocument()
    expect(screen.getByText('crate · x 11.00 · z 2.00')).toBeInTheDocument()
  })

  it('says how many are selected when there are several', () => {
    mount({ ...hall, selected: 3 })
    expect(screen.getByText('3 selected: showing the first')).toBeInTheDocument()
  })

  it('deletes a thing from its card (ED3D.7d)', async () => {
    const onchange = mount(crate)
    await userEvent.click(screen.getByRole('button', { name: 'Delete crate1' }))
    expect(onchange).toHaveBeenCalledWith(
      { kind: 'thing', definition: 'crate', id: 'crate1', remove: true },
      'set',
    )
  })

  it('edits a thing’s field: a press sets it as one change (ED3D.7d-b)', async () => {
    const onchange = mount(crate)
    expect(screen.getByRole('radio', { name: 'tools' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'empty' }))
    expect(onchange).toHaveBeenCalledWith(
      { kind: 'thing', definition: 'crate', id: 'crate1', field: 'contents', value: 'empty' },
      'set',
    )
  })

  it('shows the model’s sentence under a field it refuses (ED3D.7d-b)', async () => {
    mount(crate, 'entity crate1: contents is not one of supplies, tools, empty')
    await userEvent.click(screen.getByRole('radio', { name: 'empty' }))
    expect(screen.getByRole('alert')).toHaveTextContent('contents is not one of')
  })
})
