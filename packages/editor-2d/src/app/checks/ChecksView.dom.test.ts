import {
  createToasts,
  type History,
  type LifecycleDocument,
  type LifecycleWindow,
} from '@mcthaydt/automata-editor-kit/core'
import { stubGeometry } from '@mcthaydt/automata-editor-kit/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { packTile } from '../../model/cells-codec'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { moveLayer } from '../../profiles/floorfifty-stage/commands/layer-edits'
import { floorFiftyStage } from '../../profiles/floorfifty-stage/floorfifty-stage'
import type { StageDocument } from '../../profiles/floorfifty-stage/stage-document'
import type { ProfileRegistry } from '../../profiles/profile'
import FakeLevelCanvas from '../../testing/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { entity, withDefs, withEntities, withLayer } from '../../testing/project-edit'
import { createTestClock } from '../../testing/test-clock'
import DocumentScreen from '../document/DocumentScreen.svelte'
import { createDocumentController } from '../document/document-controller'
import { createEditorApp } from '../editor-app'
import { createAppProfiles } from '../profiles'

// The Checks view in jsdom (plan ED2D.7a step 5), mounted the way the app mounts it and reached from the rail.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

/** The app's profiles plus the FloorFifty extension, as a game that installs it registers them. */
function profiles(): ProfileRegistry {
  const registry = createAppProfiles()
  registry.register(floorFiftyStage)
  return registry
}

async function mount(profile: string, template: string, seed: (value: never) => unknown) {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: profiles(), ids: counterIds(), clock })
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
  await userEvent.click(
    within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name: 'Checks' }),
  )
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

describe('Checks view: level-project', () => {
  it('groups the findings with counts and names the object each is about', async () => {
    await mount('level-project', 'platformer', seeded)
    expect(within(group(/^Errors \(2\)/)).getByText('Layer decor in level-1')).toBeTruthy()
    expect(within(group(/^Warnings \(1\)/)).getByText('slime-z in level-1')).toBeTruthy()
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

  it('locates a finding: the Level view opens with the instance selected', async () => {
    await mount('level-project', 'platformer', seeded)
    await userEvent.click(within(row(/slime-z/)).getByRole('button', { name: 'Locate' }))
    expect(screen.getByTestId('level-view')).toBeTruthy()
    expect(screen.getByTestId('entity-tab').textContent).toContain('Slime')
  })

  it('says so when there are no problems', async () => {
    // The platformer's only finding is the definitions nothing uses yet; keep just the player start.
    await mount('level-project', 'platformer', (project: Project) =>
      withDefs(project, (defs) => ({
        ...defs,
        entities: defs.entities.filter((each) => each.id === 'player-start'),
      })),
    )
    expect(screen.getByText('No problems')).toBeTruthy()
  })
})

describe('Checks view: floorfifty-stage', () => {
  it('lists the stage findings and applies their repair', async () => {
    const { history } = await mount('floorfifty-stage', 'simple-city', (stage: StageDocument) =>
      moveLayer(stage, 2, 3),
    )
    const steps = history.revision
    await userEvent.click(screen.getByRole('button', { name: 'Reorder layers' }))
    expect(history.revision).toBe(steps + 1)
    expect(screen.queryByRole('button', { name: 'Reorder layers' })).toBeNull()
  })
})
