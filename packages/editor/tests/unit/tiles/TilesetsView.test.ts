// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { componentOf } from '#src/app/editor-2d/views.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { AutoLayerDef, Project } from '#src/shared/level-2d/model/project-types.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// The Tilesets view in jsdom, mounted the way the app mounts it and reached from the rail: the
// panel, the sheet, the inspector and the preview, and that each edit is one undo step. Layout and hit sizes are
// checked in real browsers (`tilesets-view.layout.test.ts`).

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(template = 'platformer') {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', template)
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(1194, 834),
    controller,
    viewOf: componentOf,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  await userEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Views' })).getByRole('radio', { name: 'Tiles' }),
  )
  const ground = (): AutoLayerDef =>
    (opened.document.history.state as Project).defs.layers.find(
      (layer) => layer.id === 'ground',
    ) as AutoLayerDef
  const hazards = (): string[] => ground().groups[1]?.rules.map((rule) => rule.id) ?? []
  return { opened, ground, hazards }
}

const panel = (): HTMLElement => screen.getByTestId('tilesets-panel')
const inspector = (): HTMLElement => screen.getByTestId('tilesets-inspector')
const ruleRow = (id: string): HTMLElement => panel().querySelector(`[data-rule="${id}"]`) as HTMLElement

async function chooseHazards(): Promise<void> {
  await userEvent.click(within(panel()).getByRole('button', { name: /^Hazards and water/ }))
}

