// @vitest-environment jsdom
import type { AfSector2File } from '@automata/3d/level'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DefinitionsSheet from '#src/features/levels-3d/definitions/DefinitionsSheet.svelte'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'

// The definitions sheet (ED3D.13b; ED3-r): add a definition and a field, see a refusal in the model's words, edit the
// materials table, and a fixed format says there is nothing to edit.

const depot: AfSector2File = (() => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

function mount() {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  const onclose = vi.fn()
  render(DefinitionsSheet, { props: { editor: editor as never, onclose } })
  return { editor, onclose }
}

describe('DefinitionsSheet', () => {
  it('lists the definitions with their things', () => {
    mount()
    expect(screen.getByRole('dialog', { name: 'Definitions' })).toBeInTheDocument()
    const crate = screen.getByRole('region', { name: 'Definition crate' })
    expect(within(crate).getByText(/1 thing/)).toBeInTheDocument()
  })

  it('adds a definition and a field to it, each one undo step', async () => {
    const { editor } = mount()
    await userEvent.type(screen.getByRole('textbox', { name: 'New definition id' }), 'lamp')
    await userEvent.click(screen.getByRole('button', { name: 'Add definition' }))
    const lamp = screen.getByRole('region', { name: 'Definition lamp' })
    await userEvent.type(within(lamp).getByRole('textbox', { name: 'New field in lamp' }), 'power')
    await userEvent.click(within(lamp).getByRole('button', { name: 'Add field to lamp' }))
    expect(
      within(screen.getByRole('region', { name: 'Definition lamp' })).getByDisplayValue('power'),
    ).toBeInTheDocument()
    editor.history.undo()
    editor.history.undo()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Definition lamp' })).toBeNull())
  })

  it('shows the refusal of a definition that is still in use', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Remove crate' }))
    expect(screen.getByRole('alert')).toHaveTextContent('crate is still used')
  })

  it('edits the materials table, refusing the removal of one in use', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: 'Materials' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New material id' }), 'rust')
    await userEvent.click(screen.getByRole('button', { name: 'Add material' }))
    expect(screen.getByRole('textbox', { name: 'Name of material rust' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove material rust' }))
    expect(screen.queryByRole('textbox', { name: 'Name of material rust' })).toBeNull()
  })

  it('says a fixed format has nothing to edit', () => {
    const editor = createLevelEditor({
      profile: { ...afSectorProfile, id: 'fixed', definitions: undefined },
      level: depot,
    })
    render(DefinitionsSheet, { props: { editor: editor as never, onclose: vi.fn() } })
    expect(screen.getByRole('status')).toHaveTextContent(/fixed by its format/)
  })
})
