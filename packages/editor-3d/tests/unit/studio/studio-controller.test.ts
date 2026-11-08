// What a person does in the Studio (EDS.9a to EDS.9c): each action reads what is chosen, makes the typed edit, writes it
// through the session and reports a refusal in words. The components call these and draw what comes back.

import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { createStudioController, type StudioController } from '#src/features/studio/studio-controller.ts'
import { studioFixturePorts } from '#src/testing/studio/studio-fixtures.ts'

async function open(): Promise<StudioController> {
  return createStudioController(await studioFixturePorts())
}
const text = async (controller: StudioController, path: string) =>
  controller.session.history.state.texts[path]

describe('look', () => {
  it('sets a slider of the chosen figure as one step, and Undo takes it back', async () => {
    const studio = await open()
    expect(await studio.setSlider(['height'], 130)).toEqual({ ok: true })
    expect(await text(studio, 'content/figures/wick.toml')).toContain('height = 130')
    expect(studio.session.history.undoLabel).toBe('Set height of wick')
    await studio.undo()
    expect(await text(studio, 'content/figures/wick.toml')).toContain('height = 120')
  })

  it('shows a refusal in words and keeps it until the next edit', async () => {
    const studio = await open()
    const result = await studio.setSlider(['height'], 999)
    expect(result.ok).toBe(false)
    expect(get(studio.refusal)).toMatch(/height/)
    expect(await studio.setSlider(['height'], 125)).toEqual({ ok: true })
    expect(get(studio.refusal)).toBeUndefined()
  })

  it('sets a figure field and a face slider', async () => {
    const studio = await open()
    expect(await studio.setFigureField('hand', 'L')).toEqual({ ok: true })
    expect(await studio.setSlider(['face', 'jaw'], 0.8)).toEqual({ ok: true })
    expect(studio.content().figures[0]?.value?.sliders.face?.jaw).toBe(0.8)
  })
})

describe('pose', () => {
  it('moves a handle of the chosen pose, and a drag shows live until it is committed', async () => {
    const studio = await open()
    studio.view.select('pose', 'stand')
    studio.view.setMode('pose')
    studio.dragHandle('handL', [0.35, 0.9, 0.1])
    expect(studio.view.current.live?.effectors.handL?.pos).toEqual([0.35, 0.9, 0.1])
    expect(studio.session.history.canUndo).toBe(false)
    expect(await studio.dropHandle('handL', [0.35, 0.9, 0.1])).toEqual({ ok: true })
    expect(studio.view.current.live).toBeUndefined()
    expect(studio.content().poses.find((entry) => entry.id === 'stand')?.value?.effectors.handL?.pos).toEqual(
      [0.35, 0.9, 0.1],
    )
    expect(studio.session.history.undoLabel).toBe('Move handL of stand')
  })

  it('cancels a drag without a step', async () => {
    const studio = await open()
    studio.view.select('pose', 'stand')
    studio.dragHandle('handL', [0.35, 0.9, 0.1])
    studio.cancelDrag()
    expect(studio.view.current.live).toBeUndefined()
    expect(studio.session.history.canUndo).toBe(false)
  })

  it('adds a pose as a copy of the chosen one in the poses folder, and chooses it', async () => {
    const studio = await open()
    studio.view.select('pose', 'stand')
    expect(await studio.addPose('wave')).toEqual({ ok: true })
    expect(studio.content().poses.map((entry) => entry.id)).toContain('wave')
    expect(studio.view.current.pose).toBe('wave')
    expect((await studio.addPose('wave')).ok).toBe(false)
    expect((await studio.addPose('Bad Name')).ok).toBe(false)
  })
})

describe('animate', () => {
  it('adds a key at the playhead with the chosen pose, and moves, eases and removes it', async () => {
    const studio = await open()
    studio.view.select('clip', 'roll')
    studio.view.select('pose', 'guard-high')
    studio.view.setPlayhead(0.2)
    expect(await studio.addKeyAtPlayhead()).toEqual({ ok: true })
    const keys = () => studio.content().clips.find((entry) => entry.id === 'roll')?.value?.keys ?? []
    expect(keys().map((key) => key.t)).toEqual([0, 0.12, 0.2, 0.28, 0.4])
    expect(studio.view.current.key).toBe(2)
    expect(await studio.setKeyEase(2, 'inOut')).toEqual({ ok: true })
    expect(keys()[2]?.ease).toBe('inOut')
    expect(await studio.moveKey(2, 0.22)).toEqual({ ok: true })
    expect(keys()[2]?.t).toBe(0.22)
    expect((await studio.moveKey(2, 0.5)).ok).toBe(false)
    expect(get(studio.refusal)).toMatch(/stays between/)
    expect(await studio.removeKey(2)).toEqual({ ok: true })
    expect(keys()).toHaveLength(4)
    expect(studio.view.current.key).toBeUndefined()
  })

  it('refuses a key where there is one, in words', async () => {
    const studio = await open()
    studio.view.select('clip', 'roll')
    studio.view.setPlayhead(0.12)
    const result = await studio.addKeyAtPlayhead()
    expect(result).toEqual({ ok: false, message: 'there is already a key at 0.12 s' })
  })

  it('adds a clip of two keys onto the chosen pose, and chooses it', async () => {
    const studio = await open()
    studio.view.select('pose', 'stand')
    expect(await studio.addClip('idle')).toEqual({ ok: true })
    const clip = studio.content().clips.find((entry) => entry.id === 'idle')?.value
    expect(clip?.keys.map((key) => key.t)).toEqual([0, 1])
    expect(clip?.keys.map((key) => key.pose)).toEqual(['stand', 'stand'])
    expect(studio.view.current.clip).toBe('idle')
  })

  it('sets the clip’s length, loop and mask, and markers', async () => {
    const studio = await open()
    studio.view.select('clip', 'roll')
    expect(await studio.setClipLength(0.5)).toEqual({ ok: true })
    expect(await studio.setClipLoop('loop')).toEqual({ ok: true })
    expect(await studio.setClipMask(['torso'])).toEqual({ ok: true })
    expect(await studio.setMarker('contact', 0.2)).toEqual({ ok: true })
    const clip = studio.content().clips.find((entry) => entry.id === 'roll')?.value
    expect([clip?.length, clip?.loop, clip?.mask, clip?.markers]).toEqual([
      0.5,
      'loop',
      ['torso'],
      { contact: 0.2 },
    ])
  })
})

describe('pose handles beyond a drag', () => {
  it('turns the chest and removes a handle, each one step', async () => {
    const studio = await open()
    studio.view.select('pose', 'stand')
    expect(await studio.setHandleTurn('chest', [6, 0, 0])).toEqual({ ok: true })
    expect(studio.content().poses.find((entry) => entry.id === 'stand')?.value?.effectors.chest?.rot).toEqual(
      [6, 0, 0],
    )
    expect(await studio.removeHandle('chest')).toEqual({ ok: true })
    expect(
      studio.content().poses.find((entry) => entry.id === 'stand')?.value?.effectors.chest,
    ).toBeUndefined()
    expect(studio.session.history.undoLabel).toBe('Remove chest of stand')
  })
})
