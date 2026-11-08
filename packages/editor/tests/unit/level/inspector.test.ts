// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Inspector from '#src/features/level/Inspector.svelte'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { projectHistory } from '#src/shared/level-2d/editor/edit-history.ts'
import { placeEntity } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// The inspector's tabs: the default tab follows the selection, the Selected tab
// edits the one selected instance, several selected show their count with Delete and Duplicate, and the Checks tab
// lists this level's findings, a tap selecting the object a finding is about.

function setup(selected: readonly string[]) {
  const target = { level: 'level-1', layer: 'entities' }
  let project: Project = platformerTemplate.create(counterIds())
  project = placeEntity(project, target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
  project = placeEntity(project, target, { id: 'door-a', def: 'door', x: 96, y: 48 })
  const history = createHistory<unknown>(project)
  const edits = projectHistory(history)
  if (edits === undefined) throw new Error('a project was refused')
  const handlers = { onselect: vi.fn(), ondelete: vi.fn(), onduplicate: vi.fn() }
  const props = {
    project,
    level: 'level-1',
    selected,
    diagnostics: checkProject(project, {}),
    history: edits,
    ...handlers,
  }
  const view = render(Inspector, props)
  return { history, edits, props, view, ...handlers, user: userEvent.setup() }
}

describe('Inspector', () => {
  it('opens on the Level tab when nothing is selected', () => {
    setup([])
    expect(screen.getByRole('tab', { name: 'Level' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Music' })).toBeInTheDocument()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
  })

  it('opens on the Selected tab for one selected instance and edits its fields as one step each', async () => {
    const { history, edits, user } = setup(['slime-a'])
    expect(screen.getByRole('tab', { name: 'Selected' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Increase Hit points' }))
    expect(history.undoLabel).toBe('Set Hit points')
    await user.click(screen.getByRole('button', { name: 'Increase X' }))
    expect(history.undoLabel).toBe('Move entity')
    expect(JSON.stringify(edits.state)).toContain('"id":"slime-a","def":"slime","x":33')
  })

  it('says to select something on the Selected tab when nothing is selected', async () => {
    const { user } = setup([])
    await user.click(screen.getByRole('tab', { name: 'Selected' }))
    expect(screen.getByText('Select a thing on the canvas to see its fields')).toBeInTheDocument()
  })

  it('shows the count of several selected with only Delete and Duplicate', async () => {
    const { ondelete, onduplicate, user } = setup(['slime-a', 'door-a'])
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(ondelete).toHaveBeenCalledOnce()
    expect(onduplicate).toHaveBeenCalledOnce()
  })

  it("lists this level's findings, and a tap selects the object it is about", async () => {
    const { onselect, user } = setup([])
    await user.click(screen.getByRole('tab', { name: 'Problems' }))
    const list = screen.getByRole('list', { name: 'Findings in Level 1' })
    const finding = within(list).getByRole('button', { name: /target/ })
    await user.click(finding)
    expect(onselect).toHaveBeenCalledWith('door-a')
  })

  it('keeps a tab the person chose until the selection changes', async () => {
    const { props, view, user } = setup(['slime-a'])
    await user.click(screen.getByRole('tab', { name: 'Problems' }))
    expect(screen.getByRole('tab', { name: 'Problems' })).toHaveAttribute('aria-selected', 'true')
    await view.rerender({ ...props, selected: [] })
    expect(screen.getByRole('tab', { name: 'Level' })).toHaveAttribute('aria-selected', 'true')
  })
})
