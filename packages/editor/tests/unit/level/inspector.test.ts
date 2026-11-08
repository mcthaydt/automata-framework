// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Inspector from '#src/features/level/Inspector.svelte'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { placeEntity } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { projectHistory } from '#src/shared/level-2d/model/edit-history.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// The inspector, as the approved mockup draws it: no tabs. It shows what is chosen, and with nothing chosen the level
// itself; one chosen instance has its fields, several show their count with Delete and Duplicate. Problems live in
// the top bar, not here. Fields read label-left: each name sits beside its control.

function setup(selected: readonly string[]) {
  const target = { level: 'level-1', layer: 'entities' }
  let project: Project = platformerTemplate.create(counterIds())
  project = placeEntity(project, target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
  project = placeEntity(project, target, { id: 'door-a', def: 'door', x: 96, y: 48 })
  const history = createHistory<unknown>(project)
  const edits = projectHistory(history)
  if (edits === undefined) throw new Error('a project was refused')
  const handlers = { ondelete: vi.fn(), onduplicate: vi.fn() }
  const props = {
    project,
    level: 'level-1',
    selected,
    history: edits,
    ...handlers,
  }
  const view = render(Inspector, props)
  return { history, edits, props, view, ...handlers, user: userEvent.setup() }
}

describe('Inspector', () => {
  it('shows the level with nothing chosen, headed by its name and size, with no tabs', () => {
    setup([])
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Level 1' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Music' })).toBeInTheDocument()
  })

  // The mockup gives the size in tiles, the unit a person draws in, with the tile's size said once; the pixel count a
  // computer thinks in is not shown.
  it('gives the level’s size in tiles, wide and high, and says how big a tile is', () => {
    setup([])
    expect(screen.getByText('32 wide × 18 high')).toBeInTheDocument()
    expect(screen.getByText('Sizes are in tiles of 16 px.')).toBeInTheDocument()
    expect(screen.queryByText(/512/)).toBeNull()
  })

  it('shows one chosen instance and edits its fields as one step each', async () => {
    const { history, edits, user } = setup(['slime-a'])
    expect(screen.getByRole('heading', { level: 2, name: 'Slime' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Increase Hits to beat it' }))
    expect(history.undoLabel).toBe('Set Hits to beat it')
    await user.click(screen.getByRole('button', { name: 'Increase X' }))
    expect(history.undoLabel).toBe('Move entity')
    expect(JSON.stringify(edits.state)).toContain('"id":"slime-a","def":"slime","x":33')
  })

  it('shows the count of several chosen with only Delete and Duplicate', async () => {
    const { ondelete, onduplicate, user } = setup(['slime-a', 'door-a'])
    expect(screen.getByRole('heading', { level: 2, name: '2 selected' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(ondelete).toHaveBeenCalledOnce()
    expect(onduplicate).toHaveBeenCalledOnce()
  })

  it('goes back to the level when the choice is cleared', async () => {
    const { props, view } = setup(['slime-a'])
    await view.rerender({ ...props, selected: [] })
    expect(screen.getByRole('heading', { level: 2, name: 'Level 1' })).toBeInTheDocument()
  })

  it('has no Problems in it: they live in the top bar', () => {
    setup([])
    expect(screen.queryByText('Problems')).toBeNull()
    expect(screen.queryByRole('list', { name: /Findings/ })).toBeNull()
  })

  it('reads label-left: the inspector sets the label column the fields line up on', () => {
    setup(['slime-a'])
    const inspector = screen.getByTestId('level-inspector')
    expect(inspector.getAttribute('data-labels')).toBe('left')
  })
})
