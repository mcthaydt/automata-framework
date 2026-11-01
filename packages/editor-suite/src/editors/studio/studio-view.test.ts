// What the Studio shows for each mode (EDS.9a to EDS.9c): which figure the stage draws and in what state, where the pose
// handles stand and which are out of reach, and the view's own state (mode, selection, playhead). Headless: the stage's
// renderer takes what `stageOf` says, so these are the cases of what a person sees.

import { evaluate, J, skeleton } from '@mcthaydt/automata-figures'
import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { studioFixtureFiles } from '../../testing/studio-fixtures'
import { readStudioContent } from './studio-content'
import { createStudioView, handlesOf, type StudioViewState, stageOf } from './studio-view'

const content = readStudioContent(
  Object.entries(studioFixtureFiles()).map(([path, text]) => ({ path, text })),
)
const base: StudioViewState = {
  mode: 'look',
  figure: 'wick',
  pose: 'stand',
  clip: 'roll',
  orbit: { target: [0, 0.9, 0], yaw: 0, pitch: 0.12, distance: 3.4, fov: 35 },
  facing: 0,
  playhead: 0,
  playing: false,
  key: undefined,
  handle: undefined,
  live: undefined,
  outfit: undefined,
}

describe('stageOf', () => {
  it('draws the chosen figure standing in its default outfit in Look, at his facing', () => {
    const stage = stageOf(content, { ...base, facing: 0.5 })
    expect(stage.def).toBe(content.figures[0]?.value)
    expect(stage.state).toEqual({ moving: false })
    expect(stage.facing).toBe(0.5)
  })

  it('wears the outfit the person picked', () => {
    expect(stageOf(content, { ...base, outfit: 'wanderer' }).state).toMatchObject({ outfit: 'wanderer' })
  })

  it('holds the pose in Pose, facing the camera, and shows the pose being dragged when there is one', () => {
    const stage = stageOf(content, { ...base, mode: 'pose', facing: 1 })
    expect(stage.facing).toBe(0)
    expect(stage.state.action?.id).toBe('__pose')
    expect(stage.motion.poses['__pose']).toBe(content.motion.poses['stand'])
    const live = { effectors: { handR: { pos: [-0.3, 1, 0.3] as [number, number, number] } } }
    expect(stageOf(content, { ...base, mode: 'pose', live }).motion.poses['__pose']).toBe(live)
  })

  it('plays the chosen clip at the playhead in Animate', () => {
    const stage = stageOf(content, { ...base, mode: 'animate', playhead: 0.2 })
    expect(stage.state.action).toEqual({ id: 'roll', startedAt: 0 })
    expect(stage.time).toBe(0.2)
  })

  it('draws nothing when no figure is chosen or the chosen one does not read', () => {
    expect(stageOf(content, { ...base, figure: undefined }).def).toBeUndefined()
    expect(stageOf(content, { ...base, figure: 'nobody' }).def).toBeUndefined()
  })
})

describe('handlesOf', () => {
  it('draws a handle where the figure’s hand is: a pose is in a 1.62 m figure and the figure scales it', () => {
    const view = { ...base, mode: 'pose' as const, pose: 'guard-high' }
    const stage = stageOf(content, view)
    if (stage.def === undefined) throw new Error('no figure')
    const world = evaluate(
      skeleton(stage.def),
      stage.def,
      { moving: false, facing: 0, speed: 0, action: stage.state.action } as never,
      stage.time,
      stage.motion,
    ).world
    const joint = world[J['hand.R']] as ArrayLike<number>
    const handle = handlesOf(content, view).find((entry) => entry.id === 'handR')
    if (handle === undefined) throw new Error('no handle')
    expect(handle.position[1] * handle.scale).toBeCloseTo(joint[10] as number, 1)
    expect(handle.position[0] * handle.scale).toBeCloseTo(joint[9] as number, 1)
  })

  it('stands a handle where each limb is in the pose, and says whether it was reached', () => {
    const handles = handlesOf(content, { ...base, mode: 'pose' })
    expect(handles.map((handle) => handle.id)).toEqual([
      'handL',
      'handR',
      'footL',
      'footR',
      'pelvis',
      'chest',
      'head',
    ])
    const hand = handles.find((handle) => handle.id === 'handL')
    expect(hand?.position[1]).toBeGreaterThan(0.5)
    expect(hand?.set).toBe(true)
    expect(hand?.reached).toBe(true)
    expect(handles.find((handle) => handle.id === 'footL')?.set).toBe(false)
  })

  it('shows a handle dragged past what the arm can reach in amber, with the shortfall', () => {
    const live = { effectors: { handR: { pos: [-1.9, 1.1, 0.3] as [number, number, number] } } }
    const hand = handlesOf(content, { ...base, mode: 'pose', live }).find((handle) => handle.id === 'handR')
    expect(hand?.reached).toBe(false)
    expect(hand?.error).toBeGreaterThan(0.05)
  })

  it('has none outside Pose', () => {
    expect(handlesOf(content, { ...base, mode: 'look' })).toEqual([])
  })
})

describe('createStudioView', () => {
  it('starts on the first figure, pose and clip in Look, and follows its setters', () => {
    const view = createStudioView(content)
    expect(get(view.state)).toMatchObject({
      mode: 'look',
      figure: 'wick',
      pose: 'guard-high',
      clip: 'guard',
      playhead: 0,
    })
    view.setMode('animate')
    view.select('clip', 'roll')
    view.setPlayhead(0.3)
    view.selectKey(1)
    expect(get(view.state)).toMatchObject({ mode: 'animate', clip: 'roll', playhead: 0.3, key: 1 })
  })

  it('keeps the playhead inside the clip when a clip is chosen, and drops a key that is not in it', () => {
    const view = createStudioView(content)
    view.select('clip', 'roll')
    view.setPlayhead(0.3)
    view.selectKey(2)
    view.select('clip', 'pickup')
    expect(get(view.state).key).toBeUndefined()
    view.setPlayhead(99)
    const length = content.clips.find((entry) => entry.id === 'pickup')?.value?.length ?? 0
    expect(get(view.state).playhead).toBe(length)
  })

  it('moves to what is left when the chosen file goes away', () => {
    const view = createStudioView(content)
    view.select('clip', 'roll')
    view.reconcile({ ...content, clips: content.clips.filter((entry) => entry.id !== 'roll') })
    expect(get(view.state).clip).toBe('guard')
  })
})
