// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createAppProfiles } from '#src/app/editor-2d/profiles.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { History } from '#src/shared/kit/history/history.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createEditorApp } from '#src/shared/level-2d/documents/editor-app.ts'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import FakeLevelCanvas from '#src/testing/level-2d/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { entity, withEntities, withLayer } from '#src/testing/level-2d/project-edit.ts'

// Problems in jsdom, mounted the way the app mounts it: the top bar's count opens the sheet.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(profile: string, template: string, seed: (value: never) => unknown) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create(profile, template)
  if (opened.status !== 'opened') throw new Error(opened.status)
  const history = opened.document.history as History<unknown>
  history.apply('Seed', (value) => seed(value as never))
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  render(DocumentScreen, {
    geometry: stubGeometry(1194, 834),
    controller,
    toasts,
    clock,
    read: (path: string) => workspace.store.read(path),
    ids: counterIds(100),
    canvas: FakeLevelCanvas,
    onback: () => {},
  })
  const count = screen.queryByTestId('problems')
  if (count !== null) await userEvent.click(count)
  return { history }
}

/** A stray decor tile, a slime outside the level and a door pointing at an instance that is gone. */
const seeded = (project: Project): Project =>
  withEntities(
    withLayer(project, 'level-1', 'decor', (layer) =>
      layer.kind === 'tiles' ? { ...layer, cells: layer.cells.set(4, 7, packTile(99, false, false)) } : layer,
    ),
    'level-1',
    [entity('slime-z', 'slime', 900, 40), entity('door-z', 'door', 32, 32, { target: { target: 'gone-1' } })],
  )

const group = (name: RegExp): HTMLElement => screen.getByRole('region', { name })
const row = (text: RegExp): HTMLElement => {
  const found = screen.getAllByRole('listitem').find((each) => text.test(each.textContent ?? ''))
  if (found === undefined) throw new Error(`no row ${text}`)
  return found
}

describe('Problems: level-project', () => {
  it('counts the problems in the top bar, groups them in plain words and names the object each is about', async () => {
    await mount('level-project', 'platformer', seeded)
    expect(screen.getByTestId('problems')).toHaveAccessibleName('3 problems')
    expect(screen.getByRole('dialog', { name: 'Problems' })).toBeInTheDocument()
    expect(within(group(/^Needs fixing \(2\)/)).getByText('Layer decor in level-1')).toBeTruthy()
    expect(within(group(/^Worth a look \(1\)/)).getByText('slime-z in level-1')).toBeTruthy()
    expect(within(row(/beyond the/)).getByRole('button', { name: 'Remove 1 stray tile' })).toBeTruthy()
  })

  it('removes the stray tile and moves the slime inside, one undo step each', async () => {
    const { history } = await mount('level-project', 'platformer', seeded)
    const steps = history.revision
    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 stray tile' }))
    expect(history.revision).toBe(steps + 1)
    expect(screen.queryByRole('button', { name: 'Remove 1 stray tile' })).toBeNull()
    await userEvent.click(within(row(/slime-z/)).getByRole('button', { name: 'Move inside' }))
    expect(history.revision).toBe(steps + 2)
    expect(screen.queryByText('slime-z in level-1')).toBeNull()
    history.undo()
    expect(await screen.findByText('slime-z in level-1')).toBeTruthy()
  })

  it('points a broken door at a chosen target in one step', async () => {
    const { history } = await mount('level-project', 'platformer', seeded)
    const steps = history.revision
    await userEvent.click(within(row(/door-z/)).getByRole('button', { name: 'Choose target' }))
    const dialog = screen.getByRole('dialog', { name: /Choose a target/ })
    const choices = within(dialog)
      .getAllByRole('button')
      .filter((each) => each.textContent?.includes('·'))
    expect(choices.length).toBeGreaterThan(0)
    await userEvent.click(choices[0] as HTMLElement)
    expect(history.revision).toBe(steps + 1)
    expect(screen.queryByText('door-z in level-1')).toBeNull()
  })

  it('shows a finding: the sheet closes and the Level view opens with the instance selected', async () => {
    await mount('level-project', 'platformer', seeded)
    await userEvent.click(within(row(/slime-z/)).getByRole('button', { name: 'Show' }))
    expect(screen.queryByRole('dialog', { name: 'Problems' })).toBeNull()
    expect(screen.getByTestId('level-view')).toBeTruthy()
    expect(screen.getByTestId('entity-tab').textContent).toContain('Slime')
  })

  it('shows nothing about problems when there are none: notes (definitions nothing uses yet) do not count', async () => {
    await mount('level-project', 'platformer', (project: Project) => project)
    expect(screen.queryByTestId('problems')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