describe('Tilesets view: the panel', () => {
  it('lists the tilesets, the auto layers, the groups and the first group’s rules', async () => {
    const { ground } = await mount()
    expect(screen.getByTestId('tilesets-view')).toBeInTheDocument()
    expect(within(panel()).getByRole('radio', { name: /Terrain \(placeholder\)/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(panel()).getByRole('radio', { name: /Ground.*from Collision/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    const groups = within(within(panel()).getByRole('list', { name: 'Rule groups' })).getAllByRole('listitem')
    expect(groups).toHaveLength(2)
    const rules = within(within(panel()).getByRole('list', { name: 'Rules' })).getAllByRole('listitem')
    expect(rules).toHaveLength(ground().groups[0]?.rules.length ?? -1)
  })

  it('reorders a rule with its grip from the keyboard, as one undo step', async () => {
    const { hazards } = await mount()
    await chooseHazards()
    screen.getByRole('button', { name: 'Reorder spike' }).focus()
    await userEvent.keyboard(' {ArrowDown} ')
    expect(hazards()).toEqual(['water', 'spike', 'ladder', 'one-way'])
    expect(screen.getByRole('button', { name: 'Undo Reorder rules' })).toBeEnabled()
  })

  it('adds a group and a rule, and selects what it added', async () => {
    const { ground } = await mount()
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
    expect(ground().groups).toHaveLength(3)
    expect(within(panel()).getByText('No rules in this group yet. Add one to start.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    const added = ground().groups[2]?.rules[0]?.id ?? ''
    expect(within(inspector()).getByRole('heading', { name: added })).toBeInTheDocument()
  })
})

describe('Tilesets view: plain words (grandma audit 5.2)', () => {
  it('names the auto layers as tiles that place themselves, and says so when there are none', async () => {
    await mount('blank')
    expect(screen.getByRole('heading', { name: 'Tiles that place themselves' })).toBeInTheDocument()
    expect(screen.getByText('None in this game yet.')).toBeInTheDocument()
    expect(screen.queryByText(/IntGrid/)).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Rule groups/ })).toBeNull()
  })
})

describe('Tilesets view: the sheet', () => {
  it('shows every tile, toggles the selection and makes a tag of it', async () => {
    const { opened } = await mount()
    // Queries stay inside the sheet's groups: a page-wide query by role and name works out the name of every button on
    // the screen, about 0.8 s each in jsdom, which pushed this test past its time under load. The tiles carry their
    // name as `aria-label`, so they are found by label inside the group, and checked to be buttons.
    const sheet = within(screen.getByRole('group', { name: 'Tiles' }))
    const tiles = sheet.getAllByRole('button')
    expect(tiles.length).toBeGreaterThan(0)
    const tile = (name: string): HTMLElement => {
      const found = sheet.getByLabelText(name)
      expect(tiles).toContain(found)
      return found
    }
    await userEvent.click(tile('Tile 3'))
    expect(tile('Tile 3')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('New tag'), 'lava')
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    const tags = within(screen.getByRole('group', { name: 'Tags' }))
    expect(tags.getByRole('button', { name: 'lava · 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(tile('Tile 3, tagged lava')).toBeInTheDocument()
    expect((opened.document.history.state as Project).defs.tilesets[0]?.tags).toContainEqual({
      tag: 'lava',
      tiles: [3],
    })
  })

  it('says what to do when a tag has no tiles to take', async () => {
    await mount()
    await userEvent.type(screen.getByLabelText('New tag'), 'lava')
    await userEvent.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Select the tiles to tag first.')
  })
})

describe('Tilesets view: the rule inspector and the preview', () => {
  it('cycles a pattern cell and the preview follows', async () => {
    const { ground } = await mount()
    await chooseHazards()
    const caption = screen.getByTestId('rule-preview').querySelector('.caption')
    expect(caption).toHaveTextContent('Outlined: the 0 cells where spike matches on its own.')
    expect(caption?.textContent).not.toMatch(/the 1 cells/)
    const cell = within(screen.getByTestId('pattern-editor')).getByRole('button')
    expect(cell).toHaveAccessibleName('Row 1, column 1 (centre): is Spike')
    await userEvent.click(cell)
    expect(ground().groups[1]?.rules[0]?.pattern).toEqual([{ not: 1 }])
    expect(within(screen.getByTestId('pattern-editor')).getByRole('button')).toHaveAccessibleName(
      'Row 1, column 1 (centre): not Solid',
    )
    expect(caption?.textContent).toMatch(/the [1-9]\d* cells where spike/)
    expect(screen.getByRole('button', { name: 'Undo Edit pattern' })).toBeEnabled()
  })

  it('adds the selected tile as an output, removes it, and flips', async () => {
    const { ground } = await mount()
    await chooseHazards()
    await userEvent.click(screen.getByRole('button', { name: 'Tile 2' }))
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Add selected tiles (1)' }))
    expect(ground().groups[1]?.rules[0]?.tiles.at(-1)).toBe(2)
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Remove Tile 2' }))
    expect(ground().groups[1]?.rules[0]?.tiles).not.toContain(2)
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Flip X' }))
    expect(within(inspector()).getByRole('button', { name: 'Flip X' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(ruleRow('spike')).toHaveTextContent('flip X')
  })

  it('sets what is read beyond the edge, duplicates and deletes the rule', async () => {
    const { ground, hazards } = await mount()
    await chooseHazards()
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Outside the level: Empty' }))
    await userEvent.click(
      screen.getByRole('option', { name: (name) => name.startsWith('Same as the centre') }),
    )
    expect(ground().groups[1]?.rules[0]?.outside).toBe('same')
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Duplicate' }))
    expect(hazards()).toHaveLength(5)
    const copy = hazards()[1] ?? ''
    expect(within(inspector()).getByRole('heading', { name: copy })).toBeInTheDocument()
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Delete' }))
    expect(hazards()).toEqual(['spike', 'water', 'ladder', 'one-way'])
    expect(within(inspector()).getByRole('heading', { name: 'water' })).toBeInTheDocument()
  })

  it('renames and switches off a group from the Group tab', async () => {
    const { ground } = await mount()
    await chooseHazards()
    await userEvent.click(within(inspector()).getByRole('tab', { name: 'Group' }))
    const name = within(inspector()).getByLabelText('Group name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Danger{Enter}')
    expect(ground().groups[1]?.label).toBe('Danger')
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Group on' }))
    expect(ground().groups[1]?.active).toBe(false)
    expect(within(panel()).getByRole('button', { name: /^Danger.*off/ })).toBeInTheDocument()
  })
})
