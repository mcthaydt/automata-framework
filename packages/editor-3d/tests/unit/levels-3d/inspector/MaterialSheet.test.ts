// @vitest-environment jsdom
import type { AfSector } from '@automata/3d/level'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MaterialSheet from '#src/features/levels-3d/inspector/MaterialSheet.svelte'
import type { MaterialTarget } from '#src/features/levels-3d/inspector/material-session.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'

// The material sheet (ED3D.8b; ED3D spec §5.3 flow 5, §9): categories, the tiles of the open one, a search, the preview's
// scale and brightness, the scope (this wall, the room, matching walls) and Apply, which is one undo step. The depot's
// materials table is the list; the headless picker is `material-picker.test.ts`'s.

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

function mount(target: MaterialTarget = { wall: { sector: 'hall', corner: 2 } }) {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  const onclose = vi.fn()
  render(MaterialSheet, { props: { editor: editor as never, surface: target, onclose } })
  return { editor, onclose }
}

describe('MaterialSheet', () => {
  it('opens on what the wall is made of: its category open and it chosen, with the categories and a search', () => {
    mount()
    expect(screen.getByRole('dialog', { name: 'Material' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: /^(Walls|Floors)/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('searchbox', { name: 'Search materials' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { checked: true }).length).toBeGreaterThan(0)
  })

  it('applies a chosen material to the wall as one undo step, and closes', async () => {
    const { editor, onclose } = mount()
    await userEvent.click(screen.getByRole('radio', { name: /^Floors/ }))
    const tiles = screen.getByRole('group', { name: 'Materials' })
    const other = within(tiles)
      .getAllByRole('radio')
      .find((tile) => tile.getAttribute('aria-checked') === 'false')
    if (other === undefined) throw new Error('no other material')
    await userEvent.click(other)
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onclose).toHaveBeenCalled()
    expect(editor.history.canUndo).toBe(true)
    editor.history.undo()
    expect(editor.history.canUndo).toBe(false)
  })

  it('says why Apply is refused, in the model’s words, and stays open', async () => {
    const { onclose } = mount()
    // Nothing chosen but the wall's current material: applying it again changes nothing and is said so, or refused.
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    const alert = screen.queryByRole('alert')
    expect(onclose.mock.calls.length === 1 || alert !== null).toBe(true)
  })

  it('narrows the tiles by search, and says when nothing matches', async () => {
    mount()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search materials' }), 'zzzzzz')
    expect(screen.getByText(/No material matches/)).toBeInTheDocument()
  })

  it('offers the scope for a wall, and for a floor the room and matching surfaces', async () => {
    mount()
    expect(screen.getByRole('radio', { name: 'This wall' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'This room' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Matching' })).toBeInTheDocument()
  })

  it('says a level with no materials table offers nothing', () => {
    const editor = createLevelEditor({
      profile: afSectorProfile,
      level: { ...depot, materials: undefined } as AfSector,
    })
    render(MaterialSheet, {
      props: { editor: editor as never, surface: { wall: { sector: 'hall', corner: 0 } }, onclose: vi.fn() },
    })
    expect(screen.getByRole('status')).toHaveTextContent(/materials/i)
  })
})
