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
import DocumentScreen from '../../../app/document/DocumentScreen.svelte'
import { createDocumentController } from '../../../app/document/document-controller'
import { createEditorApp } from '../../../app/editor-app'
import { createAppProfiles } from '../../../app/profiles'
import { counterIds } from '../../../model/ids'
import FakeLevelCanvas from '../../../testing/FakeLevelCanvas.svelte'
import { memoryWorkspace } from '../../../testing/memory-workspace'
import { createTestClock } from '../../../testing/test-clock'
import { floorFiftyStage } from '../floorfifty-stage'
import type { StageDocument } from '../stage-document'

// The Stage view in jsdom (plan EDFF.2a-1 step 4): a stage made from the Simple city template, reached from the rail.
// Each change is one undo step through the stage's commands.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

async function mount(template = 'simple-city') {
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('floorfifty-stage', template)
  if (opened.status !== 'opened') throw new Error(opened.status)
  const history = opened.document.history as History<StageDocument>
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
    within(screen.getByRole('tablist', { name: 'Views' })).getByRole('tab', { name: 'Stage' }),
  )
  await screen.findByTestId('stage-view')
  return { history }
}

const undo = (label: string) => screen.findByRole('button', { name: `Undo ${label}` })

async function retype(label: string, text: string): Promise<void> {
  const field = screen.getByRole('textbox', { name: label })
  await userEvent.clear(field)
  await userEvent.type(field, `${text}{Enter}`)
}

/** The kit's stepper is a spinbutton until tapped, then a text box under the same name. */
async function setStepper(label: string, value: number): Promise<void> {
  await userEvent.click(screen.getByRole('spinbutton', { name: label }))
  const input = screen.getByRole('textbox', { name: label })
  await userEvent.clear(input)
  await userEvent.type(input, `${value}{Enter}`)
}

describe('Stage view: identity', () => {
  it('renames the stage, sets its id, unlock and platform, each one undo step; an empty unlock opens the stage', async () => {
    const { history } = await mount()
    await retype('Name', 'Night market')
    expect(history.state.value.displayName).toBe('Night market')
    expect(await undo('Rename stage')).toBeEnabled()
    await retype('Id', 'night-market')
    expect(history.state.value.id).toBe('night-market')
    await retype('Unlock', 'rooftops-cleared')
    expect(history.state.value.unlock).toBe('rooftops-cleared')
    await retype('Unlock', '')
    expect(history.state.value.unlock).toBeUndefined()
    await retype('Platform', 'world.platform.night')
    expect(history.state.value.platformAlias).toBe('world.platform.night')
  })
})

describe('Stage view: presentation', () => {
  it('sets a value, switches the light height on, and removes the block', async () => {
    const { history } = await mount()
    await setStepper('Refraction', 0.6)
    expect(history.state.value.theme.presentation?.refractionIntensity).toBe(0.6)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Silhouette' }))
    expect(history.state.value.theme.presentation?.silhouette).toBe(true)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Set the light height' }))
    expect(history.state.value.theme.presentation?.lightHeight).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Remove presentation' }))
    expect(history.state.value.theme.presentation).toBeUndefined()
    expect(await undo('Remove presentation')).toBeEnabled()
  })

  it('adds the block to a stage that has none', async () => {
    const { history } = await mount('empty')
    expect(screen.queryByRole('spinbutton', { name: 'Refraction' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Use presentation' }))
    expect(history.state.value.theme.presentation).toMatchObject({ refractionIntensity: 0, horizonLift: 0 })
    expect(screen.getByRole('spinbutton', { name: 'Refraction' })).toBeInTheDocument()
  })
})

describe('Stage view: course tuning', () => {
  it('adds an override at its default, changes it, keeps a value out of range for Checks, and removes it', async () => {
    const { history } = await mount()
    expect(screen.getByText('No overrides. The race runs on the base layer alone.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tunable' }), 'MAX_MOVE_SPEED')
    await userEvent.click(screen.getByRole('button', { name: 'Add override' }))
    expect(history.state.value.courseTuning).toEqual({ MAX_MOVE_SPEED: 356 })
    expect(screen.getByText('50 to 900, base 356')).toBeInTheDocument()
    await setStepper('MAX_MOVE_SPEED', 5000)
    expect(history.state.value.courseTuning.MAX_MOVE_SPEED).toBe(5000)
    const findings = floorFiftyStage.check(history.state, {})
    expect(findings.some((finding) => finding.path === 'courseTuning.MAX_MOVE_SPEED')).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Remove MAX_MOVE_SPEED' }))
    expect(history.state.value.courseTuning).toEqual({})
    expect(await undo('Remove override')).toBeEnabled()
  })
})
