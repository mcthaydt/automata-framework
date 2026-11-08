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
import type { EntityDef2D, Project } from '#src/shared/level-2d/model/project-types.ts'
import { setLevelField } from '#src/shared/level-2d/model/world/level-edits.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// The Entities view in jsdom, mounted the way the app mounts it and reached from the rail: the
// panel, the preview, the definition form and the field editor, the refusal dialog (G-f) and that each edit is one
// undo step. Layout and hit sizes are checked in real browsers (`entities-view.layout.test.ts`).

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount() {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  // Level 1 plays a theme, so the `music` field holds a value someone chose.
  opened.document.history.apply('Set Music', (project) =>
    setLevelField(project as Project, 'level-1', 'music', 'theme'),
  )
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
    within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name: 'Entities' }),
  )
  const history = opened.document.history
  const project = (): Project => history.state as Project
  const def = (id: string): EntityDef2D | undefined => project().defs.entities.find((each) => each.id === id)
  return { history, project, def }
}

const panel = (): HTMLElement => screen.getByTestId('entities-panel')
const inspector = (): HTMLElement => screen.getByTestId('entities-inspector')
const preview = (): HTMLElement => screen.getByTestId('entity-preview')

async function choose(id: string): Promise<void> {
  await userEvent.click(within(panel()).getByRole('radio', { name: new RegExp(`^${id} `) }))
}

async function setNumber(label: string, value: number): Promise<void> {
  // The kit's stepper is a spinbutton until tapped, then a text box under the same name.
  await userEvent.click(within(inspector()).getByRole('spinbutton', { name: label }))
  const input = within(inspector()).getByRole('textbox', { name: label })
  await userEvent.clear(input)
  await userEvent.type(input, `${value}{Enter}`)
}

describe('Entities view: the panel and the preview', () => {
  it('lists the definitions and the level fields, and shows the first definition', async () => {
    await mount()
    expect(screen.getByTestId('entities-view')).toBeInTheDocument()
    // The saved file keeps definitions sorted by id, so the first is `checkpoint`.
    expect(within(panel()).getAllByRole('radio')[0]).toHaveAccessibleName(/^checkpoint 0 fields · rect/)
    expect(within(panel()).getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true')
    expect(preview()).toHaveTextContent('no instances')
    await choose('player-start')
    expect(
      within(panel()).getByRole('radio', { name: /^player-start 0 fields · rect · single/ }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(within(panel()).getByRole('radio', { name: /^slime 3 fields · rect/ })).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: /^Level fields music/ })).toBeInTheDocument()
    expect(preview()).toHaveTextContent('rect 16×24 px')
    expect(preview()).toHaveTextContent('pivot 0.5, 1')
    expect(preview()).toHaveTextContent('1 instance · 1 level')
  })

  it('redraws the preview when the width changes, as one undo step', async () => {
    const { history, def } = await mount()
    await choose('slime')
    const before = history.revision
    await setNumber('Width', 32)
    expect(def('slime')?.size.w).toBe(32)
    expect(history.revision).toBe(before + 1)
    expect(history.undoLabel).toBe('Edit entity')
    expect(preview()).toHaveTextContent(/rect 32×\d+ px/)
  })

  it('adds a definition and selects it', async () => {
    const { project } = await mount()
    await userEvent.click(within(panel()).getByRole('button', { name: 'Add entity' }))
    expect(project().defs.entities).toHaveLength(7)
    const added = project().defs.entities[6]?.id ?? ''
    expect(within(panel()).getByRole('radio', { name: new RegExp(`^${added} `) })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('Entities view: the field editor', () => {
  it('adds a field, and an int field shows its bounds and step', async () => {
    const { def } = await mount()
    await choose('coin')
    await userEvent.click(within(inspector()).getByRole('tab', { name: /Fields/ }))
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Add field' }))
    expect(def('coin')?.fields).toHaveLength(1)
    await userEvent.click(within(inspector()).getByRole('radio', { name: 'int' }))
    expect(def('coin')?.fields[0]?.type).toBe('int')
    expect(within(inspector()).getByRole('spinbutton', { name: 'Min' })).toBeInTheDocument()
    expect(within(inspector()).getByRole('spinbutton', { name: 'Max' })).toBeInTheDocument()
    expect(within(inspector()).getByRole('spinbutton', { name: 'Step' })).toBeInTheDocument()
  })

  it('shows the message of a refused setting and keeps the field as it was', async () => {
    const { history, def } = await mount()
    await choose('slime')
    await userEvent.click(within(inspector()).getByRole('tab', { name: /Fields/ }))
    const before = history.revision
    await setNumber('Min', 20)
    expect(within(inspector()).getByRole('alert')).toHaveTextContent(/.+/)
    expect(def('slime')?.fields[0]).toMatchObject({ min: 1, max: 9 })
    expect(history.revision).toBe(before)
  })

  it('lists the levels a type change would break, and "Change anyway" is one undo step (G-f)', async () => {
    const { history, project } = await mount()
    await userEvent.click(within(panel()).getByRole('button', { name: /^Level fields/ }))
    const before = history.revision
    await userEvent.click(within(inspector()).getByRole('radio', { name: 'int' }))
    const dialog = screen.getByRole('dialog', { name: 'Change music?' })
    expect(within(dialog).getByText('level-1')).toBeInTheDocument()
    expect(history.revision).toBe(before)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change anyway' }))
    expect(project().defs.levelFields[0]?.type).toBe('int')
    expect(history.revision).toBe(before + 1)
    history.undo()
    expect(project().defs.levelFields[0]?.type).toBe('text')
  })
})

describe('Entities view: deleting a definition in use (G-f)', () => {
  it('lists the instances; Cancel keeps it and "Delete anyway" removes them as one undo step', async () => {
    const { history, def } = await mount()
    await choose('player-start')
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete player-start?' })
    expect(within(dialog).getByText(/ in level-1$/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(def('player-start')).toBeDefined()
    const before = history.revision
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Delete' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete player-start?' })).getByRole('button', {
        name: 'Delete anyway',
      }),
    )
    expect(def('player-start')).toBeUndefined()
    expect(history.revision).toBe(before + 1)
    expect(history.undoLabel).toBe('Delete entity')
  })

  it('deletes an unused definition without asking', async () => {
    const { def } = await mount()
    await choose('coin')
    await userEvent.click(within(inspector()).getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(def('coin')).toBeUndefined()
  })
})
